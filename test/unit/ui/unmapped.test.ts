import { describe, it, expect, mock, beforeEach } from "bun:test";

// ============================================================================
// Mocks (mutable-factory pattern so module-load-time mocks pick up later values)
//
// We intentionally DO NOT mock src/api/terminology-suggest here — mock.module
// is process-wide in Bun, and mocking terminology-suggest would leak into
// terminology-suggest.test.ts. Instead, we mock aidboxFetch URL-aware: Task
// queries return the staged task list, and ValueSet/$expand calls (used by
// the real searchLoincCodes inside suggestCodes) return the staged LOINC rows.
// ============================================================================

type BundleEntry = { resource: unknown };
let mockTaskEntries: BundleEntry[] = [];
let mockLoincRows: { code: string; display: string }[] = [];
let mockIncomingMessages: BundleEntry[] = [];

mock.module("../../../src/aidbox", () => ({
  aidboxFetch: async (path: string) => {
    if (path.includes("/fhir/ValueSet/$expand")) {
      return {
        resourceType: "ValueSet",
        expansion: {
          contains: mockLoincRows.map((r) => ({
            code: r.code,
            display: r.display,
          })),
        },
      };
    }
    // getQueueEntries now queries BOTH Tasks (for the list of unique
    // unmapped codes) and IncomingHL7v2Messages (for the per-entry
    // message count, since Task IDs are deterministic).
    if (path.includes("/fhir/IncomingHL7v2Message")) {
      return { resourceType: "Bundle", entry: mockIncomingMessages };
    }
    // Default: Task query.
    return { resourceType: "Bundle", entry: mockTaskEntries };
  },
}));

// Intentionally NOT mocking src/ui/shell or src/ui/shared — they are process-
// wide in Bun and would leak into other test files. The partial handlers under
// test here only use htmlResponse (simple Response wrapper) which works fine
// against the real implementation.

const {
  getQueueEntries,
  renderQueuePartial,
  renderEditorPartial,
  handleUnmappedQueuePartial,
  handleUnmappedEditorPartial,
} = await import("../../../src/ui/pages/unmapped");

// ============================================================================
// Helpers
// ============================================================================

function makeTask(
  id: string,
  localCode: string,
  sender: string,
  field: string,
  display: string,
): BundleEntry {
  return {
    resource: {
      id,
      resourceType: "Task",
      status: "requested",
      input: [
        { type: { text: "Local code" }, valueString: localCode },
        { type: { text: "Sending application" }, valueString: sender },
        { type: { text: "Field" }, valueString: field },
        { type: { text: "Local display" }, valueString: display },
      ],
    },
  };
}

// ============================================================================
// getQueueEntries — grouping logic
// ============================================================================

describe("getQueueEntries", () => {
  beforeEach(() => {
    mockTaskEntries = [];
    mockIncomingMessages = [];
  });

  it("returns empty array when no tasks", async () => {
    const entries = await getQueueEntries();
    expect(entries).toEqual([]);
  });

  it("counts waiting messages per (localCode, sender) pair", async () => {
    // Aidbox dedupes Tasks by ID, so duplicate code-mapping failures
    // land on the SAME Task. The visible "N msg" count must come from
    // the IncomingHL7v2Message side — how many messages are waiting.
    mockTaskEntries = [
      makeTask("t1", "GLUC", "LAB_SYS", "OBX-3", "Glucose"),
    ];
    mockIncomingMessages = [
      {
        resource: {
          id: "m1",
          resourceType: "IncomingHL7v2Message",
          status: "code_mapping_error",
          sendingApplication: "LAB_SYS",
          unmappedCodes: [{ localCode: "GLUC", localSystem: "LOCAL" }],
        },
      },
      {
        resource: {
          id: "m2",
          resourceType: "IncomingHL7v2Message",
          status: "code_mapping_error",
          sendingApplication: "LAB_SYS",
          unmappedCodes: [{ localCode: "GLUC", localSystem: "LOCAL" }],
        },
      },
      {
        resource: {
          id: "m3",
          resourceType: "IncomingHL7v2Message",
          status: "code_mapping_error",
          sendingApplication: "LAB_SYS",
          unmappedCodes: [{ localCode: "GLUC", localSystem: "LOCAL" }],
        },
      },
    ];
    const entries = await getQueueEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.count).toBe(3);
    expect(entries[0]!.localCode).toBe("GLUC");
    expect(entries[0]!.taskId).toBe("t1");
  });

  it("falls back to count=1 when a Task exists but no matching messages are found", async () => {
    mockTaskEntries = [makeTask("t1", "GLUC", "LAB_SYS", "OBX-3", "Glucose")];
    mockIncomingMessages = [];
    const entries = await getQueueEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.count).toBe(1);
  });

  it("creates separate entries for different localCodes", async () => {
    mockTaskEntries = [
      makeTask("t1", "GLUC", "LAB_SYS", "OBX-3", "Glucose"),
      makeTask("t2", "HGB", "LAB_SYS", "OBX-3", "Hemoglobin"),
    ];
    const entries = await getQueueEntries();
    expect(entries).toHaveLength(2);
    const codes = entries.map((e) => e.localCode).sort();
    expect(codes).toEqual(["GLUC", "HGB"]);
  });

  it("creates separate entries for same code from different senders", async () => {
    mockTaskEntries = [
      makeTask("t1", "GLUC", "LAB_A", "OBX-3", "Glucose"),
      makeTask("t2", "GLUC", "LAB_B", "OBX-3", "Glucose"),
    ];
    const entries = await getQueueEntries();
    expect(entries).toHaveLength(2);
    const senders = entries.map((e) => e.sender).sort();
    expect(senders).toEqual(["LAB_A", "LAB_B"]);
  });

  it("skips tasks with no localCode", async () => {
    mockTaskEntries = [
      {
        resource: {
          id: "t1",
          resourceType: "Task",
          status: "requested",
          input: [{ type: { text: "Sending application" }, valueString: "LAB" }],
        },
      },
    ];
    const entries = await getQueueEntries();
    expect(entries).toHaveLength(0);
  });

  it("uses localCode as display fallback when Local display is absent", async () => {
    mockTaskEntries = [
      {
        resource: {
          id: "t1",
          resourceType: "Task",
          status: "requested",
          input: [
            { type: { text: "Local code" }, valueString: "XYZ" },
            { type: { text: "Sending application" }, valueString: "SYS" },
          ],
        },
      },
    ];
    const entries = await getQueueEntries();
    expect(entries[0]!.display).toBe("XYZ");
  });
});

// ============================================================================
// renderQueuePartial
// ============================================================================

describe("renderQueuePartial", () => {
  it("shows count and total message count in card header", () => {
    const entries = [
      { taskId: "t1", localCode: "GLUC", sender: "LAB", field: "OBX-3", display: "Glucose", count: 3 },
      { taskId: "t2", localCode: "HGB", sender: "LAB", field: "OBX-3", display: "Hemoglobin", count: 2 },
    ];
    const html = renderQueuePartial(entries, undefined, undefined);
    expect(html).toContain("2 codes");
    expect(html).toContain("5 msg");
  });

  it("shows empty state when no entries", () => {
    const html = renderQueuePartial([], undefined, undefined);
    expect(html).toContain("No unmapped codes");
  });

  it("marks selected entry with accent border", () => {
    const entries = [
      { taskId: "t1", localCode: "GLUC", sender: "LAB", field: "OBX-3", display: "Glucose", count: 1 },
    ];
    const html = renderQueuePartial(entries, "GLUC", "LAB");
    expect(html).toContain("border-l-accent");
  });

  it("unselected entries use transparent border", () => {
    const entries = [
      { taskId: "t1", localCode: "GLUC", sender: "LAB", field: "OBX-3", display: "Glucose", count: 1 },
    ];
    const html = renderQueuePartial(entries, "OTHER", "LAB");
    expect(html).toContain("border-l-transparent");
  });

  it("links use encodeURIComponent on localCode with special chars", () => {
    const entries = [
      { taskId: "t1", localCode: "UNKNOWN^TEST", sender: "SYS", field: "", display: "X", count: 1 },
    ];
    const html = renderQueuePartial(entries, undefined, undefined);
    expect(html).toContain("UNKNOWN%5ETEST");
  });

  it("includes hx-get for 15s auto-refresh on queue container", () => {
    const html = renderQueuePartial([], undefined, undefined);
    expect(html).toContain('hx-get="/unmapped-codes/partials/queue"');
    expect(html).toContain('hx-trigger="every 15s"');
  });
});

// ============================================================================
// renderEditorPartial
// ============================================================================

describe("renderEditorPartial", () => {
  const entry = {
    taskId: "t99",
    localCode: "GLUC",
    sender: "LAB_SYS",
    field: "OBX-3",
    display: "Glucose",
    count: 2,
  };

  const suggestions: { code: string; display: string; score: number; system: "LOINC" }[] = [
    { code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma", score: 100, system: "LOINC" },
    { code: "1234-5", display: "Glucose [Moles/volume] in Serum", score: 70, system: "LOINC" },
  ];

  it("renders the localCode and display in the header", async () => {
    const html = await renderEditorPartial(entry, suggestions);
    expect(html).toContain("GLUC");
    expect(html).toContain("Glucose");
    expect(html).toContain("LAB_SYS");
    expect(html).toContain("OBX-3");
  });

  it("renders suggestion rows with LOINC codes and messages-waiting label", async () => {
    const html = await renderEditorPartial(entry, suggestions);
    expect(html).toContain("2345-7");
    // The messages-waiting label is rendered once in the right-side card.
    expect(html).toContain("messages waiting");
    // Duplicate count from the eyebrow was removed — should NOT appear as "N waiting".
    expect(html).not.toContain("· 2 waiting");
  });

  it("Skip button has x-on:click with navigation and NO hx-* attributes", async () => {
    const html = await renderEditorPartial(entry, suggestions);
    const skipButtonMatch = html.match(/<button[^>]*>Skip<\/button>/s);
    expect(skipButtonMatch).not.toBeNull();
    const skipButton = skipButtonMatch![0];
    // Alpine click handler present
    expect(skipButton).toContain("x-on:click");
    expect(skipButton).toContain("selectedIndex");
    // Actually navigates (fixes the dead-state bug)
    expect(skipButton).toContain("window.location.href");
    expect(skipButton).toContain("/unmapped-codes?code=");
    // No htmx attributes on the Skip button
    expect(skipButton).not.toContain("hx-get");
    expect(skipButton).not.toContain("hx-post");
    expect(skipButton).not.toContain("hx-put");
    expect(skipButton).not.toContain("hx-delete");
    expect(skipButton).not.toContain("hx-trigger");
  });

  it("Save form submits to /api/mapping/tasks/:taskId/resolve with resolvedCode + resolvedDisplay hidden inputs", async () => {
    const html = await renderEditorPartial(entry, suggestions);
    expect(html).toContain(`action="/api/mapping/tasks/t99/resolve"`);
    expect(html).toContain("Save mapping");
    // Hidden fields that carry the Alpine `picked` state into the form submit.
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="resolvedCode"[^>]*:value="picked\.code"/);
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="resolvedDisplay"[^>]*:value="picked\.display"/);
  });

  it("initializes Alpine picked state with the top suggestion so Save works by default", async () => {
    const html = await renderEditorPartial(entry, suggestions);
    // Top suggestion code and display should be baked into x-data picked state.
    // JSON is HTML-escaped so `"` doesn't break the surrounding single-quoted
    // attribute (browsers decode `&quot;` back before Alpine reads).
    expect(html).toContain("x-data='{ picked: {&quot;code&quot;:&quot;2345-7&quot;,&quot;display&quot;:&quot;Glucose [Mass/volume] in Serum or Plasma&quot;}");
  });

  it("initializes picked with empty code when there are no suggestions (Save disabled)", async () => {
    const html = await renderEditorPartial(entry, []);
    expect(html).toContain("x-data='{ picked: {&quot;code&quot;:&quot;&quot;,&quot;display&quot;:&quot;&quot;}");
    // Save button should have :disabled binding on picked.code
    expect(html).toMatch(/:disabled="!picked\.code"/);
  });

  it("manual-search input wires into Alpine picked state, clearing display", async () => {
    const html = await renderEditorPartial(entry, suggestions);
    // Manual-search input drives Alpine `picked` — the expression lives in a
    // double-quoted attribute so single-quoted string literals inside are
    // fine as written.
    expect(html).toContain("x-on:input=\"picked = { code: $event.target.value, display: '' }");
  });

  it("suggestion rows carry a radio input that updates Alpine picked on change", async () => {
    const html = await renderEditorPartial(entry, suggestions);
    // Each LOINC row is an interactive <label> around a radio input. The
    // labels use single-quoted attrs (to avoid collision with the JSON
    // double-quotes), so match on `class='grid`.
    const labelCount = (html.match(/<label[^>]*class='grid[^>]*grid-template-columns/gs) ?? []).length;
    expect(labelCount).toBe(suggestions.length);
    // Radio change rebinds picked — JSON is HTML-escaped so `"` becomes
    // `&quot;` in the rendered attribute.
    expect(html).toContain("x-on:change='picked = { code: &quot;2345-7&quot;, display: &quot;Glucose [Mass/volume] in Serum or Plasma&quot; }'");
  });

  it("shows empty-suggestions message when no suggestions returned", async () => {
    const html = await renderEditorPartial(entry, []);
    expect(html).toContain("No strong suggestions");
  });

  it("URL-encodes localCode with ^ in any hx-get / href / form-action context", async () => {
    const entryWithCaret = { ...entry, localCode: "UNKNOWN^TEST" };
    const html = await renderEditorPartial(entryWithCaret, []);
    expect(html).not.toMatch(/hx-get="[^"]*\^[^"]*"/);
    expect(html).not.toMatch(/href="[^"]*\^[^"]*"/);
    expect(html).not.toMatch(/action="[^"]*\^[^"]*"/);
  });
});

// ============================================================================
// handleUnmappedQueuePartial handler
// ============================================================================

describe("handleUnmappedQueuePartial", () => {
  beforeEach(() => {
    mockTaskEntries = [];
  });

  it("returns 200 with queue HTML", async () => {
    const req = new Request("http://localhost/unmapped-codes/partials/queue");
    const res = await handleUnmappedQueuePartial(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("unmapped-queue");
  });

  it("passes code+sender params through to queue highlight", async () => {
    mockTaskEntries = [makeTask("t1", "GLUC", "LAB", "OBX-3", "Glucose")];
    const req = new Request("http://localhost/unmapped-codes/partials/queue?code=GLUC&sender=LAB");
    const res = await handleUnmappedQueuePartial(req);
    const text = await res.text();
    expect(text).toContain("border-l-accent");
  });
});

// ============================================================================
// handleUnmappedEditorPartial handler
// ============================================================================

describe("handleUnmappedEditorPartial", () => {
  beforeEach(() => {
    mockTaskEntries = [];
    mockLoincRows = [];
  });

  it("returns 400 when code param is missing", async () => {
    const req = new Request("http://localhost/unmapped-codes//partials/editor");
    Object.defineProperty(req, "params", { value: {}, writable: false });
    const res = await handleUnmappedEditorPartial(req);
    expect(res.status).toBe(400);
  });

  it("returns empty editor when code not found in queue", async () => {
    const req = new Request("http://localhost/unmapped-codes/NOTFOUND/partials/editor?sender=LAB");
    Object.defineProperty(req, "params", { value: { code: "NOTFOUND" }, writable: false });
    const res = await handleUnmappedEditorPartial(req);
    const text = await res.text();
    expect(text).toContain("Select a code");
  });

  it("returns editor HTML with suggestions when code found", async () => {
    mockTaskEntries = [makeTask("t1", "GLUC", "LAB", "OBX-3", "Glucose")];
    mockLoincRows = [
      { code: "2345-7", display: "Glucose [Mass/volume]" },
    ];
    const req = new Request("http://localhost/unmapped-codes/GLUC/partials/editor?sender=LAB");
    Object.defineProperty(req, "params", { value: { code: "GLUC" }, writable: false });
    const res = await handleUnmappedEditorPartial(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("unmapped-editor");
    expect(text).toContain("2345-7");
  });

  it("round-trips a ^-containing localCode via decodeURIComponent", async () => {
    const rawCode = "UNKNOWN%5ETEST"; // URL-encoded ^
    mockTaskEntries = [makeTask("t1", "UNKNOWN^TEST", "SYS", "OBX-3", "Unknown Test")];
    const req = new Request(
      `http://localhost/unmapped-codes/${rawCode}/partials/editor?sender=SYS`,
    );
    Object.defineProperty(req, "params", { value: { code: rawCode }, writable: false });
    const res = await handleUnmappedEditorPartial(req);
    const text = await res.text();
    // Decoded: UNKNOWN^TEST — should appear in editor
    expect(text).toContain("UNKNOWN^TEST");
    expect(text).not.toContain("Select a code"); // editor rendered, not empty-state
  });
});

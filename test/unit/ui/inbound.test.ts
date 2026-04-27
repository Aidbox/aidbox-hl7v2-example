import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";

let mockedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
let fetchPaths: string[] = [];

mock.module("../../../src/aidbox", () => ({
  aidboxFetch: (path: string, init?: RequestInit) => {
    fetchPaths.push(path);
    return mockedFetch(path, init);
  },
  getResources: async () => [],
  putResource: async () => ({}),
}));

const {
  statusToTone,
  displayMessageType,
  getInboundList,
  getTypeChipCounts,
  renderTypeChipsPartial,
  renderListPartial,
  renderRowStatusCell,
  handleInboundListPartial,
  handleInboundTypeChipsPartial,
  handleInboundRowStatusPartial,
  handleInboundMessagesPage,
} = await import("../../../src/ui/pages/inbound");

const { parseIncomingMessage, toMessageId, assertNever } = await import(
  "../../../src/ui/domain/incoming-message"
);
type ParsedIncomingMessage =
  import("../../../src/ui/domain/incoming-message").ParsedIncomingMessage;

function bundle(total: number | undefined, entries: unknown[] = []): unknown {
  return { resourceType: "Bundle", total, entry: entries };
}

/**
 * Test fixture. By default returns a *wire-shaped* record so handler
 * tests (which feed data through `aidboxFetch` mocks) work unchanged.
 * For readers that now take `ParsedIncomingMessage` directly, wrap in
 * `parsed(...)` — see below.
 */
function msg(over: Record<string, unknown> = {}): unknown {
  return {
    resourceType: "IncomingHL7v2Message",
    id: over.id ?? "msg-1",
    type: over.type ?? "ORU^R01",
    status: over.status ?? "processed",
    sendingApplication: over.sendingApplication ?? "ACME_LAB",
    date: over.date ?? "2026-04-23T12:00:00Z",
    meta: over.meta ?? { lastUpdated: "2026-04-23T12:00:01Z" },
    message: over.message ?? "MSH|^~\\&|TEST|TEST|DEST|DEST|20260423120000||ORU^R01|1|P|2.5.1",
    ...over,
  };
}

/**
 * Construct a valid `ParsedIncomingMessage` variant directly. Each
 * status maps to a variant; `unmappedCodes` for `code_mapping_error`
 * defaults to one placeholder entry so the parser's non-empty
 * invariant holds.
 */
type ParsedOverrides = {
  status?: string; id?: string; type?: string; sendingApplication?: string;
  error?: string; entries?: unknown[]; unmappedCodes?: unknown[]; message?: string;
};
function parsed(
  over: ParsedOverrides = {},
): ParsedIncomingMessage {
  const wire = msg({
    ...over,
    status: over.status ?? "processed",
    unmappedCodes:
      over.status === "code_mapping_error"
        ? over.unmappedCodes ?? [{ localCode: "UNKNOWN_TEST", mappingTask: { reference: "Task/1" } }]
        : over.unmappedCodes,
  });
  const result = parseIncomingMessage(wire as never);
  if (result.kind === "malformed-wire-record") {
    throw new Error(`parsed() test fixture produced malformed: ${result.reason}`);
  }
  return result;
}

beforeEach(() => {
  fetchPaths = [];
  mockedFetch = async () => bundle(0, []);
});

afterEach(() => {
  fetchPaths = [];
});

// ============================================================================
// statusToTone
// ============================================================================

describe("displayMessageType", () => {
  test("reverses the MLLP listener's first-caret-to-underscore substitution", () => {
    expect(displayMessageType("ADT_A01")).toBe("ADT^A01");
    expect(displayMessageType("ORU_R01")).toBe("ORU^R01");
  });
  test("preserves underscores after the first component (e.g. 3rd-component message-structure id)", () => {
    // Original MSH-9: ADT^A01^ADT_A01 → stored: ADT_A01^ADT_A01
    expect(displayMessageType("ADT_A01^ADT_A01")).toBe("ADT^A01^ADT_A01");
    expect(displayMessageType("VXU_V04^VXU_V04")).toBe("VXU^V04^VXU_V04");
  });
  test("leaves strings without a leading letters-underscore prefix untouched", () => {
    expect(displayMessageType("BAR")).toBe("BAR");
    expect(displayMessageType("—")).toBe("—");
  });
});

describe("statusToTone", () => {
  test("maps processed + warning to ok", () => {
    expect(statusToTone(parsed({ status: "processed" }))).toBe("ok");
    expect(statusToTone(parsed({ status: "warning", error: "gap" }))).toBe("ok");
  });
  test("maps code_mapping_error to warn", () => {
    expect(statusToTone(parsed({ status: "code_mapping_error" }))).toBe("warn");
  });
  test("maps hard errors to err", () => {
    expect(statusToTone(parsed({ status: "parsing_error", error: "x" }))).toBe("err");
    expect(statusToTone(parsed({ status: "conversion_error", error: "x" }))).toBe("err");
    expect(statusToTone(parsed({ status: "sending_error", error: "x" }))).toBe("err");
  });
  test("maps received to pend, deferred to held", () => {
    // Distinct tones: `received` is animated (worker hasn't picked up yet);
    // `held` is static (operator deferred — terminal until POST /mark-for-retry).
    expect(statusToTone(parsed({ status: "received" }))).toBe("pend");
    expect(statusToTone(parsed({ status: "deferred" }))).toBe("held");
  });
});

describe("sound-typing invariants (compile-time demos)", () => {
  test("processed variant CANNOT be constructed with an `error` field", () => {
    // The type system rejects this construction. The @ts-expect-error
    // must live directly above the line that actually errors — if the
    // type ever loosens and stops rejecting this, the directive itself
    // becomes unused and the test file fails to compile.
    const nonsense: ParsedIncomingMessage = {
      id: toMessageId("x"),
      type: "ORU^R01",
      date: "2026-04-23T12:00:00Z",
      sendingApplication: "T",
      lastUpdated: "2026-04-23T12:00:01Z",
      rawMessage: "",
      kind: "processed",
      entries: [],
      // @ts-expect-error - "processed" variant has no "error" field
      error: "oops",
    };
    expect(nonsense).toBeDefined();
  });

  test("switch missing a variant fails to typecheck via assertNever", () => {
    function incompleteToneLookup(p: ParsedIncomingMessage): string {
      switch (p.kind) {
        case "received": return "pend";
        case "processed": return "ok";
        default:
          // @ts-expect-error - `p` is not `never`: 6 variants unhandled
          return assertNever(p);
      }
    }
    // Runs at runtime with a handled variant, so no throw.
    expect(incompleteToneLookup(parsed({ status: "processed" }))).toBe("ok");
  });
});

// ============================================================================
// getInboundList — filters translate to FHIR query params
// ============================================================================

describe("getInboundList", () => {
  test("default query sorts by -_lastUpdated with _count=20 (page size)", async () => {
    await getInboundList({});
    expect(fetchPaths[0]).toContain("_sort=-_lastUpdated");
    expect(fetchPaths[0]).toContain("_count=20");
    expect(fetchPaths[0]).not.toContain("type=");
    expect(fetchPaths[0]).not.toContain("status=");
  });

  test("URL-encodes type filter (ORU^R01 → ORU%5ER01)", async () => {
    await getInboundList({ type: "ORU^R01" });
    expect(fetchPaths[0]).toContain("type=ORU%5ER01");
  });

  test("pseudo-status 'errors' expands to 4 hard-error statuses", async () => {
    await getInboundList({ status: "errors" });
    expect(fetchPaths[0]).toContain(
      "status=parsing_error,conversion_error,code_mapping_error,sending_error",
    );
  });

  test("regular status passes through encoded", async () => {
    await getInboundList({ status: "processed" });
    expect(fetchPaths[0]).toContain("status=processed");
    expect(fetchPaths[0]).not.toContain(
      "parsing_error,conversion_error,code_mapping_error",
    );
  });

  test("batch filter URL-encoded", async () => {
    await getInboundList({ batch: "import 2026-04-23" });
    expect(fetchPaths[0]).toContain(
      "batch-tag=import%202026-04-23",
    );
  });
});

// ============================================================================
// getTypeChipCounts — in-memory aggregation
// ============================================================================

describe("getTypeChipCounts", () => {
  test("scans _count=500 and groups by type with an 'errors' pseudo-chip", async () => {
    mockedFetch = async () =>
      bundle(0, [
        { resource: msg({ type: "ORU^R01", status: "processed" }) },
        { resource: msg({ type: "ORU^R01", status: "processed" }) },
        { resource: msg({ type: "ADT^A01", status: "processed" }) },
        { resource: msg({ type: "ADT^A01", status: "code_mapping_error" }) },
        { resource: msg({ type: "VXU^V04", status: "parsing_error" }) },
      ]);

    const chips = await getTypeChipCounts();
    expect(fetchPaths[0]).toContain("_count=500");

    const byLabel = Object.fromEntries(chips.map((c) => [c.label, c]));
    expect(byLabel.All?.count).toBe(5);
    expect(byLabel["ORU^R01"]?.count).toBe(2);
    expect(byLabel["ADT^A01"]?.count).toBe(2);
    expect(byLabel["VXU^V04"]?.count).toBe(1);
    expect(byLabel.errors?.count).toBe(2); // code_mapping_error + parsing_error
    expect(byLabel.errors?.tone).toBe("err");
  });

  test("errors aggregates all 4 hard-error statuses", async () => {
    mockedFetch = async () =>
      bundle(0, [
        { resource: msg({ status: "parsing_error" }) },
        { resource: msg({ status: "conversion_error" }) },
        { resource: msg({ status: "code_mapping_error" }) },
        { resource: msg({ status: "sending_error" }) },
        { resource: msg({ status: "processed" }) },
      ]);
    const chips = await getTypeChipCounts();
    const errors = chips.find((c) => c.label === "errors");
    expect(errors?.count).toBe(4);
  });

  test("empty bundle → only All + errors (both zero)", async () => {
    mockedFetch = async () => bundle(0, []);
    const chips = await getTypeChipCounts();
    expect(chips.map((c) => c.label)).toEqual(["All", "errors"]);
    expect(chips.every((c) => c.count === 0)).toBe(true);
  });

  test("type buckets sorted by descending count", async () => {
    mockedFetch = async () =>
      bundle(0, [
        { resource: msg({ type: "A", status: "processed" }) },
        { resource: msg({ type: "B", status: "processed" }) },
        { resource: msg({ type: "B", status: "processed" }) },
        { resource: msg({ type: "C", status: "processed" }) },
        { resource: msg({ type: "C", status: "processed" }) },
        { resource: msg({ type: "C", status: "processed" }) },
      ]);
    const chips = await getTypeChipCounts();
    // Drop "All" (first) and "errors" (last), expect C, B, A.
    const middle = chips.slice(1, -1).map((c) => c.label);
    expect(middle).toEqual(["C", "B", "A"]);
  });
});

// ============================================================================
// renderTypeChipsPartial
// ============================================================================

describe("renderTypeChipsPartial", () => {
  const chips = [
    { label: "All", value: "", count: 10, tone: "accent" as const },
    { label: "ORU^R01", value: "ORU^R01", count: 5 },
    { label: "ADT^A01", value: "ADT^A01", count: 3 },
    { label: "errors", value: "", count: 2, tone: "err" as const },
  ];

  test("renders auto-refresh trigger (every 10s)", () => {
    const html = renderTypeChipsPartial(chips, undefined, {});
    expect(html).toContain('hx-trigger="every 10s"');
    expect(html).toContain('hx-get="/incoming-messages/partials/type-chips"');
  });

  test("marks active type chip with chip-accent when type filter matches", () => {
    const html = renderTypeChipsPartial(chips, "ORU^R01", { type: "ORU^R01" });
    // The ORU^R01 chip should carry chip-accent; ADT^A01 should not.
    expect(html).toMatch(/chip chip-accent[^>]*>ORU\^R01/);
    expect(html).not.toMatch(/chip chip-accent[^>]*>ADT\^A01/);
  });

  test("marks All as active when no type filter present", () => {
    const html = renderTypeChipsPartial(chips, undefined, {});
    expect(html).toMatch(/chip chip-accent[^>]*>All/);
  });

  test("errors chip carries chip-err tone regardless of selection", () => {
    const html = renderTypeChipsPartial(chips, undefined, {});
    expect(html).toMatch(/chip chip-err[^>]*>errors/);
  });

  test("errors chip's href sets ?status=errors", () => {
    const html = renderTypeChipsPartial(chips, undefined, {});
    expect(html).toContain('href="?status=errors"');
  });

  test("All chip's href clears type + status", () => {
    const html = renderTypeChipsPartial(chips, "ORU^R01", {
      type: "ORU^R01",
      batch: "tag-1",
    });
    // All should link to URL that preserves batch but drops type + status.
    const allMatch = html.match(/href="([^"]*)"[^>]*>All/);
    expect(allMatch).not.toBeNull();
    const href = allMatch![1]!;
    expect(href).toContain("batch=tag-1");
    expect(href).not.toContain("type=");
    expect(href).not.toContain("status=");
  });
});

// ============================================================================
// renderListPartial
// ============================================================================

describe("renderListPartial", () => {
  test("does NOT poll the whole list — list is a snapshot; per-row status cells own their own polling", () => {
    const html = renderListPartial([], {});
    expect(html).not.toContain("setInterval");
    expect(html).toContain("All messages");
    expect(html).toContain("No messages match these filters.");
    // The Replay flow still needs a one-shot refresh when a user hits
    // "Replay" on a detail pane — that listener stays.
    expect(html).toContain("message-replayed.window");
  });

  test("marks data-has-selection=true when a row is selected", () => {
    const html = renderListPartial([], { selected: "abc" });
    expect(html).toContain('data-has-selection="true"');
    const htmlFalse = renderListPartial([], {});
    expect(htmlFalse).toContain('data-has-selection="false"');
  });

  test("renders each message as a row with status chip + dot tone", () => {
    const html = renderListPartial(
      [
        parsed({ id: "a", type: "ORU^R01", status: "processed" }),
        parsed({ id: "b", type: "ORU^R01", status: "code_mapping_error" }),
        parsed({ id: "c", type: "ADT^A01", status: "parsing_error", error: "bad" }),
      ],
      {},
    );
    expect(html).toMatch(/chip-ok[^>]*>processed/);
    expect(html).toMatch(/chip-warn[^>]*>needs mapping/);
    expect(html).toMatch(/chip-err[^>]*>error/);
    expect(html).toContain('data-message-id="a"');
    expect(html).toContain('data-message-id="b"');
  });

  test("row wires htmx to detail endpoint + pushes ?selected", () => {
    const html = renderListPartial(
      [parsed({ id: "abc-123", type: "ORU^R01" })],
      {},
    );
    expect(html).toContain(
      'hx-get="/incoming-messages/abc-123/partials/detail"',
    );
    expect(html).toContain('hx-target="#detail"');
    expect(html).toContain('hx-push-url="?selected=abc-123"');
  });

  test("URL-encodes message id with special chars in htmx attributes", () => {
    const html = renderListPartial(
      [parsed({ id: "id/with^slash" })],
      {},
    );
    expect(html).toContain("id%2Fwith%5Eslash");
    expect(html).not.toContain("id/with^slash/partials/detail");
  });

  test("selected row gets accent-bar + paper-2 background", () => {
    const html = renderListPartial(
      [parsed({ id: "sel" }), parsed({ id: "other" })],
      { selected: "sel" },
    );
    // Match the selected row's opening div block (ends before the 2nd row's).
    const selRow = html.split("<!--SPLIT-->").join("").match(
      /<div[^>]*data-message-id="sel"[^>]*>/,
    );
    // The selected row's parent container (grid row) has bg-paper-2 on
    // its own attr — we search for the class string within a small
    // window before the data-message-id attribute.
    const before = html.slice(0, html.indexOf('data-message-id="sel"'));
    const lastDiv = before.lastIndexOf("<div");
    const rowAttrs = before.slice(lastDiv);
    expect(rowAttrs).toContain("bg-paper-2");
    expect(rowAttrs).toContain("border-l-accent");
    expect(selRow).not.toBeNull();
  });

  test("title includes filter summary and count", () => {
    const html = renderListPartial(
      [parsed({})],
      { type: "ORU^R01", status: "errors" },
    );
    expect(html).toContain("ORU^R01 · errors (1)");
  });

  test("title normalizes stored MSH-9 underscore form to canonical caret form", () => {
    const html = renderListPartial(
      [parsed({})],
      { type: "ADT_A01^ADT_A01" },
    );
    expect(html).toContain("ADT^A01^ADT_A01 (1)");
  });

  test("row MESSAGE column is empty for processed rows (redundant with status chip)", () => {
    const html = renderListPartial(
      [parsed({ id: "r1", status: "processed" })],
      {},
    );
    // Match the MESSAGE-column span directly: the note span has the
    // distinctive `min-w-0 overflow-hidden text-ellipsis` class combo.
    // Empty content means `summarize()` returned "".
    expect(html).toMatch(
      /<span class="text-\[13px\] text-ink min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"><\/span>/,
    );
    // The status chip still reads "processed" in its own trailing span.
    expect(html).toMatch(/chip-ok[^>]*>processed/);
  });

  test("row MESSAGE column shows unmapped code detail on code_mapping_error", () => {
    const html = renderListPartial(
      [parsed({
        id: "r2",
        status: "code_mapping_error",
        unmappedCodes: [{ localCode: "UNKNOWN_TEST", mappingTask: { reference: "Task/t" } }],
      })],
      {},
    );
    expect(html).toContain("UNKNOWN_TEST — no mapping");
  });
});

// NOTE: renderDetailPartial lives in inbound-detail.ts as of Task 9;
// its tests moved to inbound-detail.test.ts.

// ============================================================================
// Handlers
// ============================================================================

describe("renderListPartial filter popovers", () => {
  const chips: unknown = [
    { label: "All", value: "", count: 48, tone: "accent" },
    { label: "ORU^R01", value: "ORU^R01", count: 22 },
    { label: "ADT_A01^ADT_A01", value: "ADT_A01^ADT_A01", count: 12 },
    { label: "VXU_V04^VXU_V04", value: "VXU_V04^VXU_V04", count: 11 },
    { label: "errors", value: "", count: 3, tone: "err" },
  ];

  test("renders type filter popover with an 'All types' clear link + one row per type", () => {
    const html = renderListPartial([], {}, 0, chips as never);
    expect(html).toContain("All types");
    // The popover lists each real type — 'errors' and 'All' are not types
    expect(html).toContain("ORU^R01");
    expect(html).toContain("ADT^A01^ADT_A01"); // displayMessageType normalizes underscore→caret
    expect(html).toContain("VXU^V04^VXU_V04");
  });

  test("type filter link URLs carry the type param (server-side filtering)", () => {
    const html = renderListPartial([], {}, 0, chips as never);
    expect(html).toContain("href=\"/incoming-messages?type=ORU%5ER01\"");
  });

  test("'All types' link has no type param (clears filter)", () => {
    const html = renderListPartial([], { type: "ORU^R01" }, 0, chips as never);
    // The 'All types' link is a bare href — preserves other filters if present.
    expect(html).toContain("href=\"/incoming-messages\"");
  });

  test("type filter icon gets accent-soft background when a type is active", () => {
    const active = renderListPartial([], { type: "ORU^R01" }, 0, chips as never);
    const inactive = renderListPartial([], {}, 0, chips as never);
    // Active filter → bg-accent-soft; inactive → bg-transparent.
    expect(active).toContain("bg-accent-soft");
    expect(inactive).not.toContain("bg-accent-soft");
  });

  test("status filter popover offers 'Any status' + 'Errors only'", () => {
    const html = renderListPartial([], {}, 0, chips as never);
    expect(html).toContain("Any status");
    expect(html).toContain("Errors only");
    expect(html).toContain("href=\"/incoming-messages?status=errors\"");
  });

  test("status filter link preserves existing type filter", () => {
    const html = renderListPartial([], { type: "ORU^R01" }, 0, chips as never);
    expect(html).toContain("href=\"/incoming-messages?type=ORU%5ER01&amp;status=errors\"");
  });

  test("filter popovers are scoped Alpine x-data (isolated open state)", () => {
    const html = renderListPartial([], {}, 0, chips as never);
    // Each popover has its own x-data="{ open: false }" scope so clicking
    // TYPE doesn't open STATUS (and vice versa).
    const matches = html.match(/x-data="\{ open: false \}"/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("renderListPartial pager", () => {
  test("shows N–M of T counter when messages exist", () => {
    const html = renderListPartial(
      [parsed({ id: "a" })],
      {},
      3,
    );
    expect(html).toContain("1–1 of 3");
  });

  test("omits pager buttons when total fits in one page", () => {
    const html = renderListPartial(
      [parsed({ id: "a" })],
      {},
      20,
    );
    expect(html).toContain("1–1 of 20");
    expect(html).not.toContain("Prev");
    expect(html).not.toContain("Next");
  });

  test("shows Prev/Next when total exceeds one page", () => {
    const msgs = Array.from({ length: 20 }, (_, i) => parsed({ id: `m${i}` }));
    const html = renderListPartial(msgs, {}, 50);
    expect(html).toContain("1–20 of 50");
    expect(html).toContain("Prev");
    expect(html).toContain("Next");
    // Next link should carry page=2
    expect(html).toContain("page=2");
    // "1 / 3" indicator (50 / 20 = 3 pages)
    expect(html).toContain("1 / 3");
  });

  test("threads filters into pager URLs", () => {
    const msgs = Array.from({ length: 20 }, (_, i) => parsed({ id: `m${i}` }));
    const html = renderListPartial(msgs, { type: "ORU^R01" }, 50);
    expect(html).toContain("type=ORU");
  });

  test("Prev disabled on first page, Next disabled on last page", () => {
    const msgs = Array.from({ length: 20 }, (_, i) => parsed({ id: `m${i}` }));
    // First page
    const first = renderListPartial(msgs, {}, 50);
    expect(first).toContain("cursor-not-allowed");
    // Last page (page=3 of 50 total, 10 rows shown)
    const lastPage = renderListPartial(msgs.slice(0, 10), { page: 3 }, 50);
    expect(lastPage).toContain("41–50 of 50");
    expect(lastPage).toContain("3 / 3");
    expect(lastPage).toContain("cursor-not-allowed");
  });

  test("omits entire pager when no messages", () => {
    const html = renderListPartial([], {}, 0);
    expect(html).not.toContain("of 0");
    expect(html).toContain("No messages match");
  });
});

describe("buildListQuery pagination", () => {
  test("adds page=N when page > 1", async () => {
    mockedFetch = async () => bundle(0, []);
    await getInboundList({ page: 3 });
    expect(fetchPaths.at(-1)).toContain("page=3");
  });

  test("omits page param on first page", async () => {
    mockedFetch = async () => bundle(0, []);
    await getInboundList({});
    expect(fetchPaths.at(-1)).not.toMatch(/[?&]page=/);
  });

  test("does NOT send HAPI's _getpagesoffset (Aidbox rejects it)", async () => {
    mockedFetch = async () => bundle(0, []);
    await getInboundList({ page: 2 });
    expect(fetchPaths.at(-1)).not.toContain("_getpagesoffset");
  });

  test("always requests _total=accurate so the pager can show T", async () => {
    mockedFetch = async () => bundle(0, []);
    await getInboundList({});
    expect(fetchPaths.at(-1)).toContain("_total=accurate");
  });
});

describe("handleInboundListPartial", () => {
  test("returns list partial with html content-type", async () => {
    mockedFetch = async () =>
      bundle(0, [{ resource: msg({ id: "x", type: "ORU^R01" }) }]);
    const res = await handleInboundListPartial(
      new Request("http://localhost/incoming-messages/partials/list"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain('id="inbound-list"');
  });

  test("threads type filter into the FHIR query", async () => {
    mockedFetch = async () => bundle(0, []);
    await handleInboundListPartial(
      new Request(
        "http://localhost/incoming-messages/partials/list?type=ADT%5EA01",
      ),
    );
    // handleInboundListPartial now also fetches chip counts in parallel
    // (so the filter popover has up-to-date numbers on refresh), so the
    // type-filtered request isn't guaranteed to be last. Assert it
    // happened at all.
    expect(fetchPaths.some((p) => p.includes("type=ADT%5EA01"))).toBe(true);
  });
});

describe("renderRowStatusCell", () => {
  test("non-terminal status (received) emits Alpine setInterval self-poll", () => {
    const html = renderRowStatusCell(parsed({ id: "abc-123", status: "received" }) as never);
    expect(html).toContain('id="status-abc-123"');
    // Alpine-driven poll (not hx-trigger="every Xs" — that fires once
    // then stops after outerHTML swap replaces the element).
    expect(html).toContain("x-data");
    expect(html).toContain("setInterval");
    expect(html).toContain("/incoming-messages/abc-123/partials/status");
    expect(html).toContain("outerHTML");
    // Self-cleans when row leaves the DOM (e.g. pager moves to next page).
    expect(html).toContain("isConnected");
    expect(html).toContain("processing");
  });

  test("terminal status (processed) renders plain chip with NO polling", () => {
    const html = renderRowStatusCell(parsed({ id: "abc-123", status: "processed" }) as never);
    expect(html).toContain('id="status-abc-123"');
    expect(html).not.toContain("setInterval");
    expect(html).not.toContain("x-data");
    expect(html).toContain("processed");
  });

  test("terminal error statuses do not poll", () => {
    for (const s of ["parsing_error", "conversion_error", "code_mapping_error", "sending_error", "warning", "deferred"]) {
      const html = renderRowStatusCell(
        parsed({ id: "e", status: s, error: "x" }),
      );
      expect(html, `status ${s} should not poll`).not.toContain("setInterval");
    }
  });

  test("URL-encodes ids with special characters", () => {
    const html = renderRowStatusCell(parsed({ id: "id/with?slash", status: "received" }) as never);
    expect(html).toContain("/incoming-messages/id%2Fwith%3Fslash/partials/status");
  });
});

describe("handleInboundRowStatusPartial", () => {
  test("returns terminal cell for processed message (no polling)", async () => {
    mockedFetch = async () => msg({ id: "m1", status: "processed" });
    const res = await handleInboundRowStatusPartial("m1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain('id="status-m1"');
    expect(body).not.toContain("hx-trigger");
    expect(body).toContain("processed");
  });

  test("returns polling cell for received message", async () => {
    mockedFetch = async () => msg({ id: "m2", status: "received" });
    const res = await handleInboundRowStatusPartial("m2");
    const body = await res.text();
    // New mechanism: Alpine setInterval (not hx-trigger="every 5s",
    // which doesn't re-arm after outerHTML self-swap).
    expect(body).toContain("setInterval");
    expect(body).toContain("processing");
  });

  test("missing id returns 400", async () => {
    const res = await handleInboundRowStatusPartial("");
    expect(res.status).toBe(400);
  });

  test("Aidbox failure returns a static em-dash cell (stops polling)", async () => {
    mockedFetch = async () => {
      throw new Error("aidbox unreachable");
    };
    const res = await handleInboundRowStatusPartial("m3");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('id="status-m3"');
    expect(body).not.toContain("hx-trigger");
    expect(body).toContain("—");
  });
});

describe("handleInboundTypeChipsPartial", () => {
  test("returns chips with current type selection highlighted", async () => {
    mockedFetch = async () =>
      bundle(0, [{ resource: msg({ type: "ORU^R01", status: "processed" }) }]);
    const res = await handleInboundTypeChipsPartial(
      new Request(
        "http://localhost/incoming-messages/partials/type-chips?type=ORU%5ER01",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/chip chip-accent[^>]*>ORU\^R01/);
  });
});

describe("handleInboundMessagesPage", () => {
  test("full-page load pre-renders detail when ?selected is set", async () => {
    mockedFetch = async (path) => {
      // The list / chips / count queries all return bundles; the
      // /IncomingHL7v2Message/<id> direct fetch returns the resource.
      if (path.startsWith("/fhir/IncomingHL7v2Message/")) {
        return msg({ id: "sel-1", type: "ADT^A01", status: "processed" });
      }
      return bundle(0, []);
    };
    const res = await handleInboundMessagesPage(
      new Request("http://localhost/incoming-messages?selected=sel-1"),
    );
    const body = await res.text();
    expect(body).toContain('id="detail"');
    expect(body).toContain("ADT^A01");
    // Should NOT render the empty-state card.
    expect(body).not.toContain("Pick a row from the list to see its details");
  });

  test("no selection renders the empty-state detail card", async () => {
    mockedFetch = async () => bundle(0, []);
    const res = await handleInboundMessagesPage(
      new Request("http://localhost/incoming-messages"),
    );
    const body = await res.text();
    expect(body).toContain("Select a message");
    expect(body).toContain("Pick a row from the list");
  });
});

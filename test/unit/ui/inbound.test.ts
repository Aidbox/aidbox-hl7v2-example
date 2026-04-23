import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";

let mockedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
let fetchPaths: string[] = [];

mock.module("../../../src/aidbox", () => ({
  aidboxFetch: (path: string, init?: RequestInit) => {
    fetchPaths.push(path);
    return mockedFetch(path, init);
  },
  getResources: async () => [],
}));

const {
  statusToTone,
  displayMessageType,
  getInboundList,
  getTypeChipCounts,
  renderTypeChipsPartial,
  renderListPartial,
  handleInboundListPartial,
  handleInboundTypeChipsPartial,
  handleInboundMessagesPage,
} = await import("../../../src/ui/pages/inbound");

function bundle(total: number | undefined, entries: unknown[] = []): unknown {
  return { resourceType: "Bundle", total, entry: entries };
}

function msg(over: Record<string, unknown> = {}): unknown {
  return {
    resourceType: "IncomingHL7v2Message",
    id: over.id ?? "msg-1",
    type: over.type ?? "ORU^R01",
    status: over.status ?? "processed",
    sendingApplication: over.sendingApplication ?? "ACME_LAB",
    date: over.date ?? "2026-04-23T12:00:00Z",
    meta: over.meta ?? { lastUpdated: "2026-04-23T12:00:01Z" },
    ...over,
  };
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
    expect(statusToTone("processed")).toBe("ok");
    expect(statusToTone("warning")).toBe("ok");
  });
  test("maps code_mapping_error to warn", () => {
    expect(statusToTone("code_mapping_error")).toBe("warn");
  });
  test("maps hard errors to err", () => {
    expect(statusToTone("parsing_error")).toBe("err");
    expect(statusToTone("conversion_error")).toBe("err");
    expect(statusToTone("sending_error")).toBe("err");
  });
  test("maps received/deferred/undefined to pend", () => {
    expect(statusToTone("received")).toBe("pend");
    expect(statusToTone("deferred")).toBe("pend");
    expect(statusToTone(undefined)).toBe("pend");
  });
});

// ============================================================================
// getInboundList — filters translate to FHIR query params
// ============================================================================

describe("getInboundList", () => {
  test("default query sorts by -_lastUpdated with _count=100", async () => {
    await getInboundList({});
    expect(fetchPaths[0]).toContain("_sort=-_lastUpdated");
    expect(fetchPaths[0]).toContain("_count=100");
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
  test("polls every 5s via Alpine setInterval that skips ticks when detail is populated", () => {
    const html = renderListPartial([], {});
    // Polling is driven by Alpine setInterval + htmx.ajax() rather than
    // hx-trigger/hx-vals. The condition reads `#detail[data-selected]`
    // at tick time — populated detail → skips, empty detail → fires.
    expect(html).toContain("setInterval");
    expect(html).toContain("'/incoming-messages/partials/list'");
    expect(html).toContain("data-selected");
    expect(html).toContain("All messages");
    expect(html).toContain("No messages match these filters.");
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
        msg({ id: "a", type: "ORU^R01", status: "processed" }) as never,
        msg({ id: "b", type: "ORU^R01", status: "code_mapping_error" }) as never,
        msg({ id: "c", type: "ADT^A01", status: "parsing_error" }) as never,
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
      [msg({ id: "abc-123", type: "ORU^R01" }) as never],
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
      [msg({ id: "id/with^slash" }) as never],
      {},
    );
    expect(html).toContain("id%2Fwith%5Eslash");
    expect(html).not.toContain("id/with^slash/partials/detail");
  });

  test("selected row gets accent-bar + paper-2 background", () => {
    const html = renderListPartial(
      [msg({ id: "sel" }) as never, msg({ id: "other" }) as never],
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
      [msg() as never],
      { type: "ORU^R01", status: "errors" },
    );
    expect(html).toContain("ORU^R01 · errors (1)");
  });

  test("title normalizes stored MSH-9 underscore form to canonical caret form", () => {
    const html = renderListPartial(
      [msg() as never],
      { type: "ADT_A01^ADT_A01" },
    );
    expect(html).toContain("ADT^A01^ADT_A01 (1)");
  });

  test("row MESSAGE column is empty for processed rows (redundant with status chip)", () => {
    const html = renderListPartial(
      [msg({ id: "r1", status: "processed" }) as never],
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
      [msg({
        id: "r2",
        status: "code_mapping_error",
        unmappedCodes: [{ localCode: "UNKNOWN_TEST", mappingTask: { reference: "Task/t" } }],
      }) as never],
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
    expect(fetchPaths.at(-1)).toContain("type=ADT%5EA01");
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

import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";

let mockedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
let fetchPaths: string[] = [];
let putCalls: { type: string; id: string }[] = [];

mock.module("../../../src/aidbox", () => ({
  aidboxFetch: (path: string, init?: RequestInit) => {
    fetchPaths.push(path);
    return mockedFetch(path, init);
  },
  putResource: (type: string, id: string, _body: unknown) => {
    putCalls.push({ type, id });
    return Promise.resolve();
  },
}));

const {
  isDetailTab,
  renderStructuredTab,
  renderRawTab,
  renderFhirTab,
  renderTimelineTab,
  collapseHistoryVersions,
  getHistoryVersions,
  renderDetailCard,
  handleInboundDetailPartial,
  handleInboundDetailTabPartial,
  handleMarkForRetry,
} = await import("../../../src/ui/pages/inbound-detail");

function msg(over: Record<string, unknown> = {}): unknown {
  return {
    resourceType: "IncomingHL7v2Message",
    id: over.id ?? "msg-1",
    type: over.type ?? "ORU^R01",
    status: over.status ?? "processed",
    message: over.message ?? "",
    date: over.date ?? "2026-04-23T12:00:00Z",
    meta: over.meta ?? { lastUpdated: "2026-04-23T12:00:01Z" },
    ...over,
  };
}

beforeEach(() => {
  fetchPaths = [];
  putCalls = [];
  mockedFetch = async () => ({ resourceType: "Bundle", entry: [] });
});

afterEach(() => {
  fetchPaths = [];
  putCalls = [];
});

// ============================================================================
// isDetailTab — type guard
// ============================================================================

describe("isDetailTab", () => {
  test("accepts the 4 documented tab keys", () => {
    expect(isDetailTab("structured")).toBe(true);
    expect(isDetailTab("raw")).toBe(true);
    expect(isDetailTab("fhir")).toBe(true);
    expect(isDetailTab("timeline")).toBe(true);
  });
  test("rejects anything else", () => {
    expect(isDetailTab("foo")).toBe(false);
    expect(isDetailTab("")).toBe(false);
    expect(isDetailTab(undefined)).toBe(false);
    expect(isDetailTab(42)).toBe(false);
  });
});

// ============================================================================
// Structured tab
// ============================================================================

const SAMPLE_HL7 = [
  "MSH|^~\\&|LAB|HOSP|EMR|DEST|20260423120000||ORU^R01|MCID1|P|2.5.1",
  "PID|1||TEST-001||Smith^John",
  "OBR|1|ORD1||CBC^Complete Blood Count^L",
  "OBX|1|NM|UNKNOWN_TEST^Unknown Lab^LOCAL||123|units|0-200||||F",
].join("\r");

describe("renderStructuredTab", () => {
  test("renders each segment as a mini-card with segment name chip", () => {
    const html = renderStructuredTab(msg({ message: SAMPLE_HL7 }) as never);
    expect(html).toContain(">MSH<");
    expect(html).toContain(">PID<");
    expect(html).toContain(">OBR<");
    expect(html).toContain(">OBX<");
  });

  test("warn-borders the segment containing the unmapped code", () => {
    const html = renderStructuredTab(
      msg({
        message: SAMPLE_HL7,
        unmappedCodes: [
          { localCode: "UNKNOWN_TEST", mappingTask: { reference: "Task/t" } },
        ],
      }) as never,
    );
    // Warn chip appears only on the flagged segment; it gives us a
    // reliable anchor inside the OBX wrapper.
    expect(html).toContain("contains UNKNOWN_TEST");
    // Parent wrapper for OBX must carry `border-warn` — look at the
    // div immediately preceding `>OBX<`.
    const obxIdx = html.indexOf(">OBX<");
    const wrapperStart = html.lastIndexOf("<div", obxIdx);
    const wrapperOpen = html.slice(wrapperStart, obxIdx);
    expect(wrapperOpen).toContain("border-warn");
  });

  test("does NOT warn-border segments that don't contain the code", () => {
    const html = renderStructuredTab(
      msg({
        message: SAMPLE_HL7,
        unmappedCodes: [
          { localCode: "UNKNOWN_TEST", mappingTask: { reference: "Task/t" } },
        ],
      }) as never,
    );
    // PID doesn't contain UNKNOWN_TEST — its wrapper div should NOT have border-warn.
    const pidIdx = html.indexOf(">PID<");
    const pidWrapperStart = html.lastIndexOf("<div", pidIdx);
    const pidWrapperOpen = html.slice(pidWrapperStart, pidIdx);
    expect(pidWrapperOpen).not.toContain("border-warn");
    expect(pidWrapperOpen).toContain("border-line");
  });

  test("empty-state when message is blank", () => {
    const html = renderStructuredTab(msg({ message: "" }) as never);
    expect(html).toContain("No HL7v2 message stored");
  });

  test("handles LF terminators as well as CR", () => {
    const html = renderStructuredTab(
      msg({ message: SAMPLE_HL7.replace(/\r/g, "\n") }) as never,
    );
    expect(html).toContain(">MSH<");
    expect(html).toContain(">OBX<");
  });
});

// ============================================================================
// Raw tab
// ============================================================================

describe("renderRawTab", () => {
  test("renders the raw HL7v2 through the highlighter", () => {
    const html = renderRawTab(msg({ message: SAMPLE_HL7 }) as never);
    expect(html).toContain("hl7-message-container");
    // The highlighter wraps segment names in markup — check MSH survives.
    expect(html).toContain("MSH");
  });

  test("empty-state when message is blank", () => {
    const html = renderRawTab(msg({ message: "" }) as never);
    expect(html).toContain("No HL7v2 message stored");
  });
});

// ============================================================================
// FHIR tab
// ============================================================================

describe("renderFhirTab", () => {
  test("pretty-prints the entries array", () => {
    const html = renderFhirTab(
      msg({
        entries: [
          { resourceType: "Patient", id: "p1" },
          { resourceType: "Observation", id: "o1" },
        ],
      }) as never,
    );
    // The FHIR tab now runs output through a small JSON syntax highlighter,
    // so keys (accent-ink) and string values (ok = green ink) each land
    // inside classed <span> tags. Assert the span-wrapped shape so a
    // future highlighter change surfaces rather than silently passing.
    expect(html).toContain('<span class="text-accent-ink">&quot;resourceType&quot;</span>: <span class="text-ok">&quot;Patient&quot;</span>');
    expect(html).toContain('<span class="text-accent-ink">&quot;id&quot;</span>: <span class="text-ok">&quot;p1&quot;</span>');
  });

  test("annotates unmapped codings with a warn comment", () => {
    const html = renderFhirTab(
      msg({
        entries: [
          {
            resourceType: "Observation",
            code: { coding: [{ system: "local", code: "UNKNOWN_TEST" }] },
          },
        ],
        unmappedCodes: [
          { localCode: "UNKNOWN_TEST", mappingTask: { reference: "Task/t" } },
        ],
      }) as never,
    );
    expect(html).toContain("⚠ no LOINC mapping");
    expect(html).toContain("text-warn");
  });

  test("does NOT annotate when no unmapped codes", () => {
    const html = renderFhirTab(
      msg({
        entries: [{ resourceType: "Patient", id: "p1" }],
      }) as never,
    );
    expect(html).not.toContain("⚠");
  });

  test("empty-state when entries is absent — different message for error vs queued", () => {
    const errorCase = renderFhirTab(
      msg({ status: "conversion_error", entries: undefined }) as never,
    );
    expect(errorCase).toContain("No FHIR resources attached");
    expect(errorCase).toContain("failed before conversion");

    const queuedCase = renderFhirTab(
      msg({ status: "received", entries: undefined }) as never,
    );
    expect(queuedCase).toContain("Processor hasn't run yet");
  });

  test("empty-state when entries is an empty array", () => {
    const html = renderFhirTab(msg({ entries: [] }) as never);
    expect(html).toContain("No FHIR resources attached");
  });
});

// ============================================================================
// Timeline tab — collapseHistoryVersions + renderTimelineTab
// ============================================================================

describe("collapseHistoryVersions", () => {
  test("drops consecutive versions where status AND error are unchanged", () => {
    const versions = [
      // v3 is a processor re-PUT — same status as v2 (processed), no new info
      { versionId: "3", lastUpdated: "2026-04-23T12:00:03Z", status: "processed" },
      // v2 is the actual transition from received → processed
      { versionId: "2", lastUpdated: "2026-04-23T12:00:02Z", status: "processed" },
      { versionId: "1", lastUpdated: "2026-04-23T12:00:01Z", status: "received" },
    ];
    // Algorithm keeps the FIRST of each run — the transition moment,
    // not the latest re-PUT — because the timestamp of v2 is when
    // "processed" actually happened. v3's timestamp would misrepresent
    // the state-change moment.
    const kept = collapseHistoryVersions(versions);
    expect(kept.map((v) => v.versionId)).toEqual(["2", "1"]);
  });

  test("keeps a version when status changes", () => {
    const versions = [
      { versionId: "2", lastUpdated: "2026-04-23T12:00:02Z", status: "processed" },
      { versionId: "1", lastUpdated: "2026-04-23T12:00:01Z", status: "received" },
    ];
    expect(collapseHistoryVersions(versions).map((v) => v.versionId)).toEqual([
      "2",
      "1",
    ]);
  });

  test("keeps a version when error changes even if status is same", () => {
    const versions = [
      {
        versionId: "2",
        lastUpdated: "2026-04-23T12:00:02Z",
        status: "conversion_error",
        error: "updated error",
      },
      {
        versionId: "1",
        lastUpdated: "2026-04-23T12:00:01Z",
        status: "conversion_error",
        error: "original error",
      },
    ];
    expect(collapseHistoryVersions(versions).map((v) => v.versionId)).toEqual([
      "2",
      "1",
    ]);
  });

  test("returns newest-first for rendering", () => {
    const versions = [
      { versionId: "2", lastUpdated: "2026-04-23T12:00:02Z", status: "processed" },
      { versionId: "1", lastUpdated: "2026-04-23T12:00:01Z", status: "received" },
    ];
    const kept = collapseHistoryVersions(versions);
    expect(kept[0]?.versionId).toBe("2");
    expect(kept[1]?.versionId).toBe("1");
  });
});

describe("renderTimelineTab", () => {
  test("renders each version with dot tone, version id, clock, step label, status chip", () => {
    const html = renderTimelineTab([
      {
        versionId: "7",
        lastUpdated: "2026-04-23T12:00:07Z",
        status: "processed",
      },
      {
        versionId: "1",
        lastUpdated: "2026-04-23T12:00:01Z",
        status: "received",
      },
    ]);
    expect(html).toContain("v7");
    expect(html).toContain("v1");
    expect(html).toMatch(/chip-ok[^>]*>processed/);
    expect(html).toContain("Received by MLLP");
    expect(html).toContain("Converted + submitted to Aidbox");
  });

  test("renders error text when version carries one", () => {
    const html = renderTimelineTab([
      {
        versionId: "2",
        lastUpdated: "2026-04-23T12:00:02Z",
        status: "conversion_error",
        error: "OBR-4 missing",
      },
    ]);
    expect(html).toContain("Conversion failed");
    expect(html).toContain("OBR-4 missing");
  });

  test("empty-state when no versions", () => {
    expect(renderTimelineTab([])).toContain("No history entries");
  });
});

describe("getHistoryVersions", () => {
  test("queries _history with _count=50 and returns collapsed versions", async () => {
    mockedFetch = async () => ({
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            meta: { versionId: "2", lastUpdated: "2026-04-23T12:00:02Z" },
            status: "processed",
          },
        },
        {
          resource: {
            meta: { versionId: "1", lastUpdated: "2026-04-23T12:00:01Z" },
            status: "received",
          },
        },
      ],
    });
    const versions = await getHistoryVersions("abc-123");
    expect(fetchPaths[0]).toContain(
      "/fhir/IncomingHL7v2Message/abc-123/_history",
    );
    expect(fetchPaths[0]).toContain("_count=50");
    expect(versions).toHaveLength(2);
  });

  test("returns [] on Aidbox failure (no throw)", async () => {
    mockedFetch = async () => {
      throw new Error("aidbox down");
    };
    const versions = await getHistoryVersions("x");
    expect(versions).toEqual([]);
  });

  test("URL-encodes message id with special chars", async () => {
    mockedFetch = async () => ({ resourceType: "Bundle", entry: [] });
    await getHistoryVersions("id/with^chars");
    expect(fetchPaths[0]).toContain("id%2Fwith%5Echars");
  });
});

// ============================================================================
// renderDetailCard composition
// ============================================================================

describe("renderDetailCard", () => {
  test("renders header + tab bar + default Structured tab body", async () => {
    const html = await renderDetailCard(
      msg({ message: SAMPLE_HL7, messageControlId: "MCID-1" }) as never,
      "structured",
    );
    expect(html).toContain('id="detail"');
    expect(html).toContain('data-selected="msg-1"');
    expect(html).toContain("MCID-1");
    // Tab bar present with all 4 tabs.
    expect(html).toContain("Structured");
    expect(html).toContain("Raw HL7");
    expect(html).toContain("FHIR resources");
    expect(html).toContain("Timeline");
    // Default tab content (structured) rendered in #detail-body.
    expect(html).toContain('id="detail-body"');
    expect(html).toContain(">MSH<");
  });

  test("Timeline tab fetches _history", async () => {
    mockedFetch = async () => ({
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            meta: { versionId: "1", lastUpdated: "2026-04-23T12:00:01Z" },
            status: "received",
          },
        },
      ],
    });
    const html = await renderDetailCard(msg() as never, "timeline");
    expect(fetchPaths.some((p) => p.includes("/_history"))).toBe(true);
    expect(html).toContain("Received by MLLP");
  });

  test("active tab gets accent underline styling", async () => {
    const html = await renderDetailCard(msg() as never, "raw");
    // Raw HL7 tab should have the accent-underline class.
    expect(html).toMatch(/border-accent[^>]*>Raw HL7/);
  });

  test("tab buttons wire hx-get with the tab key", async () => {
    const html = await renderDetailCard(msg({ id: "abc" }) as never);
    // Tab buttons use single-quoted attributes so JSON inside Alpine
    // `:class` / `x-on:click` expressions doesn't collide with the
    // surrounding attribute quote.
    expect(html).toContain(
      "hx-get='/incoming-messages/abc/partials/detail/structured'",
    );
    expect(html).toContain(
      "hx-get='/incoming-messages/abc/partials/detail/timeline'",
    );
    expect(html).toContain("hx-target='#detail-body'");
  });

  test("Replay button wired to /mark-for-retry", async () => {
    const html = await renderDetailCard(msg({ id: "retry-me" }) as never);
    expect(html).toContain('hx-post="/mark-for-retry/retry-me"');
    expect(html).toContain('hx-target="#detail"');
  });

  test('"Map code" shown only when status is code_mapping_error', async () => {
    const ok = await renderDetailCard(
      msg({ status: "processed" }) as never,
    );
    expect(ok).not.toContain("Map code");

    const warn = await renderDetailCard(
      msg({
        status: "code_mapping_error",
        sendingApplication: "ACME_LAB",
        unmappedCodes: [
          { localCode: "X^Y", localSystem: "LOCAL", mappingTask: { reference: "Task/t" } },
        ],
      }) as never,
    );
    expect(warn).toContain("Map code");
    expect(warn).toContain("code=X%5EY");
    // sender matches the Unmapped queue grouping key (sending application),
    // not the local-code system. "LOCAL" would never match the queue.
    expect(warn).toContain("sender=ACME_LAB");
    expect(warn).not.toContain("sender=LOCAL");
  });

  test("normalizes MSH-9 to canonical display form", async () => {
    const html = await renderDetailCard(
      msg({ type: "ADT_A01^ADT_A01" }) as never,
    );
    expect(html).toContain("ADT^A01^ADT_A01");
  });
});

// ============================================================================
// HTTP handlers
// ============================================================================

function reqWithParams(url: string, params: Record<string, string>): Request {
  const r = new Request(url) as Request & {
    params: Record<string, string>;
  };
  r.params = params;
  return r;
}

describe("handleInboundDetailPartial", () => {
  test("200 with html content-type on happy path", async () => {
    mockedFetch = async (path) => {
      if (path.startsWith("/fhir/IncomingHL7v2Message/")) {
        return msg({ id: "abc", message: SAMPLE_HL7 });
      }
      return { resourceType: "Bundle", entry: [] };
    };
    const res = await handleInboundDetailPartial(
      reqWithParams(
        "http://localhost/incoming-messages/abc/partials/detail",
        { id: "abc" },
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain('id="detail"');
  });

  test("404 when message not found", async () => {
    mockedFetch = async () => {
      throw new Error("not found");
    };
    const res = await handleInboundDetailPartial(
      reqWithParams(
        "http://localhost/incoming-messages/gone/partials/detail",
        { id: "gone" },
      ),
    );
    expect(res.status).toBe(404);
  });
});

describe("handleInboundDetailTabPartial", () => {
  test("400 when tab param is invalid", async () => {
    mockedFetch = async () => msg();
    const res = await handleInboundDetailTabPartial(
      reqWithParams(
        "http://localhost/incoming-messages/x/partials/detail/bogus",
        { id: "x", tab: "bogus" },
      ),
    );
    expect(res.status).toBe(400);
  });

  test("returns only the tab body, not the full detail card", async () => {
    mockedFetch = async (path) => {
      if (path.startsWith("/fhir/IncomingHL7v2Message/")) {
        return msg({ message: SAMPLE_HL7 });
      }
      return { resourceType: "Bundle", entry: [] };
    };
    const res = await handleInboundDetailTabPartial(
      reqWithParams(
        "http://localhost/incoming-messages/x/partials/detail/raw",
        { id: "x", tab: "raw" },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    // No outer #detail wrapper — just the tab body content.
    expect(body).not.toContain('id="detail"');
    expect(body).toContain("hl7-message-container");
  });

  test("404 when message not found", async () => {
    mockedFetch = async (path) => {
      if (path.startsWith("/fhir/IncomingHL7v2Message/")) {
        throw new Error("not found");
      }
      return { resourceType: "Bundle", entry: [] };
    };
    const res = await handleInboundDetailTabPartial(
      reqWithParams(
        "http://localhost/incoming-messages/gone/partials/detail/structured",
        { id: "gone", tab: "structured" },
      ),
    );
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// handleMarkForRetry — htmx-aware Replay route
// ============================================================================

describe("handleMarkForRetry", () => {
  function retryReq(id: string, htmx = false): Request {
    const r = new Request(`http://localhost/mark-for-retry/${id}`, {
      method: "POST",
      headers: htmx ? { "HX-Request": "true" } : {},
    }) as Request & { params: Record<string, string> };
    r.params = { id };
    return r;
  }

  test("non-htmx caller gets 302 redirect to /incoming-messages", async () => {
    mockedFetch = async () => msg({ id: "abc" });
    const res = await handleMarkForRetry(retryReq("abc", false));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/incoming-messages");
  });

  test("htmx caller gets 200 + text/html + HX-Trigger: message-replayed", async () => {
    mockedFetch = async (path) => {
      if (path.startsWith("/fhir/IncomingHL7v2Message/")) {
        return msg({ id: "abc", message: SAMPLE_HL7 });
      }
      return { resourceType: "Bundle", entry: [] };
    };
    const res = await handleMarkForRetry(retryReq("abc", true));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("HX-Trigger")).toBe("message-replayed");
    const body = await res.text();
    expect(body).toContain('id="detail"');
  });

  test("htmx response resets status to received in the rendered detail", async () => {
    mockedFetch = async (path) => {
      if (path.startsWith("/fhir/IncomingHL7v2Message/")) {
        return msg({ id: "abc", status: "conversion_error", message: SAMPLE_HL7 });
      }
      return { resourceType: "Bundle", entry: [] };
    };
    const res = await handleMarkForRetry(retryReq("abc", true));
    // PUT was called with the reset resource.
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0]?.id).toBe("abc");
    // Rendered detail should show the pending chip (status=received maps to pend tone).
    const body = await res.text();
    expect(body).toContain("pending");
  });

  test("400 when params.id is missing", async () => {
    const r = new Request("http://localhost/mark-for-retry/", {
      method: "POST",
    }) as Request & { params?: Record<string, string> };
    // No .params attached.
    const res = await handleMarkForRetry(r);
    expect(res.status).toBe(400);
  });
});

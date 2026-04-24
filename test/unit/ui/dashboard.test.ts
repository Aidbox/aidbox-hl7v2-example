import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";

let mockedFetch: (path: string, init?: RequestInit) => Promise<unknown>;
let fetchPaths: string[] = [];

mock.module("../../../src/aidbox", () => ({
  aidboxFetch: (path: string, init?: RequestInit) => {
    fetchPaths.push(path);
    return mockedFetch(path, init);
  },
}));

const {
  renderStatsPartial,
  renderTickerPartial,
  getDashboardStats,
  getTickerRows,
  handleDashboardStats,
  handleDashboardTicker,
} = await import("../../../src/ui/pages/dashboard");

function bundle(total: number | undefined, entries: unknown[] = []): unknown {
  return { resourceType: "Bundle", total, entry: entries };
}

beforeEach(() => {
  fetchPaths = [];
  mockedFetch = async () => bundle(0, []);
});

afterEach(() => {
  fetchPaths = [];
});

// ============================================================================
// Stats partial
// ============================================================================

describe("getDashboardStats", () => {
  test("issues the four plan-specified queries in parallel", async () => {
    mockedFetch = async (path) => {
      if (path.includes("_lastUpdated=gt")) {return bundle(14);}
      if (path.includes("status=code_mapping_error")) {return bundle(3);}
      if (path.includes("status=parsing_error,conversion_error,sending_error"))
        {return bundle(1);}
      if (path.includes("status=processed")) {return bundle(0, []);}
      return bundle(0);
    };

    const stats = await getDashboardStats();
    expect(stats.receivedToday).toBe(14);
    expect(stats.needMapping).toBe(3);
    expect(stats.errors).toBe(1);
    expect(stats.avgLatencyMs).toBeNull();
    // Plan requires _total=accurate on the count queries.
    expect(fetchPaths.filter((p) => p.includes("_total=accurate"))).toHaveLength(3);
  });

  test("computes avg latency from meta.lastUpdated − date across last 100 processed", async () => {
    const sent = new Date("2026-04-23T10:00:00Z");
    const done1 = new Date("2026-04-23T10:00:00.050Z"); // 50ms
    const done2 = new Date("2026-04-23T10:00:00.100Z"); // 100ms
    const done3 = new Date("2026-04-23T10:00:00.030Z"); // 30ms

    mockedFetch = async (path) => {
      if (path.includes("status=processed")) {
        return bundle(0, [
          { resource: { date: sent.toISOString(), meta: { lastUpdated: done1.toISOString() } } },
          { resource: { date: sent.toISOString(), meta: { lastUpdated: done2.toISOString() } } },
          { resource: { date: sent.toISOString(), meta: { lastUpdated: done3.toISOString() } } },
        ]);
      }
      return bundle(0);
    };

    const stats = await getDashboardStats();
    // Mean of [50, 100, 30] = 60. The triage-outlier filter (>60s excluded
    // in computeAvgLatencyMs) makes a plain mean robust enough here; the
    // samples that used to swamp the average are dropped before sum.
    expect(stats.avgLatencyMs).toBe(60);
  });

  test("skips rows missing date or lastUpdated", async () => {
    mockedFetch = async (path) => {
      if (path.includes("status=processed")) {
        return bundle(0, [
          { resource: { date: "2026-04-23T10:00:00Z" } }, // no meta
          { resource: { meta: { lastUpdated: "2026-04-23T10:00:00Z" } } }, // no date
          {
            resource: {
              date: "2026-04-23T10:00:00Z",
              meta: { lastUpdated: "2026-04-23T10:00:00.042Z" },
            },
          },
        ]);
      }
      return bundle(0);
    };
    const stats = await getDashboardStats();
    expect(stats.avgLatencyMs).toBe(42);
  });

  test("returns null avg latency when no samples have both timestamps", async () => {
    mockedFetch = async () => bundle(0, []);
    const stats = await getDashboardStats();
    expect(stats.avgLatencyMs).toBeNull();
  });
});

describe("renderStatsPartial", () => {
  const stats = {
    receivedToday: 42,
    needMapping: 3,
    errors: 1,
    avgLatencyMs: 87,
  };

  test("renders all four stat values and the htmx auto-refresh trigger", () => {
    const html = renderStatsPartial(stats);
    expect(html).toContain("Received · today");
    expect(html).toContain("42");
    expect(html).toContain("Need mapping");
    expect(html).toContain("Errors");
    expect(html).toContain("End-to-end time");
    expect(html).toContain("87ms");
    expect(html).toContain('hx-get="/dashboard/partials/stats"');
    expect(html).toContain('hx-trigger="every 10s"');
  });

  test("applies warn tone to Need mapping when non-zero", () => {
    const html = renderStatsPartial({ ...stats, needMapping: 4 });
    expect(html).toContain("text-warn");
  });

  test("applies err tone to Errors when non-zero", () => {
    const html = renderStatsPartial({ ...stats, errors: 2 });
    expect(html).toContain("text-err");
  });

  test("empty state — all zeros, null latency — renders without warn/err tones", () => {
    const html = renderStatsPartial({
      receivedToday: 0,
      needMapping: 0,
      errors: 0,
      avgLatencyMs: null,
    });
    expect(html).not.toContain("text-warn");
    expect(html).not.toContain("text-err");
    expect(html).toContain(">—<"); // no samples placeholder
  });

  test("formats sub-second latency in ms, ≥1s latency in s", () => {
    const htmlMs = renderStatsPartial({ ...stats, avgLatencyMs: 999 });
    expect(htmlMs).toContain("999ms");

    const htmlS = renderStatsPartial({ ...stats, avgLatencyMs: 1500 });
    expect(htmlS).toContain("1.5s");
  });
});

// ============================================================================
// Ticker partial
// ============================================================================

describe("getTickerRows", () => {
  test("maps processed to ok chip, code_mapping_error to warn, hard errors to err", async () => {
    mockedFetch = async () =>
      bundle(0, [
        {
          resource: {
            type: "ORU^R01",
            status: "processed",
            sendingApplication: "ACME_LAB",
            date: "2026-04-23T10:00:00Z",
          },
        },
        {
          resource: {
            type: "ORU^R01",
            status: "code_mapping_error",
            sendingApplication: "ACME_LAB",
            date: "2026-04-23T10:00:01Z",
          },
        },
        {
          resource: {
            type: "VXU^V04",
            status: "parsing_error",
            sendingApplication: "CLINIC",
            date: "2026-04-23T10:00:02Z",
          },
        },
        {
          resource: {
            type: "ADT^A01",
            status: "received",
            sendingApplication: "St.Marys",
            date: "2026-04-23T10:00:03Z",
          },
        },
      ]);

    const rows = await getTickerRows(4);
    expect(rows.map((r) => r.status)).toEqual(["ok", "warn", "err", "pend"]);
    const first = rows[0]!;
    const second = rows[1]!;
    expect(first.type).toBe("ORU^R01");
    // Note column carries the sender only — the status chip on the row's
    // right edge encodes the outcome, so echoing it in the middle is
    // redundant. See buildNote.
    expect(first.note).toBe("ACME_LAB");
    expect(second.note).toBe("ACME_LAB");
  });

  test("clamps limit to [1, 100]", async () => {
    mockedFetch = async () => bundle(0, []);
    await getTickerRows(0);
    expect(fetchPaths.at(-1)).toContain("_count=1");
    await getTickerRows(500);
    expect(fetchPaths.at(-1)).toContain("_count=100");
  });
});

describe("renderTickerPartial", () => {
  test("renders rows with htmx auto-refresh every 2s and a pulsing dot", () => {
    const html = renderTickerPartial(
      [
        { time: "14:19:46", type: "ORU^R01", note: "ACME_LAB → processed", status: "ok" },
        { time: "14:19:44", type: "ADT^A01", note: "St.Marys → admit", status: "ok" },
      ],
      15,
    );
    expect(html).toContain('hx-get="/dashboard/partials/ticker?limit=15"');
    expect(html).toContain('hx-trigger="every 2s"');
    expect(html).toContain('auto-refresh · 2s');
    // The ticker dot carries `.pulse` so the auto-refresh tick is visible.
    expect(html).toContain('class="dot accent pulse"');
    expect(html).toContain("ORU^R01");
    expect(html).toContain("ACME_LAB");
    expect(html).toContain("processed");
  });

  test("empty state prompts the user to click Run demo now", () => {
    const html = renderTickerPartial([], 15);
    expect(html).toContain("No messages yet");
    expect(html).toContain("Run demo now");
  });

  test("HTML-escapes malicious content in notes", () => {
    const html = renderTickerPartial(
      [{ time: "10:00", type: "X<script>", note: "<b>", status: "pend" }],
      15,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ============================================================================
// Handlers
// ============================================================================

describe("handleDashboardStats", () => {
  test("returns HTML with the stats partial", async () => {
    mockedFetch = async () => bundle(0, []);
    const res = await handleDashboardStats();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain('id="dashboard-stats"');
    expect(body).toContain('id="dashboard-stats"');
  });
});

describe("handleDashboardTicker", () => {
  test("honors ?limit param", async () => {
    mockedFetch = async () => bundle(0, []);
    const res = await handleDashboardTicker(
      new Request("http://localhost/dashboard/partials/ticker?limit=5"),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('hx-get="/dashboard/partials/ticker?limit=5"');
    expect(fetchPaths.at(-1)).toContain("_count=5");
  });

  test("defaults to limit=15 when absent", async () => {
    mockedFetch = async () => bundle(0, []);
    await handleDashboardTicker(
      new Request("http://localhost/dashboard/partials/ticker"),
    );
    expect(fetchPaths.at(-1)).toContain("_count=15");
  });

  test("survives Aidbox failures with an empty-state response", async () => {
    mockedFetch = async () => {
      throw new Error("aidbox unreachable");
    };
    const res = await handleDashboardTicker(
      new Request("http://localhost/dashboard/partials/ticker"),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("No messages yet");
  });
});

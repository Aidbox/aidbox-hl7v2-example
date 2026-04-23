import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { rewriteMessageControlId as realRewrite } from "../../../src/mllp/client";

let mockedSend: (host: string, port: number, message: string) => Promise<string>;
let sendCalls: { host: string; port: number; message: string }[] = [];
let mockedFetchStatus: (mcid: string) => Promise<string | undefined>;

mock.module("../../../src/mllp/client", () => ({
  sendMLLPMessage: (host: string, port: number, message: string) =>
    mockedSend(host, port, message),
  rewriteMessageControlId: realRewrite,
}));

// Default: demo-scenario's `defaultFetchStatus` uses aidboxFetch; most tests
// override via `fetchStatus` option, but the endpoint-level test of
// `handleRunDemoScenario` has no such knob, so stub aidboxFetch globally to
// return `processed` immediately (so the wait loop resolves instantly).
mock.module("../../../src/aidbox", () => ({
  aidboxFetch: async () => ({
    entry: [{ resource: { status: "processed" } }],
  }),
}));

const {
  runDemoScenario,
  isDemoEnabled,
  handleRunDemoScenario,
  DEMO_SAMPLE_IDS,
  DEMO_WAIT_DEADLINE_MS,
  DEMO_POLL_INTERVAL_MS,
} = await import("../../../src/api/demo-scenario");

beforeEach(() => {
  sendCalls = [];
  mockedSend = async (host, port, message) => {
    sendCalls.push({ host, port, message });
    return "MSH|^~\\&|AIDBOX|AIDBOX|T||ACK|1|P|2.4\rMSA|AA|X";
  };
  mockedFetchStatus = async () => "processed";
});

afterEach(() => {
  sendCalls = [];
  delete process.env.DEMO_MODE;
});

describe("runDemoScenario", () => {
  const defaults = () => ({
    send: mockedSend,
    sleep: async () => {},
    fetchStatus: mockedFetchStatus,
  });

  test("fires four sends in the plan-specified order", async () => {
    const fired: string[] = [];
    await runDemoScenario({
      ...defaults(),
      onFired: (id) => fired.push(id),
    });

    expect(fired).toEqual([
      "adt-a01-full",
      "oru-r01-known-loinc",
      "vxu-v04-covid-flu",
      "oru-r01-unknown-loinc",
    ]);
    expect(sendCalls).toHaveLength(4);
  });

  test("each send is normalized to CR segment terminators", async () => {
    await runDemoScenario(defaults());
    for (const call of sendCalls) {
      expect(call.message).not.toContain("\r\n");
      expect(call.message).not.toContain("\n");
      expect(call.message).toContain("\r");
    }
  });

  test("each send gets a unique DEMO-prefixed MSH-10", async () => {
    await runDemoScenario(defaults());
    const mcids = sendCalls.map((c) => {
      const msh = c.message.split("\r")[0] ?? "";
      return msh.split("|")[9] ?? "";
    });
    expect(mcids).toHaveLength(4);
    for (const m of mcids) {
      expect(m).toMatch(/^DEMO-[0-9a-z]+-\d$/);
      expect(m.length).toBeLessThanOrEqual(20);
    }
    expect(new Set(mcids).size).toBe(4);
  });

  test("waits for each previous message to leave 'received' before firing next", async () => {
    // Simulate the processor staying in `received` for 2 polls, then moving
    // to `processed`. Since DEMO_POLL_INTERVAL_MS is 500ms and sleep is
    // no-op in tests, the wait resolves after 3 status checks per message.
    const checkCounts: Record<string, number> = {};
    mockedFetchStatus = async (mcid) => {
      checkCounts[mcid] = (checkCounts[mcid] ?? 0) + 1;
      return checkCounts[mcid] < 3 ? "received" : "processed";
    };

    const fireOrder: string[] = [];
    await runDemoScenario({
      send: async (host, port, msg) => {
        const mcid = msg.split("\r")[0]?.split("|")[9] ?? "";
        fireOrder.push(mcid);
        return "ACK";
      },
      sleep: async () => {},
      fetchStatus: mockedFetchStatus,
    });

    expect(fireOrder).toHaveLength(4);
    // Each non-final send's MCID should have been polled until status changed.
    const firstThree = fireOrder.slice(0, 3);
    for (const mcid of firstThree) {
      expect(checkCounts[mcid]).toBeGreaterThanOrEqual(3);
    }
    // The last send is NOT waited on — nothing follows it.
    const last = fireOrder[3]!;
    expect(checkCounts[last]).toBeUndefined();
  });

  test("wait-for-processed gives up at waitDeadlineMs and moves on", async () => {
    // Simulate a message that never leaves `received`. The loop should still
    // complete; each wait just burns its deadline.
    mockedFetchStatus = async () => "received";

    let sleepTotal = 0;
    const pollInterval = 50;
    const waitDeadline = 200;

    await runDemoScenario({
      send: mockedSend,
      sleep: async (ms) => {
        sleepTotal += ms;
      },
      fetchStatus: mockedFetchStatus,
      pollIntervalMs: pollInterval,
      waitDeadlineMs: waitDeadline,
    });

    expect(sendCalls).toHaveLength(4);
    // 3 non-final waits × ~4 polls each = ~12 poll-interval sleeps.
    // Exact count depends on Date.now() resolution; just assert the
    // rough order of magnitude.
    expect(sleepTotal).toBeGreaterThan(0);
  });

  test("one send failure does not abort remaining sends", async () => {
    let calls = 0;
    mockedSend = async () => {
      calls++;
      if (calls === 2) throw new Error("transient MLLP error");
      return "MSH|^~\\&|AIDBOX|AIDBOX|T||ACK|1|P|2.4\rMSA|AA|X";
    };
    const fired: string[] = [];
    const errors: string[] = [];
    await runDemoScenario({
      send: mockedSend,
      sleep: async () => {},
      fetchStatus: mockedFetchStatus,
      onFired: (id) => fired.push(id),
      onError: (id) => errors.push(id),
    });
    expect(fired).toEqual([
      "adt-a01-full",
      "vxu-v04-covid-flu",
      "oru-r01-unknown-loinc",
    ]);
    expect(errors).toEqual(["oru-r01-known-loinc"]);
    expect(calls).toBe(4);
  });

  test("failed send does NOT trigger a wait — there's no mcid to poll", async () => {
    let calls = 0;
    mockedSend = async () => {
      calls++;
      if (calls === 1) throw new Error("mllp down");
      return "ACK";
    };
    const pollCalls: string[] = [];
    mockedFetchStatus = async (mcid) => {
      pollCalls.push(mcid);
      return "processed";
    };

    await runDemoScenario({
      send: mockedSend,
      sleep: async () => {},
      fetchStatus: mockedFetchStatus,
    });

    // Sends 2 and 3 each get a wait-for-processed poll (1 each since mock
    // returns processed immediately). Send 1 failed → no poll. Send 4 is
    // the last → no poll.
    expect(pollCalls).toHaveLength(2);
  });

  test("respects MLLP_HOST / MLLP_PORT env vars", async () => {
    process.env.MLLP_HOST = "192.0.2.1";
    process.env.MLLP_PORT = "25751";
    try {
      await runDemoScenario(defaults());
      for (const call of sendCalls) {
        expect(call.host).toBe("192.0.2.1");
        expect(call.port).toBe(25751);
      }
    } finally {
      delete process.env.MLLP_HOST;
      delete process.env.MLLP_PORT;
    }
  });

  test("exposed constants match expected defaults", () => {
    expect(DEMO_WAIT_DEADLINE_MS).toBe(8000);
    expect(DEMO_POLL_INTERVAL_MS).toBe(500);
  });
});

describe("isDemoEnabled", () => {
  test("default-on when env var is unset", () => {
    expect(isDemoEnabled({})).toBe(true);
  });

  test("enabled for empty string", () => {
    expect(isDemoEnabled({ DEMO_MODE: "" })).toBe(true);
  });

  test("enabled for any non-'off' value", () => {
    expect(isDemoEnabled({ DEMO_MODE: "on" })).toBe(true);
    expect(isDemoEnabled({ DEMO_MODE: "1" })).toBe(true);
    expect(isDemoEnabled({ DEMO_MODE: "staging" })).toBe(true);
  });

  test("disabled only for literal 'off'", () => {
    expect(isDemoEnabled({ DEMO_MODE: "off" })).toBe(false);
  });

  test("case-sensitive — 'OFF' is NOT treated as off", () => {
    // Documented tradeoff: matches the `DISABLE_POLLING=1` exact-string
    // convention elsewhere. If we ever want case-insensitive, normalize here.
    expect(isDemoEnabled({ DEMO_MODE: "OFF" })).toBe(true);
  });
});

describe("handleRunDemoScenario", () => {
  test("returns 202 and fires the scenario when enabled", async () => {
    const res = await handleRunDemoScenario();
    expect(res.status).toBe(202);
    // Fire-and-forget — we can't easily await the scenario, but at least one
    // send must have queued up synchronously via the first iteration.
    await new Promise((r) => setTimeout(r, 10));
    expect(sendCalls.length).toBeGreaterThanOrEqual(1);
  });

  test("returns 403 when DEMO_MODE=off", async () => {
    process.env.DEMO_MODE = "off";
    const res = await handleRunDemoScenario();
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("disabled");
    expect(sendCalls).toHaveLength(0);
  });
});

test("DEMO_SAMPLE_IDS covers the four plan-specified types", () => {
  expect(DEMO_SAMPLE_IDS).toEqual([
    "adt-a01-full",
    "oru-r01-known-loinc",
    "vxu-v04-covid-flu",
    "oru-r01-unknown-loinc",
  ]);
});

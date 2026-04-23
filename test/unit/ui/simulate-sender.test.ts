import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
// Grab the real implementation BEFORE mock.module replaces the module, so the
// mock factory below can delegate to it. If we imported inside the factory,
// we'd hit a cycle.
import { rewriteMessageControlId as realRewrite } from "../../../src/mllp/client";

let mockedMLLPSend: (host: string, port: number, message: string) => Promise<string>;
let mockedAidboxFetch: (path: string, init?: RequestInit) => Promise<unknown>;
let mllpSendCalls: string[];
let aidboxFetchCalls: string[];

mock.module("../../../src/mllp/client", () => ({
  sendMLLPMessage: (host: string, port: number, message: string) =>
    mockedMLLPSend(host, port, message),
  rewriteMessageControlId: realRewrite,
}));

mock.module("../../../src/aidbox", () => ({
  aidboxFetch: (path: string, init?: RequestInit) => mockedAidboxFetch(path, init),
}));

// Import AFTER mocks so the module picks up the stubs.
const {
  sendSimulateMessage,
  fetchMessageStatus,
  handleSimulateSenderSend,
  handleSimulateSenderStatus,
} = await import("../../../src/ui/pages/simulate-sender");

const SAMPLE_RAW = [
  "MSH|^~\\&|ACME_LAB|ACME_LAB_FACILITY|ACME_HOSP|DEST|T||ORU^R01|ORIG|P|2.5.1",
  "PID|1||P12345",
].join("\n");

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/simulate-sender/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function statusRequest(mcid: string): Request {
  return new Request(
    `http://localhost:3000/simulate-sender/status?mcid=${encodeURIComponent(mcid)}`,
  );
}

beforeEach(() => {
  mllpSendCalls = [];
  aidboxFetchCalls = [];
  mockedMLLPSend = async (_host, _port, message) => {
    mllpSendCalls.push(message);
    return "MSH|^~\\&|AIDBOX|AIDBOX|T||ACK|1|P|2.4\rMSA|AA|ORIG";
  };
  mockedAidboxFetch = async () => ({ entry: [] });
});

afterEach(() => {
  mllpSendCalls = [];
  aidboxFetchCalls = [];
});

describe("sendSimulateMessage", () => {
  test("returns ACK immediately on successful MLLP send (no status polling)", async () => {
    let aidboxCalled = false;
    mockedAidboxFetch = async () => {
      aidboxCalled = true;
      return { entry: [] };
    };

    const result = await sendSimulateMessage(SAMPLE_RAW);
    expect(result.status).toBe("sent");
    expect(result.ack).toContain("MSA|AA");
    expect(result.messageControlId).toMatch(/^SIM-[0-9a-z]+-[a-f0-9]{4}$/);
    // HL7v2 2.5.1 caps MSH-10 (ST) at 20 chars. Keep the generator under that.
    expect(result.messageControlId.length).toBeLessThanOrEqual(20);
    // Client polls status separately now — /send never touches Aidbox.
    expect(aidboxCalled).toBe(false);
  });

  test("MLLP failure returns 'error' with empty ack and error message", async () => {
    mockedMLLPSend = async () => {
      throw new Error("Connection failed: ECONNREFUSED");
    };

    const result = await sendSimulateMessage(SAMPLE_RAW);
    expect(result.status).toBe("error");
    expect(result.ack).toBe("");
    expect(result.error).toContain("ECONNREFUSED");
    expect(result.messageControlId).toMatch(/^SIM-[0-9a-z]+-[a-f0-9]{4}$/);
  });

  test("rewrites MSH-10 on the outbound message", async () => {
    const result = await sendSimulateMessage(SAMPLE_RAW);
    expect(mllpSendCalls[0]).toContain(result.messageControlId);
    expect(mllpSendCalls[0]).not.toContain("|ORIG|");
  });

  test("duplicate send of the same template yields distinct messageControlIds", async () => {
    const [a, b] = await Promise.all([
      sendSimulateMessage(SAMPLE_RAW),
      sendSimulateMessage(SAMPLE_RAW),
    ]);

    expect(a.messageControlId).not.toBe(b.messageControlId);
    expect(mllpSendCalls.length).toBe(2);
    expect(mllpSendCalls[0]).toContain(a.messageControlId);
    expect(mllpSendCalls[1]).toContain(b.messageControlId);
  });
});

describe("fetchMessageStatus", () => {
  test("maps 'processed' to outcome 'sent'", async () => {
    mockedAidboxFetch = async (path) => {
      aidboxFetchCalls.push(path);
      return { entry: [{ resource: { status: "processed" } }] };
    };

    const result = await fetchMessageStatus("SIM-abc-1234");
    expect(result.outcome).toBe("sent");
    expect(result.messageStatus).toBe("processed");
    expect(aidboxFetchCalls[0]).toContain(
      "/fhir/IncomingHL7v2Message?message-control-id=SIM-abc-1234",
    );
    expect(aidboxFetchCalls[0]).toContain("_elements=status");
    expect(aidboxFetchCalls[0]).toContain("_count=1");
  });

  test("maps 'warning' to outcome 'sent'", async () => {
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "warning" } }],
    });

    const result = await fetchMessageStatus("SIM-abc-1234");
    expect(result.outcome).toBe("sent");
    expect(result.messageStatus).toBe("warning");
  });

  test("maps 'code_mapping_error' to outcome 'held'", async () => {
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "code_mapping_error" } }],
    });

    const result = await fetchMessageStatus("SIM-abc-1234");
    expect(result.outcome).toBe("held");
    expect(result.messageStatus).toBe("code_mapping_error");
  });

  test("maps other *_error statuses to outcome 'error'", async () => {
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "parsing_error" } }],
    });

    const result = await fetchMessageStatus("SIM-abc-1234");
    expect(result.outcome).toBe("error");
    expect(result.messageStatus).toBe("parsing_error");
  });

  test("'received' status is pending (initial worker-untouched state)", async () => {
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "received" } }],
    });

    const result = await fetchMessageStatus("SIM-abc-1234");
    expect(result.outcome).toBe("pending");
    expect(result.messageStatus).toBe("received");
  });

  test("missing entry (message not yet stored) is pending", async () => {
    mockedAidboxFetch = async () => ({ entry: [] });

    const result = await fetchMessageStatus("SIM-abc-1234");
    expect(result.outcome).toBe("pending");
    expect(result.messageStatus).toBeUndefined();
  });

  test("unknown future status is treated as terminal 'sent' (forward-compatible)", async () => {
    // Since outcomeFromStatus returns 'sent' for anything that isn't
    // `received`, `code_mapping_error`, or `*_error`, any new success-ish
    // status added later automatically rolls up as done.
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "archived" } }],
    });

    const result = await fetchMessageStatus("SIM-abc-1234");
    expect(result.outcome).toBe("sent");
    expect(result.messageStatus).toBe("archived");
  });
});

describe("handleSimulateSenderSend", () => {
  test("rejects empty body with 400", async () => {
    const response = await handleSimulateSenderSend(jsonRequest({ raw: "" }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { status: string; error?: string };
    expect(body.status).toBe("error");
    expect(body.error).toContain("Empty");
  });

  test("rejects non-JSON body with 400", async () => {
    const request = new Request("http://localhost:3000/simulate-sender/send", {
      method: "POST",
      body: "not json",
    });
    const response = await handleSimulateSenderSend(request);
    expect(response.status).toBe(400);
  });

  test("returns send result as JSON on success", async () => {
    const response = await handleSimulateSenderSend(jsonRequest({ raw: SAMPLE_RAW }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      messageControlId: string;
      ack: string;
    };
    expect(body.status).toBe("sent");
    expect(body.messageControlId).toMatch(/^SIM-[0-9a-z]+-[a-f0-9]{4}$/);
    expect(body.ack).toContain("MSA");
  });
});

describe("handleSimulateSenderStatus", () => {
  test("rejects missing mcid with 400 and no overloaded outcome", async () => {
    const request = new Request("http://localhost:3000/simulate-sender/status");
    const response = await handleSimulateSenderStatus(request);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { outcome?: string; error?: string };
    // 400 body must not carry `outcome` — that vocabulary is reserved for
    // processor verdicts, not request validity.
    expect(body.outcome).toBeUndefined();
    expect(body.error).toContain("mcid");
  });

  test("returns current outcome as JSON", async () => {
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "processed" } }],
    });

    const response = await handleSimulateSenderStatus(statusRequest("SIM-abc-1234"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { outcome: string; messageStatus?: string };
    expect(body.outcome).toBe("sent");
    expect(body.messageStatus).toBe("processed");
  });

  test("falls back to 'pending' when Aidbox errors (client keeps polling)", async () => {
    mockedAidboxFetch = async () => {
      throw new Error("Aidbox unreachable");
    };

    const response = await handleSimulateSenderStatus(statusRequest("SIM-abc-1234"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { outcome: string };
    expect(body.outcome).toBe("pending");
  });
});

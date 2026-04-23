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
const { sendSimulateMessage, handleSimulateSenderSend } = await import(
  "../../../src/ui/pages/simulate-sender"
);

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
  test("happy path — status 'processed' maps to 'sent'", async () => {
    mockedAidboxFetch = async (path) => {
      aidboxFetchCalls.push(path);
      return { entry: [{ resource: { status: "processed" } }] };
    };

    const result = await sendSimulateMessage(SAMPLE_RAW);
    expect(result.status).toBe("sent");
    expect(result.messageStatus).toBe("processed");
    expect(result.messageControlId).toMatch(/^SIM-[0-9a-z]+-[a-f0-9]{4}$/);
    // HL7v2 2.5.1 caps MSH-10 (ST) at 20 chars. Keep the generator under that.
    expect(result.messageControlId.length).toBeLessThanOrEqual(20);
    expect(result.ack).toContain("MSA|AA");
  });

  test("poll-error doesn't fail the send — falls back to 'sent' + undefined messageStatus", async () => {
    mockedAidboxFetch = async () => {
      throw new Error("Aidbox unreachable");
    };

    const result = await sendSimulateMessage(SAMPLE_RAW);
    expect(result.status).toBe("sent");
    expect(result.messageStatus).toBeUndefined();
    expect(result.ack).toContain("MSA|AA");
  });

  test("code_mapping_error maps to 'held'", async () => {
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "code_mapping_error" } }],
    });

    const result = await sendSimulateMessage(SAMPLE_RAW);
    expect(result.status).toBe("held");
    expect(result.messageStatus).toBe("code_mapping_error");
  });

  test("other *_error statuses map to 'error'", async () => {
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "parsing_error" } }],
    });

    const result = await sendSimulateMessage(SAMPLE_RAW);
    expect(result.status).toBe("error");
    expect(result.messageStatus).toBe("parsing_error");
  });

  test("MLLP failure short-circuits with 'error' status and empty ack", async () => {
    mockedMLLPSend = async () => {
      throw new Error("Connection failed: ECONNREFUSED");
    };

    const result = await sendSimulateMessage(SAMPLE_RAW);
    expect(result.status).toBe("error");
    expect(result.ack).toBe("");
    expect(result.error).toContain("ECONNREFUSED");
    expect(result.messageControlId).toMatch(/^SIM-[0-9a-z]+-[a-f0-9]{4}$/);
  });

  test("poll timeout (no terminal status within budget) optimistically falls back to 'sent'", async () => {
    // Always return 'received' — never reaches terminal state.
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "received" } }],
    });

    const result = await sendSimulateMessage(SAMPLE_RAW);
    expect(result.status).toBe("sent");
    expect(result.messageStatus).toBeUndefined();
  }, 10000);

  test("duplicate send of the same template yields distinct messageControlIds", async () => {
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "processed" } }],
    });

    const [a, b] = await Promise.all([
      sendSimulateMessage(SAMPLE_RAW),
      sendSimulateMessage(SAMPLE_RAW),
    ]);

    expect(a.messageControlId).not.toBe(b.messageControlId);
    expect(mllpSendCalls.length).toBe(2);
    expect(mllpSendCalls[0]).toContain(a.messageControlId);
    expect(mllpSendCalls[1]).toContain(b.messageControlId);
    // Neither outbound carries the original MSG1776853125726 id.
    expect(mllpSendCalls[0]).not.toContain("|ORIG|");
    expect(mllpSendCalls[1]).not.toContain("|ORIG|");
  });

  test("polls IncomingHL7v2Message by message-control-id", async () => {
    mockedAidboxFetch = async (path) => {
      aidboxFetchCalls.push(path);
      return { entry: [{ resource: { status: "processed" } }] };
    };

    const result = await sendSimulateMessage(SAMPLE_RAW);
    expect(aidboxFetchCalls[0]).toContain(
      `/fhir/IncomingHL7v2Message?message-control-id=${encodeURIComponent(result.messageControlId)}`,
    );
    expect(aidboxFetchCalls[0]).toContain("_count=1");
    expect(aidboxFetchCalls[0]).toContain("_elements=status");
  });
});

describe("handleSimulateSenderSend", () => {
  test("rejects empty body with 400", async () => {
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "processed" } }],
    });
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
    mockedAidboxFetch = async () => ({
      entry: [{ resource: { status: "processed" } }],
    });

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

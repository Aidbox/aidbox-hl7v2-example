import { describe, test, expect, mock, beforeEach } from "bun:test";

let capturedBody: string | undefined;

mock.module("../../../src/aidbox", () => ({
  aidboxFetch: async (_path: string, init?: RequestInit) => {
    capturedBody = typeof init?.body === "string" ? init.body : undefined;
    return { id: "generated-id" };
  },
}));

const { storeMessage } = await import("../../../src/mllp/mllp-server");

beforeEach(() => {
  capturedBody = undefined;
});

describe("storeMessage", () => {
  test("captures MSH-10 as messageControlId on the stored resource", async () => {
    const hl7 = [
      "MSH|^~\\&|ACME_LAB|ACME_LAB_FACILITY|ACME_HOSP|DEST|T||ORU^R01|MSG-42|P|2.5.1",
      "PID|1||P12345",
    ].join("\r");

    await storeMessage(hl7);

    expect(capturedBody).toBeDefined();
    const resource = JSON.parse(capturedBody!);
    expect(resource.messageControlId).toBe("MSG-42");
    expect(resource.type).toBe("ORU_R01");
    expect(resource.sendingApplication).toBe("ACME_LAB");
    expect(resource.sendingFacility).toBe("ACME_LAB_FACILITY");
    expect(resource.status).toBe("received");
  });

  test("stores undefined messageControlId when MSH-10 is empty", async () => {
    const hl7 = [
      "MSH|^~\\&|ACME_LAB|FAC|RCV|DEST|T||ADT^A01||P|2.5.1",
      "PID|1||P12345",
    ].join("\r");

    await storeMessage(hl7);
    const resource = JSON.parse(capturedBody!);
    expect(resource.messageControlId).toBeUndefined();
  });

  test("stores undefined messageControlId when MSH segment is missing", async () => {
    await storeMessage("PID|1||P12345\rOBX|1|NM|test");
    const resource = JSON.parse(capturedBody!);
    expect(resource.messageControlId).toBeUndefined();
    expect(resource.type).toBe("UNKNOWN");
  });
});

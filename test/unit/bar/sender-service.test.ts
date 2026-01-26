import { test, expect, describe, beforeEach, mock } from "bun:test";

// Test fixtures
const testOutgoingMessage = {
  resourceType: "OutgoingBarMessage" as const,
  id: "msg-1",
  patient: { reference: "Patient/patient-1" },
  invoice: { reference: "Invoice/invoice-1" },
  status: "pending",
  hl7v2: "MSH|^~\\&|SENDER|FAC|RECV|FAC|202312151000||BAR^P01|MSG001|P|2.5\rPID|1||MRN12345||Smith^John",
};

describe("pollPendingMessage", () => {
  const mockAidbox = {
    aidboxFetch: mock(() => Promise.resolve({ entry: [] })),
    putResource: mock(() => Promise.resolve({})),
  };

  beforeEach(() => {
    mockAidbox.aidboxFetch.mockClear();
    mockAidbox.putResource.mockClear();
  });

  test("returns null when no pending messages", async () => {
    mockAidbox.aidboxFetch.mockImplementation(() =>
      Promise.resolve({ total: 0, entry: [] })
    );

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { pollPendingMessage } = await import("../../../src/bar/sender-service");

    const result = await pollPendingMessage();
    expect(result).toBeNull();
  });

  test("returns message when pending message exists", async () => {
    mockAidbox.aidboxFetch.mockImplementation(() =>
      Promise.resolve({
        total: 1,
        entry: [{ resource: testOutgoingMessage }],
      })
    );

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { pollPendingMessage } = await import("../../../src/bar/sender-service");

    const result = await pollPendingMessage();
    expect(result).toEqual(testOutgoingMessage);
  });
});

describe("sendAsIncomingMessage", () => {
  const createdMessage = {
    resourceType: "IncomingHL7v2Message" as const,
    id: "incoming-1",
    type: "BAR",
    date: "2023-12-15T10:00:00Z",
    patient: testOutgoingMessage.patient,
    message: testOutgoingMessage.hl7v2!,
  };

  const mockAidbox = {
    aidboxFetch: mock(() => Promise.resolve(createdMessage)),
    putResource: mock(() => Promise.resolve({})),
  };

  beforeEach(() => {
    mockAidbox.aidboxFetch.mockClear();
    mockAidbox.putResource.mockClear();
  });

  test("creates IncomingHL7v2Message from OutgoingBarMessage", async () => {
    mockAidbox.aidboxFetch.mockImplementation(() =>
      Promise.resolve(createdMessage)
    );

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { sendAsIncomingMessage } = await import("../../../src/bar/sender-service");

    const result = await sendAsIncomingMessage(testOutgoingMessage);

    expect(result).toEqual(createdMessage);
    expect(mockAidbox.aidboxFetch).toHaveBeenCalledTimes(1);
  });
});

describe("markAsSent", () => {
  const updatedMessage = { ...testOutgoingMessage, status: "sent" };

  const mockAidbox = {
    aidboxFetch: mock(() => Promise.resolve({})),
    putResource: mock(() => Promise.resolve(updatedMessage)),
  };

  beforeEach(() => {
    mockAidbox.aidboxFetch.mockClear();
    mockAidbox.putResource.mockClear();
  });

  test("updates message status to sent", async () => {
    mockAidbox.putResource.mockImplementation(() =>
      Promise.resolve(updatedMessage)
    );

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { markAsSent } = await import("../../../src/bar/sender-service");

    const result = await markAsSent(testOutgoingMessage);

    expect(result.status).toBe("sent");
    expect(mockAidbox.putResource).toHaveBeenCalledTimes(1);
  });
});

describe("processNextMessage", () => {
  test("returns false when no pending messages", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve({ total: 0, entry: [] })),
      putResource: mock(() => Promise.resolve({})),
    };

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { processNextMessage } = await import("../../../src/bar/sender-service");

    const result = await processNextMessage();
    expect(result).toBe(false);
  });

  test("processes message and returns true", async () => {
    let callCount = 0;
    const mockAidbox = {
      aidboxFetch: mock((path: string) => {
        callCount++;
        if (callCount === 1) {
          // Poll returns message
          return Promise.resolve({
            total: 1,
            entry: [{ resource: testOutgoingMessage }],
          });
        } else {
          // POST IncomingHL7v2Message
          return Promise.resolve({
            resourceType: "IncomingHL7v2Message",
            id: "incoming-1",
          });
        }
      }),
      putResource: mock(() =>
        Promise.resolve({ ...testOutgoingMessage, status: "sent" })
      ),
    };

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { processNextMessage } = await import("../../../src/bar/sender-service");

    const result = await processNextMessage();
    expect(result).toBe(true);
    expect(mockAidbox.aidboxFetch).toHaveBeenCalledTimes(2);
    expect(mockAidbox.putResource).toHaveBeenCalledTimes(1);
  });
});

describe("createBarMessageSenderService", () => {
  test("starts and stops correctly", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve({ entry: [] })),
      putResource: mock(() => Promise.resolve({})),
    };

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { createBarMessageSenderService } = await import("../../../src/bar/sender-service");

    const service = createBarMessageSenderService({ pollIntervalMs: 100 });

    expect(service.isRunning()).toBe(false);

    service.start();
    expect(service.isRunning()).toBe(true);

    service.stop();
    expect(service.isRunning()).toBe(false);
  });

  test("start is idempotent", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve({ entry: [] })),
      putResource: mock(() => Promise.resolve({})),
    };

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { createBarMessageSenderService } = await import("../../../src/bar/sender-service");

    const service = createBarMessageSenderService({ pollIntervalMs: 100 });

    service.start();
    service.start(); // Should not throw or cause issues
    expect(service.isRunning()).toBe(true);

    service.stop();
  });

  test("calls onIdle when no messages found", async () => {
    const onIdle = mock(() => {});
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve({ total: 0, entry: [] })),
      putResource: mock(() => Promise.resolve({})),
    };

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { createBarMessageSenderService } = await import("../../../src/bar/sender-service");

    const service = createBarMessageSenderService({
      pollIntervalMs: 50,
      onIdle,
    });

    service.start();

    // Wait for at least one poll cycle
    await new Promise((resolve) => setTimeout(resolve, 100));

    service.stop();

    expect(onIdle).toHaveBeenCalled();
  });

  test("calls onError when processing fails", async () => {
    const onError = mock(() => {});
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.reject(new Error("Network error"))),
      putResource: mock(() => Promise.resolve({})),
    };

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { createBarMessageSenderService } = await import("../../../src/bar/sender-service");

    const service = createBarMessageSenderService({
      pollIntervalMs: 50,
      onError,
    });

    service.start();

    // Wait for at least one poll cycle
    await new Promise((resolve) => setTimeout(resolve, 100));

    service.stop();

    expect(onError).toHaveBeenCalled();
  });

  test("processes messages immediately when found", async () => {
    let pollCount = 0;
    const onIdle = mock(() => {});

    const mockAidbox = {
      aidboxFetch: mock((path: string) => {
        if (path.includes("OutgoingBarMessage?status=pending")) {
          pollCount++;
          if (pollCount <= 2) {
            // Return message for first two polls
            return Promise.resolve({
              total: 1,
              entry: [{ resource: { ...testOutgoingMessage, id: `msg-${pollCount}` } }],
            });
          }
          // No more messages
          return Promise.resolve({ total: 0, entry: [] });
        }
        // POST IncomingHL7v2Message
        return Promise.resolve({ resourceType: "IncomingHL7v2Message" });
      }),
      putResource: mock(() => Promise.resolve({})),
    };

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { createBarMessageSenderService } = await import("../../../src/bar/sender-service");

    const service = createBarMessageSenderService({
      pollIntervalMs: 1000, // Long interval
      onIdle,
    });

    service.start();

    // Should process all messages quickly (not waiting for poll interval)
    await new Promise((resolve) => setTimeout(resolve, 200));

    service.stop();

    // Should have polled 3 times (2 messages + 1 empty)
    expect(pollCount).toBe(3);
    // onIdle should be called once (after finding no more messages)
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});

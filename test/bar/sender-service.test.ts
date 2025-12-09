import { test, expect, describe, beforeEach, mock, spyOn } from "bun:test";
import {
  pollPendingMessage,
  sendAsIncomingMessage,
  markAsSent,
  processNextMessage,
  createBarMessageSenderService,
  type OutgoingBarMessage,
} from "../../src/bar/sender-service";
import * as aidbox from "../../src/aidbox";

// Mock fetch for testing
const mockFetch = mock(() => Promise.resolve(new Response()));

// Test fixtures
const testOutgoingMessage: OutgoingBarMessage = {
  resourceType: "OutgoingBarMessage",
  id: "msg-1",
  patient: { reference: "Patient/patient-1" },
  invoice: { reference: "Invoice/invoice-1" },
  status: "pending",
  hl7v2: "MSH|^~\\&|SENDER|FAC|RECV|FAC|202312151000||BAR^P01|MSG001|P|2.5\rPID|1||MRN12345||Smith^John",
};

describe("pollPendingMessage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("returns null when no pending messages", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ total: 0 }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    try {
      const result = await pollPendingMessage();
      expect(result).toBeNull();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/fhir/OutgoingBarMessage");
      expect(url).toContain("status=pending");
      expect(url).toContain("_sort=_lastUpdated");
      expect(url).toContain("_count=1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("returns message when pending message exists", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            total: 1,
            entry: [{ resource: testOutgoingMessage }],
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      )
    );

    try {
      const result = await pollPendingMessage();
      expect(result).toEqual(testOutgoingMessage);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("sendAsIncomingMessage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("creates IncomingHL7v2Message from OutgoingBarMessage", async () => {
    const originalFetch = globalThis.fetch;
    const createdMessage = {
      resourceType: "IncomingHL7v2Message",
      id: "incoming-1",
      type: "BAR",
      date: "2023-12-15T10:00:00Z",
      patient: testOutgoingMessage.patient,
      message: testOutgoingMessage.hl7v2,
    };

    globalThis.fetch = mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(createdMessage), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    try {
      const result = await sendAsIncomingMessage(testOutgoingMessage);

      expect(result).toEqual(createdMessage);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/fhir/IncomingHL7v2Message");
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body as string);
      expect(body.resourceType).toBe("IncomingHL7v2Message");
      expect(body.type).toBe("BAR");
      expect(body.patient).toEqual(testOutgoingMessage.patient);
      expect(body.message).toBe(testOutgoingMessage.hl7v2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("markAsSent", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("updates message status to sent", async () => {
    const originalFetch = globalThis.fetch;
    const updatedMessage = { ...testOutgoingMessage, status: "sent" };

    globalThis.fetch = mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(updatedMessage), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    try {
      const result = await markAsSent(testOutgoingMessage);

      expect(result.status).toBe("sent");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain(`/fhir/OutgoingBarMessage/${testOutgoingMessage.id}`);
      expect(options.method).toBe("PUT");

      const body = JSON.parse(options.body as string);
      expect(body.status).toBe("sent");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("processNextMessage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("returns false when no pending messages", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ total: 0 }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    try {
      const result = await processNextMessage();
      expect(result).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("processes message and returns true", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;

    globalThis.fetch = mockFetch.mockImplementation((url: string) => {
      callCount++;
      if (callCount === 1) {
        // Poll returns message
        return Promise.resolve(
          new Response(
            JSON.stringify({
              total: 1,
              entry: [{ resource: testOutgoingMessage }],
            }),
            { headers: { "Content-Type": "application/json" } }
          )
        );
      } else if (callCount === 2) {
        // POST IncomingHL7v2Message
        return Promise.resolve(
          new Response(
            JSON.stringify({
              resourceType: "IncomingHL7v2Message",
              id: "incoming-1",
            }),
            { headers: { "Content-Type": "application/json" } }
          )
        );
      } else {
        // PUT to update status
        return Promise.resolve(
          new Response(JSON.stringify({ ...testOutgoingMessage, status: "sent" }), {
            headers: { "Content-Type": "application/json" },
          })
        );
      }
    });

    try {
      const result = await processNextMessage();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("createBarMessageSenderService", () => {
  test("starts and stops correctly", () => {
    const service = createBarMessageSenderService({ pollIntervalMs: 100 });

    expect(service.isRunning()).toBe(false);

    service.start();
    expect(service.isRunning()).toBe(true);

    service.stop();
    expect(service.isRunning()).toBe(false);
  });

  test("start is idempotent", () => {
    const service = createBarMessageSenderService({ pollIntervalMs: 100 });

    service.start();
    service.start(); // Should not throw or cause issues
    expect(service.isRunning()).toBe(true);

    service.stop();
  });

  test("calls onIdle when no messages found", async () => {
    const originalFetch = globalThis.fetch;
    const onIdle = mock(() => {});

    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ total: 0 }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    try {
      const service = createBarMessageSenderService({
        pollIntervalMs: 50,
        onIdle,
      });

      service.start();

      // Wait for at least one poll cycle
      await new Promise((resolve) => setTimeout(resolve, 100));

      service.stop();

      expect(onIdle).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("calls onError when processing fails", async () => {
    const originalFetch = globalThis.fetch;
    const onError = mock(() => {});

    globalThis.fetch = mock(() => Promise.reject(new Error("Network error")));

    try {
      const service = createBarMessageSenderService({
        pollIntervalMs: 50,
        onError,
      });

      service.start();

      // Wait for at least one poll cycle
      await new Promise((resolve) => setTimeout(resolve, 100));

      service.stop();

      expect(onError).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("processes messages immediately when found", async () => {
    const originalFetch = globalThis.fetch;
    let pollCount = 0;

    globalThis.fetch = mock((url: string, options?: RequestInit) => {
      if (url.includes("OutgoingBarMessage?status=pending")) {
        pollCount++;
        if (pollCount <= 2) {
          // Return message for first two polls
          return Promise.resolve(
            new Response(
              JSON.stringify({
                total: 1,
                entry: [{ resource: { ...testOutgoingMessage, id: `msg-${pollCount}` } }],
              }),
              { headers: { "Content-Type": "application/json" } }
            )
          );
        }
        // No more messages
        return Promise.resolve(
          new Response(JSON.stringify({ total: 0 }), {
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      // POST or PUT
      return Promise.resolve(
        new Response(JSON.stringify({ resourceType: "IncomingHL7v2Message" }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    try {
      const onIdle = mock(() => {});
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
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

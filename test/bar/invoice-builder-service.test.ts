import { test, expect, describe, beforeEach, mock } from "bun:test";
import {
  pollDraftInvoice,
  buildBarFromInvoice,
  processNextInvoice,
  createInvoiceBarBuilderService,
  type Invoice,
} from "../../src/bar/invoice-builder-service";

// Mock fetch for testing
const mockFetch = mock(() => Promise.resolve(new Response()));

// Test fixtures
const testInvoice: Invoice = {
  resourceType: "Invoice",
  id: "invoice-1",
  status: "draft",
  subject: { reference: "Patient/patient-1" },
};

const testPatient = {
  resourceType: "Patient",
  id: "patient-1",
  identifier: [{ value: "MRN12345" }],
  name: [{ family: "Smith", given: ["John"] }],
  birthDate: "1985-03-15",
  gender: "male",
};

describe("pollDraftInvoice", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("returns null when no draft invoices", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ total: 0 }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    try {
      const result = await pollDraftInvoice();
      expect(result).toBeNull();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/fhir/Invoice");
      expect(url).toContain("status=draft");
      expect(url).toContain("_sort=_lastUpdated");
      expect(url).toContain("_count=1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("returns invoice when draft invoice exists", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            total: 1,
            entry: [{ resource: testInvoice }],
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      )
    );

    try {
      const result = await pollDraftInvoice();
      expect(result).toEqual(testInvoice);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("buildBarFromInvoice", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("builds BAR message from invoice with patient", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = mockFetch.mockImplementation((url: string) => {
      if (url.includes("/fhir/Patient/")) {
        return Promise.resolve(
          new Response(JSON.stringify(testPatient), {
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      // Return empty bundles for other resources
      return Promise.resolve(
        new Response(JSON.stringify({ total: 0 }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    try {
      const hl7v2 = await buildBarFromInvoice(testInvoice);

      expect(hl7v2).toContain("MSH|");
      expect(hl7v2).toContain("BAR^P01");
      expect(hl7v2).toContain("PID|");
      expect(hl7v2).toContain("MRN12345");
      expect(hl7v2).toContain("Smith");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("throws error when invoice has no patient", async () => {
    const invoiceNoPatient: Invoice = {
      resourceType: "Invoice",
      id: "invoice-2",
      status: "draft",
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ total: 0 }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    try {
      await expect(buildBarFromInvoice(invoiceNoPatient)).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("processNextInvoice", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("returns false when no draft invoices", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ total: 0 }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    try {
      const result = await processNextInvoice();
      expect(result).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("processes invoice and returns true", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;

    globalThis.fetch = mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      callCount++;

      // Poll for draft invoice
      if (url.includes("/fhir/Invoice?status=draft")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              total: 1,
              entry: [{ resource: testInvoice }],
            }),
            { headers: { "Content-Type": "application/json" } }
          )
        );
      }

      // Fetch patient
      if (url.includes("/fhir/Patient/")) {
        return Promise.resolve(
          new Response(JSON.stringify(testPatient), {
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      // POST OutgoingBarMessage
      if (url.includes("/fhir/OutgoingBarMessage") && options?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              resourceType: "OutgoingBarMessage",
              id: "msg-1",
            }),
            { headers: { "Content-Type": "application/json" } }
          )
        );
      }

      // PATCH Invoice status
      if (url.includes("/fhir/Invoice/") && options?.method === "PATCH") {
        return Promise.resolve(
          new Response(JSON.stringify({ ...testInvoice, status: "issued" }), {
            headers: { "Content-Type": "application/json" },
          })
        );
      }

      // Return empty bundles for other resources
      return Promise.resolve(
        new Response(JSON.stringify({ total: 0 }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    try {
      const result = await processNextInvoice();
      expect(result).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("createInvoiceBarBuilderService", () => {
  test("starts and stops correctly", () => {
    const service = createInvoiceBarBuilderService({ pollIntervalMs: 100 });

    expect(service.isRunning()).toBe(false);

    service.start();
    expect(service.isRunning()).toBe(true);

    service.stop();
    expect(service.isRunning()).toBe(false);
  });

  test("start is idempotent", () => {
    const service = createInvoiceBarBuilderService({ pollIntervalMs: 100 });

    service.start();
    service.start(); // Should not throw or cause issues
    expect(service.isRunning()).toBe(true);

    service.stop();
  });

  test("calls onIdle when no draft invoices found", async () => {
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
      const service = createInvoiceBarBuilderService({
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
      const service = createInvoiceBarBuilderService({
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
});

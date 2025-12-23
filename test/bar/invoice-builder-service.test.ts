import { test, expect, describe, beforeEach, mock } from "bun:test";
import type { Invoice } from "../../src/fhir/hl7-fhir-r4-core/Invoice";

// Test fixtures
const testInvoice: Invoice & { id: string } = {
  resourceType: "Invoice",
  id: "invoice-1",
  status: "draft",
  subject: { reference: "Patient/patient-1" },
  extension: [
    {
      url: "http://example.org/invoice-processing-status",
      valueCode: "pending",
    },
  ],
};

const testPatient = {
  resourceType: "Patient",
  id: "patient-1",
  identifier: [{ value: "MRN12345" }],
  name: [{ family: "Smith", given: ["John"] }],
  birthDate: "1985-03-15",
  gender: "male",
};

describe("pollPendingInvoice", () => {
  const mockAidbox = {
    aidboxFetch: mock(() => Promise.resolve({ entry: [] })),
    putResource: mock(() => Promise.resolve({})),
    getResources: mock(() => Promise.resolve([])),
  };

  beforeEach(() => {
    mockAidbox.aidboxFetch.mockClear();
  });

  test("returns null when no pending invoices", async () => {
    mockAidbox.aidboxFetch.mockImplementation(() =>
      Promise.resolve({ total: 0, entry: [] })
    );

    mock.module("../../src/aidbox", () => mockAidbox);
    const { pollPendingInvoice } = await import("../../src/bar/invoice-builder-service");

    const result = await pollPendingInvoice();
    expect(result).toBeNull();
  });

  test("returns invoice when pending invoice exists", async () => {
    mockAidbox.aidboxFetch.mockImplementation(() =>
      Promise.resolve({
        total: 1,
        entry: [{ resource: testInvoice }],
      })
    );

    mock.module("../../src/aidbox", () => mockAidbox);
    const { pollPendingInvoice } = await import("../../src/bar/invoice-builder-service");

    const result = await pollPendingInvoice();
    expect(result).toEqual(testInvoice);
  });
});

describe("buildBarFromInvoice", () => {
  test("builds BAR message from invoice with patient", async () => {
    const mockAidbox = {
      aidboxFetch: mock((path: string) => {
        if (path.includes("/fhir/Patient/")) {
          return Promise.resolve(testPatient);
        }
        // Return empty bundles for other resources
        return Promise.resolve({ total: 0, entry: [] });
      }),
      putResource: mock(() => Promise.resolve({})),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { buildBarFromInvoice } = await import("../../src/bar/invoice-builder-service");

    const hl7v2 = await buildBarFromInvoice(testInvoice);

    expect(hl7v2).toContain("MSH|");
    expect(hl7v2).toContain("BAR^P01");
    expect(hl7v2).toContain("PID|");
    expect(hl7v2).toContain("Smith");
  });

  test("throws error when invoice has no patient", async () => {
    const invoiceNoPatient = {
      resourceType: "Invoice",
      id: "invoice-2",
      status: "draft",
    } as Invoice & { id: string };

    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve({ total: 0, entry: [] })),
      putResource: mock(() => Promise.resolve({})),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { buildBarFromInvoice } = await import("../../src/bar/invoice-builder-service");

    await expect(buildBarFromInvoice(invoiceNoPatient)).rejects.toThrow();
  });
});

describe("processNextInvoice", () => {
  test("returns false when no pending invoices", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve({ total: 0, entry: [] })),
      putResource: mock(() => Promise.resolve({})),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { processNextInvoice } = await import("../../src/bar/invoice-builder-service");

    const result = await processNextInvoice();
    expect(result).toBe(false);
  });

  test("updates status to error when invoice has no patient subject", async () => {
    const invoiceWithoutPatient: Invoice & { id: string } = {
      resourceType: "Invoice",
      id: "invoice-no-patient",
      status: "draft",
      extension: [
        {
          url: "http://example.org/invoice-processing-status",
          valueCode: "pending",
        },
      ],
    };

    const patchCalls: string[] = [];

    const mockAidbox = {
      aidboxFetch: mock((path: string, options?: any) => {
        // Poll for pending invoice
        if (path.includes("/fhir/Invoice?processing-status=pending")) {
          return Promise.resolve({
            total: 1,
            entry: [{ resource: invoiceWithoutPatient }],
          });
        }

        // PATCH Invoice status
        if (path.includes("/fhir/Invoice/") && options?.method === "PATCH") {
          patchCalls.push(options.body);
          return Promise.resolve(invoiceWithoutPatient);
        }

        // Return empty for other resources
        return Promise.resolve({ total: 0, entry: [] });
      }),
      putResource: mock(() => Promise.resolve({})),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { processNextInvoice } = await import("../../src/bar/invoice-builder-service");

    const result = await processNextInvoice();
    expect(result).toBe(true);

    // Verify PATCH was called
    expect(patchCalls.length).toBe(1);

    const patchBody = JSON.parse(patchCalls[0]!);
    expect(patchBody.resourceType).toBe("Parameters");

    // Verify status is set to "error"
    const statusOperation = patchBody.parameter.find((p: any) =>
      p.part?.some((part: any) => part.name === "value" && part.valueCode === "error")
    );
    expect(statusOperation).toBeDefined();
  });

  test("processes invoice and returns true", async () => {
    const mockAidbox = {
      aidboxFetch: mock((path: string, options?: any) => {
        // Poll for pending invoice
        if (path.includes("/fhir/Invoice?processing-status=pending")) {
          return Promise.resolve({
            total: 1,
            entry: [{ resource: testInvoice }],
          });
        }

        // Fetch patient
        if (path.includes("/fhir/Patient/")) {
          return Promise.resolve(testPatient);
        }

        // POST OutgoingBarMessage
        if (path.includes("/fhir/OutgoingBarMessage") && options?.method === "POST") {
          return Promise.resolve({
            resourceType: "OutgoingBarMessage",
            id: "msg-1",
          });
        }

        // PATCH Invoice status
        if (path.includes("/fhir/Invoice/") && options?.method === "PATCH") {
          return Promise.resolve({ ...testInvoice, status: "issued" });
        }

        // Return empty bundles for other resources
        return Promise.resolve({ total: 0, entry: [] });
      }),
      putResource: mock(() => Promise.resolve({})),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { processNextInvoice } = await import("../../src/bar/invoice-builder-service");

    const result = await processNextInvoice();
    expect(result).toBe(true);
  });
});

describe("createInvoiceBarBuilderService", () => {
  test("starts and stops correctly", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve({ entry: [] })),
      putResource: mock(() => Promise.resolve({})),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { createInvoiceBarBuilderService } = await import("../../src/bar/invoice-builder-service");

    const service = createInvoiceBarBuilderService({ pollIntervalMs: 100 });

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
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { createInvoiceBarBuilderService } = await import("../../src/bar/invoice-builder-service");

    const service = createInvoiceBarBuilderService({ pollIntervalMs: 100 });

    service.start();
    service.start(); // Should not throw or cause issues
    expect(service.isRunning()).toBe(true);

    service.stop();
  });

  test("calls onIdle when no pending invoices found", async () => {
    const onIdle = mock(() => {});
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve({ total: 0, entry: [] })),
      putResource: mock(() => Promise.resolve({})),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { createInvoiceBarBuilderService } = await import("../../src/bar/invoice-builder-service");

    const service = createInvoiceBarBuilderService({
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
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { createInvoiceBarBuilderService } = await import("../../src/bar/invoice-builder-service");

    const service = createInvoiceBarBuilderService({
      pollIntervalMs: 50,
      onError,
    });

    service.start();

    // Wait for at least one poll cycle
    await new Promise((resolve) => setTimeout(resolve, 100));

    service.stop();

    expect(onError).toHaveBeenCalled();
  });
});

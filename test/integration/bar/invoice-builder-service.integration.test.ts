/**
 * Integration tests for Invoice BAR Builder Service.
 *
 * These tests verify invoice processing against a real Aidbox instance.
 * They test: polling → BAR generation → outgoing message creation → status updates.
 */
import { describe, test, expect, mock } from "bun:test";
import {
  testAidboxFetch,
  getOutgoingBarMessages,
} from "../helpers";
import {
  pollPendingInvoice,
  buildBarFromInvoice,
  processNextInvoice,
  updateInvoiceStatus,
  createInvoiceBarBuilderService,
} from "../../../src/bar/invoice-builder-service";
import type { Invoice } from "../../../src/fhir/hl7-fhir-r4-core/Invoice";
import type { Patient } from "../../../src/fhir/hl7-fhir-r4-core/Patient";
import type { Account } from "../../../src/fhir/hl7-fhir-r4-core/Account";

async function createTestPatient(id: string): Promise<Patient> {
  return testAidboxFetch<Patient>(`/fhir/Patient/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      resourceType: "Patient",
      id,
      identifier: [{ value: "MRN12345" }],
      name: [{ family: "Smith", given: ["John"] }],
      birthDate: "1985-03-15",
      gender: "male",
    }),
  });
}

async function createTestAccount(id: string, patientId: string): Promise<Account> {
  return testAidboxFetch<Account>(`/fhir/Account/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      resourceType: "Account",
      id,
      status: "active",
      identifier: [{ value: `ACCT-${id}` }],
      subject: [{ reference: `Patient/${patientId}` }],
    }),
  });
}

async function createTestInvoice(
  id: string,
  patientId: string,
  accountId: string,
  processingStatus: string = "pending",
): Promise<Invoice & { id: string }> {
  return testAidboxFetch<Invoice & { id: string }>(`/fhir/Invoice/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      resourceType: "Invoice",
      id,
      status: "draft",
      subject: { reference: `Patient/${patientId}` },
      account: { reference: `Account/${accountId}` },
      extension: [
        {
          url: "http://example.org/invoice-processing-status",
          valueCode: processingStatus,
        },
      ],
    }),
  });
}

async function createInvoiceWithoutPatient(id: string): Promise<Invoice & { id: string }> {
  return testAidboxFetch<Invoice & { id: string }>(`/fhir/Invoice/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      resourceType: "Invoice",
      id,
      status: "draft",
      extension: [
        {
          url: "http://example.org/invoice-processing-status",
          valueCode: "pending",
        },
      ],
    }),
  });
}

async function fetchInvoice(id: string): Promise<Invoice & { id: string }> {
  return testAidboxFetch<Invoice & { id: string }>(`/fhir/Invoice/${id}`);
}

function getProcessingStatus(invoice: Invoice): string | undefined {
  return (
    invoice.extension?.find(
      (e) => e.url === "http://example.org/invoice-processing-status",
    ) as { valueCode?: string } | undefined
  )?.valueCode;
}

describe("Invoice BAR Builder Service E2E Integration", () => {
  describe("pollPendingInvoice", () => {
    test("returns null when no pending invoices", async () => {
      const result = await pollPendingInvoice();
      expect(result).toBeNull();
    });

    test("returns invoice when pending invoice exists", async () => {
      await createTestPatient("patient-poll");
      await createTestAccount("account-poll", "patient-poll");
      await createTestInvoice("invoice-poll", "patient-poll", "account-poll");

      const result = await pollPendingInvoice();
      expect(result).not.toBeNull();
      expect(result!.id).toBe("invoice-poll");
    });
  });

  describe("buildBarFromInvoice", () => {
    test("builds BAR message from invoice with patient", async () => {
      await createTestPatient("patient-bar");
      await createTestAccount("account-bar", "patient-bar");
      const invoice = await createTestInvoice("invoice-bar", "patient-bar", "account-bar");

      const hl7v2 = await buildBarFromInvoice(invoice);

      expect(hl7v2).toContain("MSH|");
      expect(hl7v2).toContain("BAR^P01");
      expect(hl7v2).toContain("PID|");
      expect(hl7v2).toContain("Smith");
    });

    test("throws error when invoice has no patient", async () => {
      const invoice = await createInvoiceWithoutPatient("invoice-no-patient");

      await expect(buildBarFromInvoice(invoice)).rejects.toThrow();
    });
  });

  describe("processNextInvoice", () => {
    test("returns false when no pending invoices", async () => {
      const result = await processNextInvoice();
      expect(result).toBe(false);
    });

    test("processes invoice and creates OutgoingBarMessage", async () => {
      await createTestPatient("patient-process");
      await createTestAccount("account-process", "patient-process");
      await createTestInvoice("invoice-process", "patient-process", "account-process");

      const result = await processNextInvoice();
      expect(result).toBe(true);

      const messages = await getOutgoingBarMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].status).toBe("pending");
      expect(messages[0].hl7v2).toContain("MSH|");
      expect(messages[0].invoice.reference).toBe("Invoice/invoice-process");

      const invoice = await fetchInvoice("invoice-process");
      expect(getProcessingStatus(invoice)).toBe("completed");
      expect(invoice.status).toBe("issued");
    });

    test("updates status to error when invoice has no patient subject", async () => {
      await createInvoiceWithoutPatient("invoice-no-patient-process");

      const result = await processNextInvoice();
      expect(result).toBe(true);

      const invoice = await fetchInvoice("invoice-no-patient-process");
      expect(getProcessingStatus(invoice)).toBe("error");
    });
  });

  describe("updateInvoiceStatus", () => {
    test("sets Invoice.status to 'issued' when processing-status is 'completed'", async () => {
      await createTestPatient("patient-status");
      await createTestAccount("account-status", "patient-status");
      await createTestInvoice("invoice-status-complete", "patient-status", "account-status");

      await updateInvoiceStatus("invoice-status-complete", "completed");

      const invoice = await fetchInvoice("invoice-status-complete");
      expect(getProcessingStatus(invoice)).toBe("completed");
      expect(invoice.status).toBe("issued");
    });

    test("does NOT set Invoice.status when processing-status is 'error'", async () => {
      await createTestPatient("patient-status-err");
      await createTestAccount("account-status-err", "patient-status-err");
      await createTestInvoice("invoice-status-error", "patient-status-err", "account-status-err");

      await updateInvoiceStatus("invoice-status-error", "error", { reason: "Test error" });

      const invoice = await fetchInvoice("invoice-status-error");
      expect(getProcessingStatus(invoice)).toBe("error");
      expect(invoice.status).toBe("draft");
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

    test("calls onIdle when no pending invoices found", async () => {
      const onIdle = mock(() => {});

      const service = createInvoiceBarBuilderService({
        pollIntervalMs: 50,
        onIdle,
      });

      service.start();
      await new Promise((resolve) => setTimeout(resolve, 200));
      service.stop();

      expect(onIdle).toHaveBeenCalled();
    });
  });
});

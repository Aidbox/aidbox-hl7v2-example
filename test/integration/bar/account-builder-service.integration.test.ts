/**
 * Integration tests for Account BAR Builder Service.
 *
 * These tests verify account processing against a real Aidbox instance.
 * They test: polling → BAR generation → outgoing message creation → status updates.
 */
import { describe, test, expect, mock } from "bun:test";
import {
  aidboxFetch,
  getOutgoingBarMessages,
} from "../helpers";
import {
  pollPendingAccount,
  buildBarFromAccount,
  processNextAccount,
  updateAccountStatus,
  createAccountBarBuilderService,
} from "../../../src/bar/account-builder-service";
import type { Account } from "../../../src/fhir/hl7-fhir-r4-core/Account";
import type { Patient } from "../../../src/fhir/hl7-fhir-r4-core/Patient";

async function createTestPatient(id: string): Promise<Patient> {
  return aidboxFetch<Patient>(`/fhir/Patient/${id}`, {
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

async function createTestAccount(
  id: string,
  patientId: string,
  processingStatus: string = "pending",
): Promise<Account & { id: string }> {
  return aidboxFetch<Account & { id: string }>(`/fhir/Account/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      resourceType: "Account",
      id,
      status: "active",
      identifier: [{ value: `ACCT-${id}` }],
      subject: [{ reference: `Patient/${patientId}` }],
      extension: [
        {
          url: "http://example.org/account-processing-status",
          valueCode: processingStatus,
        },
      ],
    }),
  });
}

async function createAccountWithoutPatient(id: string): Promise<Account & { id: string }> {
  return aidboxFetch<Account & { id: string }>(`/fhir/Account/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      resourceType: "Account",
      id,
      status: "active",
      extension: [
        {
          url: "http://example.org/account-processing-status",
          valueCode: "pending",
        },
      ],
    }),
  });
}

async function fetchAccount(id: string): Promise<Account & { id: string }> {
  return aidboxFetch<Account & { id: string }>(`/fhir/Account/${id}`);
}

function getProcessingStatus(account: Account): string | undefined {
  return (
    account.extension?.find(
      (e) => e.url === "http://example.org/account-processing-status",
    ) as { valueCode?: string } | undefined
  )?.valueCode;
}

describe("Account BAR Builder Service E2E Integration", () => {
  describe("pollPendingAccount", () => {
    test("returns null when no pending accounts", async () => {
      const result = await pollPendingAccount();
      expect(result).toBeNull();
    });

    test("returns account when pending account exists", async () => {
      await createTestPatient("patient-poll");
      await createTestAccount("account-poll", "patient-poll");

      const result = await pollPendingAccount();
      expect(result).not.toBeNull();
      expect(result!.id).toBe("account-poll");
    });
  });

  describe("buildBarFromAccount", () => {
    test("builds BAR message from account with patient", async () => {
      await createTestPatient("patient-bar");
      const account = await createTestAccount("account-bar", "patient-bar");

      const hl7v2 = await buildBarFromAccount(account);

      expect(hl7v2).toContain("MSH|");
      expect(hl7v2).toContain("BAR^P01");
      expect(hl7v2).toContain("PID|");
      expect(hl7v2).toContain("Smith");
    });

    test("throws error when account has no patient", async () => {
      const account = await createAccountWithoutPatient("account-no-patient");

      await expect(buildBarFromAccount(account)).rejects.toThrow();
    });
  });

  describe("processNextAccount", () => {
    test("returns false when no pending accounts", async () => {
      const result = await processNextAccount();
      expect(result).toBe(false);
    });

    test("processes account and creates OutgoingBarMessage", async () => {
      await createTestPatient("patient-process");
      await createTestAccount("account-process", "patient-process");

      const result = await processNextAccount();
      expect(result).toBe(true);

      const messages = await getOutgoingBarMessages();
      expect(messages.length).toBe(1);
      expect(messages[0]!.status).toBe("pending");
      expect(messages[0]!.hl7v2).toContain("MSH|");
      expect(messages[0]!.account.reference).toBe("Account/account-process");

      const account = await fetchAccount("account-process");
      expect(getProcessingStatus(account)).toBe("completed");
    });

    test("updates status to error when account has no patient subject", async () => {
      await createAccountWithoutPatient("account-no-patient-process");

      const result = await processNextAccount();
      expect(result).toBe(true);

      const account = await fetchAccount("account-no-patient-process");
      expect(getProcessingStatus(account)).toBe("error");
    });
  });

  describe("updateAccountStatus", () => {
    test("sets processing-status to 'completed'", async () => {
      await createTestPatient("patient-status");
      await createTestAccount("account-status-complete", "patient-status");

      await updateAccountStatus("account-status-complete", "completed");

      const account = await fetchAccount("account-status-complete");
      expect(getProcessingStatus(account)).toBe("completed");
    });

    test("sets processing-status to 'error' with reason", async () => {
      await createTestPatient("patient-status-err");
      await createTestAccount("account-status-error", "patient-status-err");

      await updateAccountStatus("account-status-error", "error", { reason: "Test error" });

      const account = await fetchAccount("account-status-error");
      expect(getProcessingStatus(account)).toBe("error");
    });
  });

  describe("createAccountBarBuilderService", () => {
    test("starts and stops correctly", () => {
      const service = createAccountBarBuilderService({ pollIntervalMs: 100 });

      expect(service.isRunning()).toBe(false);

      service.start();
      expect(service.isRunning()).toBe(true);

      service.stop();
      expect(service.isRunning()).toBe(false);
    });

    test("calls onIdle when no pending accounts found", async () => {
      const onIdle = mock(() => {});

      const service = createAccountBarBuilderService({
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

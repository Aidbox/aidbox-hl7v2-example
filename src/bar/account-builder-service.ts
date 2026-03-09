/**
 * Account BAR Builder Service
 *
 * Polls for pending Accounts and generates BAR messages.
 *
 * Environment variables:
 * - FHIR_APP: Sending application name for MSH-3 (e.g., "HOSPITAL_EMR")
 * - FHIR_FAC: Sending facility name for MSH-4 (e.g., "MAIN_CAMPUS")
 * - BILLING_APP: Receiving application name for MSH-5 (e.g., "BILLING_SYSTEM")
 * - BILLING_FAC: Receiving facility name for MSH-6 (e.g., "BILLING_DEPT")
 */

import { aidboxFetch, type Bundle } from "../aidbox";
import { generateBarMessage } from "./generator";
import { formatMessage } from "@atomic-ehr/hl7v2/src/hl7v2/format";
import type { Account } from "../fhir/hl7-fhir-r4-core/Account";
import type { Condition } from "../fhir/hl7-fhir-r4-core/Condition";
import type { Coverage } from "../fhir/hl7-fhir-r4-core/Coverage";
import type { Encounter } from "../fhir/hl7-fhir-r4-core/Encounter";
import type { Organization } from "../fhir/hl7-fhir-r4-core/Organization";
import type { Patient } from "../fhir/hl7-fhir-r4-core/Patient";
import type { Procedure } from "../fhir/hl7-fhir-r4-core/Procedure";
import type { RelatedPerson } from "../fhir/hl7-fhir-r4-core/RelatedPerson";
import type { OutgoingBarMessage } from "../fhir/aidbox-hl7v2-custom";

type AccountWithId = Account & { id: string };

const POLL_INTERVAL_MS = 60_000; // 1 minute
const MAX_RETRIES = 3;
const PROCESSING_STATUS_URL = "http://example.org/account-processing-status";
const RETRY_COUNT_URL = "http://example.org/account-processing-retry-count";
const ERROR_REASON_URL = "http://example.org/account-processing-error-reason";
const DIAGNOSIS_EXT_URL = "http://example.org/account-diagnosis";
const PROCEDURE_EXT_URL = "http://example.org/account-procedure";

export function getRetryCount(account: Account): number {
  const ext = account.extension?.find(e => e.url === RETRY_COUNT_URL);
  return (ext as { valueInteger?: number } | undefined)?.valueInteger ?? 0;
}

export async function pollPendingAccount(): Promise<Account | null> {
  const bundle = await aidboxFetch<Bundle<Account>>(
    "/fhir/Account?processing-status=pending&_sort=_lastUpdated&_count=1"
  );
  return bundle.entry?.[0]?.resource ?? null;
}

async function fetchResource<T>(reference: string): Promise<T | null> {
  try {
    return await aidboxFetch<T>(`/fhir/${reference}`);
  } catch {
    return null;
  }
}

/**
 * Extract reference strings from a complex extension with a sub-extension containing valueReference.
 * E.g., for account-diagnosis extension: each extension has sub-extension "condition" with valueReference.
 */
function extractRefsFromExtension(
  account: Account,
  extUrl: string,
  subExtUrl: string,
): string[] {
  if (!account.extension) return [];

  const refs: string[] = [];
  for (const ext of account.extension) {
    if (ext.url !== extUrl) continue;
    const subExts = (ext as { extension?: Array<{ url: string; valueReference?: { reference?: string } }> }).extension;
    if (!subExts) continue;
    for (const sub of subExts) {
      if (sub.url === subExtUrl && sub.valueReference?.reference) {
        refs.push(sub.valueReference.reference);
      }
    }
  }
  return refs;
}

async function fetchRelatedResources(account: AccountWithId): Promise<{
  patient: Patient | null;
  encounter: Encounter | null;
  coverages: Coverage[];
  conditions: Condition[];
  procedures: Procedure[];
  guarantor: RelatedPerson | Patient | null;
  organizations: Map<string, Organization>;
}> {
  const result = {
    patient: null as Patient | null,
    encounter: null as Encounter | null,
    coverages: [] as Coverage[],
    conditions: [] as Condition[],
    procedures: [] as Procedure[],
    guarantor: null as RelatedPerson | Patient | null,
    organizations: new Map<string, Organization>(),
  };

  // Fetch patient from Account.subject[0]
  const patientRef = account.subject?.[0]?.reference;
  if (patientRef) {
    result.patient = await fetchResource<Patient>(patientRef);
  }

  // Fetch conditions from account-diagnosis extensions
  const conditionRefs = extractRefsFromExtension(account, DIAGNOSIS_EXT_URL, "condition");
  for (const ref of conditionRefs) {
    const condition = await fetchResource<Condition>(ref);
    if (condition) result.conditions.push(condition);
  }

  // Fetch procedures from account-procedure extensions
  const procedureRefs = extractRefsFromExtension(account, PROCEDURE_EXT_URL, "procedure");
  for (const ref of procedureRefs) {
    const procedure = await fetchResource<Procedure>(ref);
    if (procedure) result.procedures.push(procedure);
  }

  // Fetch coverages from Account.coverage[]
  if (account.coverage) {
    for (const cov of account.coverage) {
      const covRef = cov.coverage?.reference;
      if (covRef) {
        const coverage = await fetchResource<Coverage>(covRef);
        if (coverage) {
          result.coverages.push(coverage);

          // Fetch organizations from coverage payors
          const payorRef = coverage.payor?.[0]?.reference;
          if (payorRef?.startsWith("Organization/")) {
            const org = await fetchResource<Organization>(payorRef);
            if (org) result.organizations.set(payorRef, org);
          }
        }
      }
    }
  }

  // Fetch encounter by patient query
  if (result.patient) {
    const encounterBundle = await aidboxFetch<Bundle<Encounter>>(
      `/fhir/Encounter?subject=Patient/${result.patient.id}&_sort=-_lastUpdated&_count=1`
    );
    result.encounter = encounterBundle.entry?.[0]?.resource ?? null;
  }

  // Fetch guarantor from Account.guarantor[0].party
  const guarantorRef = account.guarantor?.[0]?.party?.reference;
  if (guarantorRef) {
    result.guarantor = await fetchResource<RelatedPerson | Patient>(guarantorRef);
  }

  // Fetch organization from Account.owner
  const ownerRef = (account as { owner?: { reference?: string } }).owner?.reference;
  if (ownerRef?.startsWith("Organization/") && !result.organizations.has(ownerRef)) {
    const org = await fetchResource<Organization>(ownerRef);
    if (org) result.organizations.set(ownerRef, org);
  }

  return result;
}

export async function buildBarFromAccount(account: AccountWithId): Promise<string> {
  const related = await fetchRelatedResources(account);

  if (!related.patient) {
    throw new Error("Account has no patient");
  }

  const messageControlId = `BAR-${account.id}-${Date.now()}`;
  const barMessage = generateBarMessage({
    patient: related.patient,
    account,
    encounter: related.encounter ?? undefined,
    coverages: related.coverages.length > 0 ? related.coverages : undefined,
    guarantor: related.guarantor ?? undefined,
    conditions: related.conditions.length > 0 ? related.conditions : undefined,
    procedures: related.procedures.length > 0 ? related.procedures : undefined,
    organizations: related.organizations.size > 0 ? related.organizations : undefined,
    messageControlId,
    triggerEvent: "P01",
    sendingApplication: process.env.FHIR_APP,
    sendingFacility: process.env.FHIR_FAC,
    receivingApplication: process.env.BILLING_APP,
    receivingFacility: process.env.BILLING_FAC
  });

  return formatMessage(barMessage);
}

export async function createOutgoingBarMessage(account: AccountWithId, hl7v2: string): Promise<OutgoingBarMessage> {
  const patientRef = account.subject?.[0]?.reference;
  const newMessage: OutgoingBarMessage = {
    resourceType: "OutgoingBarMessage",
    patient: { reference: patientRef! as `Patient/${string}` },
    account: { reference: `Account/${account.id}` },
    status: "pending",
    hl7v2,
  };

  return aidboxFetch<OutgoingBarMessage>("/fhir/OutgoingBarMessage", {
    method: "POST",
    body: JSON.stringify(newMessage),
  });
}

export async function updateAccountStatus(
  accountId: string,
  status: string,
  options?: { reason?: string; retryCount?: number }
): Promise<void> {
  const operations: Array<{ name: string; part: Array<Record<string, unknown>> }> = [
    {
      "name": "operation",
      "part": [
        { "name": "type", "valueCode": "replace" },
        { "name": "path", "valueString": `Account.extension.where(url='${PROCESSING_STATUS_URL}').value` },
        { "name": "value", "valueCode": status },
      ]
    }
  ];

  if (options?.reason) {
    operations.push(
      {
        "name": "operation",
        "part": [
          { "name": "type", "valueCode": "delete" },
          { "name": "path", "valueString": `Account.extension.where(url='${ERROR_REASON_URL}')` },
        ]
      },
      {
        "name": "operation",
        "part": [
          { "name": "type", "valueCode": "insert" },
          { "name": "path", "valueString": "Account.extension" },
          { "name": "index", "valueInteger": 0 },
          {
            "name": "value",
            "valueExtension": {
              "url": ERROR_REASON_URL,
              "valueString": options.reason,
            }
          }
        ]
      }
    );
  } else if (status === "pending") {
    operations.push({
      "name": "operation",
      "part": [
        { "name": "type", "valueCode": "delete" },
        { "name": "path", "valueString": `Account.extension.where(url='${ERROR_REASON_URL}')` },
      ]
    });
  }

  if (options?.retryCount !== undefined) {
    operations.push(
      {
        "name": "operation",
        "part": [
          { "name": "type", "valueCode": "delete" },
          { "name": "path", "valueString": `Account.extension.where(url='${RETRY_COUNT_URL}')` },
        ]
      },
      {
        "name": "operation",
        "part": [
          { "name": "type", "valueCode": "insert" },
          { "name": "path", "valueString": "Account.extension" },
          { "name": "index", "valueInteger": 0 },
          {
            "name": "value",
            "valueExtension": {
              "url": RETRY_COUNT_URL,
              "valueInteger": options.retryCount,
            }
          }
        ]
      }
    );
  }

  await aidboxFetch(`/fhir/Account/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify({
      "resourceType": "Parameters",
      "parameter": operations,
    }),
  });
}

export async function processNextAccount(): Promise<boolean> {
  const account = await pollPendingAccount() as AccountWithId | null;

  if (!account) {
    return false;
  }

  try {
    const hl7v2 = await buildBarFromAccount(account);
    await createOutgoingBarMessage(account, hl7v2);
    await updateAccountStatus(account.id, "completed");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await updateAccountStatus(account.id, "error", { reason: errorMessage });
  }

  return true;
}

export function createAccountBarBuilderService(options: {
  pollIntervalMs?: number;
  onError?: (error: Error) => void;
  onProcessed?: (account: Account) => void;
  onIdle?: () => void;
} = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  let running = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  async function poll() {
    if (!running) return;

    try {
      const processed = await processNextAccount();
      if (processed) {
        setImmediate(poll);
      } else {
        options.onIdle?.();
        timeoutId = setTimeout(poll, pollIntervalMs);
      }
    } catch (error) {
      options.onError?.(error as Error);
      timeoutId = setTimeout(poll, pollIntervalMs);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      poll();
    },

    stop() {
      running = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },

    isRunning() {
      return running;
    },
  };
}

// Main entry point when run directly
if (import.meta.main) {
  console.log("Starting Account BAR Builder Service...");
  console.log("Polling for pending Account resources every minute.");

  const service = createAccountBarBuilderService({
    onError: (error) => console.error("Error processing account:", error.message),
    onProcessed: (account) => console.log(`Processed account: ${account.id}`),
    onIdle: () => console.log("No pending accounts, waiting..."),
  });

  service.start();

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    service.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\nShutting down...");
    service.stop();
    process.exit(0);
  });
}

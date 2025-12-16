/**
 * Invoice BAR Builder Service
 *
 * Polls for pending Invoices and generates BAR messages.
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
import type { ChargeItem } from "../fhir/hl7-fhir-r4-core/ChargeItem";
import type { Condition } from "../fhir/hl7-fhir-r4-core/Condition";
import type { Coverage } from "../fhir/hl7-fhir-r4-core/Coverage";
import type { Encounter } from "../fhir/hl7-fhir-r4-core/Encounter";
import type { Invoice } from "../fhir/hl7-fhir-r4-core/Invoice";
import type { Organization } from "../fhir/hl7-fhir-r4-core/Organization";
import type { Patient } from "../fhir/hl7-fhir-r4-core/Patient";
import type { Practitioner } from "../fhir/hl7-fhir-r4-core/Practitioner";
import type { Procedure } from "../fhir/hl7-fhir-r4-core/Procedure";
import type { RelatedPerson } from "../fhir/hl7-fhir-r4-core/RelatedPerson";
import type { OutgoingBarMessage } from "../fhir/aidbox-hl7v2-custom";

// Type for Invoice with required id (as returned from Aidbox)
type InvoiceWithId = Invoice & { id: string };

const POLL_INTERVAL_MS = 60_000; // 1 minute
const MAX_RETRIES = 3;
const RETRY_COUNT_URL = "http://example.org/invoice-processing-retry-count";

export function getRetryCount(invoice: Invoice): number {
  const ext = invoice.extension?.find(e => e.url === RETRY_COUNT_URL);
  return (ext as { valueInteger?: number } | undefined)?.valueInteger ?? 0;
}

export async function pollPendingInvoice(): Promise<Invoice | null> {
  const bundle = await aidboxFetch<Bundle<Invoice>>(
    "/fhir/Invoice?processing-status=pending&_sort=_lastUpdated&_count=1"
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

async function fetchRelatedResources(invoice: InvoiceWithId): Promise<{
  patient: Patient | null;
  account: Account | null;
  encounter: Encounter | null;
  coverages: Coverage[];
  conditions: Condition[];
  procedures: Procedure[];
  guarantor: RelatedPerson | Patient | null;
  organizations: Map<string, Organization>;
  practitioners: Map<string, Practitioner>;
}> {
  const result = {
    patient: null as Patient | null,
    account: null as Account | null,
    encounter: null as Encounter | null,
    coverages: [] as Coverage[],
    conditions: [] as Condition[],
    procedures: [] as Procedure[],
    guarantor: null as RelatedPerson | Patient | null,
    organizations: new Map<string, Organization>(),
    practitioners: new Map<string, Practitioner>(),
  };

  // Fetch patient
  if (invoice.subject?.reference) {
    result.patient = await fetchResource<Patient>(invoice.subject.reference);
  }

  // Fetch account
  if (invoice.account?.reference) {
    result.account = await fetchResource<Account>(invoice.account.reference);
  }

  // If no account from invoice, create a minimal one from invoice
  if (!result.account && result.patient) {
    result.account = {
      resourceType: "Account",
      id: `account-${invoice.id}`,
      identifier: [{ value: invoice.id }],
      status: "active",
    };
  }

  // Fetch practitioners from Invoice.participant
  if (invoice.participant) {
    for (const participant of invoice.participant) {
      const actorRef = participant.actor?.reference;
      if (actorRef?.startsWith("Practitioner/")) {
        const practitioner = await fetchResource<Practitioner>(actorRef);
        if (practitioner) {
          result.practitioners.set(actorRef, practitioner);
        }
      }
    }
  }

  // Fetch related resources from Invoice.lineItem -> ChargeItem
  const chargeItemEncounters: Encounter[] = [];
  const chargeItemProcedures: Procedure[] = [];

  if (invoice.lineItem) {
    for (const lineItem of invoice.lineItem) {
      const chargeItemRef = lineItem.chargeItemReference?.reference;
      if (chargeItemRef) {
        const chargeItem = await fetchResource<ChargeItem>(chargeItemRef);
        if (chargeItem) {
          // Fetch Encounter from ChargeItem.context
          if (chargeItem.context?.reference?.startsWith("Encounter/")) {
            const encounter = await fetchResource<Encounter>(chargeItem.context.reference);
            if (encounter) {
              chargeItemEncounters.push(encounter);
            }
          }

          // Fetch Procedures from ChargeItem.service
          if (chargeItem.service) {
            for (const service of chargeItem.service) {
              if (service.reference?.startsWith("Procedure/")) {
                const procedure = await fetchResource<Procedure>(service.reference);
                if (procedure) {
                  chargeItemProcedures.push(procedure);
                }
              }
            }
          }
        }
      }
    }
  }

  // Use explicitly linked resources from ChargeItems
  result.encounter = chargeItemEncounters[0] ?? null;
  result.procedures = chargeItemProcedures;

  // Fetch coverages and conditions for patient
  if (result.patient) {
    const coverageBundle = await aidboxFetch<Bundle<Coverage>>(
      `/fhir/Coverage?beneficiary=Patient/${result.patient.id}&_count=10`
    );
    result.coverages = coverageBundle.entry?.map((e) => e.resource) || [];

    // Fetch organizations for coverage payors
    for (const coverage of result.coverages) {
      const payorRef = coverage.payor?.[0]?.reference;
      if (payorRef && payorRef.startsWith("Organization/")) {
        const org = await fetchResource<Organization>(payorRef);
        if (org) {
          result.organizations.set(payorRef, org);
        }
      }
    }

    // Fetch conditions for patient
    const conditionBundle = await aidboxFetch<Bundle<Condition>>(
      `/fhir/Condition?patient=Patient/${result.patient.id}&_count=10`
    );
    result.conditions = conditionBundle.entry?.map((e) => e.resource) || [];
  }

  return result;
}

export async function buildBarFromInvoice(invoice: InvoiceWithId): Promise<string> {
  const related = await fetchRelatedResources(invoice);

  if (!related.patient) {
    throw new Error("Invoice has no patient");
  }

  if (!related.account) {
    throw new Error("Invoice has no account");
  }

  const messageControlId = `BAR-${invoice.id}-${Date.now()}`;
  const barMessage = generateBarMessage({
    patient: related.patient,
    account: related.account,
    encounter: related.encounter ?? undefined,
    coverages: related.coverages.length > 0 ? related.coverages : undefined,
    guarantor: related.guarantor ?? undefined,
    conditions: related.conditions.length > 0 ? related.conditions : undefined,
    procedures: related.procedures.length > 0 ? related.procedures : undefined,
    organizations: related.organizations.size > 0 ? related.organizations : undefined,
    practitioners: related.practitioners.size > 0 ? related.practitioners : undefined,
    messageControlId,
    triggerEvent: "P01",
    sendingApplication: process.env.FHIR_APP,
    sendingFacility: process.env.FHIR_FAC,
    receivingApplication: process.env.BILLING_APP,
    receivingFacility: process.env.BILLING_FAC
  });

  return formatMessage(barMessage);
}

export async function createOutgoingBarMessage(invoice: InvoiceWithId, hl7v2: string): Promise<OutgoingBarMessage> {
  const newMessage: OutgoingBarMessage = {
    resourceType: "OutgoingBarMessage",
    patient: { reference: invoice.subject!.reference! as `Patient/${string}` },
    invoice: { reference: `Invoice/${invoice.id}` },
    status: "pending",
    hl7v2,
  };

  return aidboxFetch<OutgoingBarMessage>("/fhir/OutgoingBarMessage", {
    method: "POST",
    body: JSON.stringify(newMessage),
  });
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: string,
  options?: { reason?: string; retryCount?: number }
): Promise<void> {
  const operations: Array<{ name: string; part: Array<Record<string, unknown>> }> = [
    {
      "name": "operation",
      "part": [
        { "name": "type", "valueCode": "replace" },
        { "name": "path", "valueString": "Invoice.extension.where(url='http://example.org/invoice-processing-status').value" },
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
          { "name": "path", "valueString": "Invoice.extension.where(url='http://example.org/invoice-processing-error-reason')" },
        ]
      },
      {
        "name": "operation",
        "part": [
          { "name": "type", "valueCode": "insert" },
          { "name": "path", "valueString": "Invoice.extension" },
          { "name": "index", "valueInteger": 0 },
          {
            "name": "value",
            "valueExtension": {
              "url": "http://example.org/invoice-processing-error-reason",
              "valueString": options.reason,
            }
          }
        ]
      }
    );
  } else if (status === "pending") {
    // Remove error reason when setting to pending
    operations.push({
      "name": "operation",
      "part": [
        { "name": "type", "valueCode": "delete" },
        { "name": "path", "valueString": "Invoice.extension.where(url='http://example.org/invoice-processing-error-reason')" },
      ]
    });
  }

  if (options?.retryCount !== undefined) {
    operations.push(
      {
        "name": "operation",
        "part": [
          { "name": "type", "valueCode": "delete" },
          { "name": "path", "valueString": `Invoice.extension.where(url='${RETRY_COUNT_URL}')` },
        ]
      },
      {
        "name": "operation",
        "part": [
          { "name": "type", "valueCode": "insert" },
          { "name": "path", "valueString": "Invoice.extension" },
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

  await aidboxFetch(`/fhir/Invoice/${invoiceId}`, {
    method: "PATCH",
    body: JSON.stringify({
      "resourceType": "Parameters",
      "parameter": operations,
    }),
  });
}

export async function processNextInvoice(): Promise<boolean> {
  const invoice = await pollPendingInvoice() as InvoiceWithId | null;

  if (!invoice) {
    return false;
  }

  try {
    const hl7v2 = await buildBarFromInvoice(invoice);
    await createOutgoingBarMessage(invoice, hl7v2);
    await updateInvoiceStatus(invoice.id, "completed");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await updateInvoiceStatus(invoice.id, "error", { reason: errorMessage });
  }

  return true;
}

export function createInvoiceBarBuilderService(options: {
  pollIntervalMs?: number;
  onError?: (error: Error) => void;
  onProcessed?: (invoice: Invoice) => void;
  onIdle?: () => void;
} = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  let running = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  async function poll() {
    if (!running) return;

    try {
      const processed = await processNextInvoice();
      if (processed) {
        // Invoice was processed, try immediately for the next one
        setImmediate(poll);
      } else {
        // No invoice found, wait for poll interval
        options.onIdle?.();
        timeoutId = setTimeout(poll, pollIntervalMs);
      }
    } catch (error) {
      options.onError?.(error as Error);
      // On error, wait for poll interval before retrying
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
  console.log("Starting Invoice BAR Builder Service...");
  console.log("Polling for pending Invoice resources every minute.");

  const service = createInvoiceBarBuilderService({
    onError: (error) => console.error("Error processing invoice:", error.message),
    onProcessed: (invoice) => console.log(`Processed invoice: ${invoice.id}`),
    onIdle: () => console.log("No pending invoices, waiting..."),
  });

  service.start();

  // Handle graceful shutdown
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

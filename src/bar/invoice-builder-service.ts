import { aidboxFetch, type Bundle } from "../aidbox";
import { generateBarMessage } from "./generator";
import { formatMessage } from "../hl7v2/format";
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

// Type for Invoice with required id (as returned from Aidbox)
type InvoiceWithId = Invoice & { id: string };

export interface OutgoingBarMessage {
  resourceType: "OutgoingBarMessage";
  id?: string;
  patient: { reference: string };
  invoice: { reference: string };
  status: string;
  hl7v2?: string;
}

const POLL_INTERVAL_MS = 60_000; // 1 minute

export async function pollDraftInvoice(): Promise<Invoice | null> {
  const bundle = await aidboxFetch<Bundle<Invoice>>(
    "/fhir/Invoice?status=draft&_sort=_lastUpdated&_count=1"
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

  // Use ChargeItem-linked resources if available, otherwise fall back to patient-based queries
  const hasChargeItemData = chargeItemEncounters.length > 0 || chargeItemProcedures.length > 0;

  if (hasChargeItemData) {
    // Use explicitly linked resources from ChargeItems
    result.encounter = chargeItemEncounters[0] ?? null;
    result.procedures = chargeItemProcedures;
  }

  // Fetch coverages for patient (always from patient, not ChargeItem)
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

    // Fallback: Fetch from patient if no ChargeItem data
    if (!hasChargeItemData) {
      // Fetch encounters for patient (most recent)
      const encounterBundle = await aidboxFetch<Bundle<Encounter>>(
        `/fhir/Encounter?patient=Patient/${result.patient.id}&_sort=-date&_count=1`
      );
      result.encounter = encounterBundle.entry?.[0]?.resource ?? null;

      // Fetch procedures for patient
      const procedureBundle = await aidboxFetch<Bundle<Procedure>>(
        `/fhir/Procedure?patient=Patient/${result.patient.id}&_count=10`
      );
      result.procedures = procedureBundle.entry?.map((e) => e.resource) || [];
    }

    // Fetch conditions for patient (always from patient, not ChargeItem)
    const conditionBundle = await aidboxFetch<Bundle<Condition>>(
      `/fhir/Condition?patient=Patient/${result.patient.id}&_count=10`
    );
    result.conditions = conditionBundle.entry?.map((e) => e.resource) || [];
  }

  return result;
}

export async function buildBarFromInvoice(invoice: InvoiceWithId): Promise<string> {
  const related = await fetchRelatedResources(invoice);

  if (!related.patient || !related.account) {
    throw new Error(`Invoice ${invoice.id} has no patient or account`);
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
  });

  return formatMessage(barMessage);
}

export async function createOutgoingBarMessage(invoice: InvoiceWithId, hl7v2: string): Promise<OutgoingBarMessage> {
  const newMessage: OutgoingBarMessage = {
    resourceType: "OutgoingBarMessage",
    patient: { reference: invoice.subject!.reference! },
    invoice: { reference: `Invoice/${invoice.id}` },
    status: "pending",
    hl7v2,
  };

  return aidboxFetch<OutgoingBarMessage>("/fhir/OutgoingBarMessage", {
    method: "POST",
    body: JSON.stringify(newMessage),
  });
}

export async function updateInvoiceStatus(invoiceId: string, status: string): Promise<void> {
  await aidboxFetch(`/fhir/Invoice/${invoiceId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json-patch+json",
    },
    body: JSON.stringify([
      { op: "replace", path: "/status", value: status },
    ]),
  });
}

export async function processNextInvoice(): Promise<boolean> {
  const invoice = await pollDraftInvoice() as InvoiceWithId | null;

  if (!invoice) {
    return false;
  }

  if (!invoice.subject?.reference) {
    console.error(`Invoice ${invoice.id} has no patient subject, skipping`);
    return true; // Continue to next invoice
  }

  const hl7v2 = await buildBarFromInvoice(invoice);
  await createOutgoingBarMessage(invoice, hl7v2);
  await updateInvoiceStatus(invoice.id, "issued");

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
  console.log("Polling for draft Invoice resources every minute.");

  const service = createInvoiceBarBuilderService({
    onError: (error) => console.error("Error processing invoice:", error.message),
    onProcessed: (invoice) => console.log(`Processed invoice: ${invoice.id}`),
    onIdle: () => console.log("No draft invoices, waiting..."),
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

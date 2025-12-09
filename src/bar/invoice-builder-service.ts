import { aidboxFetch, type Bundle } from "../aidbox";
import { generateBarMessage } from "./generator";
import { formatMessage } from "../hl7v2/format";
import type { Patient, Account, Encounter, Coverage, RelatedPerson, Condition, Procedure, Organization } from "./types";

export interface Invoice {
  resourceType: "Invoice";
  id: string;
  status: string;
  subject?: { reference: string };
  account?: { reference: string };
  date?: string;
}

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

async function fetchRelatedResources(invoice: Invoice): Promise<{
  patient: Patient | null;
  account: Account | null;
  encounter: Encounter | null;
  coverages: Coverage[];
  conditions: Condition[];
  procedures: Procedure[];
  guarantor: RelatedPerson | Patient | null;
  organizations: Map<string, Organization>;
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

  // Fetch coverages for patient
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

    // Fetch encounters for patient (most recent)
    const encounterBundle = await aidboxFetch<Bundle<Encounter>>(
      `/fhir/Encounter?patient=Patient/${result.patient.id}&_sort=-date&_count=1`
    );
    result.encounter = encounterBundle.entry?.[0]?.resource ?? null;

    // Fetch conditions for patient
    const conditionBundle = await aidboxFetch<Bundle<Condition>>(
      `/fhir/Condition?patient=Patient/${result.patient.id}&_count=10`
    );
    result.conditions = conditionBundle.entry?.map((e) => e.resource) || [];

    // Fetch procedures for patient
    const procedureBundle = await aidboxFetch<Bundle<Procedure>>(
      `/fhir/Procedure?patient=Patient/${result.patient.id}&_count=10`
    );
    result.procedures = procedureBundle.entry?.map((e) => e.resource) || [];
  }

  return result;
}

export async function buildBarFromInvoice(invoice: Invoice): Promise<string> {
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
    messageControlId,
    triggerEvent: "P01",
  });

  return formatMessage(barMessage);
}

export async function createOutgoingBarMessage(invoice: Invoice, hl7v2: string): Promise<OutgoingBarMessage> {
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
  const invoice = await pollDraftInvoice();

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

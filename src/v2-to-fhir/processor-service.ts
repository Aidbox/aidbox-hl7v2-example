/**
 * HL7v2 Message Processor Service
 *
 * Polls for IncomingHL7v2Message resources with status=received,
 * converts them to FHIR resources, submits to Aidbox, and updates status.
 */

import { aidboxFetch, putResource, type Bundle as AidboxBundle } from "../aidbox";
import type { IncomingHL7v2Message } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import type { Patient } from "../fhir/hl7-fhir-r4-core/Patient";
import type { Bundle } from "../fhir/hl7-fhir-r4-core/Bundle";
import { convertToFHIR } from "./converter";

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 60_000; // 1 minute

// ============================================================================
// Polling Functions
// ============================================================================

/**
 * Query for oldest unprocessed IncomingHL7v2Message
 * Returns null if no messages found
 */
export async function pollReceivedMessage(): Promise<IncomingHL7v2Message | null> {
  const bundle = await aidboxFetch<AidboxBundle<IncomingHL7v2Message>>(
    "/fhir/IncomingHL7v2Message?status=received&_sort=_lastUpdated&_count=1"
  );
  return bundle.entry?.[0]?.resource ?? null;
}

// ============================================================================
// Message Conversion
// ============================================================================

/**
 * Convert HL7v2 message to FHIR Bundle
 * Uses converter router to automatically detect message type
 */
function convertMessage(message: IncomingHL7v2Message): Bundle {
  return convertToFHIR(message.message);
}

// ============================================================================
// Bundle Submission
// ============================================================================

/**
 * Submit FHIR transaction bundle to Aidbox
 * Throws error if submission fails
 */
async function submitBundle(bundle: Bundle): Promise<void> {
  await aidboxFetch("/fhir", {
    method: "POST",
    body: JSON.stringify(bundle),
  });
}

// ============================================================================
// Patient ID Extraction
// ============================================================================

/**
 * Extract patient ID from bundle
 * Returns undefined if no patient found
 */
function extractPatientId(bundle: Bundle): string | undefined {
  // Extract from first Patient in bundle
  const patientEntry = bundle.entry?.find(
    (e) => e.resource?.resourceType === "Patient"
  );

  if (patientEntry?.resource) {
    return (patientEntry.resource as Patient).id;
  }

  return undefined;
}

// ============================================================================
// Status Management
// ============================================================================

/**
 * Update IncomingHL7v2Message status
 * Optionally links to created Patient resource
 */
async function updateMessageStatus(
  message: IncomingHL7v2Message,
  status: "processed" | "error",
  patientId?: string
): Promise<void> {
  const updated: IncomingHL7v2Message = {
    ...message,
    status,
    patient: patientId ? { reference: `Patient/${patientId}` } : message.patient,
  };

  await putResource<IncomingHL7v2Message>(
    "IncomingHL7v2Message",
    message.id!,
    updated
  );
}

// ============================================================================
// Main Processing Logic
// ============================================================================

/**
 * Process next message in queue
 * Returns true if message was processed, false if queue empty
 */
export async function processNextMessage(): Promise<boolean> {
  const message = await pollReceivedMessage();

  if (!message) {
    return false;
  }

  try {
    // Convert HL7v2 to FHIR
    const bundle = convertMessage(message);

    // Submit to Aidbox as transaction
    await submitBundle(bundle);

    // Extract patient ID for linking
    const patientId = extractPatientId(bundle);

    // Update status to processed
    await updateMessageStatus(message, "processed", patientId);

    return true;
  } catch (error) {
    // Update status to error (best effort - don't fail if update fails)
    try {
      await updateMessageStatus(message, "error");
    } catch (updateError) {
      console.error("Failed to update message status:", updateError);
    }

    // Re-throw error to be handled by caller
    throw error;
  }
}

// ============================================================================
// Service Factory
// ============================================================================

/**
 * Create IncomingHL7v2Message processor service
 * Returns object with start(), stop(), isRunning() methods
 */
export function createIncomingHL7v2MessageProcessorService(options: {
  pollIntervalMs?: number;
  onError?: (error: Error, message?: IncomingHL7v2Message) => void;
  onProcessed?: (message: IncomingHL7v2Message, patientId?: string) => void;
  onIdle?: () => void;
} = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  let running = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  async function poll() {
    if (!running) return;

    let currentMessage: IncomingHL7v2Message | null = null;

    try {
      currentMessage = await pollReceivedMessage();

      if (!currentMessage) {
        // No message found, wait for poll interval
        options.onIdle?.();
        timeoutId = setTimeout(poll, pollIntervalMs);
        return;
      }

      // Process the message
      const bundle = convertMessage(currentMessage);
      await submitBundle(bundle);
      const patientId = extractPatientId(bundle);
      await updateMessageStatus(currentMessage, "processed", patientId);

      options.onProcessed?.(currentMessage, patientId);

      // Message processed successfully, poll immediately for next
      setImmediate(poll);
    } catch (error) {
      options.onError?.(error as Error, currentMessage ?? undefined);

      // Update status to error if we have the message
      if (currentMessage) {
        try {
          await updateMessageStatus(currentMessage, "error");
        } catch (updateError) {
          console.error("Failed to update message status:", updateError);
        }
      }

      // On error, continue polling after interval
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

// ============================================================================
// Standalone Execution
// ============================================================================

if (import.meta.main) {
  console.log("Starting HL7v2 Message Processor Service...");
  console.log("Polling for IncomingHL7v2Message with status=received every minute.");

  const service = createIncomingHL7v2MessageProcessorService({
    onError: (error, message) => {
      console.error(
        `Error processing message ${message?.id || "unknown"}:`,
        error.message
      );
    },
    onProcessed: (message, patientId) => {
      console.log(
        `✓ Processed ${message.type} message ${message.id} → Patient ${patientId || "unknown"}`
      );
    },
    onIdle: () => {
      console.log("No pending messages, waiting...");
    },
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

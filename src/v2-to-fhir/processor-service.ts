/**
 * HL7v2 Message Processor Service
 *
 * Polls for IncomingHL7v2Message resources with status=received,
 * converts them to FHIR resources, submits to Aidbox, and updates status.
 */

import { parseMessage } from "@atomic-ehr/hl7v2";
import {
  aidboxFetch,
  putResource,
  type Bundle as AidboxBundle,
} from "../aidbox";
import { createPollingService, type PollingService } from "../polling-service";
import type { IncomingHL7v2Message } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import type { Bundle } from "../fhir/hl7-fhir-r4-core/Bundle";
import type { DomainResource } from "../fhir/hl7-fhir-r4-core/DomainResource";
import { convertToFHIR, type ConversionResult } from "./converter";
import { preprocessMessage } from "./preprocessor";
import { hl7v2ToFhirConfig } from "./config";

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 60_000; // 1 minute
const MAX_SENDING_RETRIES = 3;
const SENDING_ATTEMPT_PREFIX = "Sending failed (attempt ";

// ============================================================================
// Polling Functions
// ============================================================================

/**
 * Query for oldest unprocessed IncomingHL7v2Message
 * Returns null if no messages found
 */
export async function pollReceivedMessage(): Promise<IncomingHL7v2Message | null> {
  const bundle = await aidboxFetch<AidboxBundle<IncomingHL7v2Message>>(
    "/fhir/IncomingHL7v2Message?status=received&_sort=_lastUpdated&_count=1",
  );
  return bundle.entry?.[0]?.resource ?? null;
}

// ============================================================================
// Message Conversion
// ============================================================================

/**
 * Convert HL7v2 message to FHIR resources with message update.
 * Parses once, preprocesses, then converts.
 *
 * Parse failures return parsing_error status (not thrown).
 * Conversion failures flow through ConversionResult normally.
 */
export async function convertMessage(
  message: IncomingHL7v2Message,
): Promise<ConversionResult> {
  let parsed;
  try {
    parsed = parseMessage(message.message);
  } catch (error) {
    return {
      messageUpdate: {
        status: "parsing_error",
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  // Validate minimal structure: parseMessage is lenient and may return
  // an empty array or segments without MSH for malformed input.
  const hasMSH = parsed.some((s) => s.segment === "MSH");
  if (!hasMSH) {
    return {
      messageUpdate: {
        status: "parsing_error",
        error: "MSH segment not found — message is malformed",
      },
    };
  }

  const config = hl7v2ToFhirConfig();
  const preprocessed = preprocessMessage(parsed, config);
  return await convertToFHIR(preprocessed);
}

/**
 * Parse the sending attempt count from the error field.
 * Returns 0 if no previous attempts found.
 */
export function parseSendingAttempt(error: string | undefined): number {
  if (!error?.startsWith(SENDING_ATTEMPT_PREFIX)) {return 0;}
  const match = error.match(/^Sending failed \(attempt (\d+)\//);
  const attempt = match?.[1];
  return attempt ? parseInt(attempt, 10) : 0;
}

// ============================================================================
// Bundle Submission
// ============================================================================

/**
 * Wrap bare resources in a transaction Bundle.
 *
 * Each resource produces two entries:
 *   1. Conditional POST (`ifNoneExist=_id=ID`) — create if missing, no-op if exists.
 *      Race-safe against concurrent messages targeting the same resource.
 *   2. PATCH Type/ID with the resource body — merges fields onto the existing
 *      resource (JSON Merge Patch semantics). Fields not present in this
 *      message's resource are preserved from prior writes.
 */
function buildTransactionBundle(entries: DomainResource[]): Bundle {
  const bundleEntries = entries.flatMap((resource) => {
    const id = (resource as { id?: string }).id;
    const type = resource.resourceType;
    return [
      {
        resource,
        request: {
          method: "POST" as const,
          url: type,
          ifNoneExist: `_id=${id}`,
        },
      },
      {
        resource,
        request: {
          method: "PATCH" as const,
          url: `${type}/${id}`,
        },
      },
    ];
  });
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: bundleEntries,
  };
}

/**
 * Submit FHIR transaction bundle to Aidbox
 * Throws error if submission fails
 */
async function submitEntries(entries: DomainResource[]): Promise<void> {
  await aidboxFetch("/fhir", {
    method: "POST",
    body: JSON.stringify(buildTransactionBundle(entries)),
  });
}

// ============================================================================
// Status Management
// ============================================================================

/**
 * Apply message update from conversion result
 * Merges update fields with existing message and saves to Aidbox
 */
async function applyMessageUpdate(
  message: IncomingHL7v2Message,
  update: Partial<IncomingHL7v2Message>,
  entries?: DomainResource[],
): Promise<void> {
  const updated: IncomingHL7v2Message = {
    ...message,
    ...update,
    entries,
  };

  if (update.status === "processed") {
    delete updated.error;
  }

  if (!message.id) {
    throw new Error("Cannot update IncomingHL7v2Message without id");
  }
  await putResource<IncomingHL7v2Message>(
    "IncomingHL7v2Message",
    message.id,
    updated,
  );
}

/**
 * Handle sending error with auto-retry.
 * Retries up to MAX_SENDING_RETRIES times by resetting to "received".
 * After all retries exhausted, sets permanent "sending_error" status.
 */
async function handleSendingError(
  message: IncomingHL7v2Message,
  sendError: unknown,
  entries: DomainResource[],
): Promise<void> {
  const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
  const attempt = parseSendingAttempt(message.error) + 1;

  if (attempt < MAX_SENDING_RETRIES) {
    await applyMessageUpdate(message, {
      status: "received",
      error: `Sending failed (attempt ${attempt}/${MAX_SENDING_RETRIES}): ${errorMessage}`,
    });
  } else {
    await applyMessageUpdate(message, {
      status: "sending_error",
      error: `Sending failed after ${MAX_SENDING_RETRIES} attempts: ${errorMessage}`,
    }, entries);
  }
}

// ============================================================================
// Main Processing Logic
// ============================================================================

/**
 * Thrown by processMessage when submit fails and handleSendingError has
 * already recorded the status. Outer handlers should treat this as
 * "status already set — don't overwrite."
 */
class SendError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "SendError";
  }
}

/**
 * Process a single message: convert, submit bundle, update status.
 *
 * Throws on any failure. Submit failures throw a `SendError` wrapping the
 * underlying cause; handleSendingError has already recorded the status before
 * the throw, so callers must not record a `conversion_error` over it.
 */
export async function processMessage(
  message: IncomingHL7v2Message,
): Promise<void> {
  const { entries, messageUpdate } = await convertMessage(message);

  if (entries && entries.length > 0) {
    try {
      await submitEntries(entries);
    } catch (sendError) {
      await handleSendingError(message, sendError, entries);
      throw new SendError(sendError);
    }
  }
  await applyMessageUpdate(message, messageUpdate, entries);
}

/**
 * Record conversion_error status for non-send errors. No-op for `SendError`
 * (status already recorded by handleSendingError).
 */
async function recordProcessingError(
  message: IncomingHL7v2Message,
  error: unknown,
): Promise<void> {
  if (error instanceof SendError) {return;}
  const errorMessage = error instanceof Error ? error.message : String(error);
  try {
    await applyMessageUpdate(message, {
      status: "conversion_error",
      error: errorMessage,
    });
  } catch (updateError) {
    console.error("Failed to update message status:", updateError);
  }
}

/**
 * Process next message in queue.
 * Returns true if a message was attempted (success OR recorded error),
 * false if queue empty. Re-throws non-send errors after recording.
 */
export async function processNextMessage(): Promise<boolean> {
  const message = await pollReceivedMessage();
  if (!message) {return false;}

  try {
    await processMessage(message);
    return true;
  } catch (error) {
    if (error instanceof SendError) {return true;}
    await recordProcessingError(message, error);
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
export function createIncomingHL7v2MessageProcessorService(
  options: {
    pollIntervalMs?: number;
    onError?: (error: Error, message?: IncomingHL7v2Message) => void;
    onProcessed?: (message: IncomingHL7v2Message) => void;
    onIdle?: () => void;
  } = {},
): PollingService {
  return createPollingService<IncomingHL7v2Message>({
    poll: pollReceivedMessage,
    process: async (message) => {
      try {
        await processMessage(message);
      } catch (error) {
        await recordProcessingError(message, error);
        throw error;
      }
    },
    pollIntervalMs: options.pollIntervalMs ?? POLL_INTERVAL_MS,
    onError: options.onError,
    onProcessed: options.onProcessed,
    onIdle: options.onIdle,
  });
}

// ============================================================================
// Standalone Execution
// ============================================================================

if (import.meta.main) {
  console.log("Starting HL7v2 Message Processor Service...");
  console.log(
    "Polling for IncomingHL7v2Message with status=received every minute.",
  );

  const service = createIncomingHL7v2MessageProcessorService({
    onError: (error, message) => {
      console.error(
        `Error processing message ${message?.id || "unknown"}:`,
        error.message,
      );
    },
    onProcessed: (message) => {
      const patientRef = message.patient?.reference || "unknown";
      console.log(
        `✓ Processed ${message.type} message ${message.id} → ${patientRef}`,
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

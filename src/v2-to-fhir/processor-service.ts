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
import type { IncomingHL7v2Message } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import type { Bundle } from "../fhir/hl7-fhir-r4-core/Bundle";
import { convertToFHIR, type ConversionResult } from "./converter";
import { preprocessMessage } from "./preprocessor";
import { hl7v2ToFhirConfig } from "./config";
// DESIGN PROTOTYPE: 2026-02-24-profiles-support.md
// Planned extension:
// import { validateBundleProfiles } from "./profile-conformance";

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
 * Convert HL7v2 message to FHIR Bundle with message update.
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
  if (!error?.startsWith(SENDING_ATTEMPT_PREFIX)) return 0;
  const match = error.match(/^Sending failed \(attempt (\d+)\//);
  return match ? parseInt(match[1]!, 10) : 0;
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
// Status Management
// ============================================================================

/**
 * Apply message update from conversion result
 * Merges update fields with existing message and saves to Aidbox
 */
async function applyMessageUpdate(
  message: IncomingHL7v2Message,
  update: Partial<IncomingHL7v2Message>,
  bundle?: Bundle,
): Promise<void> {
  const updated: IncomingHL7v2Message = {
    ...message,
    ...update,
    bundle: bundle ? JSON.stringify(bundle, null, 2) : undefined,
  };

  if (update.status === "processed") {
    delete updated.error;
  }

  await putResource<IncomingHL7v2Message>(
    "IncomingHL7v2Message",
    message.id!,
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
  bundle: Bundle,
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
    }, bundle);
  }
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
    const { bundle, messageUpdate } = await convertMessage(message);

    // DESIGN PROTOTYPE: 2026-02-24-profiles-support.md
    // if (bundle) {
    //   const profileResult = await validateBundleProfiles(bundle, message.type);
    //   if (profileResult.strictFailure) {
    //     await applyMessageUpdate(message, {
    //       status: "conversion_error",
    //       error: profileResult.summary,
    //     });
    //     return true;
    //   }
    //   bundle = profileResult.bundle;
    // }

    if (bundle) {
      try {
        await submitBundle(bundle);
      } catch (sendError) {
        await handleSendingError(message, sendError, bundle);
        return true;
      }
    }
    await applyMessageUpdate(message, messageUpdate, bundle);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      await applyMessageUpdate(message, {
        status: "conversion_error",
        error: errorMessage,
      });
    } catch (updateError) {
      console.error("Failed to update message status:", updateError);
    }
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
) {
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  let running = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  async function poll() {
    if (!running) return;

    let currentMessage: IncomingHL7v2Message | null = null;

    try {
      currentMessage = await pollReceivedMessage();

      if (!currentMessage) {
        options.onIdle?.();
        timeoutId = setTimeout(poll, pollIntervalMs);
        return;
      }

      const { bundle, messageUpdate } = await convertMessage(currentMessage);
      if (bundle) {
        try {
          await submitBundle(bundle);
        } catch (sendError) {
          await handleSendingError(currentMessage, sendError, bundle);
          options.onError?.(sendError as Error, currentMessage);
          timeoutId = setTimeout(poll, pollIntervalMs);
          return;
        }
      }
      await applyMessageUpdate(currentMessage, messageUpdate, bundle);

      options.onProcessed?.(currentMessage);
      setImmediate(poll);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      options.onError?.(error as Error, currentMessage ?? undefined);

      if (currentMessage) {
        try {
          await applyMessageUpdate(currentMessage, {
            status: "conversion_error",
            error: errorMessage,
          });
        } catch (updateError) {
          console.error("Failed to update message status:", updateError);
        }
      }

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

import { aidboxFetch, Bundle, putResource } from "../aidbox";

export interface OutgoingBarMessage {
  resourceType: "OutgoingBarMessage";
  id: string;
  patient: { reference: string };
  invoice: { reference: string };
  status: string;
  hl7v2?: string;
}

export interface IncomingHL7v2Message {
  resourceType: "IncomingHL7v2Message";
  id?: string;
  type: string;
  date?: string;
  patient?: { reference: string };
  message: string;
}

const POLL_INTERVAL_MS = 60_000; // 1 minute

export async function pollPendingMessage(): Promise<OutgoingBarMessage | null> {
  const bundle = await aidboxFetch<Bundle<OutgoingBarMessage>>(
    "/fhir/OutgoingBarMessage?status=pending&_sort=_lastUpdated&_count=1"
  );
  return bundle.entry?.[0]?.resource ?? null;
}

export async function sendAsIncomingMessage(message: OutgoingBarMessage): Promise<IncomingHL7v2Message> {
  const incoming: IncomingHL7v2Message = {
    resourceType: "IncomingHL7v2Message",
    type: "BAR",
    date: new Date().toISOString(),
    patient: message.patient,
    message: message.hl7v2 || "",
  };

  return aidboxFetch<IncomingHL7v2Message>("/fhir/IncomingHL7v2Message", {
    method: "POST",
    body: JSON.stringify(incoming),
  });
}

export async function markAsSent(message: OutgoingBarMessage): Promise<OutgoingBarMessage> {
  return putResource<OutgoingBarMessage>("OutgoingBarMessage", message.id, {
    ...message,
    status: "sent",
  });
}

export async function processNextMessage(): Promise<boolean> {
  const message = await pollPendingMessage();

  if (!message) {
    return false;
  }

  await sendAsIncomingMessage(message);
  await markAsSent(message);

  return true;
}

export function createBarMessageSenderService(options: {
  pollIntervalMs?: number;
  onError?: (error: Error) => void;
  onProcessed?: (message: OutgoingBarMessage) => void;
  onIdle?: () => void;
} = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  let running = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  async function poll() {
    if (!running) return;

    try {
      const processed = await processNextMessage();

      if (processed) {
        // Message was processed, try immediately for the next one
        setImmediate(poll);
      } else {
        // No message found, wait for poll interval
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
  console.log("Starting Bar Message Sender Service...");
  console.log("Polling for pending OutgoingBarMessage resources every minute.");

  const service = createBarMessageSenderService({
    onError: (error) => console.error("Error processing message:", error.message),
    onProcessed: (message) => console.log(`Processed message: ${message.id}`),
    onIdle: () => console.log("No pending messages, waiting..."),
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

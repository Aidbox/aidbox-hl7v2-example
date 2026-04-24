import { aidboxFetch, type Bundle, putResource } from "../aidbox";
import { createPollingService, type PollingService } from "../polling-service";

export interface OutgoingBarMessage {
  resourceType: "OutgoingBarMessage";
  id: string;
  patient: { reference: string };
  account: { reference: string };
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

export async function processMessage(message: OutgoingBarMessage): Promise<void> {
  await sendAsIncomingMessage(message);
  await markAsSent(message);
}

export async function processNextMessage(): Promise<boolean> {
  const message = await pollPendingMessage();
  if (!message) {return false;}
  await processMessage(message);
  return true;
}

export function createBarMessageSenderService(options: {
  pollIntervalMs?: number;
  onError?: (error: Error, message?: OutgoingBarMessage) => void;
  onProcessed?: (message: OutgoingBarMessage) => void;
  onIdle?: () => void;
} = {}): PollingService {
  return createPollingService<OutgoingBarMessage>({
    poll: pollPendingMessage,
    process: processMessage,
    pollIntervalMs: options.pollIntervalMs ?? POLL_INTERVAL_MS,
    onError: options.onError,
    onProcessed: options.onProcessed,
    onIdle: options.onIdle,
  });
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

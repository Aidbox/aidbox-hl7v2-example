import * as net from "node:net";
import { aidboxFetch } from "../aidbox";

// MLLP (Minimal Lower Layer Protocol) framing characters
export const VT = 0x0b; // Vertical Tab - Start Block
export const FS = 0x1c; // File Separator - End Block (part 1)
export const CR = 0x0d; // Carriage Return - End Block (part 2)

interface IncomingHL7v2Message {
  resourceType: "IncomingHL7v2Message";
  type: string;
  date: string;
  message: string;
  status: string;
}

/**
 * Parse HL7v2 message to extract message type from MSH-9
 */
export function extractMessageType(hl7Message: string): string {
  const lines = hl7Message.split(/\r?\n|\r/);
  const mshLine = lines.find((line) => line.startsWith("MSH"));
  if (!mshLine) return "UNKNOWN";

  const fields = mshLine.split("|");
  // MSH-9 is the 9th field (0-indexed: field 8 after the initial MSH|^~\&|)
  // But MSH is special: MSH[0]="MSH", MSH[1]="|" (field separator), MSH[2]="^~\&" (encoding chars)
  // So MSH-9 = fields[8]
  const messageType = fields[8] || "UNKNOWN";
  return messageType.replace("^", "_"); // e.g., ADT^A01 -> ADT_A01
}

/**
 * Generate HL7v2 ACK message
 */
export function generateAck(
  originalMessage: string,
  ackCode: "AA" | "AE" | "AR",
  errorMessage?: string
): string {
  const lines = originalMessage.split(/\r?\n|\r/);
  const mshLine = lines.find((line) => line.startsWith("MSH"));
  if (!mshLine) {
    // Fallback ACK if we can't parse MSH
    return [
      `MSH|^~\\&|AIDBOX|AIDBOX|UNKNOWN|UNKNOWN|${formatHL7Date(new Date())}||ACK|${Date.now()}|P|2.4`,
      `MSA|${ackCode}|UNKNOWN|${errorMessage || ""}`,
    ].join("\r");
  }

  const fields = mshLine.split("|");
  const sendingApp = fields[2] || "";
  const sendingFacility = fields[3] || "";
  const receivingApp = fields[4] || "";
  const receivingFacility = fields[5] || "";
  const messageControlId = fields[9] || "";

  const ack = [
    `MSH|^~\\&|${receivingApp}|${receivingFacility}|${sendingApp}|${sendingFacility}|${formatHL7Date(new Date())}||ACK|${Date.now()}|P|2.4`,
    `MSA|${ackCode}|${messageControlId}${errorMessage ? `|${errorMessage}` : ""}`,
  ].join("\r");

  return ack;
}

/**
 * Format date in HL7v2 format (YYYYMMDDHHmmss)
 */
export function formatHL7Date(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);
}

/**
 * Wrap HL7v2 message with MLLP framing
 */
export function wrapWithMLLP(message: string): Buffer {
  const messageBuffer = Buffer.from(message, "utf-8");
  const framedMessage = Buffer.alloc(messageBuffer.length + 3);
  framedMessage[0] = VT;
  messageBuffer.copy(framedMessage, 1);
  framedMessage[framedMessage.length - 2] = FS;
  framedMessage[framedMessage.length - 1] = CR;
  return framedMessage;
}

/**
 * Store incoming HL7v2 message in Aidbox
 */
async function storeMessage(hl7Message: string): Promise<void> {
  const messageType = extractMessageType(hl7Message);

  const resource: IncomingHL7v2Message = {
    resourceType: "IncomingHL7v2Message",
    type: messageType,
    date: new Date().toISOString(),
    message: hl7Message,
    status: "received",
  };

  await aidboxFetch<IncomingHL7v2Message>("/fhir/IncomingHL7v2Message", {
    method: "POST",
    body: JSON.stringify(resource),
  });

  console.log(`[MLLP] Stored message of type: ${messageType}`);
}

/**
 * MLLP message parser - handles buffering and framing
 */
export class MLLPParser {
  private buffer: Buffer = Buffer.alloc(0);
  private inMessage = false;

  /**
   * Process incoming data and extract complete HL7v2 messages
   */
  processData(data: Buffer): string[] {
    this.buffer = Buffer.concat([this.buffer, data]);
    const messages: string[] = [];

    while (true) {
      if (!this.inMessage) {
        // Look for start block (VT)
        const startIndex = this.buffer.indexOf(VT);
        if (startIndex === -1) {
          // No start block found, clear non-VT data
          this.buffer = Buffer.alloc(0);
          break;
        }
        // Found start block, trim buffer and mark in message
        this.buffer = this.buffer.subarray(startIndex + 1);
        this.inMessage = true;
      }

      // Look for end block (FS + CR)
      let endIndex = -1;
      for (let i = 0; i < this.buffer.length - 1; i++) {
        if (this.buffer[i] === FS && this.buffer[i + 1] === CR) {
          endIndex = i;
          break;
        }
      }

      if (endIndex === -1) {
        // No complete message yet
        break;
      }

      // Extract message
      const messageData = this.buffer.subarray(0, endIndex);
      const message = messageData.toString("utf-8");
      messages.push(message);

      // Move past the end block
      this.buffer = this.buffer.subarray(endIndex + 2);
      this.inMessage = false;
    }

    return messages;
  }
}

/**
 * Create MLLP TCP server
 */
export function createMLLPServer(port: number = 2575): net.Server {
  const server = net.createServer((socket) => {
    const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[MLLP] Client connected: ${clientAddr}`);

    const parser = new MLLPParser();

    socket.on("data", async (data) => {
      const messages = parser.processData(data);

      for (const message of messages) {
        console.log(`[MLLP] Received message from ${clientAddr}`);
        console.log(`[MLLP] Message preview: ${message.substring(0, 100)}...`);

        try {
          await storeMessage(message);
          const ack = generateAck(message, "AA");
          socket.write(wrapWithMLLP(ack));
          console.log(`[MLLP] Sent ACK to ${clientAddr}`);
        } catch (error) {
          console.error(`[MLLP] Error processing message:`, error);
          const ack = generateAck(
            message,
            "AE",
            error instanceof Error ? error.message : "Unknown error"
          );
          socket.write(wrapWithMLLP(ack));
        }
      }
    });

    socket.on("close", () => {
      console.log(`[MLLP] Client disconnected: ${clientAddr}`);
    });

    socket.on("error", (err) => {
      console.error(`[MLLP] Socket error from ${clientAddr}:`, err.message);
    });
  });

  server.on("error", (err) => {
    console.error("[MLLP] Server error:", err);
  });

  return server;
}

// Run as standalone service
if (import.meta.main) {
  const port = parseInt(process.env.MLLP_PORT || "2575", 10);

  const server = createMLLPServer(port);

  server.listen(port, () => {
    console.log(`[MLLP] Server listening on port ${port}`);
    console.log(`[MLLP] Ready to receive HL7v2 messages via MLLP protocol`);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[MLLP] Shutting down...");
    server.close(() => {
      console.log("[MLLP] Server closed");
      process.exit(0);
    });
  });
}

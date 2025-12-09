import * as net from "node:net";

// MLP framing characters
const VT = 0x0b;
const FS = 0x1c;
const CR = 0x0d;

/**
 * Wrap HL7v2 message with MLP framing
 */
function wrapWithMLP(message: string): Buffer {
  const messageBuffer = Buffer.from(message, "utf-8");
  const framedMessage = Buffer.alloc(messageBuffer.length + 3);
  framedMessage[0] = VT;
  messageBuffer.copy(framedMessage, 1);
  framedMessage[framedMessage.length - 2] = FS;
  framedMessage[framedMessage.length - 1] = CR;
  return framedMessage;
}

/**
 * Parse MLP response
 */
function parseMLPResponse(data: Buffer): string | null {
  const startIndex = data.indexOf(VT);
  if (startIndex === -1) return null;

  for (let i = startIndex + 1; i < data.length - 1; i++) {
    if (data[i] === FS && data[i + 1] === CR) {
      return data.subarray(startIndex + 1, i).toString("utf-8");
    }
  }
  return null;
}

// Sample HL7v2 ADT^A01 message
const sampleMessage = [
  "MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20231215120000||ADT^A01|MSG001|P|2.4",
  "EVN|A01|20231215120000",
  "PID|1||12345^^^HOSPITAL^MR||Smith^John^A||19800101|M|||123 Main St^^Anytown^CA^12345||555-555-5555",
  "PV1|1|I|ICU^101^A|E|||12345^Jones^Mary^A|||MED||||1|||12345^Jones^Mary^A|IN||||||||||||||||||||||||||20231215120000",
].join("\r");

const host = process.argv[2] || "localhost";
const port = parseInt(process.argv[3] || "2575", 10);

console.log(`Connecting to MLP server at ${host}:${port}...`);

const client = net.createConnection({ host, port }, () => {
  console.log("Connected to MLP server");
  console.log("\nSending ADT^A01 message...");
  console.log("Message preview:", sampleMessage.substring(0, 80) + "...\n");

  client.write(wrapWithMLP(sampleMessage));
});

client.on("data", (data) => {
  const response = parseMLPResponse(data);
  if (response) {
    console.log("Received ACK:");
    console.log(response.replace(/\r/g, "\n"));
    console.log("\nMessage sent and acknowledged successfully!");
  }
  client.end();
});

client.on("close", () => {
  console.log("Connection closed");
  process.exit(0);
});

client.on("error", (err) => {
  console.error("Connection error:", err.message);
  process.exit(1);
});

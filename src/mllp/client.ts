import * as net from "node:net";
import { wrapWithMLLP, VT, FS, CR } from "./mllp-server";

/**
 * Send an HL7v2 message via MLLP and resolve with the listener's ACK body.
 *
 * Split out of the original UI-scoped mllp-client.ts so non-UI callers (the
 * Simulate Sender handler, future automation) can reuse the transport.
 */
export function sendMLLPMessage(
  host: string,
  port: number,
  message: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host, port }, () => {
      client.write(wrapWithMLLP(message));
    });

    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error("Connection timeout (10s)"));
    }, 10000);

    let buffer = Buffer.alloc(0);

    client.on("data", (data) => {
      buffer = Buffer.concat([buffer, data]);

      const startIndex = buffer.indexOf(VT);
      if (startIndex === -1) return;

      for (let i = startIndex + 1; i < buffer.length - 1; i++) {
        if (buffer[i] === FS && buffer[i + 1] === CR) {
          const response = buffer.subarray(startIndex + 1, i).toString("utf-8");
          clearTimeout(timeout);
          client.end();
          resolve(response);
          return;
        }
      }
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Connection failed: ${err.message}`));
    });

    client.on("close", () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Replace MSH-10 (message control id) in a raw HL7v2 message.
 *
 * Preserves the rest of the MSH segment and every following segment byte-for-byte.
 * Accepts either `\r`, `\n`, or `\r\n` segment delimiters and a `|` field delimiter
 * in MSH (the latter is the HL7v2 hard rule — MSH-1 is always `|`).
 *
 * Returns the message unchanged if no MSH segment is found. Adds an empty MSH-10
 * slot if the segment is shorter than 10 fields (rare; still produces valid HL7v2).
 */
export function rewriteMessageControlId(raw: string, newId: string): string {
  const segmentDelimiter = /\r\n|\r|\n/g;
  const segments = raw.split(segmentDelimiter);
  const separators = raw.match(segmentDelimiter) ?? [];

  const mshIndex = segments.findIndex((seg) => seg.startsWith("MSH"));
  if (mshIndex === -1) return raw;

  const mshSegment = segments[mshIndex];
  if (mshSegment === undefined) return raw;
  segments[mshIndex] = replaceMshControlId(mshSegment, newId);

  const pieces: string[] = [segments[0] ?? ""];
  for (let i = 1; i < segments.length; i++) {
    pieces.push(separators[i - 1] ?? "\r");
    pieces.push(segments[i] ?? "");
  }
  return pieces.join("");
}

function replaceMshControlId(mshSegment: string, newId: string): string {
  const fields = mshSegment.split("|");
  // Pad to at least 10 fields so indexing is safe.
  while (fields.length <= 9) {
    fields.push("");
  }
  fields[9] = newId;
  return fields.join("|");
}

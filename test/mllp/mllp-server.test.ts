import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import * as net from "node:net";
import {
  createMLLPServer,
  MLLPParser,
  extractMessageType,
  generateAck,
  formatHL7Date,
  wrapWithMLLP,
  VT,
  FS,
  CR,
  type StoreMessageFn,
} from "../../src/mllp/mllp-server";

// Sample HL7v2 messages for testing
const sampleADT = [
  "MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|20231215120000||ADT^A01|MSG001|P|2.4",
  "EVN|A01|20231215120000",
  "PID|1||12345^^^HOSPITAL^MR||Smith^John^A||19800101|M",
].join("\r");

const sampleBAR = [
  "MSH|^~\\&|BILLING|HOSPITAL|RECEIVER|FAC|20231215130000||BAR^P01|MSG002|P|2.5",
  "PID|1||MRN12345||Doe^Jane",
].join("\r");

describe("MLLPParser", () => {
  test("parses single complete message", () => {
    const parser = new MLLPParser();
    const framedMessage = wrapWithMLLP(sampleADT);

    const messages = parser.processData(framedMessage);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toBe(sampleADT);
  });

  test("parses multiple messages in one chunk", () => {
    const parser = new MLLPParser();
    const framed1 = wrapWithMLLP(sampleADT);
    const framed2 = wrapWithMLLP(sampleBAR);
    const combined = Buffer.concat([framed1, framed2]);

    const messages = parser.processData(combined);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe(sampleADT);
    expect(messages[1]).toBe(sampleBAR);
  });

  test("handles fragmented message across multiple chunks", () => {
    const parser = new MLLPParser();
    const framedMessage = wrapWithMLLP(sampleADT);

    // Split in the middle
    const mid = Math.floor(framedMessage.length / 2);
    const chunk1 = framedMessage.subarray(0, mid);
    const chunk2 = framedMessage.subarray(mid);

    const messages1 = parser.processData(chunk1);
    expect(messages1).toHaveLength(0);

    const messages2 = parser.processData(chunk2);
    expect(messages2).toHaveLength(1);
    expect(messages2[0]).toBe(sampleADT);
  });

  test("handles byte-by-byte delivery", () => {
    const parser = new MLLPParser();
    const framedMessage = wrapWithMLLP(sampleADT);

    let messages: string[] = [];
    for (let i = 0; i < framedMessage.length; i++) {
      const result = parser.processData(Buffer.from([framedMessage[i] ?? 0]));
      messages = messages.concat(result);
    }

    expect(messages).toHaveLength(1);
    expect(messages[0]).toBe(sampleADT);
  });

  test("ignores data before start block", () => {
    const parser = new MLLPParser();
    const garbage = Buffer.from("garbage data");
    const framedMessage = wrapWithMLLP(sampleADT);
    const combined = Buffer.concat([garbage, framedMessage]);

    const messages = parser.processData(combined);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toBe(sampleADT);
  });

  test("handles message after incomplete end block", () => {
    const parser = new MLLPParser();

    // Send VT + partial message (no end block)
    const partial = Buffer.concat([Buffer.from([VT]), Buffer.from("partial")]);
    const messages1 = parser.processData(partial);
    expect(messages1).toHaveLength(0);

    // Send end block + new complete message
    const endAndNew = Buffer.concat([
      Buffer.from([FS, CR]),
      wrapWithMLLP(sampleADT),
    ]);
    const messages2 = parser.processData(endAndNew);

    expect(messages2).toHaveLength(2);
    expect(messages2[0]).toBe("partial");
    expect(messages2[1]).toBe(sampleADT);
  });
});

describe("extractMessageType", () => {
  test("extracts ADT^A01 as ADT_A01", () => {
    const type = extractMessageType(sampleADT);
    expect(type).toBe("ADT_A01");
  });

  test("extracts BAR^P01 as BAR_P01", () => {
    const type = extractMessageType(sampleBAR);
    expect(type).toBe("BAR_P01");
  });

  test("returns UNKNOWN for message without MSH", () => {
    const type = extractMessageType("PID|1||12345");
    expect(type).toBe("UNKNOWN");
  });

  test("returns UNKNOWN for empty MSH-9", () => {
    const msg = "MSH|^~\\&|APP|FAC|RCV|FAC|20231215||";
    const type = extractMessageType(msg);
    expect(type).toBe("UNKNOWN");
  });

  test("handles message with LF line endings", () => {
    const msg = sampleADT.replace(/\r/g, "\n");
    const type = extractMessageType(msg);
    expect(type).toBe("ADT_A01");
  });

  test("handles message with CRLF line endings", () => {
    const msg = sampleADT.replace(/\r/g, "\r\n");
    const type = extractMessageType(msg);
    expect(type).toBe("ADT_A01");
  });
});

describe("generateAck", () => {
  test("generates AA acknowledgment", () => {
    const ack = generateAck(sampleADT, "AA");

    expect(ack).toContain("MSH|^~\\&|RECEIVING_APP|RECEIVING_FAC|SENDING_APP|SENDING_FAC|");
    expect(ack).toContain("||ACK|");
    expect(ack).toContain("|P|2.4");
    expect(ack).toContain("\rMSA|AA|MSG001");
  });

  test("generates AE acknowledgment with error message", () => {
    const ack = generateAck(sampleADT, "AE", "Database error");

    expect(ack).toContain("MSA|AE|MSG001|Database error");
  });

  test("generates AR acknowledgment", () => {
    const ack = generateAck(sampleADT, "AR");

    expect(ack).toContain("MSA|AR|MSG001");
  });

  test("generates fallback ACK for message without MSH", () => {
    const ack = generateAck("PID|1||12345", "AA");

    expect(ack).toContain("MSH|^~\\&|AIDBOX|AIDBOX|UNKNOWN|UNKNOWN|");
    expect(ack).toContain("MSA|AA|UNKNOWN");
  });
});

describe("formatHL7Date", () => {
  test("formats date correctly", () => {
    const date = new Date("2023-12-15T10:30:45.000Z");
    const formatted = formatHL7Date(date);

    expect(formatted).toBe("20231215103045");
  });
});

describe("wrapWithMLLP", () => {
  test("wraps message with VT header and FS+CR trailer", () => {
    const message = "TEST";
    const wrapped = wrapWithMLLP(message);

    expect(wrapped[0]).toBe(VT);
    expect(wrapped.subarray(1, 5).toString()).toBe("TEST");
    expect(wrapped[5]).toBe(FS);
    expect(wrapped[6]).toBe(CR);
    expect(wrapped.length).toBe(7);
  });
});

describe("MLLP Server Functional Tests", () => {
  let server: net.Server;
  let port: number;
  let mockStoreMessage: ReturnType<typeof mock<StoreMessageFn>>;
  let storedMessages: string[];

  beforeEach(async () => {
    storedMessages = [];
    mockStoreMessage = mock(async (message: string) => {
      storedMessages.push(message);
    });

    // Use random available port with injected store function
    port = 0;
    server = createMLLPServer(port, { storeMessageFn: mockStoreMessage });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as net.AddressInfo;
        port = addr.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Force close server with timeout to prevent hanging
    await Promise.race([
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
    ]);
  });

  test("accepts connection and receives message", async () => {
    const client = net.createConnection({ port });
    try {
      await new Promise<void>((resolve) => client.on("connect", resolve));

      // Send framed message
      client.write(wrapWithMLLP(sampleADT));

      // Wait for ACK
      const response = await new Promise<Buffer>((resolve) => {
        client.once("data", resolve);
      });

      // Parse ACK
      const ackStart = response.indexOf(VT);
      const ackEnd = response.indexOf(FS);
      const ack = response.subarray(ackStart + 1, ackEnd).toString();

      expect(ack).toContain("MSH|");
      expect(ack).toContain("MSA|AA|MSG001");
    } finally {
      client.destroy();
    }
  });

  test("handles multiple messages on same connection", async () => {
    const client = net.createConnection({ port });
    try {
      await new Promise<void>((resolve) => client.on("connect", resolve));

      const acks: string[] = [];

      client.on("data", (data) => {
        const ackStart = data.indexOf(VT);
        const ackEnd = data.indexOf(FS);
        if (ackStart !== -1 && ackEnd !== -1) {
          acks.push(data.subarray(ackStart + 1, ackEnd).toString());
        }
      });

      // Send first message
      client.write(wrapWithMLLP(sampleADT));
      await new Promise((r) => setTimeout(r, 50));

      // Send second message
      client.write(wrapWithMLLP(sampleBAR));
      await new Promise((r) => setTimeout(r, 50));

      expect(acks.length).toBe(2);
      expect(acks[0]).toContain("MSA|AA|MSG001");
      expect(acks[1]).toContain("MSA|AA|MSG002");
    } finally {
      client.destroy();
    }
  });

  test("handles fragmented TCP delivery", async () => {
    const client = net.createConnection({ port });
    try {
      await new Promise<void>((resolve) => client.on("connect", resolve));

      const framedMessage = wrapWithMLLP(sampleADT);

      // Split message into 3 parts
      const part1 = framedMessage.subarray(0, 10);
      const part2 = framedMessage.subarray(10, 50);
      const part3 = framedMessage.subarray(50);

      client.write(part1);
      await new Promise((r) => setTimeout(r, 10));
      client.write(part2);
      await new Promise((r) => setTimeout(r, 10));
      client.write(part3);

      // Wait for ACK
      const response = await new Promise<Buffer>((resolve) => {
        client.once("data", resolve);
      });

      const ackStart = response.indexOf(VT);
      const ackEnd = response.indexOf(FS);
      const ack = response.subarray(ackStart + 1, ackEnd).toString();

      expect(ack).toContain("MSA|AA|MSG001");
    } finally {
      client.destroy();
    }
  });

  test("stores message in Aidbox", async () => {
    const client = net.createConnection({ port });
    try {
      await new Promise<void>((resolve) => client.on("connect", resolve));

      client.write(wrapWithMLLP(sampleADT));

      // Wait for ACK to ensure processing is complete
      await new Promise<Buffer>((resolve) => {
        client.once("data", resolve);
      });

      expect(mockStoreMessage).toHaveBeenCalled();
      expect(storedMessages).toHaveLength(1);
      expect(storedMessages[0]).toBe(sampleADT);
    } finally {
      client.destroy();
    }
  });

  test("returns AE on Aidbox error", async () => {
    // Create a new server with a failing store function
    const failingServer = createMLLPServer(0, {
      storeMessageFn: async () => {
        throw new Error("Connection refused");
      },
    });

    const failingPort = await new Promise<number>((resolve) => {
      failingServer.listen(0, () => {
        const addr = failingServer.address() as net.AddressInfo;
        resolve(addr.port);
      });
    });

    const client = net.createConnection({ port: failingPort });
    try {
      await new Promise<void>((resolve) => client.on("connect", resolve));

      client.write(wrapWithMLLP(sampleADT));

      const response = await new Promise<Buffer>((resolve) => {
        client.once("data", resolve);
      });

      const ackStart = response.indexOf(VT);
      const ackEnd = response.indexOf(FS);
      const ack = response.subarray(ackStart + 1, ackEnd).toString();

      expect(ack).toContain("MSA|AE|MSG001");
      expect(ack).toContain("Connection refused");
    } finally {
      client.destroy();
      await new Promise<void>((resolve) => {
        failingServer.close(() => resolve());
      });
    }
  });

  test("handles multiple concurrent clients", async () => {
    const numClients = 3;
    const clients: net.Socket[] = [];
    const results: string[] = [];

    try {
      // Create multiple clients
      for (let i = 0; i < numClients; i++) {
        const client = net.createConnection({ port });
        await new Promise<void>((resolve) => client.on("connect", resolve));
        clients.push(client);
      }

      // Set up data handlers
      clients.forEach((client, i) => {
        client.on("data", (data) => {
          const ackStart = data.indexOf(VT);
          const ackEnd = data.indexOf(FS);
          if (ackStart !== -1 && ackEnd !== -1) {
            results.push(`client-${i}`);
          }
        });
      });

      // Send messages from all clients
      clients.forEach((client, i) => {
        const msg = `MSH|^~\\&|APP${i}|FAC|RCV|FAC|20231215||ADT^A01|MSG${i}|P|2.4`;
        client.write(wrapWithMLLP(msg));
      });

      // Wait for all responses
      await new Promise((r) => setTimeout(r, 100));

      expect(results.length).toBe(numClients);
    } finally {
      // Clean up
      clients.forEach((c) => c.destroy());
    }
  });
});

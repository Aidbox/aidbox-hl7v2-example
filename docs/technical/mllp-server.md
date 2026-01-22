# MLLP Server

TCP server implementing the Minimal Lower Layer Protocol (MLLP) for receiving HL7v2 messages from external systems. For conceptual background on MLLP and HL7v2 transport, see the [User Guide](../user-guide/concepts.md#mllp).

## Code Organization

The `src/mllp/` module contains the MLLP server implementation:

| File | Purpose |
|------|---------|
| `mllp-server.ts` | TCP server, MLLPParser class, ACK generation, message storage |
| `index.ts` | Module exports |

**Key entry points:**

- `createMLLPServer(port)` - Factory function that creates and returns `net.Server`
- `MLLPParser.processData(data)` - Extracts complete messages from TCP stream
- `generateAck(message, code)` - Creates HL7v2 ACK response
- `storeMessage(hl7Message)` - Saves to Aidbox as IncomingHL7v2Message

## Implementation Walkthrough

### Connection Handling Flow

The server uses Node.js `net.createServer()` to handle TCP connections:

```
createMLLPServer(port)
    │
    └─► net.createServer((socket) => {
            │
            ├─► Create MLLPParser instance for this connection
            │
            └─► socket.on("data", (data) => {
                    │
                    ├─► parser.processData(data)  // Returns string[] of complete messages
                    │
                    └─► for each message:
                            │
                            ├─► storeMessage(message)
                            │       │
                            │       ├─► extractMSHFields()  // Get type, sender info
                            │       └─► POST /IncomingHL7v2Message
                            │
                            ├─► generateAck(message, "AA" | "AE")
                            │
                            └─► socket.write(wrapWithMLLP(ack))
                })
        })
```

### Message Parsing Detail

The `MLLPParser` class in `mllp-server.ts:133` handles TCP fragmentation:

```typescript
class MLLPParser {
  private buffer: Buffer = Buffer.alloc(0);
  private inMessage = false;

  processData(data: Buffer): string[] {
    this.buffer = Buffer.concat([this.buffer, data]);
    const messages: string[] = [];

    while (true) {
      if (!this.inMessage) {
        // Look for start block (VT = 0x0B)
        const startIndex = this.buffer.indexOf(VT);
        if (startIndex === -1) {
          this.buffer = Buffer.alloc(0);  // Discard non-message data
          break;
        }
        this.buffer = this.buffer.subarray(startIndex + 1);
        this.inMessage = true;
      }

      // Look for end block (FS + CR = 0x1C 0x0D)
      let endIndex = -1;
      for (let i = 0; i < this.buffer.length - 1; i++) {
        if (this.buffer[i] === FS && this.buffer[i + 1] === CR) {
          endIndex = i;
          break;
        }
      }

      if (endIndex === -1) break;  // Wait for more data

      // Extract complete message
      const message = this.buffer.subarray(0, endIndex).toString("utf-8");
      messages.push(message);
      this.buffer = this.buffer.subarray(endIndex + 2);
      this.inMessage = false;
    }

    return messages;
  }
}
```

### ACK Generation

The `generateAck()` function in `mllp-server.ts:51` creates HL7v2 acknowledgment messages:

```typescript
function generateAck(originalMessage: string, ackCode: "AA" | "AE" | "AR", errorMessage?: string): string {
  // Parse original MSH to get routing info
  const fields = mshLine.split("|");
  const sendingApp = fields[2];
  const sendingFacility = fields[3];
  const receivingApp = fields[4];
  const receivingFacility = fields[5];
  const messageControlId = fields[9];

  // Build ACK - swap sender/receiver
  return [
    `MSH|^~\\&|${receivingApp}|${receivingFacility}|${sendingApp}|${sendingFacility}|${timestamp}||ACK|${newControlId}|P|2.4`,
    `MSA|${ackCode}|${messageControlId}${errorMessage ? `|${errorMessage}` : ""}`,
  ].join("\r");
}
```

## Key Patterns

### MLLP Framing

Every HL7v2 message is wrapped with framing characters:

```
┌────────┬─────────────────┬────────┬────────┐
│  VT    │   HL7v2 Message │   FS   │   CR   │
│ (0x0B) │                 │ (0x1C) │ (0x0D) │
└────────┴─────────────────┴────────┴────────┘
```

| Character | Hex | Name | Purpose |
|-----------|-----|------|---------|
| VT | 0x0B | Vertical Tab | Start of message |
| FS | 0x1C | File Separator | End of message (part 1) |
| CR | 0x0D | Carriage Return | End of message (part 2) |

Constants defined in `mllp-server.ts:5`:

```typescript
export const VT = 0x0b;
export const FS = 0x1c;
export const CR = 0x0d;
```

### TCP Fragmentation Handling

TCP doesn't guarantee message boundaries. A single HL7v2 message might arrive as:
- Multiple small packets
- One large packet with multiple messages
- Partial message waiting for more data

The `MLLPParser` maintains state across `processData()` calls:

```typescript
// Connection receives 3 packets:
// Packet 1: [VT] + "MSH|^~\\&|APP|..."  (partial message)
// Packet 2: "...|PID|..." (continuation)
// Packet 3: "...|PV1|..." + [FS][CR]    (end of message)

// processData() buffers until complete:
parser.processData(packet1);  // Returns []
parser.processData(packet2);  // Returns []
parser.processData(packet3);  // Returns ["MSH|^~\\&|APP|...|PID|...|PV1|..."]
```

### ACK Response Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| AA | Application Accept | Message stored successfully |
| AE | Application Error | Processing failed (e.g., Aidbox unavailable) |
| AR | Application Reject | Message rejected (parse failure) |

The ACK includes the original MSH-10 (Message Control ID) for correlation:

```
MSA|AA|MSG001234|
     │   │
     │   └─ Original message control ID
     └─ ACK code
```

### MSH Field Extraction

The `extractMSHFields()` function parses the MSH segment for routing and storage:

```typescript
function extractMSHFields(hl7Message: string) {
  const lines = hl7Message.split(/\r?\n|\r/);
  const mshLine = lines.find(line => line.startsWith("MSH"));
  const fields = mshLine.split("|");

  return {
    messageType: fields[8].replace("^", "_"),  // ADT^A01 → ADT_A01
    sendingApplication: fields[2],              // MSH-3
    sendingFacility: fields[3],                 // MSH-4
  };
}
```

## Usage

### Running the Server

```sh
# Start with default port (2575)
bun run mllp

# Start with custom port
MLLP_PORT=3001 bun run mllp
```

### Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MLLP_PORT` | 2575 | TCP port to listen on |

### Testing

The Web UI provides an MLLP test client at `/mllp-client`:
- Configure target host and port
- Select sample messages (ADT^A01, ADT^A08, BAR^P01, ORM^O01)
- Send custom HL7v2 messages
- View ACK responses

## Extension Points

### Custom Message Handling

To add pre-processing before storage:

```typescript
// Override storeMessageFn in createMLLPServer options
const server = createMLLPServer(2575, {
  storeMessageFn: async (message) => {
    // Custom validation or transformation
    await customHandler(message);
    await defaultStoreMessage(message);
  }
});
```

### Adding TLS Support

The current implementation uses plain TCP. For TLS:

1. Replace `net.createServer()` with `tls.createServer()`
2. Provide certificate options
3. Keep the same socket event handlers

## Reference

### IncomingHL7v2Message Resource

Stored with sender information extracted from MSH:

```json
{
  "resourceType": "IncomingHL7v2Message",
  "type": "ADT_A01",
  "date": "2025-01-21T10:30:00Z",
  "message": "MSH|^~\\&|...",
  "status": "received",
  "sendingApplication": "LAB_SYSTEM",
  "sendingFacility": "HOSPITAL_A"
}
```

### Connection Flow Diagram

```
External System                    MLLP Server                    Aidbox
      │                                 │                            │
      │───── TCP Connect ──────────────►│                            │
      │                                 │                            │
      │───── VT + Message + FS CR ─────►│                            │
      │                                 │── MLLPParser.processData() │
      │                                 │── extractMSHFields()       │
      │                                 │                            │
      │                                 │── POST /IncomingHL7v2Message ─►│
      │                                 │◄── 201 Created ───────────│
      │                                 │                            │
      │                                 │── generateAck()            │
      │◄──── VT + ACK + FS CR ──────────│                            │
      │                                 │                            │
      │───── TCP Close ────────────────►│                            │
```

## See Also

- [Architecture](architecture.md) - MLLP message flow diagrams
- [ORU Processing](oru-processing.md) - What happens to messages after receipt
- [How-To: Extracting Modules](how-to/extracting-modules.md) - Using MLLP server standalone

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

### Message Parsing

The `MLLPParser` class (`mllp-server.ts:133`) handles TCP stream reassembly. It buffers incoming data, scans for MLLP framing bytes (VT start, FS+CR end), and extracts complete messages. The parser maintains state across `processData()` calls to handle messages split across multiple TCP packets.

### ACK Generation

The `generateAck()` function (`mllp-server.ts:51`) creates HL7v2 acknowledgment messages by swapping sender/receiver routing from the original MSH segment and including the original Message Control ID for correlation.

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

The `MLLPParser` maintains state across `processData()` calls, buffering partial data until complete MLLP frames are received. It returns an empty array until all framing bytes are present, then returns the complete message(s).

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

The `extractMSHFields()` function (`mllp-server.ts:22`) parses the MSH segment to extract message type (MSH-9), sending application (MSH-3), and sending facility (MSH-4) for storage in the IncomingHL7v2Message resource.

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

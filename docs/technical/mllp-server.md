# MLLP Server

TCP server implementing the Minimal Lower Layer Protocol (MLLP) for receiving HL7v2 messages from external systems.

## Overview

MLLP is the standard transport protocol for HL7v2 messages over TCP/IP. This server:
- Listens for TCP connections on port 2575 (configurable)
- Parses MLLP-framed messages (handles TCP fragmentation)
- Stores messages as `IncomingHL7v2Message` resources in Aidbox
- Sends HL7v2 ACK responses (AA/AE/AR)

## How It Works

### Connection Flow

```
External System                    MLLP Server                    Aidbox
      │                                 │                            │
      │───── TCP Connect ──────────────►│                            │
      │                                 │                            │
      │───── VT + Message + FS CR ─────►│                            │
      │                                 │── Parse MLLP framing       │
      │                                 │── Extract MSH fields       │
      │                                 │                            │
      │                                 │──── POST /IncomingHL7v2Message ──►│
      │                                 │◄─── 201 Created ───────────│
      │                                 │                            │
      │                                 │── Generate ACK             │
      │◄──── VT + ACK + FS CR ──────────│                            │
      │                                 │                            │
      │───── TCP Close ────────────────►│                            │
```

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

### Message Processing

1. **Buffer incoming data** - TCP packets may be fragmented; accumulate until complete message received
2. **Detect message boundaries** - Look for VT (start) and FS+CR (end)
3. **Extract MSH fields** - Parse MSH-3 (sending app), MSH-4 (sending facility), MSH-9 (message type)
4. **Store in Aidbox** - Create `IncomingHL7v2Message` with `status=received`
5. **Generate ACK** - Build acknowledgment message with appropriate response code
6. **Send ACK** - Wrap in MLLP framing and send back

## Implementation Details

### Code Locations

| Component | File | Entry Point |
|-----------|------|-------------|
| Server factory | `src/mllp/mllp-server.ts` | `createMLLPServer()` |
| Message parser | `src/mllp/mllp-server.ts` | `MLLPParser` class |
| ACK generator | `src/mllp/mllp-server.ts` | `generateAck()` |
| MLLP framing | `src/mllp/mllp-server.ts` | `wrapWithMLLP()` |
| Message storage | `src/mllp/mllp-server.ts` | `storeMessage()` |
| MSH extraction | `src/mllp/mllp-server.ts` | `extractMSHFields()` |
| Module exports | `src/mllp/index.ts` | - |

### ACK Message Structure

The server generates HL7v2 ACK messages with two segments:

**MSH (Message Header):**
```
MSH|^~\&|{receivingApp}|{receivingFacility}|{sendingApp}|{sendingFacility}|{timestamp}||ACK|{controlId}|P|2.4
```

- Sending/receiving applications are swapped from original message
- New unique control ID generated
- Processing ID is `P` (production)

**MSA (Message Acknowledgment):**
```
MSA|{ackCode}|{originalControlId}|{errorMessage}
```

| ACK Code | Meaning | When Used |
|----------|---------|-----------|
| AA | Application Accept | Message stored successfully |
| AE | Application Error | Processing failed (e.g., Aidbox unavailable) |
| AR | Application Reject | Message rejected (parse failure) |

### TCP Fragmentation Handling

The `MLLPParser` class buffers incoming TCP data:

```typescript
class MLLPParser {
  private buffer: Buffer;
  private inMessage: boolean;

  processData(data: Buffer): string[] {
    // Append to buffer
    // Scan for VT (start) and FS+CR (end)
    // Return complete messages, keep partial in buffer
  }
}
```

This handles:
- Messages split across multiple TCP packets
- Multiple messages in single TCP packet
- Partial messages waiting for more data

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

### Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MLLP_PORT` | 2575 | TCP port to listen on |

### Running the Server

```sh
# Start with default port (2575)
bun run mllp

# Start with custom port
MLLP_PORT=3001 bun run mllp
```

### Web UI Test Client

The `/mllp-client` page provides a testing interface:
- Configure target host and port
- Select sample messages (ADT^A01, ADT^A08, BAR^P01, ORM^O01)
- Send custom HL7v2 messages
- View ACK responses

## See Also

- [Architecture](architecture.md) - MLLP message flow diagrams
- [ORU Processing](oru-processing.md) - What happens to messages after receipt
- [How-To: Extracting Modules](how-to/extracting-modules.md) - Using MLLP server in your project

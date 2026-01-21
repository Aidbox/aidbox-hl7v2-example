# MLLP Server Module

TCP server implementing the Minimal Lower Layer Protocol (MLLP) for receiving HL7v2 messages.

## MLLP Protocol

MLLP wraps HL7v2 messages with framing characters for TCP transmission:

```
┌────────┬─────────────────┬────────┬────────┐
│  VT    │   HL7v2 Message │   FS   │   CR   │
│ (0x0B) │                 │ (0x1C) │ (0x0D) │
└────────┴─────────────────┴────────┴────────┘
```

- **Start Block**: `0x0B` (VT - Vertical Tab)
- **End Block**: `0x1C 0x0D` (FS + CR)

## Module Structure

- `src/mllp/mllp-server.ts` - MLLP TCP server implementation
- `src/mllp/index.ts` - Module exports

## Features

- Accepts HL7v2 messages wrapped in MLLP framing
- Handles multiple concurrent connections
- Supports fragmented TCP delivery (message buffering)
- Generates HL7v2 ACK responses (AA/AE/AR)
- Swaps sending/receiving application in ACK

## Usage

```sh
# Start MLLP server (default port 2575)
bun run mllp

# With custom port
MLLP_PORT=3001 bun run mllp
```

## Integration

<!-- TODO: How to extract and use in another project -->

## ACK Generation

<!-- TODO: Describe ACK message structure and response codes -->

# Aidbox HL7 Integration

Web UI for managing HL7v2 BAR messages with Aidbox FHIR server. View Invoices, generate BAR messages, and track incoming/outgoing HL7v2 messages.

## Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Docker](https://docker.com) and Docker Compose

## Quick Start

```sh
# Install dependencies
bun install

# Start Aidbox and PostgreSQL
docker compose up -d

# Run database migrations (creates custom FHIR resources)
bun src/migrate.ts

# Start the web server
bun run dev
```

**Web UI:** http://localhost:3000
**Aidbox:** http://localhost:8080 (root / Vbro4upIT1)

## Development

```sh
bun run dev   # Start server with hot reload (logs to logs/server.log)
bun run stop  # Stop the server
bun run logs  # Tail server logs

# Load test data (5 patients with encounters, conditions, procedures, coverages)
bun scripts/load-test-data.ts
```

## Project Structure

```
src/
├── index.ts              # HTTP server with web UI routes
├── aidbox.ts             # Aidbox FHIR client
├── migrate.ts            # Loads FHIR resources from fhir/ folder
├── bar/
│   ├── generator.ts      # BAR message generator from FHIR resources
│   ├── invoice-builder-service.ts  # Polls draft Invoices, creates BAR messages
│   ├── sender-service.ts # Sends pending OutgoingBarMessage
│   └── types.ts          # FHIR resource type definitions
└── hl7v2/
    ├── types.ts          # HL7v2 message types
    ├── fields.ts         # Generated segment builders (MSH, PID, PV1, etc.)
    ├── format.ts         # Serializes messages to pipe-delimited format
    └── codegen.ts        # Generates builders from HL7v2 schema

fhir/                     # FHIR resource definitions (loaded by migrate.ts)
scripts/
├── dev.sh                # Development server script
├── stop.sh               # Stop server script
└── load-test-data.ts     # Creates sample FHIR data
```

## Custom FHIR Resources

### OutgoingBarMessage

Tracks BAR messages generated from Invoices.

| Field | Type | Required |
|-------|------|----------|
| patient | Reference(Patient) | Yes |
| invoice | Reference(Invoice) | Yes |
| status | string (pending/sent/error) | Yes |
| hl7v2 | string | No |

### IncomingHL7v2Message

Stores received HL7v2 messages.

| Field | Type | Required |
|-------|------|----------|
| type | string | Yes |
| status | string (received/processed/error) | No |
| date | dateTime | No |
| patient | Reference(Patient) | No |
| message | string | Yes |

## Web UI Features

- **Invoices:** View all invoices, filter by status, create new invoices, build BAR messages from drafts
- **Outgoing Messages:** View BAR messages with HL7v2 syntax highlighting, filter by status, send pending messages
- **Incoming Messages:** View received HL7v2 messages, filter by status

## HL7v2 Module

Type-safe HL7v2 message building with fluent API:

```ts
import { MSHBuilder, PIDBuilder } from "./src/hl7v2/fields";
import { formatMessage } from "./src/hl7v2/format";

const message = [
  new MSHBuilder()
    .set9_1_messageCode("BAR")
    .set9_2_triggerEvent("P01")
    .build(),
  new PIDBuilder()
    .set3_1_idNumber("12345")
    .set5_1_1_surname("Smith")
    .set5_2_givenName("John")
    .build(),
];

console.log(formatMessage(message));
```

## BAR Message Generation

Generate HL7v2 BAR messages from FHIR resources:

```ts
import { generateBarMessage } from "./src/bar";
import { formatMessage } from "./src/hl7v2/format";

const barMessage = generateBarMessage({
  patient,           // FHIR Patient
  account,           // FHIR Account (PID-18 account number)
  encounter,         // FHIR Encounter -> PV1 segment
  coverages,         // FHIR Coverage[] -> IN1 segments
  guarantor,         // RelatedPerson or Patient -> GT1
  conditions,        // FHIR Condition[] -> DG1 segments
  procedures,        // FHIR Procedure[] -> PR1 segments
  messageControlId: "MSG001",
  triggerEvent: "P01",  // P01=Add, P05=Update, P06=End
});

console.log(formatMessage(barMessage));
```

## Background Services

Run as standalone processes:

```sh
# Poll draft invoices and generate BAR messages
bun src/bar/invoice-builder-service.ts

# Send pending OutgoingBarMessage resources
bun src/bar/sender-service.ts
```

## Testing

```sh
bun test
```

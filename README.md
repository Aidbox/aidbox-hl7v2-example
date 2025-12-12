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
    └── generated/        # Auto-generated from @atomic-ehr/hl7v2
        ├── types.ts      # HL7v2 message types
        ├── fields.ts     # Segment interfaces and fromXXX() getters
        ├── messages.ts   # Message builders (BAR_P01Builder)
        └── tables.ts     # HL7 table constants

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

### HL7v2 Message Highlighting

The UI displays HL7v2 messages with rich syntax highlighting and tooltips:

- **Field tooltips** - Hover over any field to see its ID, name, data type, and required status
- **Component tooltips** - Nested components (e.g., `XPN.1: Family Name`) show their metadata
- **Color-coded delimiters** - Pipe `|` (blue), caret `^` (purple), tilde `~` (green), ampersand `&` (red)
- **Required indicators** - Fields marked with `[R]` are required per HL7v2 spec

Metadata is sourced from the HL7v2 schema bundled in `@atomic-ehr/hl7v2`.

## HL7v2 Module

Uses [@atomic-ehr/hl7v2](https://github.com/atomic-ehr/atomic-hl7v2) for type-safe HL7v2 message handling.

**Regenerate bindings:** `bun run regenerate-hl7v2`

```ts
import { formatMessage } from "@atomic-ehr/hl7v2/src/hl7v2/format";
import { BAR_P01Builder } from "./src/hl7v2/generated/messages";
import type { MSH, PID } from "./src/hl7v2/generated/fields";

const msh: MSH = {
  $3_sendingApplication: { $1_namespace: "HOSPITAL" },
  $9_messageType: { $1_code: "BAR", $2_event: "P01" },
  $10_messageControlId: "MSG001",
};

const pid: PID = {
  $3_identifier: [{ $1_value: "12345" }],
  $5_name: [{ $1_family: { $1_family: "Smith" }, $2_given: "John" }],
};

const message = new BAR_P01Builder()
  .msh(msh)
  .pid(pid)
  .build();

console.log(formatMessage(message));
```

## BAR Message Generation

Generate HL7v2 BAR messages from FHIR resources:

```ts
import { generateBarMessage } from "./src/bar";
import { formatMessage } from "@atomic-ehr/hl7v2/src/hl7v2/format";

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

There are environment variables allowing one to customize some of the resulting BAR message:

- `FHIR_APP`: Sending application name for MSH-3 (e.g., "HOSPITAL_EMR")
- `FHIR_FAC`: Sending facility name for MSH-4 (e.g., "MAIN_CAMPUS")
- `BILLING_APP`: Receiving application name for MSH-5 (e.g., "BILLING_SYSTEM")
- `BILLING_FAC`: Receiving facility name for MSH-6 (e.g., "BILLING_DEPT")

## Testing

```sh
bun test
```

# Aidbox HL7 Integration

A demo project for bidirectional HL7v2 ↔ FHIR conversion with a web UI, built on [Aidbox](https://www.health-samurai.io/aidbox).

**FHIR → HL7v2:** Generate BAR (billing) messages from Invoices, Patients, Encounters, Coverages, Conditions, and Procedures.

**HL7v2 → FHIR:** Convert incoming ADT (admissions) and ORU (lab results) messages into Patient, Encounter, DiagnosticReport, and Observation resources.

## Key Features

### Web Interface

Web UI for managing the HL7v2/FHIR workflow:

- **Invoice Management** — Create invoices, generate BAR messages, track processing status
- **Message Queues** — View outgoing BAR messages and incoming HL7v2 messages with syntax highlighting
- **HL7v2 Message Viewer** — Color-coded segments, field delimiters, and hover tooltips showing field names and data types
- **Code Mapping UI** — Resolve unmapped lab codes to LOINC, manage ConceptMap entries
- **MLLP Test Client** — Send test messages to the built-in MLLP server from the browser

### MLLP Server

Built-in TCP server implementing the Minimal Lower Layer Protocol (MLLP) for receiving HL7v2 messages. Background services use pull-based polling, so they can restart without losing work.

### Type-Safe Implementation

TypeScript interfaces are generated using [@atomic-ehr](https://github.com/atomic-ehr) to support compile-time validation and IDE autocomplete support:

- **FHIR R4 types** — Patient, Encounter, DiagnosticReport, Observation, etc.
- **HL7v2 message bindings** — Segment interfaces and message builders for BAR, ADT, ORU

### Unknown Code Mapping Resolution

When ORU messages contain local codes without LOINC mappings:

1. Message is flagged with unmapped codes
2. Mapping tasks are created
3. User can resolve it via web UI by selecting LOINC codes

## Quick Start

(see the [Getting Started Guide](docs/user-guide/getting-started.md) for detailed setup instructions)

**Prerequisites:** [Bun](https://bun.sh) v1.2+, [Docker](https://docker.com)

```sh
bun install
docker compose up -d

# First run: Open http://localhost:8080 and log in with aidbox.app to activate license

bun run migrate
bun run dev
```

- **Web UI:** http://localhost:3000
- **Aidbox Console:** http://localhost:8080
- **MLLP Server:** localhost:2575

## Documentation

- **[User Guide](docs/user-guide/README.md)** — Setup, configuration, operations, troubleshooting
- **[Developer Guide](docs/developer-guide/README.md)** — Architecture, extending the system, implementation details

## Supported Message Types

- **FHIR → HL7v2:** BAR^P01/P05/P06 (billing account records)
- **HL7v2 → FHIR:** ADT^A01/A08 (patient admission and updates), ORU^R01 (laboratory results)

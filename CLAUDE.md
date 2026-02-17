---
description: Aidbox HL7 Integration Project
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: true
---

# Your Role

Act as a critical, analytical partner. Before implementing ANY user suggestion:
- evaluate assumptions and tradeoffs
- state if you see weaknesses even for "reasonable" requests
- proceed only after this review (can be 1-2 sentences for simple cases)

Keep in mind that user might be an idiot and suggests things without thinking about them, so critically review ALL user suggestions, requests and thoughts.
State tradeoffs before implementing, even if the suggestion seems reasonable. Be direct but constructive.
If the change has clear downsides and the user still wants it, they must say: "I request you to do it this way".

# Aidbox HL7 Integration

HL7v2 message processing with Aidbox FHIR server. Bidirectional: FHIR → HL7v2 BAR (billing) and HL7v2 → FHIR (lab results, ADT).

## Quick Start

```sh
docker compose up -d              # Start Aidbox and PostgreSQL
bun src/migrate.ts                # Run database migrations
bun run dev                       # Start web server (logs to logs/server.log)
```

- **Web UI**: http://localhost:3000
- **Aidbox Console**: http://localhost:8080 (root / Vbro4upIT1)

## Development Scripts

```sh
bun run dev                       # Start server with hot reload
bun run stop                      # Stop the server
bun run logs                      # Tail server logs
bun run mllp                      # Start MLLP server (port 2575)
bun scripts/load-test-data.ts     # Load 5 test patients with related resources
bun run typecheck                 # TypeScript type checking
bun test:all                      # Run all tests: unit + integration
bun test:unit                     # Run unit tests only
bun test:integration              # Run integration tests only
bun reset-integration-aidbox      # Destroy and recreate test Aidbox from scratch (if test data in the db creates problems)
bun run regenerate-fhir           # Regenerate src/fhir/ from FHIR R4 spec
bun run regenerate-hl7v2          # Regenerate src/hl7v2/generated/
bun run generate-hl7v2-reference  # Generate data/hl7v2-reference/ from XSD+PDF (see docs)
```

Integration tests use a separate test Aidbox on port 8888 via `docker-compose.test.yaml`.

**IMPORTANT — Testing rules:**
1. **Always run `bun test:all` after any change.** Never run only `bun test:unit`. Do not skip integration tests.
2. **Don't manually run `docker compose` for integration tests.** The test command (`bun test:integration` or `bun test:all`) automatically starts Docker containers, waits for health, and runs migrations.

Read `docs/developer-guide/how-to/development-guide.md` for: test infrastructure details, how to run specific tests, writing new tests (conventions, integration test helpers), code generation workflows, and debugging.

## Architecture Overview

**Pull-based polling pattern**: Services poll Aidbox for work rather than push notifications. Benefits: resilience (restart without losing work), simplicity (no webhooks/queues), observability (queue visible as FHIR resources).

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Web UI | `src/index.ts`, `src/ui/` | Server-rendered pages, manual triggers |
| Aidbox Client | `src/aidbox.ts` | `aidboxFetch`, `getResources`, `putResource` |
| Invoice BAR Builder | `src/bar/invoice-builder-service.ts` | Polls pending Invoices → generates BAR messages |
| BAR Sender | `src/bar/sender-service.ts` | Polls pending OutgoingBarMessage → delivers |
| MLLP Server | `src/mllp/` | TCP server receiving HL7v2 messages (port 2575) |
| V2-to-FHIR Processor | `src/v2-to-fhir/processor-service.ts` | Polls received messages → converts to FHIR |
| Code Mapping | `src/code-mapping/` | LOINC resolution, ConceptMap per sender |

### Data Flow

**Outgoing (FHIR → HL7v2):**
```
Invoice (pending) → Invoice BAR Builder → OutgoingBarMessage (pending) → Sender → sent
```

**Incoming (HL7v2 → FHIR):**
```
MLLP receives → IncomingHL7v2Message (received) → Processor → FHIR resources (processed)
```

### Custom FHIR Resources

**OutgoingBarMessage** - Queued BAR messages
- `patient`, `invoice` (References) - required
- `status`: `pending` → `sent`
- `hl7v2` (string) - the message content

**IncomingHL7v2Message** - Received HL7v2 messages
- `message` (string) - raw HL7v2 content
- `type` (string) - from MSH-9 (e.g., "ADT^A01", "ORU^R01")
- `status`: `received` → `processed` | `warning` | `error` | `mapping_error`
- `sendingApplication`, `sendingFacility` - from MSH-3, MSH-4
- `unmappedCodes[]` - unresolved OBX codes (when `mapping_error`)

**Invoice extensions** (processing status):
- `http://example.org/invoice-processing-status`: `pending` | `completed` | `error` | `failed`
- `http://example.org/invoice-processing-retry-count`: number (max 3 retries)

## Workflows

### BAR Generation (FHIR → HL7v2)

Invoice BAR Builder polls pending Invoices and:
1. Fetches related resources: Patient, Account, Coverage[], Encounter, Condition[], Procedure[]
2. Calls `generateBarMessage()` in `src/bar/generator.ts` (pure function)
3. Creates OutgoingBarMessage, updates Invoice status

**Trigger events**: P01 (add account), P05 (update), P06 (end account).

→ Details: `docs/developer-guide/bar-generation.md`

### ORU Processing (HL7v2 → FHIR)

V2-to-FHIR Processor polls received IncomingHL7v2Message and:
1. Parses message, runs config-driven preprocessor (e.g., fix PV1-19 authority from MSH)
2. Routes by type (ADT_A01, ORU_R01, etc.)
3. For each OBX-3, resolves to LOINC (checks inline codes first, then sender's ConceptMap; on failure → `mapping_error`, creates Task)
4. Creates FHIR resources: DiagnosticReport (from OBR), Observation (from OBX), Specimen (from SPM)
5. If Patient/Encounter not found → creates drafts (`active=false`, `status=unknown`)
6. PV1 policy per message type: ADT requires valid PV1 (→ `error` if invalid); ORU skips Encounter on invalid PV1 (→ `warning`)

**Deterministic IDs**: Resources get IDs from source data, enabling idempotent reprocessing.

→ Details: `docs/developer-guide/oru-processing.md`

### Code Mapping (Multiple Types)

When HL7v2 codes can't be mapped to valid FHIR values:
1. Message gets `status=mapping_error`, code stored in `unmappedCodes[]`
2. Task created (deterministic ID from sender + code + mapping type)
3. User resolves via `/mapping/tasks` or `/mapping/table`
4. On resolution: Task completed, message requeued for processing

Mapping types are defined in `src/code-mapping/mapping-types.ts`.

**ConceptMap per sender per type**: Same local code from different senders can map to different values.

→ Details: `docs/developer-guide/code-mapping.md`

## Routes

**UI Pages:**
| Route | Purpose |
|-------|---------|
| `/invoices` | List invoices with status filter |
| `/outgoing-messages` | Outgoing BAR messages |
| `/incoming-messages` | Incoming HL7v2 messages |
| `/mapping/tasks` | Pending code mapping tasks |
| `/mapping/table` | ConceptMap entries |
| `/mllp-client` | MLLP test client |

**Actions (POST, trigger manually or via polling services):**
| Route | Purpose |
|-------|---------|
| `/build-bar` | Generate BAR from pending invoices |
| `/send-messages` | Send pending outgoing messages |
| `/process-incoming-messages` | Process received HL7v2 → FHIR |
| `/reprocess-errors` | Retry failed invoices (max 3) |

**API:**
| Route | Purpose |
|-------|---------|
| `GET /api/terminology/loinc?q=` | Search LOINC codes |
| `POST /api/mapping/tasks/:id/resolve` | Resolve task with LOINC |
| `POST /api/concept-maps/:id/entries` | Add/update ConceptMap entry |

## Project Structure

```
src/
├── index.ts              # HTTP server and routes
├── aidbox.ts             # Aidbox FHIR client
├── migrate.ts            # Database migrations (loads init-bundle.json)
├── api/                  # API handlers (HTTP request/response handling)
│   ├── concept-map-entries.ts  # ConceptMap entry CRUD endpoints
│   ├── mapping-tasks.ts        # Mapping task endpoints
│   └── task-resolution.ts      # Task resolution business logic
├── fhir/                 # FHIR R4 types (generated)
├── hl7v2/                # HL7v2 types, builders, formatters (generated)
│   ├── generated/        # types.ts, fields.ts, messages.ts, tables.ts
│   └── wrappers/         # Parser fixes (e.g., OBX SN values)
├── bar/                  # FHIR → HL7v2 BAR generation
│   ├── generator.ts      # generateBarMessage() - pure transformation
│   ├── invoice-builder-service.ts  # Polling service
│   └── sender-service.ts # Delivery service
├── v2-to-fhir/           # HL7v2 → FHIR conversion
│   ├── converter.ts      # Message type routing
│   ├── processor-service.ts  # Polling service
│   ├── config.ts         # Config loader for config/hl7v2-to-fhir.json
│   ├── preprocessor.ts   # Config-driven preprocessing before conversion
│   ├── id-generation.ts  # Encounter ID from PV1-19 (HL7 v2.8.2 CX rules)
│   ├── messages/         # ADT_A01, ORU_R01 converters
│   └── segments/         # PID, OBX, etc. converters
├── code-mapping/         # Code mapping for multiple field types
│   ├── mapping-types.ts  # Mapping type registry (CRITICAL: add new types here)
│   ├── mapping-errors.ts # MappingError types and builders
│   ├── concept-map/      # ConceptMap CRUD and observation code resolution
│   └── mapping-task-service.ts  # Task creation/resolution
├── mllp/                 # MLLP TCP server
└── ui/                   # Server-rendered HTML pages
scripts/
├── hl7v2-reference/      # HL7v2 reference data generator (XSD + PDF → JSON)
└── generate-hl7v2-reference.ts
data/
└── hl7v2-reference/v2.5/ # Generated reference JSON (fields, segments, datatypes, messages, tables)
```

## Documentation

For implementation details, see `docs/developer-guide/`:

| When you need | Read |
|---------------|------|
| System diagrams, polling pattern details | `architecture.md` |
| FHIR→HL7v2 field mappings, segment builders | `bar-generation.md` |
| HL7v2→FHIR conversion, ORU processing | `oru-processing.md` |
| ConceptMap workflow, Task lifecycle | `code-mapping.md` |
| MLLP protocol, ACK generation | `mllp-server.md` |
| HL7v2 builders, field naming (`$N_fieldName`) | `hl7v2-module.md` |
| Coding standards | `.claude/code-style.md` |

## Bun Guidelines

Use Bun instead of Node.js:

| Instead of | Use                                       |
|------------|-------------------------------------------|
| `node`/`ts-node`, `npm`/`yarn`/`pnpm` | `bun`, `bun install`, `bun run`           |
| `jest`/`vitest` | `bun test:all`                            |
| `dotenv` | Not needed (Bun loads .env automatically) |
| `express` | `Bun.serve()`                             |
| `better-sqlite3` / `pg` / `ioredis` | `bun:sqlite` / `Bun.sql` / `Bun.redis`    |
| `ws` | Built-in `WebSocket`                      |
| `node:fs readFile/writeFile` | `Bun.file`                                |

## Code Style

IMPORTANT: Always read `.claude/code-style.md` before writing or modifying code.

## HL7v2 Spec Compliance Rule

Before proposing, implementing, or reviewing ANY change that touches HL7v2 message handling — including segment optionality, field semantics, message structure, or processing rules — you MUST look up the relevant message/segment/field via the `hl7v2-info` skill first.

Do NOT rely on assumptions, existing code patterns, or memory of the spec. The code may intentionally deviate from the spec, but you must know what the spec says before proposing or implementing changes.

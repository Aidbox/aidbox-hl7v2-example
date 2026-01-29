---
description: Aidbox HL7 Integration - Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

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
bun test                          # Run unit tests
bun test:all                      # Run all tests: unit + integration (requires Aidbox)
bun test:unit                     # Run unit tests (alias for bun test)
bun test:integration              # Run integration tests only (requires Aidbox)
bun reset-integration-aidbox      # Destroy and recreate test Aidbox from scratch
bun run regenerate-fhir           # Regenerate src/fhir/ from FHIR R4 spec
bun run regenerate-hl7v2          # Regenerate src/hl7v2/generated/
```

**Integration tests** use a separate test Aidbox on port 8888 via `docker-compose.test.yaml`.

→ Details: `docs/developer-guide/how-to/development-guide.md`

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
- `status`: `received` → `processed` | `error` | `mapping_error`
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
1. Parses message, routes by type (ADT_A01, ORU_R01, etc.)
2. For each OBX-3, resolves to LOINC (checks inline codes first, then sender's ConceptMap; on failure → `mapping_error`, creates Task)
3. Creates FHIR resources: DiagnosticReport (from OBR), Observation (from OBX), Specimen (from SPM)
4. If Patient/Encounter not found → creates drafts (`active=false`, `status=unknown`)

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
│   ├── messages/         # ADT_A01, ORU_R01 converters
│   └── segments/         # PID, OBX, etc. converters
├── code-mapping/         # Code mapping for multiple field types
│   ├── mapping-types.ts  # Mapping type registry (CRITICAL: add new types here)
│   ├── mapping-errors.ts # MappingError types and builders
│   ├── concept-map/      # ConceptMap CRUD, lookup
│   └── mapping-task-service.ts  # Task creation/resolution
├── mllp/                 # MLLP TCP server
└── ui/                   # Server-rendered HTML pages
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

| Instead of | Use |
|------------|-----|
| `node`/`ts-node`, `npm`/`yarn`/`pnpm` | `bun`, `bun install`, `bun run` |
| `jest`/`vitest` | `bun test` |
| `dotenv` | Not needed (Bun loads .env automatically) |
| `express` | `Bun.serve()` |
| `better-sqlite3` / `pg` / `ioredis` | `bun:sqlite` / `Bun.sql` / `Bun.redis` |
| `ws` | Built-in `WebSocket` |
| `node:fs readFile/writeFile` | `Bun.file` |

## Code Style

Always read `.claude/code-style.md` before writing or modifying code.

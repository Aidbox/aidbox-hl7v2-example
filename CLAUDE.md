---
description: Aidbox HL7 Integration - Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

# Aidbox HL7 Integration

## Project Overview

This project integrates with Aidbox FHIR server for HL7v2 message processing. It provides a web UI to view Invoices, Outgoing BAR messages, and Incoming HL7v2 messages.

See `spec/architecture.md` for system diagrams, pull-based polling architecture, data flow sequences, and resource status transitions - useful when understanding how components interact or debugging message flow issues.

## Quick Start

```sh
# Start Aidbox and PostgreSQL
docker compose up -d

# Run database migrations (creates custom resources)
bun src/migrate.ts

# Start the web server (with hot reload, logs to file)
bun run dev
```

- **Web UI**: http://localhost:3000
- **Aidbox**: http://localhost:8080

## Development Scripts

```sh
bun run dev   # Start server with hot reload (logs to logs/server.log, PID in logs/server.pid)
bun run stop  # Stop the server
bun run logs  # Tail server logs (tail -f logs/server.log)

# Load test data (5 patients with encounters, conditions, procedures, coverages)
bun scripts/load-test-data.ts
```

## Project Structure

- `src/index.ts` - Bun HTTP server with routes for Invoices, Outgoing/Incoming Messages, MLLP Client
- `src/aidbox.ts` - Reusable Aidbox client with `aidboxFetch`, `getResources`, `putResource`
- `src/migrate.ts` - Script for loading custom resource StructureDefinitions (OutgoingBarMessage, IncomingHL7v2Message) from init-bundle.json
- `src/fhir/` - Code-generated FHIR R4 type definitions
- `src/bar/` - BAR message generation from FHIR resources
- `src/hl7v2/` - HL7v2 message representation, builders, and formatter
- `src/v2-to-fhir/` - Collection of HL7v2 to FHIR converters
- `src/code-mapping/` - Code mapping services (ConceptMap, terminology API, mapping Task)
- `src/mllp/` - MLLP (Minimal Lower Layer Protocol) TCP server for receiving HL7v2 messages
- `src/ui/` - Web UI page handlers and HTML rendering
- `spec/` - Detailed specification documents
- `docker-compose.yaml` - Aidbox and PostgreSQL setup

## Routes

**UI Pages:**
| Route | Description |
|-------|-------------|
| `/invoices` | List invoices with status filter |
| `/outgoing-messages` | List outgoing BAR messages |
| `/incoming-messages` | List incoming HL7v2 messages |
| `/mapping/tasks` | Queue of pending code mapping tasks |
| `/mapping/table` | ConceptMap entries management |
| `/mllp-client` | MLLP test client |

**API:**
| Route | Method | Description |
|-------|--------|-------------|
| `/api/terminology/loinc?q=` | GET | Search LOINC codes |
| `/api/terminology/loinc/:code` | GET | Validate LOINC code |
| `/api/mapping/tasks/:id/resolve` | POST | Resolve mapping task with LOINC code |
| `/api/concept-maps/:id/entries` | POST | Add ConceptMap entry |
| `/api/concept-maps/:id/entries/:code` | POST | Update ConceptMap entry |
| `/api/concept-maps/:id/entries/:code/delete` | POST | Delete ConceptMap entry |

**Actions:**
| Route | Description |
|-------|-------------|
| `/build-bar` | Build BAR messages from pending invoices |
| `/send-messages` | Send pending outgoing messages |
| `/reprocess-errors` | Retry failed invoices (max 3 attempts) |
| `/process-incoming-messages` | Process received HL7v2 messages |
| `/mark-for-retry/:id` | Reset message status to `received` |

## Code Generation

### FHIR R4 Types (`src/fhir/`)

Generated using [@atomic-ehr/codegen](https://github.com/atomic-ehr/codegen) from the official HL7 FHIR R4 specification.

```sh
bun run regenerate-fhir   # Regenerates src/fhir/hl7-fhir-r4-core/
```

- Script: `scripts/regenerate-fhir.ts`
- Output: 195 TypeScript interfaces for FHIR R4 resources
- Uses `APIBuilder` from `@atomic-ehr/codegen` with `hl7.fhir.r4.core` package

### HL7v2 Module (`src/hl7v2/`)

Generated using [@atomic-ehr/hl7v2](https://github.com/atomic-ehr/atomic-hl7v2) for type-safe HL7v2 message handling.

```sh
bun run regenerate-hl7v2  # Regenerates src/hl7v2/generated/
```

- Script: `scripts/regenerate-hl7v2.sh`
- Output:
  - `generated/types.ts` - Core types: `HL7v2Message`, `HL7v2Segment`, `FieldValue`
  - `generated/fields.ts` - Segment interfaces, `toSegment()`, and `fromXXX()` getters
  - `generated/messages.ts` - Message builders (`BAR_P01Builder`)
  - `generated/tables.ts` - HL7 table constants

Note: `highlightHL7Message`, `getHighlightStyles`, and `formatMessage` are imported directly from `@atomic-ehr/hl7v2`.

```ts
import { formatMessage } from "@atomic-ehr/hl7v2/src/hl7v2/format";
import { BAR_P01Builder } from "./src/hl7v2/generated/messages";
import { toSegment, type MSH, type PID } from "./src/hl7v2/generated/fields";

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

See `spec/hl7v2.md` for segment builder fluent API, field naming conventions, and datatype interfaces (XPN, CX, HD, etc.) - useful when building or parsing HL7v2 messages.

## BAR Message Generator (`src/bar/`)

Generates HL7v2 BAR messages from FHIR resources.

- `types.ts` - Re-exports FHIR types from `src/fhir/` and defines `BarMessageInput`
- `generator.ts` - `generateBarMessage()` pure function
- `sender-service.ts` - Polling service for sending OutgoingBarMessage
- `index.ts` - Module exports

```ts
import { generateBarMessage } from "./src/bar";
import { formatMessage } from "@atomic-ehr/hl7v2/src/hl7v2/format";

const barMessage = generateBarMessage({
  patient,           // FHIR Patient
  account,           // FHIR Account (provides PID-18 account number)
  encounter,         // FHIR Encounter -> PV1
  coverages,         // FHIR Coverage[] -> IN1 segments
  guarantor,         // RelatedPerson or Patient -> GT1
  conditions,        // FHIR Condition[] -> DG1 segments
  procedures,        // FHIR Procedure[] -> PR1 segments
  messageControlId: "MSG001",
  triggerEvent: "P01",  // P01=Add, P05=Update, P06=End
});

console.log(formatMessage(barMessage));
```

See `spec/bar-message-spec.md` for FHIR→HL7v2 field mappings per segment (PID, PV1, IN1, DG1, PR1, GT1) and trigger event semantics (P01/P05/P06) - useful when debugging or extending BAR generation.

## Invoice BAR Builder Service (`src/bar/invoice-builder-service.ts`)

Polls Aidbox for pending Invoices and generates BAR messages.

- Polls every minute for Invoice with `processing-status=pending` (custom extension), sorted by `_lastUpdated` (oldest first)
- Invoice.status remains "draft" (FHIR standard), processing tracked via extension
- Processing statuses: `pending` → `completed` (or `error` on failure)
- Fetches related resources: Patient, Account, Coverage, Encounter, Condition, Procedure
- Generates BAR message using `generateBarMessage()`
- Creates OutgoingBarMessage with `status=pending`
- Updates Invoice processing-status to "completed" via PATCH

```sh
# Run as standalone service
bun src/bar/invoice-builder-service.ts
```

## BAR Message Sender Service (`src/bar/sender-service.ts`)

Polls Aidbox for pending OutgoingBarMessage resources and sends them as IncomingHL7v2Message.

- Polls every minute for OutgoingBarMessage with `status=pending`, sorted by `_lastUpdated`
- On message found: sends as IncomingHL7v2Message, updates status to "sent", polls immediately for next
- On no message: waits 1 minute before polling again

```sh
# Run as standalone service
bun src/bar/sender-service.ts
```

## MLLP Server (`src/mllp/`)

TCP server implementing the Minimal Lower Layer Protocol (MLLP) for receiving HL7v2 messages over TCP/IP.

- `mllp-server.ts` - MLLP TCP server with message parsing and ACK generation
- `index.ts` - Module exports

**MLLP Protocol:**
- Start Block: `0x0B` (VT - Vertical Tab)
- End Block: `0x1C 0x0D` (FS + CR)
- Default Port: 2575

**Features:**
- Accepts HL7v2 messages wrapped in MLLP framing
- Stores messages as `IncomingHL7v2Message` resources in Aidbox
- Sends HL7v2 ACK responses (AA/AE/AR)
- Handles multiple concurrent connections
- Supports fragmented TCP delivery

```sh
# Start MLLP server (default port 2575)
bun run mllp

# With custom port
MLLP_PORT=3001 bun run mllp

# Test with sample client
bun run test-mllp
```

**Web UI MLLP Test Client:**

The web UI includes an MLLP Test Client at `/mllp-client` for sending test messages:
- Configure host and port
- Select from sample messages (ADT^A01, ADT^A08, BAR^P01, ORM^O01)
- View ACK responses
- Messages are stored in Aidbox and visible in Incoming Messages

## V2-to-FHIR Converter (`src/v2-to-fhir/`)

Converts inbound HL7v2 messages to FHIR resources. Supports ADT_A01, ADT_A08, and ORU_R01.

- `converter.ts` - Core conversion logic, message type routing
- `processor-service.ts` - Background service polling `IncomingHL7v2Message` with `status=received`
- `messages/` - Message-level converters
- `segments/` - Segment-to-FHIR converters
- `datatypes/` - HL7v2 datatype converters
- `code-mapping/` - LOINC code resolution for OBX segments

```sh
# Run processor service
bun src/v2-to-fhir/processor-service.ts
```

See `spec/v2-to-fhir/spec.md` for supported segments/datatypes.

### ORU_R01 Lab Results Processing

Converts lab results to DiagnosticReport + Observation + Specimen resources.
Blocks message conversion with status `mapping_error` if failed to resolve OBX code to LOINC.

See `spec/oru-message-processing.md` for ORU_R01 processing pipeline details.

## Code Mapping (`src/code-mapping/`)

Handles local-to-LOINC code mappings for laboratory codes that arrive without standard LOINC codes.

- `concept-map/` - ConceptMap CRUD and LOINC lookup (one ConceptMap per sender)
- `mapping-task-service.ts` - Task lifecycle: create for unmapped codes, resolve with LOINC, update affected messages
- `terminology-api.ts` - LOINC search and validation via external terminology service

See `spec/code-mapping-infrastructure.md` for data model and `spec/code-mapping-ui.md` for UI workflows.

## Custom FHIR Resources

### OutgoingBarMessage
- `patient` (Reference to Patient) - required
- `invoice` (Reference to Invoice) - required
- `status` (string) - required
- `hl7v2` (string) - optional

### IncomingHL7v2Message
- `message` (string) - raw HL7v2 message content, required
- `type` (string) - message type from MSH-9 (e.g., "ADT^A01"), required
- `status` (string) - `received` | `processed` | `error` | `mapping_error`
- `date` (dateTime) - message timestamp
- `sendingApplication` (string) - MSH-3
- `sendingFacility` (string) - MSH-4
- `patient` (Reference) - linked Patient after processing
- `error` (string) - error message if status is `error`
- `unmappedCodes` (array) - unresolved OBX codes when status is `mapping_error`

## Aidbox Credentials (Development)

From docker-compose.yaml:
- URL: `http://localhost:8080`
- Client ID: `root`
- Client Secret: `Vbro4upIT1`

## Bun Guidelines

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

Use `bun run typecheck` to ensure there are no type errors.

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

# Best Code Practices

## Readable code
Prefer readable variable names over comments:
```typescript
/* BAD */

// Check if this group maps to LOINC
if (group.target !== "http://loinc.org") continue;

// If a source system is specified in the group, check if it matches
if (group.source !== localSystem) {
  // Also try with normalized system
  if (normalizeSystem(localSystem) !== group.source) {
    continue;
  }
}


/* GOOD */

const mapsToLoinc = mappingSystem.target === "http://loinc.org";
const matchingSystem = mappingSystem.source === localSystem || mappingSystem.source === normalizeSystem(localSystem);

if (!mapsToLoinc || !matchingSystem)
  continue;
```

Prefer functions over big commented blocks:
```typescript
/* BAD */

// =========================================================================
// OBX Parsing
// =========================================================================

// ... a lot of code

// =========================================================================
// SPM Parsing
// =========================================================================

// ... a lot of code


/* GOOD */

function parseOBX() {
  // ... a lot of code
}

function parseSPM() {
  // ... a lot of code
}

const obx = parseOBX();
const spm = parseSPM();
```

## Separation of concerns

Ideally, each module should own one primary responsibility. Before adding new logic, check if a
module already owns that responsibility; if yes, extend or reuse it instead of duplicating code.

If new logic overlaps with another module’s responsibility:
- Consider moving shared logic into a single module and call it from both places.
- Prefer refactoring when the overlap is more than small glue code.

If ownership is unclear or refactoring is risky:
- Keep the duplication for now.
- Add a short comment explaining why and where the related code lives, so it can be consolidated later.

### Minimal public interface

Modules should export only what consumers actually need.
Keep implementation details private, don't break encapsulation and keep coupling low.

```typescript
// GOOD: Export only the interface consumers need
export async function processInvoice(invoiceId: string): Promise<Result>

// BAD: Export implementation details that force consumers to orchestrate
export function fetchInvoice(id: string)        // Internal step - keep private
export function saveInvoice(invoice: any)       // Internal step - keep private
export interface InvoiceInternal { ... }        // Internal type - keep private
```

This ensures:
- Consumers depend only on the public contract, not internal structure
- Internal implementation can change without breaking consumers
- Each module owns its logic; consumers don't orchestrate it

## Avoid cyclic dependencies

Never create circular imports between modules. If module A imports from module B, then module B must not import from module A (directly or indirectly).

To avoid cycles:
- Place shared utilities, types, and constants in a dedicated `shared/` module that other modules can import from
- Keep dependencies flowing in one direction (e.g., services → utilities, not utilities → services)
- If two modules need each other's functionality, extract the shared part into a third module

## Other
- Don't add error handling, fallbacks, or validation for scenarios that can't happen.
- Always use static imports at the top of the file. Never use dynamic `await import()` inside functions or route handlers.
- Remove unused code immediately; do not keep dead code or commented-out code

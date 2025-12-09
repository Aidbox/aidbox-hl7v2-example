---
description: Aidbox HL7 Integration - Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

# Aidbox HL7 Integration

## Project Overview

This project integrates with Aidbox FHIR server for HL7v2 message processing. It provides a web UI to view Invoices, Outgoing BAR messages, and Incoming HL7v2 messages.

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

- `src/index.ts` - Bun HTTP server with routes for Invoices, Outgoing/Incoming Messages
- `src/aidbox.ts` - Reusable Aidbox client with `aidboxFetch`, `getResources`, `putResource`
- `src/migrate.ts` - Custom resource StructureDefinitions (OutgoingBarMessage, IncomingHL7v2Message)
- `src/bar/` - BAR message generation from FHIR resources
- `src/hl7v2/` - HL7v2 message representation, builders, and formatter
- `docker-compose.yaml` - Aidbox and PostgreSQL setup

## HL7v2 Module (`src/hl7v2/`)

Type-safe HL7v2 message handling with fluent builders.

- `types.ts` - Core types: `HL7v2Message`, `HL7v2Segment`, `FieldValue`
- `fields.ts` - Generated fluent builders (MSHBuilder, PIDBuilder, etc.) and getters
- `format.ts` - Serializes messages to pipe-delimited wire format
- `codegen.ts` - Generates builders from HL7v2 schema definitions

```ts
import { MSHBuilder, PIDBuilder } from "./src/hl7v2/fields";
import { formatMessage } from "./src/hl7v2/format";

const message = [
  new MSHBuilder()
    .set9_1_messageCode("ADT")
    .set9_2_triggerEvent("A01")
    .build(),
  new PIDBuilder()
    .set3_1_idNumber("12345")
    .set5_1_1_surname("Smith")
    .set5_2_givenName("John")
    .build(),
];

console.log(formatMessage(message));
```

## BAR Message Generator (`src/bar/`)

Generates HL7v2 BAR messages from FHIR resources.

- `types.ts` - FHIR resource types (Patient, Account, Coverage, etc.)
- `generator.ts` - `generateBarMessage()` pure function
- `sender-service.ts` - Polling service for sending OutgoingBarMessage
- `index.ts` - Module exports

```ts
import { generateBarMessage } from "./src/bar";
import { formatMessage } from "./src/hl7v2/format";

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

## BAR Message Sender Service (`src/bar/sender-service.ts`)

Polls Aidbox for pending OutgoingBarMessage resources and sends them as IncomingHL7v2Message.

- Polls every minute for OutgoingBarMessage with `status=pending`, sorted by `_lastUpdated`
- On message found: sends as IncomingHL7v2Message, updates status to "sent", polls immediately for next
- On no message: waits 1 minute before polling again

```sh
# Run as standalone service
bun src/bar/sender-service.ts
```

```ts
import { createBarMessageSenderService } from "./src/bar";

const service = createBarMessageSenderService({
  pollIntervalMs: 60000,  // default: 1 minute
  onError: (error) => console.error(error),
  onIdle: () => console.log("No pending messages"),
});

service.start();
// service.stop();
```

## Custom FHIR Resources

### OutgoingBarMessage
- `patient` (Reference to Patient) - required
- `invoice` (Reference to Invoice) - required
- `status` (string) - required
- `hl7v2` (string) - optional

### IncomingHL7v2Message
- `type` (string) - required
- `date` (dateTime) - optional
- `patient` (Reference to Patient) - optional
- `message` (string) - required

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

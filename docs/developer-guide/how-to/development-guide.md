# Development Guide

Developer workflows for testing, debugging, and extending the codebase.

For initial setup (Docker, Aidbox, running services), see the [User Guide: Getting Started](../../user-guide/getting-started.md).

## Testing

### Unit Tests

Unit tests have no external dependencies and run fast. The default test root is `./test/unit` (configured in `bunfig.toml`).

```sh
bun test                                    # Run unit tests only
bun test:unit                               # Same as above (alias)
bun test test/unit/bar/                     # Run tests in directory
bun test test/unit/bar/generator.test.ts    # Run specific file
bun test --watch                            # Watch mode
```

### Integration Tests

Integration tests run against a real Aidbox instance and verify end-to-end workflows (HL7v2 message processing, BAR generation, code mapping).

#### Prerequisites

1. **Docker and Docker Compose** installed
2. **Aidbox license** — obtain a development license from [aidbox.app](https://aidbox.app) and add it to your `.env` file:
   ```
   AIDBOX_LICENSE=<your-jwt-token>
   ```
3. The test infrastructure uses `docker-compose.test.yaml`, which runs a **separate** Aidbox instance on port 8888 with its own PostgreSQL database (`aidbox_test`). This does not interfere with the development Aidbox on port 8080.

#### Running Integration Tests

```sh
# Run integration tests (starts Aidbox if not running, runs migrations on first start):
bun test:integration

# Run all tests (unit + integration):
bun test:all

# Run a specific test by name pattern:
bun test:integration --test-name-pattern "processes invoice and creates"

# Destroy and recreate test Aidbox from scratch (when DB is in a bad state):
bun reset-integration-aidbox
```

#### How Startup Works

The integration test preload (`test/integration/preload.ts`) automatically handles setup:

1. Checks if test Aidbox is already running (health check on port 8888)
2. If not running: starts containers via `docker compose -f docker-compose.test.yaml up -d`, waits for health (up to 90s), and runs database migrations
3. If already running: skips startup entirely for faster iteration

Tests never tear down the Aidbox instance — it stays running between test runs. Use `bun reset-integration-aidbox` to destroy and recreate it from scratch when needed.

### Type Checking

```sh
bun run typecheck    # TypeScript type checking (no emit)
```

### Test Organization

```
test/
├── fixtures/hl7v2/         # HL7v2 message fixtures (ADT, ORU)
├── unit/                   # Unit tests (no external dependencies)
│   ├── bar/
│   ├── code-mapping/
│   ├── hl7v2/
│   ├── mllp/
│   ├── ui/
│   └── v2-to-fhir/
└── integration/            # Integration tests (require Aidbox)
    ├── preload.ts          # Global setup (container lifecycle, migrations)
    ├── helpers.ts          # Shared utilities (aidboxFetch, cleanup, fixtures)
    ├── bar/
    ├── ui/
    └── v2-to-fhir/
```

### Writing Tests

Tests use Bun's built-in test framework:

```typescript
import { test, expect, describe } from "bun:test";

describe("feature", () => {
  test("does something", () => {
    expect(result).toBe(expected);
  });
});
```

For converters, test both the happy path and edge cases (missing fields, malformed data).

#### Writing Integration Tests

Integration test files use the naming convention `*.integration.test.ts`.

Key helpers from `test/integration/helpers.ts`:
- **`aidboxFetch()`** — authenticated HTTP client for Aidbox (uses test instance on port 8888 during integration tests)
- **`loadFixture(path)`** — loads HL7v2 messages from `test/fixtures/hl7v2/`
- **`cleanupTestResources()`** — runs in `beforeEach` (configured in `preload.ts`) to give each test a clean state

Tests run serially (`--max-concurrency=1`) to prevent interference between tests that share the Aidbox instance.

#### Future Optimization Ideas

If integration test performance becomes a bottleneck, consider these approaches:

1. **Parallel Aidbox instances** — Spawn multiple independent Aidbox containers (e.g., ports 8888, 8889, 8890) and partition tests across them. Each instance has its own database, enabling true parallel execution without test interference.

2. **Global ConceptMap fixtures** — ConceptMap CRUD operations are slow because Aidbox invalidates its terminology cache on each change. Move ConceptMap creation from individual tests to a global setup phase (in `preload.ts`). Tests that need specific ConceptMap states should use unique sender identifiers (e.g., `TEST1_LAB/TEST1_HOSP`) rather than modifying shared fixtures.

## Code Generation

Regenerate types after updating `@atomic-ehr` packages:

```sh
bun run regenerate-fhir    # Regenerate src/fhir/hl7-fhir-r4-core/
bun run regenerate-hl7v2   # Regenerate src/hl7v2/generated/
```

Caveat: `bun run regenerate-hl7v2` and `bun run generate-hl7v2-reference` are completely different workflows. The former regenerates runtime TypeScript bindings; the latter regenerates local reference JSON from HL7 XSD/PDF sources. See [HL7v2 Reference Data Generation](hl7v2-reference-generation.md).

See [Extracting Modules](extracting-modules.md) for details on the generated code structure.

## Debugging

### Viewing Logs

```sh
bun run logs              # Tail web server logs
tail -f logs/server.log   # Same thing

# Search for errors
grep -i "error" logs/server.log

# Follow logs and filter
tail -f logs/server.log | grep -i "error\|failed"
```

### Inspecting Aidbox Resources

**Aidbox Console (UI):**

Open http://localhost:8080. See [Configuration > Aidbox License](../../user-guide/configuration.md#aidbox-license) for login instructions. The console lets you browse resources, run queries, and inspect data visually.

**curl:**

```sh
# List resources
curl -u root:Vbro4upIT1 http://localhost:8080/fhir/Patient

# Get specific resource
curl -u root:Vbro4upIT1 http://localhost:8080/fhir/Patient/123

# Search with parameters
curl -u root:Vbro4upIT1 "http://localhost:8080/fhir/IncomingHL7v2Message?status=received"
```

### Docker / Aidbox

```sh
docker compose logs aidbox    # Check logs
docker compose down -v        # Reset volumes (destructive)
docker compose up -d          # Restart

# Ensure Aidbox is healthy
curl http://localhost:8080/health

# Re-run migrations
bun run migrate
```

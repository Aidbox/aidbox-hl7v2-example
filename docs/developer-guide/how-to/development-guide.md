# Development Guide

Developer workflows for testing, debugging, and extending the codebase.

For initial setup (Docker, Aidbox, running services), see the [User Guide: Getting Started](../../user-guide/getting-started.md).

## Testing

### Unit Tests

Unit tests have no external dependencies and run fast. The default test root is `./test/unit` (configured in `bunfig.toml`).

```sh
bun test                                    # Run all unit tests
bun test:unit                               # Same as above (explicit)
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
# First run — starts fresh containers, runs migrations, tears down after:
TEST_RESET_AIDBOX=true bun test:integration

# Subsequent runs — reuses running containers (faster):
bun test:integration
```

#### `TEST_RESET_AIDBOX` Option

| Value | Behavior |
|-------|----------|
| `true` | Stops existing test containers, starts fresh ones with `docker compose -f docker-compose.test.yaml up -d`, runs database migrations, waits for Aidbox health check (up to 90s), tears down containers after tests complete |
| unset / `false` | Assumes test containers are already running, skips setup and teardown — use this for faster iteration during development |

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
    ├── preload.ts          # Global setup/teardown (container lifecycle)
    ├── helpers.ts          # Shared utilities (testAidboxFetch, cleanup, fixtures)
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
- **`describeIntegration()`** — wraps `describe()`, auto-skips when Aidbox is unavailable
- **`testAidboxFetch()`** — authenticated HTTP client for the test Aidbox (port 8888)
- **`loadFixture(path)`** — loads HL7v2 messages from `test/fixtures/hl7v2/`
- **`cleanupTestResources()`** — runs in `beforeEach` (configured in `preload.ts`) to give each test a clean state

Tests run serially (`--max-concurrency=1`) to prevent interference between tests that share the Aidbox instance.

## Code Generation

Regenerate types after updating `@atomic-ehr` packages:

```sh
bun run regenerate-fhir    # Regenerate src/fhir/hl7-fhir-r4-core/
bun run regenerate-hl7v2   # Regenerate src/hl7v2/generated/
```

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


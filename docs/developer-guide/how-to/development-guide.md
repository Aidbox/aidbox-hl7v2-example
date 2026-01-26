# Development Guide

Developer workflows for testing, debugging, and extending the codebase.

For initial setup (Docker, Aidbox, running services), see the [User Guide: Getting Started](../../user-guide/getting-started.md).

## Testing

### Running Tests

```sh
bun test                             # Run all tests
bun test test/bar/                   # Run tests in directory
bun test test/bar/generator.test.ts  # Run specific file
bun test --watch                     # Watch mode
```

### Type Checking

```sh
bun run typecheck    # TypeScript type checking (no emit)
```

### Test Organization

Tests mirror the `src/` structure:

```
test/
├── bar/                    # BAR message generation
├── code-mapping/           # ConceptMap and Task services
├── hl7v2/                  # HL7v2 parsing/formatting
├── mllp/                   # MLLP server
├── ui/                     # UI components
└── v2-to-fhir/
    ├── datatypes/          # HL7v2→FHIR datatype converters
    ├── messages/           # Message-level converters
    └── segments/           # Segment converters
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


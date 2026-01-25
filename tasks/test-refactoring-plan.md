# Test Refactoring Plan for oru-r01.test.ts

## Decisions Summary

| Decision | Choice |
|----------|--------|
| **Integration tests** | Full E2E (submit to Aidbox, verify stored resources) |
| **Fixtures** | File-based (.hl7 files) |
| **Aidbox instance** | Separate test instance via `docker-compose.test.yaml` |
| **Test isolation** | Fresh Aidbox per `bun test` command (`down -v` + `up`) |
| **IncomingHL7v2Message creation** | POST (server-assigned ID, like production) |
| **Scope** | Just oru-r01.test.ts first, then expand |

---

## Architecture

### Aidbox License Requirement

Aidbox requires a license to run - `BOX_SECURITY_DEV_MODE` does **not** bypass this requirement.

**Solution**: Use the `AIDBOX_LICENSE` environment variable.

**How to get a free development license:**
1. Go to https://aidbox.app/
2. Sign up / log in
3. Create a project (free tier available)
4. Copy the license key from your project settings

**Providing the license:**
```bash
# Option 1: Export env var before running tests
export AIDBOX_LICENSE="your-license-key-here"

# Option 2: Add to .env file (should be gitignored)
echo "AIDBOX_LICENSE=your-license-key-here" >> .env
```

The same license can be used for both dev and test instances (different ports).

### Separate Test Aidbox Instance

Tests run against a **completely separate Aidbox instance** (not your development one).

**File:** `docker-compose.test.yaml`

```yaml
volumes:
  postgres_test_data: {}

services:
  postgres-test:
    image: docker.io/library/postgres:18
    volumes:
      - postgres_test_data:/var/lib/postgresql/18/docker:delegated
    command:
      - postgres
      - -c
      - shared_preload_libraries=pg_stat_statements
    environment:
      POSTGRES_USER: aidbox
      POSTGRES_PORT: '5432'
      POSTGRES_DB: aidbox_test
      POSTGRES_PASSWORD: test_password

  aidbox-test:
    image: docker.io/healthsamurai/aidboxone:edge
    pull_policy: always
    depends_on:
      - postgres-test
    ports:
      - "8888:8080"  # Different port from dev (8080)
    volumes:
      - ./init-bundle.json:/init-bundle.json:ro
    environment:
      AIDBOX_LICENSE: ${AIDBOX_LICENSE}  # Required - set in .env or export before running
      BOX_INIT_BUNDLE: file:///init-bundle.json
      BOX_ADMIN_PASSWORD: test_admin_password
      BOX_BOOTSTRAP_FHIR_PACKAGES: hl7.fhir.r4.core#4.0.1
      BOX_COMPATIBILITY_VALIDATION_JSON__SCHEMA_REGEX: '#{:fhir-datetime}'
      BOX_DB_DATABASE: aidbox_test
      BOX_DB_HOST: postgres-test
      BOX_DB_PASSWORD: test_password
      BOX_DB_PORT: '5432'
      BOX_DB_USER: aidbox
      BOX_FHIR_BUNDLE_EXECUTION_VALIDATION_MODE: limited
      BOX_FHIR_COMPLIANT_MODE: 'true'
      BOX_FHIR_CORRECT_AIDBOX_FORMAT: 'true'
      BOX_FHIR_CREATEDAT_URL: https://aidbox.app/ex/createdAt
      BOX_FHIR_SCHEMA_VALIDATION: 'true'
      BOX_FHIR_SEARCH_AUTHORIZE_INLINE_REQUESTS: 'true'
      BOX_FHIR_SEARCH_CHAIN_SUBSELECT: 'true'
      BOX_FHIR_SEARCH_COMPARISONS: 'true'
      BOX_FHIR_TERMINOLOGY_ENGINE: hybrid
      BOX_FHIR_TERMINOLOGY_ENGINE_HYBRID_EXTERNAL_TX_SERVER: https://tx.health-samurai.io/fhir
      BOX_FHIR_TERMINOLOGY_SERVICE_BASE_URL: https://tx.health-samurai.io/fhir
      BOX_FHIR_VALIDATOR_STRICT_EXTENSION_RESOLUTION: 'true'
      BOX_MODULE_SDC_STRICT_ACCESS_CONTROL: 'true'
      BOX_ROOT_CLIENT_SECRET: test_secret
      BOX_RUNME_UUID: test-instance-uuid
      BOX_SEARCH_INCLUDE_CONFORMANT: 'true'
      BOX_SECURITY_AUDIT_LOG_ENABLED: 'true'
      BOX_SECURITY_DEV_MODE: 'true'
      BOX_SETTINGS_MODE: read-write
      BOX_WEB_BASE_URL: http://localhost:8888
      BOX_WEB_PORT: 8080
    healthcheck:
      test: curl -f http://localhost:8080/health || exit 1
      interval: 5s
      timeout: 5s
      retries: 90
      start_period: 30s
```

### Test Lifecycle

```
Per bun test command:
  1. Start fresh Aidbox (down -v, up, wait for health, migrate)
  2. Run all test files
  3. Stop Aidbox (down -v)

Per test:
  1. Load fixture
  2. Create IncomingHL7v2Message via POST
  3. Process message
  4. Verify resources
```

Test isolation is achieved by starting a fresh Aidbox instance per test run. No cleanup between individual tests is needed since the entire database is wiped at the start of each test run.

This uses Bun's global test lifecycle hooks in a preload file.

---

## Fixture Analysis

I analyzed all 12 inline message definitions in `oru-r01.test.ts`. Here's the breakdown:

### Core Fixtures (5 files) - Happy Path Tests

| Fixture File | Purpose | Used By |
|--------------|---------|---------|
| `base.hl7` | Simple ORU with 2 OBX, LOINC in alternate | 15+ tests (happy path, idempotency, value types) |
| `with-loinc-abnormal.hl7` | OBX with abnormal flag H, reference range | Interpretation, reference range tests |
| `with-specimen.hl7` | SPM segment included | Specimen handling tests |
| `with-notes.hl7` | NTE segments, SN value type | Note handling, paragraph breaks |
| `multiple-obr.hl7` | 2 OBR groups with 2 OBX each | Multiple DiagnosticReport tests |

### Validation Error Fixtures (11 files)

| Fixture File | Tests |
|--------------|-------|
| `error/missing-obr25.hl7` | OBR-25 missing |
| `error/obr25-y.hl7` | OBR-25 = Y (invalid) |
| `error/obr25-z.hl7` | OBR-25 = Z (invalid) |
| `error/missing-obx11.hl7` | OBX-11 missing |
| `error/obx11-n.hl7` | OBX-11 = N (invalid) |
| `error/missing-msh3.hl7` | MSH-3 (sending app) missing |
| `error/missing-msh4.hl7` | MSH-4 (sending facility) missing |
| `error/missing-obr.hl7` | No OBR segment |
| `error/missing-obr2-obr3.hl7` | Both OBR-2 and OBR-3 missing |
| `error/missing-pid.hl7` | No PID segment |
| `error/empty-pid.hl7` | PID with no patient ID |

### LOINC/Mapping Fixtures (7 files)

| Fixture File | Tests |
|--------------|-------|
| `loinc/primary.hl7` | LOINC in OBX-3.1 |
| `loinc/alternate.hl7` | LOINC in OBX-3.4 (alternate) |
| `loinc/local-only.hl7` | Local code, no LOINC → mapping_error |
| `loinc/mixed.hl7` | Some OBX with LOINC, some without |
| `loinc/no-system.hl7` | OBX-3 without system → MissingLocalSystemError |
| `valid-preliminary.hl7` | OBR-25=P, OBX-11=P → preliminary status |

### Patient/Encounter Fixtures (6 files)

| Fixture File | Tests |
|--------------|-------|
| `patient/pid2-only.hl7` | Patient ID in PID-2 |
| `patient/pid3-only.hl7` | Patient ID in PID-3 only |
| `encounter/no-pv1.hl7` | No PV1 segment |
| `encounter/pv1-no-visit.hl7` | PV1 without visit number |
| `encounter/with-visit.hl7` | Full PV1-19 encounter |
| `encounter/mapping-error.hl7` | Encounter + unmapped LOINC |

### Valid Edge Cases (2 files)

| Fixture File | Tests |
|--------------|-------|
| `valid-obr2-fallback.hl7` | OBR-2 as fallback when OBR-3 missing |
| `loinc/multiple-no-system.hl7` | Multiple OBX without system |

### Summary: ~25 fixture files total (consolidated)

---

## Unit vs Integration Test Strategy

**Unit tests** (`test/unit/`) use inline HL7v2 message strings. This is intentional:
- Better test locality and readability
- Easier to understand what each test verifies without jumping to external files
- Tests pure conversion logic without Aidbox dependency

**Integration tests** (`test/integration/`) use fixture files:
- E2E testing against real Aidbox instance
- Verify complete message processing pipeline
- Test resource creation and persistence

---

## Implementation Plan

### Step 1: Create test infrastructure

**File:** `docker-compose.test.yaml`
- Separate Aidbox instance on port 8888
- Separate PostgreSQL with isolated volume

**File:** `test/integration/preload.ts` (global setup/teardown)

```typescript
import { beforeAll, afterAll } from "bun:test";
import { $ } from "bun";

const TEST_AIDBOX_URL = "http://localhost:8888";
const TEST_CLIENT_SECRET = "test_secret";

// Set environment variables for the test Aidbox instance
process.env.AIDBOX_URL = TEST_AIDBOX_URL;
process.env.AIDBOX_CLIENT_SECRET = TEST_CLIENT_SECRET;

beforeAll(async () => {
  console.log("Starting test Aidbox...");
  
  // Stop and remove existing
  await $`docker compose -f docker-compose.test.yaml down -v`.quiet();
  
  // Start fresh
  await $`docker compose -f docker-compose.test.yaml up -d`.quiet();
  
  // Wait for health
  for (let i = 0; i < 90; i++) {
    try {
      const response = await fetch(`${TEST_AIDBOX_URL}/health`);
      if (response.ok) break;
    } catch {
      // Not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Run migrations
  await $`bun src/migrate.ts`.quiet();
  
  console.log("Test Aidbox ready");
});

afterAll(async () => {
  console.log("Stopping test Aidbox...");
  await $`docker compose -f docker-compose.test.yaml down -v`.quiet();
});
```

**File:** `test/integration/helpers.ts` (test utilities)

```typescript
export const TEST_AIDBOX_URL = "http://localhost:8888";
export const TEST_CLIENT_ID = "root";
export const TEST_CLIENT_SECRET = "test_secret";

export async function loadFixture(fixturePath: string): Promise<string> {
  return Bun.file(`test/fixtures/hl7v2/${fixturePath}`).text();
}

export async function testAidboxFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const auth = Buffer.from(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${TEST_AIDBOX_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/fhir+json",
      Authorization: `Basic ${auth}`,
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Aidbox error: ${response.status} ${await response.text()}`);
  }
  return response.json();
}
```

### Step 2: Create fixture directory structure

```
test/fixtures/hl7v2/oru-r01/
├── base.hl7                    # Core happy path message
├── with-loinc-abnormal.hl7     # Abnormal flag + reference range
├── with-specimen.hl7           # SPM segment
├── with-notes.hl7              # NTE segments
├── multiple-obr.hl7            # Multiple OBR groups
├── valid-preliminary.hl7       # Preliminary status
├── valid-obr2-fallback.hl7     # OBR-2 fallback when OBR-3 missing
├── error/
│   ├── missing-obr25.hl7
│   ├── obr25-y.hl7
│   ├── obr25-z.hl7
│   ├── missing-obx11.hl7
│   ├── obx11-n.hl7
│   ├── missing-msh3.hl7
│   ├── missing-msh4.hl7
│   ├── missing-obr.hl7
│   ├── missing-obr-ids.hl7
│   ├── missing-pid.hl7
│   └── empty-pid.hl7
├── loinc/
│   ├── primary.hl7
│   ├── alternate.hl7
│   ├── local-only.hl7
│   ├── mixed.hl7
│   ├── no-system.hl7
│   └── multiple-no-system.hl7
├── patient/
│   ├── pid2-only.hl7
│   ├── pid3-only.hl7
│   ├── without-pid.hl7
│   └── empty-pid.hl7
└── encounter/
    ├── without-pv1.hl7
    ├── no-visit-number.hl7
    ├── with-visit.hl7
    └── with-mapping-error.hl7
```

### Step 3: Create integration test file

**File:** `test/integration/v2-to-fhir/oru-r01.integration.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { loadFixture, testAidboxFetch } from "../helpers";
import { processNextMessage } from "../../../src/v2-to-fhir/processor-service";

describe("ORU_R01 E2E", () => {
  describe("happy path", () => {
    test("processes message and creates FHIR resources in Aidbox", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");

      await testAidboxFetch("/fhir/IncomingHL7v2Message", {
        method: "POST",
        body: JSON.stringify({
          resourceType: "IncomingHL7v2Message",
          message: hl7Message,
          status: "received",
          type: "ORU^R01",
        }),
      });

      await processNextMessage();

      const patients = await testAidboxFetch<{ total: number }>("/fhir/Patient");
      expect(patients.total).toBe(1);

      const diagnosticReports = await testAidboxFetch<{ total: number; entry: any[] }>(
        "/fhir/DiagnosticReport"
      );
      expect(diagnosticReports.total).toBe(1);
      expect(diagnosticReports.entry[0].resource.status).toBe("final");
    });
  });

  // ... more integration tests
});
```

### Step 4: Keep unit tests for pure functions

**File:** `test/unit/v2-to-fhir/messages/oru-r01.test.ts` (refactored from original)

- Keep error validation tests (they test error messages, don't need Aidbox)
- Keep datatype conversion tests
- Remove `convertOBXToObservationResolving` tests (test through integration)

### Step 5: Update test scripts

**File:** `package.json`

```json
{
  "scripts": {
    "test": "bun test test/unit",
    "test:integration": "bun test --preload ./test/integration/preload.ts test/integration",
    "test:all": "bun test --preload ./test/integration/preload.ts"
  }
}
```

The `--preload` flag loads `preload.ts` before any tests run, ensuring Aidbox starts once at the beginning and stops once at the end of the entire test run.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `docker-compose.test.yaml` | Create |
| `test/integration/preload.ts` | Create (global setup/teardown) |
| `test/integration/helpers.ts` | Create (test utilities) |
| `test/fixtures/hl7v2/oru-r01/*.hl7` | Create (~25 files) |
| `test/integration/v2-to-fhir/oru-r01.integration.test.ts` | Create |
| `test/v2-to-fhir/messages/oru-r01.test.ts` | Refactor → move to `test/unit/` |
| `package.json` | Add test scripts |

---

## Verification

1. **Run unit tests**: `bun run test` (fast, no Aidbox needed)
2. **Run integration tests**: `bun run test:integration` (starts/stops Aidbox automatically)
3. **Verify cleanup**: Check that test Aidbox is stopped after tests
4. **Check no dev impact**: Verify `docker-compose up -d` (dev) still works on port 8080

---

## Migration Path

1. Create `docker-compose.test.yaml`
2. Create `test/integration/preload.ts` and `test/integration/helpers.ts`
3. Create fixture directory and extract fixtures from inline messages
4. Create integration tests using fixtures
5. Refactor original test file to use fixtures
6. Move unit tests to `test/unit/`
7. Remove `convertOBXToObservationResolving` describe block
8. Update package.json scripts

---

## Sources

- [Testcontainers for NodeJS](https://node.testcontainers.org/)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodejs-testing-best-practices)
- [Docker Desktop Alternatives - Podman, Rancher](https://www.netguru.com/blog/node-js-alternatives)
- [Aidbox Delete Data](https://www.health-samurai.io/docs/aidbox/tutorials/crud-search-tutorials/delete-data)
- [Aidbox Licensing](https://www.health-samurai.io/docs/aidbox/overview/licensing-and-support)

# Your Role

Act as a critical, analytical partner. Before implementing ANY user suggestion:
- evaluate assumptions and tradeoffs
- flag weaknesses even for "reasonable" requests
- state tradeoffs before implementing (1-2 sentences is fine for simple cases)

Assume the user may not have deep HL7v2, FHIR, or Health IT experience. Suggestions that sound reasonable in plain software terms can be spec-wrong, clinically incorrect, or carry interoperability risk that isn't visible at the code level. Examples: fabricating identifiers that must be preserved for patient safety, discarding fields that the IG requires, relaxing a validator to silence an error that actually indicates bad sender data. Push back when the domain says no, even if the engineering says yes — and explain *why* in HL7/FHIR terms, not just "the spec says so."

If a proposed change has clear downsides and the user still wants it, they must say: "I request you to do it this way".

## File Purpose

This file is the project memory — checked into the repo, shared across agents and sessions. It captures cross-cutting rules and the gotchas that catch agents out. When you learn something that should persist (gotcha, rule, pattern), add it here. If you hit something surprising that isn't covered here, tell the developer and add it.

Do NOT use the auto-memory file (MEMORY.md) for this project.

Architecture, workflows, routes, and directory structure are **not** kept here — they go stale. Look them up live in the code or in `docs/developer-guide/`.

# Aidbox HL7 Integration

HL7v2 message processing with Aidbox FHIR server. Bidirectional: FHIR → HL7v2 BAR (billing) and HL7v2 → FHIR (lab results, ADT, orders, immunization).

## Quick Start

```sh
docker compose up -d              # Start Aidbox and PostgreSQL
bun src/migrate.ts                # Run database migrations
bun run dev                       # Start web server (logs to logs/server.log)
```

- **Web UI**: http://localhost:3000
- **Aidbox Console**: http://localhost:8080 — login as `admin` with `BOX_ADMIN_PASSWORD` from `docker-compose.yaml`.
- **Aidbox API auth**: use the `aidbox-request` skill. Never hardcode the client secret in code or docs.

## Development Scripts

```sh
bun run dev                       # Start server with hot reload
bun run stop                      # Stop the server
bun run logs                      # Tail server logs
bun run mllp                      # Start MLLP server (port 2575)
bun scripts/load-test-data.ts     # Load 5 test patients with related resources
bun scripts/import-batch.ts <zip|dir> [--tag <name>]  # Bulk-import HL7v2 messages under a batchTag
bun run typecheck                 # TypeScript type checking
bun test:local                    # Unit tests + smoke tests — the everyday local loop (~10s)
bun test:all                      # Unit + full integration — for CI, slow locally
bun test:unit                     # Unit tests only
bun test:smoke                    # Smoke subset of integration tests (tests whose name starts with "smoke: ")
bun test:integration              # Full integration suite — runs in CI, takes minutes locally
bun reset-integration-aidbox      # Destroy and recreate test Aidbox from scratch (if test data in the db creates problems)
bun run truncate-aidbox           # Delete all project-created data from dev Aidbox (demo reset; preserves terminology/profiles)
bun scripts/truncate-aidbox.ts --yes  # Skip confirmation prompt (use -y for short form)
bun run regenerate-fhir           # Regenerate src/fhir/ from FHIR R4 spec
bun run regenerate-hl7v2          # Regenerate src/hl7v2/generated/
bun run generate-hl7v2-reference  # Generate data/hl7v2-reference/ from XSD+PDF
```

Integration tests use a separate test Aidbox on port 8888 via `docker-compose.test.yaml`.

**Testing rules:**
1. **Run `bun test:local` after any change.** Unit tests + the smoke subset of integration tests (~10s). CI runs the full `bun test:all`; don't also run it locally unless debugging a CI-only failure.
2. **Smoke tests are tagged by name prefix.** A test (or `describe`) whose name starts with `smoke: ` is included in `test:smoke` via `--test-name-pattern "smoke: "`. Promote by prepending the prefix; demote by removing it. Keep the smoke set small and focused on one happy-path per major flow.
3. **Don't manually run `docker compose` for integration tests.** The test commands auto-start containers, wait for health, and run migrations.

Read `docs/developer-guide/how-to/development-guide.md` for test infrastructure, writing new tests, codegen, and debugging.

## In-process polling workers

`bun run dev` boots three polling services inside the web server (`src/workers.ts`): inbound HL7v2 processor, Account BAR builder, BAR message sender. Messages flow through the pipeline without manual "Process All" / "Build BAR" / "Send Pending" clicks.

Env flags:
- `DISABLE_POLLING=1` — do not start any workers (useful for tests or when running the standalone `bun src/v2-to-fhir/processor-service.ts` scripts).
- `POLL_INTERVAL_MS` — override poll interval. Default 5000ms (demo-friendly). The standalone scripts still use their own 60000ms default.

The per-service standalone entrypoints (`bun src/bar/sender-service.ts` etc.) are unchanged and still work — they share the same factories.

## In-process polling workers

`bun run dev` boots three polling services inside the web server (`src/workers.ts`): inbound HL7v2 processor, Account BAR builder, BAR message sender. Messages flow through the pipeline without manual "Process All" / "Build BAR" / "Send Pending" clicks.

Env flags:
- `DISABLE_POLLING=1` — do not start any workers (useful for tests or when running the standalone `bun src/v2-to-fhir/processor-service.ts` scripts).
- `POLL_INTERVAL_MS` — override poll interval. Default 5000ms (demo-friendly). The standalone scripts still use their own 60000ms default.

The per-service standalone entrypoints (`bun src/bar/sender-service.ts` etc.) are unchanged and still work — they share the same factories.

## IncomingHL7v2Message statuses

Referenced constantly when diagnosing errors. Full details: `docs/developer-guide/error-statuses.md`.

- `received` — unprocessed
- `processed` — converted + submitted to Aidbox successfully
- `warning` — converted + submitted, but with a non-fatal gap (e.g., PV1 missing → no Encounter)
- `parsing_error` — malformed HL7v2, parse failed; sender must fix
- `conversion_error` — parsed OK but missing/invalid data for FHIR conversion
- `code_mapping_error` — unmapped code, Task created; auto-requeued on resolution
- `sending_error` — FHIR bundle submission to Aidbox failed; auto-retried 3 times
- `deferred` — manually set via `POST /defer/:id` when resolution needs external input; eligible for retry via `POST /mark-for-retry/:id`

## US Core demographic extension runtime note

If `profileConformance.implementationGuides` enables US Core (`hl7.fhir.us.core`), PID-10/PID-22 mapping adds `us-core-race` / `us-core-ethnicity` on Patient. Aidbox must have the US Core package loaded and CodeSystem `urn:oid:2.16.840.1.113883.6.238` available (seeded in `init-bundle.json`), or Patient writes fail with terminology-binding errors.

## Documentation

For anything beyond this file, read `docs/developer-guide/`:

| When you need                                                                            | Read |
|------------------------------------------------------------------------------------------|------|
| System diagrams, polling pattern, component overview                                     | `architecture.md` |
| FHIR→HL7v2 field mappings, segment builders                                              | `bar-generation.md` |
| HL7v2→FHIR conversion, ORU processing                                                    | `oru-processing.md` |
| Preprocessor architecture, registry, and config                                          | `preprocessors.md` |
| ConceptMap workflow, Task lifecycle                                                      | `code-mapping.md` |
| Error statuses, resolution flows, sending auto-retry                                     | `error-statuses.md` |
| MLLP protocol, ACK generation                                                            | `mllp-server.md` |
| HL7v2 builders, field naming (`$N_fieldName`)                                            | `hl7v2-module.md` |
| HL7 reference JSON generation (XSD+PDF → data/hl7v2-reference)                           | `how-to/hl7v2-reference-generation.md` |
| Batch-importing HL7v2 zips and triaging errors                                           | `how-to/batch-import.md` |
| Testing, integration infra, codegen/debug workflows                                      | `how-to/development-guide.md` |
| VXU ORDER OBX hard error decision                                                        | `adr/001-unknown-order-obx-hard-error.md` |

## Code Style

IMPORTANT: Read `.claude/code-style.md` before writing or modifying code.

## Bun, not Node

This project uses Bun. Use `bun`/`bun install`/`bun run` instead of `node`/`npm`/`yarn`/`pnpm`. Unit tests use `bun test` (not jest/vitest). Bun auto-loads `.env` (no `dotenv`). HTTP: `Bun.serve()`. File I/O: `Bun.file`.

## Before Touching HL7v2

Three mandatory lookups before proposing, implementing, designing, or reviewing any HL7v2-related change. Do not rely on assumptions, existing code patterns, or memory of the spec — the code may intentionally deviate, but you must know what the spec says first.

### 1. Check the HL7v2 spec (`hl7v2-info` skill)

For segment optionality, field semantics, message structure, datatype components, or processing rules — look them up via `hl7v2-info` first.

**Never read `data/hl7v2-reference/` JSON files directly** — no `cat`, `python`, `Read`, `Grep`, or any other tool. Always go through the `hl7v2-info` skill (`bun scripts/hl7v2-ref-lookup.ts`), which parses and formats the data correctly. Applies to all agents, including sub-agents spawned for review or exploration.

**Spec completeness rule:** Handle ALL components/fields defined in the spec — not just those present in current sample data or example messages. Never skip a field solely because example senders don't populate it.

### 2. Check the V2-to-FHIR IG mappings

For any HL7v2→FHIR conversion, consult the IG mapping CSVs in `docs/v2-to-fhir-spec/mappings/`:

- **Message mappings** (`mappings/messages/`) — which FHIR resources each message type produces
- **Segment mappings** (`mappings/segments/`) — field-level mappings
- **Vocabulary mappings** (`mappings/codesystems/`) — code translations between HL7v2 and FHIR systems

### 3. Never count pipe positions by hand

Use `scripts/hl7v2-inspect.sh` (or the `hl7v2-info` skill) to verify field positions — eyeballing fails silently for an AI agent.

```sh
scripts/hl7v2-inspect.sh <file>                 # Structure overview (no PHI)
scripts/hl7v2-inspect.sh <file> --values        # Show field values (may contain PHI!)
scripts/hl7v2-inspect.sh <file> --segment RXA   # Filter to segment type
scripts/hl7v2-inspect.sh <file> --field RXA.6   # Specific field with components
scripts/hl7v2-inspect.sh <file> --verify RXA.20 # Verify field position by pipe count
```

Handles RTF wrappers, multi-message files, and repeating fields. Use `--verify` to catch pipe count errors in fixtures. Reference fixture with correct PV1-19: `test/fixtures/hl7v2/oru-r01/encounter/with-visit.hl7`.

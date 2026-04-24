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

Architecture, workflows, routes, directory structure, and script lists are **not** kept here — they go stale. Look them up live in the code. `README.md` has quick start, status reference, and UI routes.

# Aidbox HL7 Integration

HL7v2 message processing with Aidbox FHIR server. Bidirectional: FHIR → HL7v2 BAR (billing) and HL7v2 → FHIR (lab results, ADT, orders, immunization, documents).

## Aidbox auth

Never hardcode the client secret in code or docs. Use the `aidbox-request` skill for ad-hoc curl. App code uses `src/aidbox.ts` which reads the secret from env.

## Bun, not Node

Use `bun`/`bun install`/`bun run` instead of `node`/`npm`/`yarn`/`pnpm`. Unit tests use `bun test` (not jest/vitest). Bun auto-loads `.env` (no `dotenv`). HTTP: `Bun.serve()`. File I/O: `Bun.file`.

## Testing rules

1. **Run `bun test:local` only before committing** — not after every change. Use `bun scripts/check-message-support.ts` or targeted `bun test <file>` to verify a specific fix. CI runs the full `bun test:all`; don't also run it locally unless debugging a CI-only failure.
2. **Smoke tests are tagged by name prefix.** A test (or `describe`) whose name starts with `smoke: ` is included in `test:smoke` via `--test-name-pattern "smoke: "`. Promote by prepending the prefix; demote by removing it. Keep the smoke set small and focused on one happy-path per major flow.
3. **Don't manually run `docker compose` for integration tests.** The test commands auto-start containers, wait for health, and run migrations. Integration tests use a separate test Aidbox on port 8888 via `docker-compose.test.yaml`.

## Polling workers env flags

`bun run dev` boots in-process pollers via `src/workers.ts`. Flags:

- `DISABLE_POLLING=1` — disable all workers (useful for tests or when running standalone service scripts).
- `POLL_INTERVAL_MS` — override poll interval. Default 1000ms. Standalone scripts still use their own 60000ms default.
- `DEMO_MODE` — default-on. Controls the Dashboard's "Run demo now" endpoint (`POST /demo/run-scenario`). Only `DEMO_MODE=off` disables (returns 403).

## US Core demographic extension runtime note

If `profileConformance.implementationGuides` enables US Core (`hl7.fhir.us.core`), PID-10/PID-22 mapping adds `us-core-race` / `us-core-ethnicity` on Patient. Aidbox must have the US Core package loaded and CodeSystem `urn:oid:2.16.840.1.113883.6.238` available (seeded in `init-bundle.json`), or Patient writes fail with terminology-binding errors.

## Code Style

IMPORTANT: Read `.claude/code-style.md` before writing or modifying code.

**Prefer scripts over raw file reads:** Use project scripts for inspection and diagnosis — `scripts/errors/inspect-error.sh`, `scripts/hl7v2-inspect.sh`, `bun scripts/check-message-support.ts`, `bun scripts/hl7v2-ref-lookup.ts` — before reaching for `Read`/`Grep` on source files. Read source files only when you need the code pattern itself (e.g. to write a new function that matches existing style). When you do read multiple source files, fire them in parallel.

Tailwind v4 gotcha: Tailwind utilities are emitted inside cascade layers, while `DESIGN_SYSTEM_CSS` is plain unlayered CSS. Broad unlayered resets override utilities even when the utility selector looks more specific; e.g. `a { color: inherit; }` breaks legacy anchor tabs using `text-white` / `text-gray-*`. Scope resets to unclassed elements (`a:not([class])`) or put them in Tailwind's base layer.

## Before Touching HL7v2

Three mandatory lookups before proposing, implementing, designing, or reviewing any HL7v2-related change. Do not rely on assumptions, existing code patterns, or memory of the spec — the code may intentionally deviate, but you must know what the spec says first.

### 1. Check the HL7v2 spec (`hl7v2-info` skill)

For segment optionality, field semantics, message structure, datatype components, or processing rules — look them up via `hl7v2-info` first.

**Never read `specs/hl7v2-reference/` JSON files directly** — no `cat`, `python`, `Read`, `Grep`, or any other tool. Always go through the `hl7v2-info` skill (`bun scripts/hl7v2-ref-lookup.ts`), which parses and formats the data correctly. Applies to all agents, including sub-agents spawned for review or exploration.

**Spec completeness rule:** Handle ALL components/fields defined in the spec — not just those present in current sample data or example messages. Never skip a field solely because example senders don't populate it.

### 2. Check the V2-to-FHIR IG mappings

For any HL7v2→FHIR conversion, consult the IG mapping CSVs in `specs/v2-to-fhir/mappings/`:

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

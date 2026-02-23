---
status: planned
reviewer-iterations: 2
prototype-files:
  - src/v2-to-fhir/converter-context.ts
  - src/v2-to-fhir/aidbox-lookups.ts
  - src/v2-to-fhir/messages/oru-r01.ts
  - src/v2-to-fhir/messages/adt-a01.ts
  - src/v2-to-fhir/messages/adt-a08.ts
  - src/v2-to-fhir/converter.ts
---

# Design: Compose Converter Dependencies into ConverterContext

## Problem Statement

Each converter function (`convertADT_A01`, `convertADT_A08`, `convertORU_R01`) receives its runtime dependencies as individual positional parameters, but the set of dependencies differs across converters — ORU_R01 takes four parameters while ADT converters take two. Adding a new dependency (e.g., an MPI client or a feature flag) requires changing every converter signature and every call site simultaneously. Additionally, config is not passed as a parameter at all: each converter calls `hl7v2ToFhirConfig()` internally in private helpers, coupling the converters to the global config singleton and making them harder to test with alternative configs.

## Proposed Approach

Introduce a `ConverterContext` interface that bundles all converter runtime dependencies into a single object. All converter functions change to `(parsed: HL7v2Message, context: ConverterContext) => Promise<ConversionResult>`. The context is constructed once in `converter.ts` and passed through unchanged. The two FHIR lookup types (`PatientLookupFn`, `EncounterLookupFn`) move from `oru-r01.ts` to `converter-context.ts`. The `config` field replaces internal calls to `hl7v2ToFhirConfig()` inside converters. A `createConverterContext()` factory in `converter-context.ts` wires up production defaults so `converter.ts` remains a thin router.

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Context shape | Flat object vs. nested grouping (e.g., `context.identity.resolvePatientId`) | Flat object | Converters destructure what they need; nesting adds indirection without current benefit. Revisit when groups become large. |
| Config in context vs. kept as internal singleton | Keep internal calls / add `config` to context | Add `config` to context | Makes config substitutable in unit tests without env-var tricks and `clearConfigCache()` calls. Removes the only reason converters import from `config.ts`. |
| `lookupPatient` / `lookupEncounter` required vs. optional | Optional with defaults on the type / Required on the type | Required on the type, defaults provided by `createConverterContext()` | Keeps the interface honest — the context is always fully populated. ADT converters simply don't destructure the lookup fields; they are not burdened by them. |
| Where to define lookup types | Stay in `oru-r01.ts` / Move to `converter-context.ts` | Move to `converter-context.ts` | The types are now part of the context contract, not ORU-specific. Avoids a cross-module import from a consumer (oru-r01) back to the type that describes its host. |
| Factory function location | `converter.ts` / `converter-context.ts` | `converter-context.ts` | Co-locates the interface and its default wiring. `converter.ts` stays a thin router with no awareness of defaults. |
| Test helper: pass context object vs. keep old positional args for tests | Keep old signature for tests / Update tests to pass context | Update tests to pass context | Tests should exercise the real call contract. A small `makeTestContext()` helper (or inline object literal) is sufficient and avoids keeping a parallel API alive. |

## Trade-offs

**Pros**
- Adding a new dependency requires one change: add field to `ConverterContext` and initialize it in `createConverterContext()`. No other call site changes.
- Converter signatures are uniform: `(parsed, context)` everywhere — readable and predictable.
- Config is now injected, removing the need for `clearConfigCache()` in unit tests and the env-var override pattern.
- `PatientLookupFn` and `EncounterLookupFn` live in a central, stable location rather than leaking from an implementation file.

**Cons / Risks**
- Unit tests must be updated to pass a context object instead of positional arguments. This is mechanical but touches every test that calls a converter directly (7 call sites currently).
- The context object is slightly more to type in tests compared to passing two values. Mitigated by a shared `makeTestContext()` helper in the test directory.
- ADT converters receive `lookupPatient` and `lookupEncounter` fields they will never use. This is a mild violation of interface segregation. Accepted because the lookup functions are cheap no-ops, the context is still small, and splitting into subtypes would add complexity with no near-term benefit.

**Mitigations**
- Provide a `makeTestContext(overrides?)` helper in `test/unit/v2-to-fhir/helpers.ts` (or inline in the test files) that fills in safe defaults (null-returning lookups, `defaultPatientIdResolver()`, test config). Keeps test boilerplate minimal.
- `defaultPatientLookup` and `defaultEncounterLookup` are extracted to `src/v2-to-fhir/aidbox-lookups.ts` — they remain plain exported functions, testable in isolation, and the move eliminates the circular import.

**~~Known limitation~~ Resolved: `defaultPatientIdResolver()` config inconsistency**
Resolved in Task 5: `defaultPatientIdResolver(config)` now accepts config as a parameter. `createConverterContext()` and `makeTestContext()` both pass config through, so `makeTestContext({ config: myConfig })` correctly builds the resolver from `myConfig`.

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|
| `src/v2-to-fhir/converter-context.ts` | New | `ConverterContext` interface, `PatientLookupFn`, `EncounterLookupFn`, `createConverterContext()` factory |
| `src/v2-to-fhir/aidbox-lookups.ts` | New | `defaultPatientLookup`, `defaultEncounterLookup` — extracted from `oru-r01.ts` to break the circular import between `converter-context.ts` and `oru-r01.ts` |
| `src/v2-to-fhir/converter.ts` | Modify | Construct `ConverterContext` via `createConverterContext()`, pass it to each converter; remove `defaultPatientIdResolver()` call |
| `src/v2-to-fhir/messages/adt-a01.ts` | Modify | Change signature to `(parsed, context)`, destructure `resolvePatientId` and `config` from context, remove `hl7v2ToFhirConfig()` call |
| `src/v2-to-fhir/messages/adt-a08.ts` | Modify | Change signature to `(parsed, context)`, destructure `resolvePatientId` and `config` from context, remove `hl7v2ToFhirConfig()` call (currently implicit — adt-a08 does not call it yet, but should accept config for consistency) |
| `src/v2-to-fhir/messages/oru-r01.ts` | Modify | Change signature to `(parsed, context)`, move `PatientLookupFn` / `EncounterLookupFn` types out, remove `hl7v2ToFhirConfig()` calls, use context fields |
| `test/unit/v2-to-fhir/messages/adt-a01.test.ts` | Modify | Replace `convertADT_A01(parsed, defaultPatientIdResolver())` with `convertADT_A01(parsed, context)` |
| `test/unit/v2-to-fhir/messages/oru-r01.test.ts` | Modify | Replace four-arg call with `convertORU_R01(parsed, context)` |

## Technical Details

### ConverterContext interface

```typescript
// src/v2-to-fhir/converter-context.ts

export interface ConverterContext {
  /** Loaded HL7v2-to-FHIR config. Passed explicitly so converters are config-injection-friendly. */
  config: Hl7v2ToFhirConfig;
  /** Resolves Patient.id from a pool of PID-3 CX identifiers. */
  resolvePatientId: PatientIdResolver;
  /** Look up an existing Patient by ID; returns null when not found. */
  lookupPatient: PatientLookupFn;
  /** Look up an existing Encounter by ID; returns null when not found. */
  lookupEncounter: EncounterLookupFn;
}

/** Construct a ConverterContext wired with production defaults. */
export function createConverterContext(): ConverterContext {
  return {
    config: hl7v2ToFhirConfig(),
    resolvePatientId: defaultPatientIdResolver(),
    lookupPatient: defaultPatientLookup,
    lookupEncounter: defaultEncounterLookup,
  };
}
```

### Updated converter signatures

```typescript
// adt-a01.ts
export async function convertADT_A01(
  parsed: HL7v2Message,
  context: ConverterContext,
): Promise<ConversionResult>

// adt-a08.ts
export async function convertADT_A08(
  parsed: HL7v2Message,
  context: ConverterContext,
): Promise<ConversionResult>

// oru-r01.ts
export async function convertORU_R01(
  parsed: HL7v2Message,
  context: ConverterContext,
): Promise<ConversionResult>
```

### Updated router (converter.ts)

```typescript
export async function convertToFHIR(
  parsed: HL7v2Message,
): Promise<ConversionResult> {
  const messageType = extractMessageType(parsed);
  const context = createConverterContext();

  switch (messageType) {
    case "ADT_A01": return await convertADT_A01(parsed, context);
    case "ADT_A08": return await convertADT_A08(parsed, context);
    case "ORU_R01": return await convertORU_R01(parsed, context);
    default: throw new Error(`Unsupported message type: ${messageType}`);
  }
}
```

### Config usage inside converters (before vs. after)

**Before** (adt-a01.ts, line ~368):
```typescript
const config = hl7v2ToFhirConfig();
const pv1Required = config.messages?.["ADT-A01"]?.converter?.PV1?.required ?? true;
```

**After**:
```typescript
const { config, resolvePatientId } = context;
const pv1Required = config.messages?.["ADT-A01"]?.converter?.PV1?.required ?? true;
```

### Test context helper (suggested)

Note: There is no `test/helpers/` directory in this project. The helper should go in
`test/unit/v2-to-fhir/helpers.ts`, or be inlined directly in the test files for minimal
shared state. Existing shared test infrastructure lives in `test/integration/helpers.ts`
(integration only); unit test helpers are co-located with the tests they serve.

```typescript
// test/unit/v2-to-fhir/helpers.ts
import type { ConverterContext } from "../../../src/v2-to-fhir/converter-context";
import { defaultPatientIdResolver } from "../../../src/v2-to-fhir/identity-system/patient-id";
import { hl7v2ToFhirConfig } from "../../../src/v2-to-fhir/config";

export function makeTestContext(overrides?: Partial<ConverterContext>): ConverterContext {
  return {
    config: hl7v2ToFhirConfig(),
    resolvePatientId: defaultPatientIdResolver(),
    lookupPatient: async () => null,
    lookupEncounter: async () => null,
    ...overrides,
  };
}
```

### Import chain after refactor

```
converter.ts
  ← converter-context.ts (createConverterContext)
      ← config.ts (hl7v2ToFhirConfig, Hl7v2ToFhirConfig)
      ← identity-system/patient-id.ts (defaultPatientIdResolver, PatientIdResolver)
      ← aidbox-lookups.ts (defaultPatientLookup, defaultEncounterLookup)

aidbox-lookups.ts
  ← aidbox.ts (getResourceWithETag, NotFoundError)
  ← fhir/hl7-fhir-r4-core (Patient, Encounter — type only)
  [no import from converter-context.ts — functions use inline types]

messages/adt-a01.ts
  ← converter-context.ts (ConverterContext)
  [no longer imports config.ts directly]

messages/adt-a08.ts
  ← converter-context.ts (ConverterContext)
  [no longer imports identity-system/patient-id.ts directly]

messages/oru-r01.ts
  ← converter-context.ts (ConverterContext, PatientLookupFn, EncounterLookupFn)
  [no longer imports config.ts directly]
  [PatientLookupFn, EncounterLookupFn removed from this file's exports]
  [defaultPatientLookup, defaultEncounterLookup removed — live in aidbox-lookups.ts]
```

No cycles: `aidbox-lookups.ts` does not import from `converter-context.ts`. The lookup implementations are structurally compatible with `PatientLookupFn`/`EncounterLookupFn` via TypeScript duck-typing — no explicit type import needed.

## Edge Cases and Error Handling

| Edge Case | Handling |
|-----------|----------|
| `createConverterContext()` called before config is loaded | `hl7v2ToFhirConfig()` throws on invalid config; this surfaces at context creation time in `converter.ts`, which is the same failure point as before |
| Test overrides `config` but not `resolvePatientId` | `makeTestContext()` fills remaining fields with safe defaults; partial overrides work via spread |
| A future converter needs a field not in `ConverterContext` | Add the field to the interface and initialize it in `createConverterContext()`; existing converters are unaffected |
| ADT converter accidentally destructures `lookupPatient` | TypeScript provides the field; it just goes unused. No runtime harm. |
| `defaultPatientLookup` / `defaultEncounterLookup` could create a circular import | Resolved: both functions live in `src/v2-to-fhir/aidbox-lookups.ts`, which has no dependency on `converter-context.ts`. `converter-context.ts` imports from `aidbox-lookups.ts`; `oru-r01.ts` imports types from `converter-context.ts`. No cycle. |

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|
| `createConverterContext()` returns all required fields | Unit | Assert that the returned object has `config`, `resolvePatientId`, `lookupPatient`, `lookupEncounter` as functions/objects |
| ADT_A01 with valid PV1 processes correctly via context | Unit | Pass `makeTestContext()` to `convertADT_A01`; existing behavior unchanged |
| ADT_A01 with missing PV1 returns warning via context | Unit | Same scenario, now with context-injected config where `PV1.required=false` |
| ADT_A08 processes patient via context | Unit | Pass `makeTestContext()` to `convertADT_A08`; existing behavior unchanged |
| ORU_R01 with valid PV1 via context | Unit | Pass `makeTestContext()` with custom `lookupPatient`/`lookupEncounter` (null-returning); existing behavior unchanged |
| ORU_R01 with existing patient (context.lookupPatient returns resource) | Unit | Override `lookupPatient` in context to return a fixture Patient; verify no draft patient created |
| ORU_R01 with existing encounter (context.lookupEncounter returns resource) | Unit | Override `lookupEncounter` in context to return a fixture Encounter; verify no draft encounter created |
| Config injected via context is used (not global singleton) | Unit | Pass context with `config.messages["ADT-A01"].converter.PV1.required = false`; no env-var or `clearConfigCache()` needed |
| ADT_A01 with PV1 required=false via direct config injection | Unit | Pass config object directly via `makeTestContext({ config: loadTestConfig() })`; no `process.env.HL7V2_TO_FHIR_CONFIG`, no `clearConfigCache()`, no `beforeAll`/`afterAll` wrappers needed. Replaces the env-var pattern in the existing "PV1 required=false" describe block. |
| Full message pipeline (processor-service → converter.ts → convertADT_A01) | Integration | End-to-end: MLLP receive → process → verify FHIR resources in Aidbox. Exercises `createConverterContext()` in production path. |

# Context

## Exploration Findings

### Current Converter Signatures

```typescript
// adt-a01.ts:289-292
export async function convertADT_A01(
  parsed: HL7v2Message,
  resolvePatientId: PatientIdResolver,
): Promise<ConversionResult>

// adt-a08.ts:87-90
export async function convertADT_A08(
  parsed: HL7v2Message,
  resolvePatientId: PatientIdResolver,
): Promise<ConversionResult>

// oru-r01.ts:911-916
export async function convertORU_R01(
  parsed: HL7v2Message,
  lookupPatient: PatientLookupFn = defaultPatientLookup,
  lookupEncounter: EncounterLookupFn = defaultEncounterLookup,
  resolvePatientId: PatientIdResolver,
): Promise<ConversionResult>
```

### Type Locations (Pre-Refactor)

- `PatientIdResolver` — `src/v2-to-fhir/identity-system/patient-id.ts:26-27`
- `PatientLookupFn` — `src/v2-to-fhir/messages/oru-r01.ts:70`
- `EncounterLookupFn` — `src/v2-to-fhir/messages/oru-r01.ts:94`
- `MpiClient` — `src/v2-to-fhir/identity-system/mpi-lookup.ts:17-39`
- `Hl7v2ToFhirConfig` — `src/v2-to-fhir/config.ts:24-29`

### Config Loading Pattern (Pre-Refactor)

Config is loaded **inside each converter** via `hl7v2ToFhirConfig()` (cached at process level). Not passed as a parameter currently.

### Call Sites in converter.ts

```typescript
// converter.ts ~line 95-102
switch (messageType) {
  case "ADT_A01": return await convertADT_A01(parsed, resolvePatientId);
  case "ADT_A08": return await convertADT_A08(parsed, resolvePatientId);
  case "ORU_R01": return await convertORU_R01(parsed, undefined, undefined, resolvePatientId);
}
```
`resolvePatientId` is created once via `defaultPatientIdResolver()`. ORU's lookup params passed as `undefined` (relying on defaults).

### Test Impact

**Unit tests with direct converter calls:**
- `test/unit/v2-to-fhir/messages/adt-a01.test.ts` — 3 calls: `convertADT_A01(parsed, defaultPatientIdResolver())`
- `test/unit/v2-to-fhir/messages/oru-r01.test.ts` — 4 calls: `convertORU_R01(parsed, noExistingPatient, noExistingEncounter, defaultPatientIdResolver())`

**Integration tests:** Not directly affected (go through processor-service).

### Directory Structure

```
src/v2-to-fhir/
├── converter.ts               (main router)
├── config.ts                  (config loader & types)
├── processor-service.ts       (polling service)
├── preprocessor.ts
├── preprocessor-registry.ts
├── identity-system/
│   ├── patient-id.ts          (PatientIdResolver, defaultPatientIdResolver)
│   ├── mpi-lookup.ts          (MpiClient)
│   └── encounter-id.ts
├── messages/
│   ├── adt-a01.ts
│   ├── adt-a08.ts
│   └── oru-r01.ts             (also contains PatientLookupFn, EncounterLookupFn)
├── segments/
└── datatypes/
```

## User Requirements & Answers

**Source:** `ai/tickets/awie_case/epics/00_03_converter_context_refactor.md`

**Feature:** Compose all converter runtime dependencies into a `ConverterContext` object so converters receive `(parsed, context)` instead of N individual parameters.

**Agreed decisions:**
- Include `config: Hl7v2ToFhirConfig` in ConverterContext (converters stop calling `hl7v2ToFhirConfig()` internally)
- Move `PatientLookupFn` and `EncounterLookupFn` type definitions to `converter-context.ts`
- New file: `src/v2-to-fhir/converter-context.ts` for the interface
- `lookupPatient` and `lookupEncounter` are required fields (not optional) — ADT converters simply won't destructure them

## User Feedback

# Implementation Plan

## Overview

Compose all converter runtime dependencies (`config`, `resolvePatientId`, `lookupPatient`, `lookupEncounter`) into a single `ConverterContext` object. All message converters change to a uniform `(parsed, context)` signature. Config becomes injected rather than accessed via a global singleton inside converters, removing the need for env-var overrides and `clearConfigCache()` in most tests.

## Development Approach
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: all tests must pass before starting next task** — run `bun test:all`
- **CRITICAL: update this plan when scope changes**

## Validation Commands
- `bun test:all` — Run all tests (unit + integration)
- `bun run typecheck` — TypeScript type checking

---

## Task 1: Implement `converter-context.ts` and `aidbox-lookups.ts`

The two new files already exist as design prototypes. Replace the prototype scaffolding with production code.

- [x] In `src/v2-to-fhir/aidbox-lookups.ts`: remove the `DESIGN PROTOTYPE` banner and all prototype comment blocks. Keep the implementation and JSDoc exactly as written (they are the final implementation).
- [x] In `src/v2-to-fhir/converter-context.ts`: remove the `DESIGN PROTOTYPE` banner and all prototype comment blocks. Keep the interface, types, factory function, and JSDoc exactly as written.
- [x] Verify: `PatientLookupFn`, `EncounterLookupFn` are exported from `converter-context.ts`
- [x] Verify: `defaultPatientLookup`, `defaultEncounterLookup` are exported from `aidbox-lookups.ts`
- [x] Verify: `createConverterContext()` returns an object with all four required fields
- [x] Run `bun run typecheck` — must pass
- [x] Run `bun test:all` — must pass before next task

---

## Task 2: Update `converter.ts` to use `ConverterContext`

Typecheck and tests will not pass until Tasks 3-5 update converter signatures. Proceed immediately to Tasks 3-5 after this task.

- [x] Add import: `import { createConverterContext } from "./converter-context"`
- [x] Remove import: `import { defaultPatientIdResolver } from "./identity-system/patient-id"`
- [x] In `convertToFHIR()`: replace `const resolvePatientId = defaultPatientIdResolver()` with `const context = createConverterContext()`
- [x] Update switch cases: pass `context` as second argument instead of `resolvePatientId` / `undefined, undefined, resolvePatientId`
  - `convertADT_A01(parsed, context)`
  - `convertADT_A08(parsed, context)`
  - `convertORU_R01(parsed, context)`
- [x] Remove all `DESIGN PROTOTYPE` comments from this file

---

## Task 3: Update `convertADT_A01` to accept `ConverterContext`

- [x] Add import: `import type { ConverterContext } from "../converter-context"`
- [x] Remove import: `import { hl7v2ToFhirConfig } from "../config"`
- [x] Remove import: `import type { PatientIdResolver } from "../identity-system/patient-id"`
- [x] Change signature from `(parsed: HL7v2Message, resolvePatientId: PatientIdResolver)` to `(parsed: HL7v2Message, context: ConverterContext)`
- [x] Destructure at top of function: `const { resolvePatientId, config } = context`
- [x] Remove the line `const config = hl7v2ToFhirConfig()` (~line 375) — `config` now comes from destructuring
- [x] Verify `config.messages?.["ADT-A01"]?.converter?.PV1?.required` still works with the destructured `config`
- [x] Remove all `DESIGN PROTOTYPE` comments from this file

---

## Task 4: Update `convertADT_A08` to accept `ConverterContext`

- [x] Add import: `import type { ConverterContext } from "../converter-context"`
- [x] Remove import: `import type { PatientIdResolver } from "../identity-system/patient-id"`
- [x] Change signature from `(parsed: HL7v2Message, resolvePatientId: PatientIdResolver)` to `(parsed: HL7v2Message, context: ConverterContext)`
- [x] Destructure at top of function: `const { resolvePatientId } = context`
- [x] Remove all `DESIGN PROTOTYPE` comments from this file

---

## Task 5: Update `convertORU_R01` to accept `ConverterContext`

This is the most involved converter change: three parameters collapse into one, lookup types move out, duplicate implementations are deleted.

- [x] Add import: `import type { ConverterContext } from "../converter-context"`
- [x] Add import: `import type { PatientLookupFn, EncounterLookupFn } from "../aidbox-lookups"`
- [x] Remove: the local `PatientLookupFn` type alias (line 73)
- [x] Remove: the local `EncounterLookupFn` type alias (line 106)
- [x] Remove: the `defaultPatientLookup` function (lines 85-97) — now lives in `aidbox-lookups.ts`
- [x] Remove: the `defaultEncounterLookup` function (lines 118-130) — now lives in `aidbox-lookups.ts`
- [x] Remove: the `import { getResourceWithETag, NotFoundError } from "../../aidbox"` if no longer used after removing the lookup functions. (Check: `getResourceWithETag` and `NotFoundError` were only used by the lookup functions; if no other code in this file references them, remove the import.)
- [x] Remove import: `import { hl7v2ToFhirConfig } from "../config"`
- [x] Change `convertORU_R01` signature from `(parsed, lookupPatient, lookupEncounter, resolvePatientId)` to `(parsed: HL7v2Message, context: ConverterContext)`
- [x] Destructure at top of function: `const { resolvePatientId, lookupPatient, lookupEncounter, config } = context`
- [x] In `handleEncounter()`: it currently calls `hl7v2ToFhirConfig()` internally (line 638). Either:
  - **(Preferred)** Add `config: Hl7v2ToFhirConfig` as a parameter to `handleEncounter()` and pass it from the caller, OR
  - Pass the whole `context` to `handleEncounter()`

  The design specifies the `config` approach. Update `handleEncounter` signature to accept `config` as an additional parameter. Replace `const config = hl7v2ToFhirConfig()` inside it with the parameter.
- [x] Update the call to `handleEncounter()` in `convertORU_R01` to pass `config`
- [x] Remove all `DESIGN PROTOTYPE` comments from this file (there are 6 comment blocks)
- [x] Remove the import of `hl7v2ToFhirConfig` from `"../config"` if no other code in this file uses it
- [x] Verify internal helper signatures (`handlePatient` at line 549 already accepts `lookupPatient` and `resolvePatientId` as params — these are now sourced from context but the helper interface stays the same)
- [x] Run `bun run typecheck` — source code passes; test files fail as expected (updated in Tasks 6-7)

---

## Task 6: Create `makeTestContext` helper and update ADT_A01 tests

- [x] Create `test/unit/v2-to-fhir/helpers.ts` with `makeTestContext(overrides?)` function:
  ```typescript
  import type { ConverterContext } from "../../../src/v2-to-fhir/converter-context";
  import { defaultPatientIdResolver } from "../../../src/v2-to-fhir/identity-system/patient-id";
  import { hl7v2ToFhirConfig } from "../../../src/v2-to-fhir/config";

  export function makeTestContext(overrides?: Partial<ConverterContext>): ConverterContext {
    return {
      config: hl7v2ToFhirConfig(),
      resolvePatientId: defaultPatientIdResolver(),
      lookupPatient: async () => null,
      lookupEncounter: async () => null,
      ...overrides,
    };
  }
  ```
- [x] In `test/unit/v2-to-fhir/messages/adt-a01.test.ts`:
  - Add import: `import { makeTestContext } from "../helpers"`
  - Remove import: `import { defaultPatientIdResolver } from "../../../../src/v2-to-fhir/identity-system/patient-id"`
  - Replace 3 call sites: `convertADT_A01(parsed, defaultPatientIdResolver())` → `convertADT_A01(parsed, makeTestContext())`
  - **Replace the "PV1 required=false" `describe` block**: remove `beforeAll`/`afterAll` env-var wiring and `process.env.HL7V2_TO_FHIR_CONFIG` manipulation. Instead, load the test config directly and pass it via `makeTestContext({ config: testConfig })`. This means:
    - Add: `import { readFileSync } from "fs"` (or use `Bun.file`)
    - Load test config: parse the JSON from `test/fixtures/config/hl7v2-to-fhir.json`
    - Replace `beforeAll`/`afterAll` with a const: `const testConfig = JSON.parse(readFileSync(TEST_CONFIG, "utf-8"))`
    - Call: `convertADT_A01(parsed, makeTestContext({ config: testConfig }))`
  - The `afterEach(() => clearConfigCache())` at the top level can remain for safety (other test helpers may still call `hl7v2ToFhirConfig()`), but consider whether it's still needed. If `makeTestContext` is the only thing calling `hl7v2ToFhirConfig()`, the cache clear is still appropriate for test isolation.
- [x] Run `bun test:all` — ADT_A01 tests pass (3/3). 4 ORU_R01 failures are expected pre-existing from Task 5 signature change, fixed in Task 7.

---

## Task 7: Update ORU_R01 tests

- [ ] In `test/unit/v2-to-fhir/messages/oru-r01.test.ts`:
  - Add import: `import { makeTestContext } from "../helpers"`
  - Remove import: `import { defaultPatientIdResolver } from "../../../../src/v2-to-fhir/identity-system/patient-id"`
  - The existing `noExistingPatient` / `noExistingEncounter` mocks can be removed — `makeTestContext()` already provides `async () => null` defaults for both lookups
  - Replace 4 call sites: `convertORU_R01(parsed, noExistingPatient, noExistingEncounter, defaultPatientIdResolver())` → `convertORU_R01(parsed, makeTestContext())`
  - Keep `afterEach(() => clearConfigCache())` — still needed because `makeTestContext()` calls `hl7v2ToFhirConfig()` by default
- [ ] Run `bun test:all` — must pass before next task

---

## Task 8: Verify no regressions and final typecheck

- [ ] Run `bun run typecheck` — must pass
- [ ] Run `bun test:all` — all tests must pass (unit + integration)
- [ ] Verify that `convertToFHIR()` in `converter.ts` correctly constructs context and passes it through — integration tests exercise this path via `processor-service.ts`

---

## Task 9: Cleanup design artifacts

- [ ] Remove all `DESIGN PROTOTYPE: 2026-02-23-converter-context-refactor.md` comments from codebase
- [ ] Verify no prototype markers remain: `grep -r "DESIGN PROTOTYPE: 2026-02-23-converter-context-refactor" src/ test/`
- [ ] Verify no stale `PatientLookupFn` / `EncounterLookupFn` type exports remain in `oru-r01.ts`
- [ ] Verify no stale `defaultPatientLookup` / `defaultEncounterLookup` function exports remain in `oru-r01.ts`
- [ ] Verify `oru-r01.ts` no longer imports from `../../aidbox` (unless something else in the file uses it — check)
- [ ] Update design document frontmatter status to `implemented`
- [ ] Run `bun test:all` and `bun run typecheck` — final verification

---

## Post-Completion Verification

1. **Functional test**: Run `bun test:all` — all unit and integration tests pass. Integration tests exercise the full path: MLLP receive → processor-service → `convertToFHIR()` → `createConverterContext()` → converter.
2. **Config injection test**: The ADT_A01 "PV1 required=false" tests now pass config directly via `makeTestContext({ config })` without env-var overrides.
3. **Uniform signatures**: All three converters (`convertADT_A01`, `convertADT_A08`, `convertORU_R01`) accept `(parsed: HL7v2Message, context: ConverterContext)`.
4. **No circular imports**: `aidbox-lookups.ts` does not import from `converter-context.ts`. `oru-r01.ts` imports types from `converter-context.ts` only. No bidirectional edges.
5. **No regressions**: All existing tests pass unchanged (modulo the call-site updates).
6. **Cleanup verified**: No `DESIGN PROTOTYPE` comments remain in `src/` or `test/`.


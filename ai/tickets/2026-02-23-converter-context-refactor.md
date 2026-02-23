---
status: ai-reviewed
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

**Known limitation: `defaultPatientIdResolver()` config inconsistency**
`defaultPatientIdResolver()` (in `identity-system/patient-id.ts`) calls `hl7v2ToFhirConfig()` internally to read `config.identitySystem.patient.rules` at construction time. As a result, when a test passes a custom `config` to `makeTestContext({ config: myConfig })`, the `resolvePatientId` field is still built from the cached global config — not from `myConfig`. The two can diverge if the config cache was cleared between calls. This inconsistency is unlikely to cause bugs in practice today because the identity rules and PV1 config are independent, but it is a known limitation. It will be resolved when `defaultPatientIdResolver` is refactored to accept config as a parameter (a natural follow-up to this ticket).

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

## AI Review Notes

### Summary

The design is well-reasoned. The `ConverterContext` concept is the right abstraction, the motivations are clear, and the trade-offs are honestly acknowledged. However, there is one blocker: the design documents a circular (bidirectional) import between `converter-context.ts` and `oru-r01.ts`, dismisses it as "TypeScript/Bun handle this fine", and proposes extracting to `aidbox-lookups.ts` only as a future optional step. The project code-style rules explicitly prohibit circular imports with no exception clause. This must be resolved as part of this ticket, not deferred.

There are also two smaller issues worth addressing.

---

### Issue 1 — BLOCKER: Circular import between `converter-context.ts` and `oru-r01.ts`

**Severity: Blocker**

The design import chain (Section "Import chain after refactor") has:

```
converter-context.ts  →  messages/oru-r01.ts  (imports defaultPatientLookup, defaultEncounterLookup)
messages/oru-r01.ts   →  converter-context.ts  (imports ConverterContext, PatientLookupFn, EncounterLookupFn)
```

This is a direct bidirectional cycle. `.claude/code-style.md` is unambiguous: "Never create circular imports between modules." The document acknowledges this and suggests it is acceptable for now because "there are no top-level side effects at import time." That rationale does not override the project rule — the rule is unconditional.

The document itself names the correct fix: extract `defaultPatientLookup` and `defaultEncounterLookup` to `src/v2-to-fhir/aidbox-lookups.ts`. This is a small, well-scoped change. It should not be deferred.

**Required resolution:**
- Create `src/v2-to-fhir/aidbox-lookups.ts` (or a similarly named file) exporting `defaultPatientLookup` and `defaultEncounterLookup`.
- `converter-context.ts` imports from `aidbox-lookups.ts` (not from `oru-r01.ts`).
- `oru-r01.ts` imports from `converter-context.ts` (for `ConverterContext`, `PatientLookupFn`, `EncounterLookupFn`). No back-import into `converter-context.ts`.
- Update the "Import chain after refactor" section to reflect the corrected graph.

Note: `defaultPatientLookup` and `defaultEncounterLookup` are currently also exported from `oru-r01.ts` for use in `converter-context.ts`. After the split they will live only in `aidbox-lookups.ts`. Any external references to these functions (check for direct imports outside of `oru-r01.ts` and `converter-context.ts`) must be updated.

---

### Issue 2 — Minor: `defaultPatientIdResolver()` still calls `hl7v2ToFhirConfig()` internally

**Severity: Minor**

The design's stated goal is that converters stop calling `hl7v2ToFhirConfig()` so config is injected and testable. `createConverterContext()` passes `config` explicitly in the returned object, which achieves this for the converters themselves. However, `defaultPatientIdResolver()` (in `identity-system/patient-id.ts`) still calls `hl7v2ToFhirConfig()` internally — it reads `config.identitySystem.patient.rules` at construction time.

This is not a blocker for the current ticket (the resolver is a black box from the converters' perspective, and the factory already wires it in). But there is a subtle inconsistency: the `makeTestContext()` helper calls both `hl7v2ToFhirConfig()` (for `config`) and `defaultPatientIdResolver()` (which also calls `hl7v2ToFhirConfig()`), so tests that supply a custom `config` to `makeTestContext()` will have `config` and `resolvePatientId` built from potentially different config objects if the cache was cleared between the two calls. This is unlikely to cause bugs in practice today, but it is worth documenting.

**Resolution:** Add a note to the "Trade-offs / Cons" section documenting this inconsistency. Mark it as a known limitation to be resolved when `defaultPatientIdResolver` is refactored to accept config as a parameter (a natural follow-up to this ticket).

---

### Issue 3 — Minor: `makeTestContext` calls `hl7v2ToFhirConfig()` — existing env-var tests still needed

**Severity: Minor**

The design claims: "Config is now injected, removing the need for `clearConfigCache()` in unit tests and the env-var override pattern." This is true for tests that construct an explicit config object and pass it via `makeTestContext({ config: myConfig })`. However, `makeTestContext()` as written calls `hl7v2ToFhirConfig()` as its `config` default, which still reads from the file system and is still cached. Any test that needs a non-default config will still need to either: (a) pass an explicit config object (the clean path), or (b) use the env-var + `clearConfigCache()` dance.

Looking at the existing tests, the `adt-a01.test.ts` "PV1 required=false" describe block uses `process.env.HL7V2_TO_FHIR_CONFIG` + `beforeAll/afterAll` + `clearConfigCache()` because it needs the test config fixture. After this refactor, that block can instead pass `config: loadTestConfig()` to `makeTestContext()` — but only if the test is updated to construct the config object rather than relying on env-var. The design does not call this out explicitly.

**Resolution:** Update the "Test Cases" table to include: "ADT_A01 with PV1 required=false: pass config object directly via makeTestContext — no env-var or clearConfigCache needed." Also verify that the existing `afterEach(() => clearConfigCache())` calls in both test files can be removed after the refactor (they probably can for the converter tests, but may still be needed if any helper in scope calls `hl7v2ToFhirConfig()` without injection).

---

### Additional Observations (non-blocking)

**Typo in design document:** Section "Import chain after refactor" contains `messages/adu-a08.ts` — should be `messages/adt-a08.ts`.

**`makeTestContext` location:** The design suggests `test/helpers/converter-context.ts`. There is no `test/helpers/` directory; the existing shared test infrastructure lives in `test/integration/helpers.ts`. For unit test helpers, placing `makeTestContext` inside the existing test file (or a new `test/unit/v2-to-fhir/helpers.ts`) is consistent with the pattern used elsewhere in unit tests. This is a style call, not a blocker.

**Affected file list is complete:** The table covers all seven files correctly. No missing entries found.

**`createConverterContext()` called once per message:** Confirmed correct — it is called inside `convertToFHIR()` per the prototype marker in `converter.ts`. This is the right scope: not once per process (would prevent config reloading if ever needed), not once per segment (wasteful).

---

### Required Changes Before Approval

1. Resolve the circular import by extracting `defaultPatientLookup` / `defaultEncounterLookup` to `src/v2-to-fhir/aidbox-lookups.ts` and updating the import chain diagram.
2. Fix the typo `adu-a08.ts` → `adt-a08.ts` in the import chain section.
3. Add a note about the `defaultPatientIdResolver` config inconsistency to the Trade-offs section.
4. Clarify in the Test Cases that the `PV1 required=false` test can use direct config injection instead of env-var tricks.

### Resolution (addressed in review iteration 1)

**Issue 1 — Circular import (BLOCKER): RESOLVED**
Created `src/v2-to-fhir/aidbox-lookups.ts` as a new prototype file containing `defaultPatientLookup` and `defaultEncounterLookup`. The implementations use inline `(patientId: string) => Promise<Patient | null>` types rather than importing `PatientLookupFn`/`EncounterLookupFn` from `converter-context.ts` — avoiding a new cycle. TypeScript structural typing ensures the implementations satisfy the named types. `converter-context.ts` now imports from `aidbox-lookups.ts`. The import chain diagram was updated to reflect the clean graph. The stale Edge Cases row that dismissed the cycle was corrected. Added markers to `oru-r01.ts` indicating that `defaultPatientLookup`/`defaultEncounterLookup` will be removed and why they move to `aidbox-lookups.ts` rather than staying in place.

**Issue 2 — `defaultPatientIdResolver()` config inconsistency (Minor): DOCUMENTED**
Added a "Known limitation" subsection under Mitigations in Trade-offs explaining the inconsistency and noting it will be resolved when `defaultPatientIdResolver` is refactored to accept config as a parameter.

**Issue 3 — `PV1 required=false` env-var pattern (Minor): DOCUMENTED**
Added test case "ADT_A01 with PV1 required=false via direct config injection" to the Test Cases table, explicitly noting that `process.env`, `clearConfigCache()`, and `beforeAll`/`afterAll` wrappers are not needed.

**Typo `adu-a08.ts` → `adt-a08.ts`: FIXED**
Corrected in the Import chain after refactor section.

**`makeTestContext` location: CLARIFIED**
Updated the Test context helper code block to use `test/unit/v2-to-fhir/helpers.ts` and added a note explaining there is no `test/helpers/` directory. Updated the Mitigations section to reference the correct path.

## User Feedback

---

### AI Review Notes — Iteration 2

#### Summary

All three blockers and minor issues from iteration 1 have been correctly addressed. The circular import is genuinely resolved: `aidbox-lookups.ts` exists as a prototype file, its implementations use inline types (not importing from `converter-context.ts`), and the import chain diagram in the document reflects a clean acyclic graph. The two minor issues (config inconsistency documentation, PV1 env-var test clarification) are addressed in the document. No new structural problems were introduced.

There are a small number of remaining observations, none of which are blockers.

---

#### Issue 1 — Minor: `aidbox-lookups.ts` prototype still duplicates implementations from `oru-r01.ts`

**Severity: Minor / Informational**

Both `src/v2-to-fhir/aidbox-lookups.ts` and `src/v2-to-fhir/messages/oru-r01.ts` currently contain identical implementations of `defaultPatientLookup` and `defaultEncounterLookup`. This is intentional for the prototype phase — `oru-r01.ts` retains the originals with DESIGN PROTOTYPE removal markers. The design correctly notes they must be removed from `oru-r01.ts` during implementation. This is not a design flaw but is worth flagging: during implementation, the implementer must delete the copies in `oru-r01.ts` rather than leaving them as dead code (code-style rule: remove unused code immediately).

**No action needed in the design document.** Verified the markers in `oru-r01.ts` (lines 75-130) are clear and accurate.

---

#### Issue 2 — Minor: `oru-r01.ts` internal helpers still reference old `PatientLookupFn` / `EncounterLookupFn` types after refactor

**Severity: Minor / Implementation reminder**

After the refactor, `oru-r01.ts` will import `PatientLookupFn` and `EncounterLookupFn` from `converter-context.ts` and use them in internal helper signatures (`handlePatient` at line 552, `handleEncounter` at line 634). These internal functions are private (not exported). They will continue to accept the same types — the types just come from a different import. This is correct; the design covers it in the import chain section. Nothing needs to change in the document.

---

#### Issue 3 — Minor: `makeTestContext` calls `hl7v2ToFhirConfig()` — `afterEach(clearConfigCache)` in test files

**Severity: Minor / Implementation reminder**

The existing `oru-r01.test.ts` has `afterEach(() => clearConfigCache())` (line 8-10). After the refactor, if tests use `makeTestContext()` (which calls `hl7v2ToFhirConfig()` for its default `config`), the cache-clearing `afterEach` is still appropriate to maintain test isolation. However, tests that pass `makeTestContext({ config: myConfig })` with an explicit config object no longer depend on the cache for that field — though `defaultPatientIdResolver()` inside `makeTestContext` still calls `hl7v2ToFhirConfig()` internally (the documented known limitation). So `clearConfigCache()` in `afterEach` remains needed for full isolation. The test cases table and known limitation note in the document cover this correctly. No change needed.

---

#### Issue 4 — Minor: `converter.ts` affected component description could note removal of `defaultPatientIdResolver` import

**Severity: Cosmetic**

The Affected Components table entry for `converter.ts` says "remove `defaultPatientIdResolver()` call" which is accurate, but it will also require removing the import line `import { defaultPatientIdResolver } from "./identity-system/patient-id"`. The DESIGN PROTOTYPE marker in `converter.ts` (line 97) already calls this out explicitly, so the implementer will not miss it. The document is functionally correct; this is cosmetic only.

---

#### Dependency Graph Verification

Verified the post-refactor import graph is acyclic:

```
converter.ts → converter-context.ts → aidbox-lookups.ts → aidbox.ts, fhir/
                                     → config.ts
                                     → identity-system/patient-id.ts → config.ts

converter.ts → messages/adt-a01.ts → converter-context.ts (types only)
converter.ts → messages/adt-a08.ts → converter-context.ts (types only)
converter.ts → messages/oru-r01.ts → converter-context.ts (types only)
```

No cycle exists. `aidbox-lookups.ts` has zero imports from `converter-context.ts` or any message file. Confirmed by reading the prototype file directly.

---

#### Affected Components Completeness

The affected components table lists 8 entries. Verified against codebase:
- No other files import `PatientLookupFn`, `EncounterLookupFn`, `defaultPatientLookup`, or `defaultEncounterLookup` from `oru-r01.ts` outside of `converter.ts` and the test files. The `oru-r01.test.ts` only imports `convertORU_R01` from `oru-r01.ts` — not the lookup types.
- `processor-service.ts` calls `convertToFHIR()` from `converter.ts` — unaffected.
- No integration test files directly call converters. Table is complete.

---

#### Test Cases Completeness

The 9 test cases in the table cover the critical paths:
- Happy path for all three converter types via context
- Lookup override for ORU (existing patient, existing encounter)
- Config injection (PV1 required=false without env-var tricks)
- Factory function smoke test
- Integration end-to-end

One gap worth noting (non-blocking): there is no test case for `createConverterContext()` failing when `hl7v2ToFhirConfig()` throws (invalid config file). This is the same behavior as today and is covered implicitly by existing config unit tests in `test/unit/v2-to-fhir/config.test.ts`. Acceptable omission.

---

#### Recommendation

Approved for user review. No blockers. The design is clean, the circular import resolution is correct and complete, all issues from iteration 1 are addressed, and the implementation notes (DESIGN PROTOTYPE markers) in the prototype files are accurate and actionable.


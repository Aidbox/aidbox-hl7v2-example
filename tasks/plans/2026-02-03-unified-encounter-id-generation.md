---
status: planned
reviewer-iterations: 2
prototype-files:
  - config/hl7v2-to-fhir.json
  - src/v2-to-fhir/config.ts
  - src/v2-to-fhir/id-generation.ts
  - src/v2-to-fhir/preprocessor.ts
  - src/v2-to-fhir/segments/pv1-encounter.ts
  - src/v2-to-fhir/messages/oru-r01.ts
  - src/v2-to-fhir/messages/adt-a01.ts
  - src/v2-to-fhir/processor-service.ts
  - src/ui/pages/messages.ts
  - src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts
---

# Design: Unified Encounter ID Generation

## Problem Statement
ADT and ORU currently generate Encounter IDs using different strategies, which fragments visit data and leaves orphaned draft Encounters. The core converter must be HL7 v2.8.2 compliant for PV1-19 authority requirements, while allowing preprocessing for non-conformant messages. We need a unified ID strategy, a preprocessor stage before conversion, and message-type policy to warn or hard-fail. Warnings must be visible in the incoming queue with manual retry.

## Proposed Approach
Introduce a preprocessor stage that runs before message handlers and returns only a modified IncomingHL7v2Message (converters are unaware it ran). The preprocessor loads a JSON config at `config/hl7v2-to-fhir.json` keyed by exact message type (`ORU-R01`, `ADT-A01`); preprocessor config is optional per message type. Per-segment preprocessing is configured as lists of registered preprocessor IDs (kebab-case), validated at startup. Each segment preprocessor receives the full IncomingHL7v2Message and the current segment, and must always return a (possibly unchanged) segment; preprocessors compose in the order listed. Preprocessors run for every matching segment, but only apply when the configured field (e.g., PV1-19) is present. The core converter enforces HL7 v2.8.2 CX requirements for authority using CX.4 / CX.9 / CX.10 with no MSH fallback; invalid PV1-19 causes a descriptive error. Converter policy controls whether PV1 is required per message type (ORU-R01 optional, ADT-A01 required). Missing converter config is a hard error to avoid implicit defaults. The incoming message schema and UI queue add `warning` support and a manual retry action.

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Config source | A) Env vars, B) JSON file, C) Aidbox resource | B | Versionable and explicit without environment sprawl. |
| Core authority rules | A) Spec-compliant CX.4/9/10, B) MSH fallback | A | Core converter must be HL7 v2.8.2 compliant; preprocessors handle non-conformant messages. |
| Preprocessor location | A) Before handlers, B) Inside handlers | A | Ensures all conversion paths receive validated/normalized input. |
| PV1 optional in ORU-R01 | A) Warn + skip Encounter, B) Silent skip | A | Preserve clinical data while surfacing data quality issues. |
| ADT-A01 missing/invalid PV1 | A) Warn, B) Hard error | B | ADT is source of truth; avoid inconsistent IDs. |
| Conflicting CX.4/9/10 values | A) Pick priority, B) Error without profile | B | Spec defers precedence to message profile; preprocessor can resolve. |
| Warning handling | A) Auto-retry, B) Manual retry | B | Avoid silent reprocessing; user-controlled. |

## Trade-offs
- **Pro**: Strict spec compliance in core converter with explicit preprocessor policy per message type.
- **Con**: Non-conformant messages will fail unless preprocessor rules are configured.
- **Mitigated by**: Config-driven preprocessing to normalize or skip Encounter creation with descriptive warnings.

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|
| `config/hl7v2-to-fhir.json` | Create | Preprocess + converter config per message type |
| `src/v2-to-fhir/config.ts` | Create | Load and validate JSON config |
| `src/v2-to-fhir/preprocessor.ts` | Create | Preprocess messages before conversion (PV1 required policy) |
| `src/v2-to-fhir/id-generation.ts` | Create | Strict Encounter identifier builder (CX.4/9/10) |
| `src/v2-to-fhir/segments/pv1-encounter.ts` | Modify | Use strict identifier builder; no authority metadata leakage |
| `src/v2-to-fhir/messages/oru-r01.ts` | Modify | ORU policy: warning + skip Encounter when PV1 optional/missing |
| `src/v2-to-fhir/messages/adt-a01.ts` | Modify | ADT policy: hard error when PV1 required and missing/invalid |
| `src/v2-to-fhir/processor-service.ts` | Modify | Run preprocessor before message handlers; allow `warning` updates |
| `src/ui/pages/messages.ts` | Modify | Display `warning`, add retry action |
| `src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts` | Regenerated | Add `warning` to status (regenerated from init-bundle.json via @atomic-ehr/codegen) |
| `init-bundle.json` | Modify | Add `warning` status in schema |

## Technical Details

### Config schema (`config/hl7v2-to-fhir.json`)
```json
{
  "ORU-R01": {
    "preprocess": { "PV1": { "19": ["fix-authority-with-msh"] } },
    "converter": { "PV1": { "required": false } }
  },
  "ADT-A01": {
    "preprocess": { "PV1": { "19": ["fix-authority-with-msh"] } },
    "converter": { "PV1": { "required": true } }
  }
}
```

### Config loading strategy
- Config is loaded once at application startup and cached for the process lifetime.
- Missing or malformed config file is a hard startup error (fail fast).
- No runtime reload; changes require application restart.

### Preprocessor pipeline
- Preprocessor runs before message handlers and returns a modified IncomingHL7v2Message only (no diagnostics object).
- It applies config to normalize PV1 for non-conformant messages.
- It applies per-segment preprocessors by ID in list order; each preprocessor returns an updated segment.
- Preprocessors run for every matching segment, but only when the configured field (PV1-19) is present.
- It never sets `status` or `error` fields.

### Preprocessor registry
Segment preprocessors are registered by ID (kebab-case) and validated at startup. Unknown IDs cause startup failure. The initial preprocessor set:
- `fix-authority-with-msh`: If PV1-19 is present but missing authority components (CX.4/9/10), populate CX.4 from MSH-3/4. Never overrides existing authority.
This keeps preprocessing explicit and isolated; the core converter never falls back to MSH.

### Authority requirements (HL7 v2.8.2 CX rules)
For PV1-19 (CX type), authority must satisfy the conditional requirements defined for CX components:
- At least one of **CX.4 Assigning Authority**, **CX.9 Assigning Jurisdiction**, or **CX.10 Assigning Agency/Department** must be populated.
- **CX.4** is required if neither **CX.9** nor **CX.10** are populated.
- **CX.9** is required if neither **CX.4** nor **CX.10** are populated.
- **CX.10** is required if neither **CX.4** nor **CX.9** are populated.
- All three components may be valued; if CX.4 conflicts with CX.9/CX.10, precedence is defined by the Message Profile or implementation agreement.
- **CX.6 Assigning Facility** is not the authority; it is historical context about where the identifier was first assigned. It does not satisfy authority requirements.

### Utility API (new module)
```ts
export type EncounterIdentifierResult = {
  identifier?: Encounter["identifier"];
  error?: string; // descriptive error for IncomingHL7v2Message
};

export function buildEncounterIdentifier(
  visitNumber: CX,
): EncounterIdentifierResult;
```
The ID generation API is a single public entrypoint; any authority resolution helpers are internal to `id-generation.ts` and not exported.

### Validation behavior
- Core converter is strict: Encounter creation requires a valid PV1-19 identifier with authority satisfying CX.4/9/10 rules; conflicts without profile guidance are treated as errors.
- Converter policy runs in message handlers:
  - **ORU-R01** with `converter.PV1.required=false`: if PV1 missing/invalid, skip Encounter creation, continue clinical data, set `status=warning` with descriptive error.
  - **ADT-A01** with `converter.PV1.required=true`: if PV1 missing/invalid, stop processing immediately, set `status=error`, submit no bundle.
- Converter config missing/invalid: stop processing with `status=error`.

### UI requirements for warning status
The `warning` status must be fully supported in the incoming messages UI:
- **Status filter dropdown**: Include `warning` as a selectable filter option.
- **Status label/badge**: Render `warning` messages with appropriate visual styling (e.g., yellow/amber badge).
- **Retry action eligibility**: Warning messages can be retried via the manual retry action (same as other error statuses).

## Edge Cases and Error Handling
- PV1 missing entirely: if PV1 required → error, else skip Encounter and set warning.
- PV1-19 present but value missing: treat as missing identifier.
- Authority components present but empty/whitespace: treat as missing.
- Conflicting CX.4/CX.9/CX.10 values without profile guidance: treat as invalid PV1-19.
- Warning messages are not auto-requeued; manual retry only.

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|
| ORU missing authority → warning | Integration | Process ORU, create report/observations, skip Encounter, message `warning`. |
| ADT missing authority → error | Integration | Processing stops, message `error`, no FHIR bundle submitted. |
| Config missing | Unit | Config loader fails fast with error at startup. |
| Config malformed JSON | Unit | Config loader fails fast with parse error at startup. |
| Authority present → unified ID | Unit | `buildEncounterIdentifier` accepts CX.4 or CX.9 or CX.10 per spec rules. |
| Missing authority components | Unit | Error when none of CX.4/CX.9/CX.10 is populated. |
| Conflicting authority components | Unit | Error when CX.4 conflicts with CX.9/CX.10 without profile guidance. |
| Empty-after-sanitization | Unit | Authority component that sanitizes to empty string treated as missing. |
| ORU clinical data preserved | Integration | When Encounter skipped due to missing authority, DiagnosticReport and Observations are still created. |
| Warning retry action | Integration | UI action retries a warning message. |
| Preprocessor invoked before handlers | Integration | `warning/error` determined before ORU/ADT conversion runs. |

# Context

## Exploration Findings
- Encounter ID logic is split: ADT uses PV1-19 directly with fallback ID; ORU generates sender-prefixed IDs. This is in `src/v2-to-fhir/messages/adt-a01.ts` and `src/v2-to-fhir/messages/oru-r01.ts`.
- PV1 conversion is centralized in `src/v2-to-fhir/segments/pv1-encounter.ts` via `convertPV1WithMappingSupport`, which already returns an Encounter and a mappingError so callers can decide policy.
- Incoming message lifecycle and status handling is defined across:
  - Schema: `init-bundle.json` (StructureDefinition + SearchParameters)
  - Type: `src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts` (autogenerated)
  - Processor: `src/v2-to-fhir/processor-service.ts` (polls only `status=received`, updates `processed`/`error`)
  - UI queue: `src/ui/pages/messages.ts` (handles `received|processed|mapping_error|error`)
- Adding a `warning` status will require updates in schema, TS type, processor behavior, and UI filters/labels to avoid stuck or invisible messages.

## User Requirements & Answers
- Core converter must be HL7 v2.8.2 spec-conformant, including CX.9 and all "required when" rules for CX components, with no MSH fallback in the core algorithm.
- Preprocessor tooling (config-driven) runs before message handlers to normalize non-conformant messages.
- Preprocessor returns only a modified message; converters are unaware it ran.
- Preprocessor uses MSH sender context via `fix-authority-with-msh` when configured and never sets status/error.
- Config schema is exactly:
  ```json
  {
    "ORU-R01": {
      "preprocess": { "PV1": { "19": ["fix-authority-with-msh"] } },
      "converter": { "PV1": { "required": false } }
    },
    "ADT-A01": {
      "preprocess": { "PV1": { "19": ["fix-authority-with-msh"] } },
      "converter": { "PV1": { "required": true } }
    }
  }
  ```
- Encounter authority is always required for Encounter creation; PV1 presence governs whether Encounter is required per message type.
- If PV1 is not required and missing/invalid, skip Encounter and mark `warning`.
- ADT-A01 with PV1 required and missing/invalid must fail with `status=error` and no bundle submission.
- Warning details must be stored in the IncomingHL7v2Message error field and visible in the UI.
- Messages in `warning` should not be reprocessed automatically, but UI should offer a retry action.
- ID generation API should be single-entrypoint, with no exported `resolveEncounterAuthority` / `EncounterAuthorityResolution`; it should return a descriptive error used in the IncomingHL7v2Message warning/error.
- No backward compatibility or migration work is required for existing Encounters.
- Config location: `config/hl7v2-to-fhir.json`. Missing converter config is a hard error; missing preprocess config is allowed.
 - Segment preprocessors are configured by kebab-case IDs and validated at startup; preprocessors always return a segment and run on every matching segment when the configured field is present.

## AI Review Notes
Reviewed against current requirements and feedback. No blockers found.
- Config is message-type keyed with optional preprocess + converter sections; sender-agnostic noted and deferred to global preprocessors doc.
- Authority rules cover CX.4/CX.9/CX.10 conditional requirements; conflicts without profile guidance are treated as errors.
- Preprocessor is explicitly called before handlers (prototype marker) and returns only a modified message.
- ID generation API exports only `buildEncounterIdentifier` with internal authority resolution helpers.
- Warning behavior for ORU and error behavior for ADT are documented, with UI and schema updates listed.

## User Feedback

I found a few flaws in the design proposal:

1. Missing CX.9 in the resolution algorithm priority. Read the doc for the algorithm: https://www.hl7.eu/HL7v2x/v282/std282/ch02a.html - gather ALL rules about "what is required when"
2. The statement "CX.4 (Assigning Authority) should take priority over CX.6 (Assigning Facility)"
3. There's no clarification on what should be done (in both ORU and ADT) if the PV1-19 is NOT required, but still missing
4. Why function resolveEncounterAuthority is exported? I think it should be local for the encounter id resolution, and if the id fails to generate, the generateEncounterId or buildEncounterIdentifier should return an error with the failed policy description. EncounterAuthorityResolution shouldn't probably be exported too.
5. Let's specify in the config the exact message: "ORU-R01" and "ADT-A01"
6. Let's remove "validation" wrapper for both messages in the config
7. Functions in the id-generation namespace accept SenderContext (I assume to generate id using them as the fallback for missing authority), but they don't know if the authority is required or not. So they don't know and the caller won't know if the authority was found or replaced with the fallback.
8. I don't see any place where the preprocessor is called.
9. Let's change the paradigm a bit: the authority IS always required FOR Encounter creation (because PV1-19 without the authority is outright invalid according to hl7v2 spec), so it should be enforced by the converter and return an error if it doesn't have the authority. BUT the encounter itself (i.e. a valid PV1) is not required for ORU-R01, but IS required for ADT-A01. So let's change the config to:
```json
{
  "ORU-R01": {
    "PV1": {
      "required": false
    }
  },
  "ADT-A01": {
    "PV1": {
      "required": true
    }
  }
}

```
10. Please, clarify how `authority.source` will be used? I'm not sure why we need this field at all.
11. I think `convertPV1WithMappingSupport` returning `PV1ConversionResult` with authority information is an encapsulation flaw. The caller doesn't need to know WHY PV1 is invalid, it only needs to know that it's invalid. 
12. Preprocessor should return only a modified message. Converters are unaware it ran; no diagnostics or pv1Required should be returned.
13. Preprocessor should be config-driven to optionally fix missing PV1-19 authority (CX.4/9/10) per message type.

(User feedback has been addressed ✅)

# Implementation Plan

## Overview
Unify ADT and ORU Encounter ID generation with HL7 v2.8.2 spec-compliant authority validation (CX.4/9/10), a config-driven preprocessor for non-conformant messages, and a `warning` status for ORU messages with invalid/missing PV1.

## Development Approach
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan when scope changes**

## Validation Commands
- `bun test:all` - Run all tests (unit + integration)
- `bun test:unit` - Run unit tests only
- `bun run typecheck` - Type checking

---

## Task 1: Add `warning` status to schema and regenerate types

- [x] Update `init-bundle.json` to document `warning` as a valid status value for IncomingHL7v2Message (add comment or binding description)
- [x] Remove the DESIGN PROTOTYPE comment from `src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts`
- [x] Update the `status` type union in `IncomingHl7v2message.ts` to include `"warning"`: `status?: "received" | "processed" | "error" | "mapping_error" | "warning"`
- [x] Run `bun run typecheck` - must pass before next task

---

## Task 2: Implement config loader module

- [x] Replace prototype scaffold in `src/v2-to-fhir/config.ts` with actual implementation
- [x] Define typed config structure (no helper functions - navigate config directly like `config["ORU-R01"]?.converter?.PV1?.required`):
  ```ts
  export type MessageTypeConfig = {
    preprocess?: {
      PV1?: {
        "19"?: SegmentPreprocessorId[];
      };
    };
    converter?: {
      PV1?: { required?: boolean };
    };
  };

  export type Hl7v2ToFhirConfig = {
    "ORU-R01"?: MessageTypeConfig;
    "ADT-A01"?: MessageTypeConfig;
  };
  ```
- [x] Implement `hl7v2ToFhirConfig()` that reads, parses, and returns typed `Hl7v2ToFhirConfig`
- [x] Fail fast on missing or malformed config file with descriptive error
- [x] Cache config for process lifetime (singleton pattern)
- [x] Replace the prototype JSON in `config/hl7v2-to-fhir.json` with production config (remove `_designPrototype` marker)
- [x] Write unit tests in `src/v2-to-fhir/config.test.ts`:
  - Config file missing → startup error
  - Config file malformed JSON → startup error with parse details
  - Valid config → returns typed object with correct structure
  - Config navigation works: `config["ORU-R01"]?.converter?.PV1?.required === false`
  - Config navigation works: `config["ADT-A01"]?.preprocess?.PV1?.["19"]?.[0] === "fix-authority-with-msh"`
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 3: Implement strict Encounter ID generation module

- [x] Replace prototype scaffold in `src/v2-to-fhir/id-generation.ts` with actual implementation
- [x] Add HL7 v2.8.2 spec guidance as a comment block at the top of the file:
  ```ts
  /**
   * HL7 v2.8.2 CX Datatype Authority Rules (from Section 2.A.14):
   *
   * At least one of CX.4, CX.9, or CX.10 must be populated:
   * - CX.4 (Assigning Authority) is required if neither CX.9 nor CX.10 are populated
   * - CX.9 (Assigning Jurisdiction) is required if neither CX.4 nor CX.10 are populated
   * - CX.10 (Assigning Agency/Department) is required if neither CX.4 nor CX.9 are populated
   *
   * All three may be valued. If values in CX.9 and/or CX.10 conflict with CX.4,
   * the Message Profile defines precedence. Without a profile, conflicts are errors.
   *
   * These components serve different semantic purposes:
   * - CX.4: Assigning Authority (HD type) - organization/system that assigned the ID
   * - CX.9: Assigning Jurisdiction (CWE type) - geo-political body
   * - CX.10: Assigning Agency/Department (CWE type) - organization unit
   *
   * Ref: https://www.hl7.eu/HL7v2x/v282/std282/ch02a.html#Heading158
   */
  ```
- [x] Define `EncounterIdentifierResult` type: `{ identifier?: Encounter["identifier"]; error?: string }`
- [x] Implement `buildEncounterIdentifier(visitNumber: CX): EncounterIdentifierResult`
- [x] Implement internal authority validation (not exported):
  - Check CX.4 (Assigning Authority) - treat empty/whitespace as missing
  - Check CX.9 (Assigning Jurisdiction) - treat empty/whitespace as missing
  - Check CX.10 (Assigning Agency/Department) - treat empty/whitespace as missing
  - Validate at least one of CX.4/9/10 is populated (per spec conditional rules)
- [x] Handle multiple authority components:
  - If only one of CX.4/9/10 is populated → use it for identifier system
  - If multiple are populated with consistent values → valid (use CX.4 if present, as it's the primary authority designator)
  - If multiple are populated with conflicting values → error (spec says Message Profile defines precedence; we don't have one)
- [x] Return descriptive error string when:
  - PV1-19 value (CX.1) is missing → `"PV1-19 (Visit Number) value is required but missing"`
  - No authority (CX.4/9/10 all missing) → `"PV1-19 authority is required: CX.4, CX.9, or CX.10 must be populated (HL7 v2.8.2)"`
  - Conflicting authority → `"PV1-19 has conflicting authority values in CX.4/9/10; Message Profile required to resolve precedence"`
- [x] Generate deterministic identifier when valid:
  - Use the populated authority component for system (CX.4/9/10 - they're alternatives, not prioritized)
  - Value from CX.1
  - Return as `Encounter["identifier"]` array with type VN
- [x] Write unit tests in `src/v2-to-fhir/id-generation.test.ts`:
  - CX with only CX.4 populated → valid identifier using CX.4
  - CX with only CX.9 populated → valid identifier using CX.9
  - CX with only CX.10 populated → valid identifier using CX.10
  - CX with CX.4 + CX.9 same namespace → valid (use CX.4)
  - CX with CX.4 + CX.9 different namespaces → error (conflict)
  - CX with none of CX.4/9/10 → error
  - CX with empty/whitespace CX.4 only → treated as missing → error
  - CX.1 value missing → error
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 4: Implement preprocessor module

- [x] Replace prototype scaffold in `src/v2-to-fhir/preprocessor.ts` with actual implementation
- [x] Implement `preprocessIncomingMessage(message: IncomingHL7v2Message, config: Hl7v2ToFhirConfig): IncomingHL7v2Message`
- [x] Parse message type from `message.type` (e.g., "ORU^R01" → "ORU-R01" for config lookup)
- [x] If no preprocess config for message type, return message unchanged
- [x] If `fix-authority-with-msh` is configured for PV1-19:
  - Parse HL7v2 message to extract PV1-19 and MSH-3/4
  - If PV1-19 exists but CX.4/9/10 are all missing:
    - Populate CX.4 with MSH-3 (namespace) and MSH-4 (universal ID)
    - Modify the raw message string and return updated IncomingHL7v2Message
  - Never override existing CX.4/9/10 values
- [x] Never set `status` or `error` fields - preprocessor is transparent to converters
- [x] Write unit tests in `src/v2-to-fhir/preprocessor.test.ts`:
  - Message with no preprocess config → unchanged
  - ORU with missing PV1-19 authority, MSH fallback enabled → CX.4 populated from MSH-3/4
  - ORU with existing CX.4 → not overwritten
  - ADT with missing PV1-19 authority, MSH fallback enabled → CX.4 populated from MSH-3/4
  - Message with no PV1 segment → unchanged
  - Preprocessor never modifies status/error fields
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 4.1: Refactor preprocessor to registry-based segment pipeline

- [x] Add a segment preprocessor registry with kebab-case IDs and a startup validator
- [x] Update config types to use `SegmentPreprocessorId[]` for `preprocess.PV1.19`
- [x] Update config loader to validate preprocessors at startup (fail fast on unknown IDs)
- [x] Update config tests to expect list-based preprocessors
- [x] Refactor preprocessor to iterate segments and apply configured preprocessors in order
- [x] Ensure segment preprocessors always return a segment (no null/undefined)
- [x] Run preprocessors for every matching segment only when the configured field (PV1-19) is present
- [x] Update preprocessor tests to cover registry validation, composition order, and multi-segment behavior
- [x] Add draft task document for "preprocess when PV1-19 is missing entirely"
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

## Task 5: Integrate ID generation into PV1 converter

- [ ] Remove the DESIGN PROTOTYPE comment from `src/v2-to-fhir/segments/pv1-encounter.ts`
- [ ] Import `buildEncounterIdentifier` from `../id-generation`
- [ ] Modify `convertPV1WithMappingSupport` to use `buildEncounterIdentifier` for PV1-19:
  - Call `buildEncounterIdentifier(pv1.$19_visitNumber)` when PV1-19 is present
  - If `buildEncounterIdentifier` returns an error, propagate it
  - If valid, attach identifier to the Encounter
- [ ] Update `PV1ConversionResult` type if needed to include identifier error
- [ ] Remove any legacy PV1-19 handling that used fallback IDs
- [ ] Write/update unit tests in `src/v2-to-fhir/segments/pv1-encounter.test.ts`:
  - PV1 with valid authority → Encounter has identifier from `buildEncounterIdentifier`
  - PV1 with missing authority → conversion result includes error
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 6: Update ORU-R01 converter with config-driven PV1 policy

- [ ] Remove all DESIGN PROTOTYPE comments from `src/v2-to-fhir/messages/oru-r01.ts`
- [ ] Import config loader and update `convertORU_R01` to accept config parameter or load singleton
- [ ] Modify `handleEncounter` function with unified config-driven logic:
  - Get `pv1Required = config["ORU-R01"]?.converter?.PV1?.required ?? false`
  - If PV1 missing OR `buildEncounterIdentifier` returns error:
    - If `pv1Required === true` → return error result immediately, no bundle
    - If `pv1Required === false` → skip Encounter, set `status=warning`, continue with clinical data
- [ ] Update `ConversionResult` return:
  - When PV1 invalid and not required: `messageUpdate.status = "warning"`, `messageUpdate.error` = descriptive text, continue bundle
  - When PV1 invalid and required: `messageUpdate.status = "error"`, `messageUpdate.error` = descriptive text, no bundle
- [ ] Remove legacy `generateEncounterId` function that used sender context for ID generation
- [ ] Write/update integration tests in `src/v2-to-fhir/messages/oru-r01.test.ts`:
  - ORU with valid PV1 → Encounter created with unified ID
  - ORU with missing PV1 (config: required=false) → DiagnosticReport created, no Encounter, status=warning
  - ORU with invalid PV1-19 authority (config: required=false) → DiagnosticReport created, no Encounter, status=warning
  - ORU clinical data preserved when Encounter skipped
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 7: Update ADT-A01 converter with config-driven PV1 policy

- [ ] Remove all DESIGN PROTOTYPE comments from `src/v2-to-fhir/messages/adt-a01.ts`
- [ ] Import config loader and update `convertADT_A01` to accept config parameter or load singleton
- [ ] Modify PV1 handling with unified config-driven logic (same pattern as Task 6):
  - Get `pv1Required = config["ADT-A01"]?.converter?.PV1?.required ?? true`
  - If PV1 missing OR `buildEncounterIdentifier` returns error:
    - If `pv1Required === true` → return error result immediately, no bundle
    - If `pv1Required === false` → skip Encounter, set `status=warning`, continue
- [ ] Update `ConversionResult` return:
  - When PV1 invalid and required: `messageUpdate.status = "error"`, `messageUpdate.error` = descriptive text, no bundle
  - When PV1 invalid and not required: `messageUpdate.status = "warning"`, continue
- [ ] Use `buildEncounterIdentifier` result for Encounter ID (replace legacy ID generation)
- [ ] Write/update integration tests in `src/v2-to-fhir/messages/adt-a01.test.ts`:
  - ADT with valid PV1 → Encounter created with unified ID
  - ADT with missing PV1 (config: required=true) → status=error, no bundle submitted
  - ADT with invalid PV1-19 authority (config: required=true) → status=error with descriptive message, no bundle
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 8: Integrate preprocessor into processor service

- [ ] Remove all DESIGN PROTOTYPE comments from `src/v2-to-fhir/processor-service.ts`
- [ ] Import `hl7v2ToFhirConfig` and `preprocessIncomingMessage`
- [ ] Load config once at service startup (fail fast on invalid config)
- [ ] Modify `processNextMessage` to call preprocessor before `convertMessage`:
  ```ts
  const config = hl7v2ToFhirConfig();
  const preprocessed = preprocessIncomingMessage(message, config);
  const { bundle, messageUpdate } = await convertMessage(preprocessed);
  ```
- [ ] Update `applyMessageUpdate` to preserve `error` field for `warning` status (currently only preserved for errors)
- [ ] Update service factory similarly
- [ ] Write integration test in `src/v2-to-fhir/processor-service.test.ts`:
  - Preprocessor is invoked before conversion
  - Warning status is correctly persisted with error text
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 9: Update UI for warning status

- [ ] Remove all DESIGN PROTOTYPE comments from `src/ui/pages/messages.ts`
- [ ] Add `"warning"` to the `statuses` array for filter buttons
- [ ] Update `getStatusBadgeClass` to handle `"warning"` status:
  - Return `"bg-amber-100 text-amber-800"` for warning styling
- [ ] Update `formatStatusLabel` to handle `"warning"` → `"Warning"`
- [ ] Update retry action eligibility to include `warning`:
  - Change condition from `msg.status === "error" || msg.status === "mapping_error"` to also include `msg.status === "warning"`
- [ ] Write/update test in `src/ui/pages/messages.test.ts` (if exists):
  - Warning status appears in filter dropdown
  - Warning messages show amber badge
  - Warning messages have retry button
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 10: Update documentation

- [ ] Update CLAUDE.md if any new patterns or conventions were introduced (likely minimal)
- [ ] Verify `id-generation.ts` has the HL7 v2.8.2 spec comment block (added in Task 3)
- [ ] Add inline comments in `preprocessor.ts` explaining MSH fallback logic
- [ ] Review and update any relevant docs in `docs/developer-guide/` if ORU/ADT processing changed significantly
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 11: Cleanup design artifacts

- [ ] Remove all `DESIGN PROTOTYPE: 2026-02-03-unified-encounter-id-generation.md` comments from codebase
- [ ] Remove `_designPrototype` field from `config/hl7v2-to-fhir.json` if not already done
- [ ] Update design document status to `implemented`
- [ ] Verify no prototype markers remain: `grep -r "DESIGN PROTOTYPE: 2026-02-03-unified-encounter-id-generation" src/ config/`
- [ ] Run `bun test:all` and `bun run typecheck` - final verification

---

## Post-Completion Verification

1. **Functional test - ORU with valid PV1**: Send ORU message with valid PV1-19 authority → Encounter created with unified ID, status=processed
2. **Functional test - ORU with invalid PV1**: Send ORU message with missing authority → DiagnosticReport created, no Encounter, status=warning with error text visible in UI
3. **Functional test - ADT with valid PV1**: Send ADT message with valid PV1-19 → Encounter created with unified ID, status=processed
4. **Functional test - ADT with invalid PV1**: Send ADT message with missing authority → status=error, no FHIR resources created
5. **UI test - warning status**: Verify warning status shows in filter, has amber badge, and retry button works
6. **Config test**: Restart server with missing config → startup error
7. **No regressions**: All existing tests pass
8. **Cleanup verified**: No DESIGN PROTOTYPE comments remain

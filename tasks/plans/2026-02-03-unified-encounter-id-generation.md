---
status: ready-for-review
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
Introduce a preprocessor stage that runs before message handlers and returns only a modified IncomingHL7v2Message (converters are unaware it ran). The preprocessor loads a JSON config at `config/hl7v2-to-fhir.json` keyed by exact message type (`ORU-R01`, `ADT-A01`); preprocessor config is optional per message type. It may fix missing PV1-19 authority using MSH sender context when enabled, but it never sets status or error. The core converter enforces HL7 v2.8.2 CX requirements for authority using CX.4 / CX.9 / CX.10 with no MSH fallback; invalid PV1-19 causes a descriptive error. Converter policy controls whether PV1 is required per message type (ORU-R01 optional, ADT-A01 required). Missing converter config is a hard error to avoid implicit defaults. The incoming message schema and UI queue add `warning` support and a manual retry action.

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
    "preprocess": { "PV1": { "19": { "authorityFallback": { "source": "msh" } } } },
    "converter": { "PV1": { "required": false } }
  },
  "ADT-A01": {
    "preprocess": { "PV1": { "19": { "authorityFallback": { "source": "msh" } } } },
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
- It can optionally fill missing PV1-19 authority (CX.4/9/10) using MSH sender context when `authorityFallback.source="msh"` is enabled.
- It never sets `status` or `error` fields.

### authorityFallback.source usage
`authorityFallback.source` controls where the preprocessor derives missing PV1-19 authority from. Currently the only supported value is `"msh"`, which uses MSH sender context:
- Populate CX.4 (Assigning Authority) with MSH-3/4 values (namespace/universal ID) when PV1-19 authority components are missing.
- Do not override any existing CX.4/CX.9/CX.10 values.
This keeps the fallback explicit and isolated to preprocessing; the core converter never falls back to MSH.

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
- Preprocessor uses MSH sender context when `PV1.19.authorityFallback.source="msh"` is enabled and never sets status/error.
- Config schema is exactly:
  ```json
  {
    "ORU-R01": {
      "preprocess": { "PV1": { "19": { "authorityFallback": { "source": "msh" } } } },
      "converter": { "PV1": { "required": false } }
    },
    "ADT-A01": {
      "preprocess": { "PV1": { "19": { "authorityFallback": { "source": "msh" } } } },
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

## AI Review Notes
User feedback items have been incorporated into config shape, authority rules, and prototype markers (preprocessor + converter policy + ID generation API). Ready for re-review.

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

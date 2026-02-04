---
status: explored
reviewer-iterations: 2
prototype-files:
  - config/hl7v2-to-fhir.json
  - src/v2-to-fhir/config.ts
  - src/v2-to-fhir/id-generation.ts
  - src/v2-to-fhir/segments/pv1-encounter.ts
  - src/v2-to-fhir/messages/oru-r01.ts
  - src/v2-to-fhir/messages/adt-a01.ts
  - src/v2-to-fhir/processor-service.ts
  - src/ui/pages/messages.ts
  - src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts
---

# Design: Unified Encounter ID Generation

## Problem Statement
ADT and ORU currently generate Encounter IDs using different strategies, which fragments visit data and leaves orphaned draft Encounters. Missing PV1-19 assigning authority must be enforced consistently with explicit, configurable behavior rather than ad-hoc fallbacks. We need a unified ID strategy and a validation policy that can warn or hard-fail based on message type. Warnings must be visible in the incoming queue with manual retry.

## Proposed Approach
Introduce centralized Encounter ID generation with explicit authority resolution and a JSON validation config at `config/hl7v2-to-fhir.json`. PV1 conversion returns Encounter data plus an authority validation outcome. ORU continues processing reports/observations when authority is missing but skips Encounter creation and marks the message `warning`. ADT fails the message with `status=error` when authority is required and missing. Missing config is a hard error to avoid implicit defaults. The incoming message schema and UI queue add `warning` support and a manual retry action.

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Config source | A) Env vars, B) JSON file, C) Aidbox resource | B | Versionable and explicit without environment sprawl. |
| ORU missing authority | A) Fail message, B) Warn + skip Encounter, C) Ignore | B | Preserve clinical data while flagging linkage issue. |
| ADT missing authority | A) Warn, B) Hard error, C) Fallback ID | B | ADT is source of truth; avoid inconsistent IDs. |
| Warning handling | A) Auto-retry, B) Manual retry | B | Avoid silent reprocessing; user-controlled. |

## Trade-offs
- **Pro**: Consistent Encounter identity and explicit validation policy per message type.
- **Con**: Hard error when config missing can break pipelines on misconfiguration.
- **Mitigated by**: Include standard config file in repo and clear error strings.

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|
| `config/hl7v2-to-fhir.json` | Create | Validation config for PV1-19 authority requirement |
| `src/v2-to-fhir/config.ts` | Create | Load and validate JSON config |
| `src/v2-to-fhir/id-generation.ts` | Create | Centralized Encounter ID + authority resolution |
| `src/v2-to-fhir/segments/pv1-encounter.ts` | Modify | Provide authority validation outcome and identifiers |
| `src/v2-to-fhir/messages/oru-r01.ts` | Modify | ORU policy: warning + skip Encounter |
| `src/v2-to-fhir/messages/adt-a01.ts` | Modify | ADT policy: hard error |
| `src/v2-to-fhir/processor-service.ts` | Modify | Allow `warning` updates |
| `src/ui/pages/messages.ts` | Modify | Display `warning`, add retry action |
| `src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts` | Regenerated | Add `warning` to status (regenerated from init-bundle.json via @atomic-ehr/codegen) |
| `init-bundle.json` | Modify | Add `warning` status in schema |

## Technical Details

### Config schema (`config/hl7v2-to-fhir.json`)
```json
{
  "ORU-R01": {
    "validation": {
      "PV1": {
        "19": { "authority": { "required": true } }
      }
    }
  },
  "ADT": {
    "validation": {
      "PV1": {
        "19": { "authority": { "required": true } }
      }
    }
  }
}
```

### Config loading strategy
- Config is loaded once at application startup and cached for the process lifetime.
- Missing or malformed config file is a hard startup error (fail fast).
- No runtime reload; changes require application restart.

### Authority resolution priority
When resolving the assigning authority from PV1-19 (Visit Number, CX type):
1. **CX.4** (Assigning Authority) - primary source
2. **CX.6** (Assigning Facility) - fallback if CX.4 is empty
3. **MSH fallback** - if both CX.4 and CX.6 are empty, use `SenderContext.sendingApplication` / `SenderContext.sendingFacility` (from MSH-3/MSH-4)

### Utility API (new module)
```ts
export type EncounterAuthorityResolution = {
  authority: string | null;
  source: "cx4" | "cx6" | "msh" | "missing";
};

export function resolveEncounterAuthority(
  visitNumber: CX,
  sender: SenderContext,
): EncounterAuthorityResolution;

export function generateEncounterId(
  visitNumber: CX,
  sender: SenderContext,
): string | null;
```

### Validation behavior
- Authority present: generate Encounter ID, create Encounter.
- ORU required + missing: skip Encounter creation, keep report/observations, set `status=warning` and a plain string error.
- ADT required + missing: stop processing immediately, do NOT submit any FHIR bundle (no partial resource creation), set `status=error` and a plain string error on the IncomingHL7v2Message only.
- Config missing/invalid: stop processing with `status=error`.

### UI requirements for warning status
The `warning` status must be fully supported in the incoming messages UI:
- **Status filter dropdown**: Include `warning` as a selectable filter option.
- **Status label/badge**: Render `warning` messages with appropriate visual styling (e.g., yellow/amber badge).
- **Retry action eligibility**: Warning messages can be retried via the manual retry action (same as other error statuses).

## Edge Cases and Error Handling
- PV1 missing entirely: no authority check, no Encounter (existing behavior).
- PV1-19 present but value missing: treat as missing identifier.
- Authority present but value sanitizes to empty: treat as missing.
- Warning messages are not auto-requeued; manual retry only.

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|
| ORU missing authority → warning | Integration | Process ORU, create report/observations, skip Encounter, message `warning`. |
| ADT missing authority → error | Integration | Processing stops, message `error`, no FHIR bundle submitted. |
| Config missing | Unit | Config loader fails fast with error at startup. |
| Config malformed JSON | Unit | Config loader fails fast with parse error at startup. |
| Authority present → unified ID | Unit | `generateEncounterId` uses CX.4/CX.6 then MSH fallback. |
| Authority fallback chain | Unit | CX.4 → CX.6 → MSH: verify each level is tried in order. |
| Empty-after-sanitization | Unit | Authority value that sanitizes to empty string treated as missing. |
| ORU clinical data preserved | Integration | When Encounter skipped due to missing authority, DiagnosticReport and Observations are still created. |
| Warning retry action | Integration | UI action retries a warning message. |

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
- Configurable behavior when CX.4/CX.6 are missing in PV1-19: no implicit default at runtime, but the standard/example configuration should use MSH-3/MSH-4 fallback.
- Encounter should not be created when required identifiers are missing; this is enforced after preprocessing.
- When preprocessing decides to fail due to missing identifier data, it should emit a `warning` status (not `error`) on the incoming message, with details stored in the message error field.
- `warning` should be added to the custom resource definition and visible in the incoming message queue with a warning label.
- No backward compatibility or migration work is required for existing Encounters.
- Config is JSON-based, with paths:
  - `ORU-R01.validation.PV1.19.authority.required` (true/false)
  - `ADT.PV1.19.authority.required` (true/false)
- Messages in `warning` should not be reprocessed automatically, but UI should offer a retry action.
- ORU: if authority is missing and policy blocks, still process clinical data (create DiagnosticReport/Observations) but do not create Encounter; mark message `warning`.
- ADT: if authority is required and missing, stop processing and mark message `error` (plain string error).
- Config location: `config/hl7v2-to-fhir.json` with the paths above. Missing config is a hard error.
- Updated requirements after review feedback:
  - Config schema is exactly:
    ```json
    {
      "ORU-R01": { "PV1": { "required": false } },
      "ADT-A01": { "PV1": { "required": true } }
    }
    ```
  - Core converter must be HL7 v2.8.2 spec-conformant, including CX.9 and all "required when" rules for CX components, with no MSH fallback in the core algorithm.
  - Preprocessor tooling (config-driven) runs before message handlers to normalize non-conformant messages for specific senders.
  - If PV1 is not required and missing/invalid, skip Encounter and mark `warning`.
  - ID generation API should be single-entrypoint, with no exported `resolveEncounterAuthority` / `EncounterAuthorityResolution`; it should return a descriptive error used in the IncomingHL7v2Message warning/error.
  - Authority is always required for Encounter creation; PV1 presence governs whether Encounter is required per message type.

## AI Review Notes

**Review Iteration 1 - APPROVED FOR USER REVIEW**

### Findings

**1. Completeness** ✅
- All requirements addressed: unified ID generation, configurable policy per message type, warning status with manual retry
- Minor inconsistency in config schema documentation (ORU has `validation` wrapper, ADT does not) - normalize during implementation

**2. Consistency with Codebase** ✅
- Follows existing patterns: `SenderContext`, result types with optional error field
- Note: `IncomingHl7v2message.ts` is autogenerated - the codegen source or process should be updated rather than modifying the generated file directly

**3. Clean Architecture** ✅
- Clear separation: `id-generation.ts` for ID logic, `config.ts` for config loading
- Policy decisions (warn vs error) appropriately kept at message-level converters

**4. Best Practices** ✅
- Explicit validation policy, no implicit defaults
- Plain string errors for simplicity

**5. Test Coverage** - Minor gaps to address during implementation:
- Add test for authority fallback chain (CX.4 → CX.6 → MSH)
- Add test for empty-after-sanitization case
- Add test verifying ORU clinical data preserved when Encounter skipped
- Add test for malformed config JSON

### Implementation Notes
Missing or not stated very clearly:
- Config loading strategy (startup vs per-message) should be startup with caching
- CX.4 (Assigning Authority) should take priority over CX.6 (Assigning Facility)
- MSH fallback uses `SenderContext.sendingApplication` / `SenderContext.sendingFacility`

### Changes Made (Iteration 1 Feedback)

All review notes and user feedback have been addressed:

1. **Config schema normalized** - Added `validation` wrapper to ADT config to match ORU structure
2. **Config loading clarified** - Added "Config loading strategy" section: load once at startup, cache for process lifetime
3. **Authority priority documented** - Added "Authority resolution priority" section: CX.4 > CX.6 > MSH fallback
4. **MSH fallback clarified** - Explicitly documented that MSH fallback uses `SenderContext.sendingApplication` / `SenderContext.sendingFacility`
5. **Autogenerated file clarified** - Updated Affected Components table to note that `IncomingHl7v2message.ts` is regenerated from init-bundle.json via @atomic-ehr/codegen
6. **Missing test cases added** - Test Cases table now includes: authority fallback chain, empty-after-sanitization, ORU clinical data preserved, malformed config JSON
7. **UI warning status requirements** - Added "UI requirements for warning status" section covering filter dropdown, status badge, and retry eligibility
8. **ADT error behavior explicit** - Updated validation behavior to state ADT hard error does NOT submit any FHIR bundle (no partial resource creation)

**Review Iteration 2 - APPROVED FOR USER REVIEW** ✅

All feedback items verified as addressed. Design is comprehensive and ready for user approval.

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

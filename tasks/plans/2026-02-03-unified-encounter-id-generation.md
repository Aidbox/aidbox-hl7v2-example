---
status: ai-reviewed
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

Missing or not stated very clearly:
- Warning status must be included in UI filters, labels, and retry action eligibility.
- ADT hard error (on missing/invalid encounter PV1-19) should avoid submitting any bundle and only update message status/error.

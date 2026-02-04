---
status: ai-reviewed
reviewer-iterations: 0
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
| `src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts` | Modify | Add `warning` to status |
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
    "PV1": {
      "19": { "authority": { "required": true } }
    }
  }
}
```

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
- ADT required + missing: stop processing, set `status=error` and a plain string error.
- Config missing/invalid: stop processing with `status=error`.

## Edge Cases and Error Handling
- PV1 missing entirely: no authority check, no Encounter (existing behavior).
- PV1-19 present but value missing: treat as missing identifier.
- Authority present but value sanitizes to empty: treat as missing.
- Warning messages are not auto-requeued; manual retry only.

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|
| ORU missing authority → warning | Integration | Process ORU, create report/observations, skip Encounter, message `warning`. |
| ADT missing authority → error | Integration | Processing stops, message `error`, no resources created. |
| Config missing | Unit | Config loader fails fast with error. |
| Authority present → unified ID | Unit | `generateEncounterId` uses CX.4/CX.6 then MSH fallback. |
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
No blockers found. Key implementation reminders:
- Ensure config loader ignores `_designPrototype` key and fails fast if config missing or malformed.
- Warning status must be included in UI filters, labels, and retry action eligibility.
- ADT hard error should avoid submitting any bundle and only update message status/error.

## User Feedback

# Bug: ADT-A01 Condition ID generation crashes when Encounter is unavailable

## Problem

In `src/v2-to-fhir/messages/adt-a01.ts:449`, condition ID generation uses `encounter!.id!`:

```ts
condition.id = generateConditionId(dg1, encounter!.id!);
```

This crashes at runtime when `encounter` is `undefined` — which happens when PV1 is configured as optional (`converter.PV1.required = false`) and is missing or has an invalid PV1-19 authority.

The same pattern affects `encounterRef` usage for linking Conditions and AllergyIntolerances to the Encounter, though `encounterRef` at line 407 handles the undefined case correctly with `encounter?.id`.

## Context

- **PV1 is required `[1..1]` per HL7v2 spec for ADT-A01**, so the default config (`required: true`) is correct and the crash is masked with the default configuration.
- However, the code explicitly supports the `required: false` path (lines 376-377), and the config-driven PV1 policy was designed to be flexible per message type.
- Conditions should still be created even when Encounter is unavailable (if config is `required: false`) — they just need an alternative ID strategy.

## Current ID strategy

`generateConditionId` in `adt-a01.ts:174`:
```ts
function generateConditionId(dg1: DG1, encounterId: string): string {
  const conditionName = dg1.$4_diagnosisDescription || dg1.$3_diagnosisCodeDg1?.$2_text || dg1.$3_diagnosisCodeDg1?.$1_code || "condition";
  const kebabName = toKebabCase(conditionName);
  return `${encounterId}-${kebabName}`;
}
```

The ID is `{encounterId}-{kebab-case-condition-name}`, which requires `encounterId` to be defined.

## HL7v2 spec context: DG1.20 Diagnosis Identifier

DG1.20 is an **EI** (Entity Identifier) type field — optional for ADT-A01, required for P12 messages.

> "This field contains a value that uniquely identifies a single diagnosis for an encounter. It is unique across all segments and messages for an encounter."

EI components (2-4 form an HD assigning authority):

| Component | Type | Opt | Rule |
|-----------|------|-----|------|
| EI.1 Entity Identifier | ST | O | The actual ID value |
| EI.2 Namespace ID | IS | O | Local assigning authority |
| EI.3 Universal ID | ST | C | Required if EI.4 is valued; must pair with EI.4 |
| EI.4 Universal ID Type | ID | C | Required if EI.3 is valued; must pair with EI.3 |

Valid assigning authority combinations: EI.2 alone (local), EI.3+EI.4 (universal), EI.2+EI.3+EI.4 (both), or none.

## Proposed fix direction

Update `generateConditionId` to not require `encounterId`:

1. Use **DG1.20** (Diagnosis Identifier, EI.1) when populated — spec-intended unique ID
2. When DG1.20 is absent and Encounter is available: current `{encounterId}-{kebab-name}` strategy
3. When DG1.20 is absent and Encounter is unavailable: fall back to `{patientId}-{kebab-name}`

**User feedback**: I don't think we should use encounter-id at all. What happens if later we get an update for this condition, and it was in another encounter? Also patient-id won't work in cases if it's a diagnosis like "wound" that can be resolved and appear later with the same code, but another problem. Need to heavily research spec and best practices to find a reliable way of making a deterministic id for conditions.

## Files involved

- `src/v2-to-fhir/messages/adt-a01.ts` — `generateConditionId`, condition/allergy processing loop

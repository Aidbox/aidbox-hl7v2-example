# Epic 3: ADT Subtypes (A02-A04, A11-A13)

**Priority**: P1 (ADT Completeness)
**Status**: Ready to implement (after foundation epics)
**Depends on**: Epic 1 (identity model), Epic 2 (materializing resources — ADT subtypes produce the same resources)
**Blocks**: Nothing directly (other message types are independent)

## Problem

Only ADT_A01 (admit) and ADT_A08 (update) are implemented. The Awie Case data contains 6 additional ADT event types (A02-A04, A11-A13) that represent transfers, discharges, registrations, and cancel operations. These share ~90% of A01's converter logic but differ in Encounter lifecycle semantics.

## What A01 Currently Does

See `src/v2-to-fhir/messages/adt-a01.ts`. Creates: Patient (PID), Encounter (PV1), RelatedPerson (NK1), Condition (DG1), AllergyIntolerance (AL1), Coverage (IN1). PV1 required per `config/hl7v2-to-fhir.json`. PV1-19 preprocessor `fix-authority-with-msh` applied.

## Subtype Summary

| Event | Semantic | Encounter Effect | Segments | New Converters? |
|---|---|---|---|---|
| A02 Transfer | Location change within same admission | UPDATE location[] | Core + optional (same as A01) | No — reuse A01 logic |
| A03 Discharge | End of visit | UPDATE status→finished, set period.end | Core + optional | No — PV1-45 presence triggers `finished` |
| A04 Register | Pre-admission/outpatient | CREATE with status=planned | Core + PD1, GT1, ACC, UB1/UB2 | Yes: PD1, GT1 converters |
| A11 Cancel Admit | Undo A01 | UPDATE status→cancelled | Minimal (MSH, EVN, PID, PV1) | Minimal new logic |
| A12 Cancel Transfer | Undo A02 | UPDATE remove last location | Minimal + OBX | Location array manipulation |
| A13 Cancel Discharge | Undo A03, re-activate | UPDATE status→in-progress, clear period.end | Minimal + OBX | Period.end clearing |

## Reusability of Existing Converters

**Can reuse as-is:** `convertPIDToPatient()`, `convertPV1WithMappingSupport()` (status derived from PV1-2 + PV1-45 — already handles discharge correctly), `convertNK1ToRelatedPerson()`, `convertDG1ToCondition()`, `convertAL1ToAllergyIntolerance()`, `convertIN1ToCoverage()`.

**ID generation (`src/v2-to-fhir/id-generation.ts`):** Works unchanged — PV1-19 Visit Number generates same Encounter ID across all ADT events for the same visit. No changes needed.

## Gaps & Pitfalls

1. **Bundle request method**: A02-A13 must use PUT (update), not POST. Current A01 uses conditional create — need to decide if all events should use PUT unconditionally (idempotent) or conditional logic.

2. **A04 PV1 optionality**: ASTRA A04 samples (`ASTRA-ADT-A04-01/`) have PV1, but some systems send minimal/empty PV1 for pre-admission. Config should allow `"PV1": { "required": false }` for A04.

3. **A11 FHIR status**: FHIR R4 Encounter DOES support `cancelled` status — confirmed. But what about cascading effects? If Encounter cancelled, should linked Conditions/Coverages also be updated?

4. **A12 location array manipulation**: No existing pattern for "remove most recent location entry." Need utility function. Question: does PV1 in A12 contain the *original* location (to restore) or the *cancelled transfer* location (to remove)?

5. **A13 period.end clearing**: Current converter always sets period.end from PV1-45. For A13, PV1-45 is empty → period.end should be removed/null. Need to ensure the converter handles this correctly (not just "if PV1-45, set it" but "if no PV1-45, explicitly clear it").

6. **New segments needed for A04**: PD1 (Patient Additional Demographics) — ASTRA sends PD1-4 (primary care provider) and PD1-3 (primary facility). GT1 (Guarantor) — maps to either RelatedPerson or a separate Organization. ACC (Accident), UB1/UB2 (Uniform Billing) — billing-specific, may be deferred.

7. **No "fetch existing resource" pattern**: A02-A13 update existing Encounters. Current architecture creates resources in bundles — no pattern for "read existing, modify, PUT back." Options: (a) just PUT with same ID (overwrites), (b) use conditional update, (c) add read-before-write pattern.

## Recommended Implementation Order

1. **A03 (Discharge)** — simplest update, just status change
2. **A02 (Transfer)** — simple location update
3. **A04 (Register)** — needs PD1/GT1 new converters
4. **A11 (Cancel Admit)** — minimal, sets cancelled
5. **A13 (Cancel Discharge)** — period manipulation
6. **A12 (Cancel Transfer)** — location array manipulation (trickiest)

## Decisions Needed

- [ ] Bundle request method: PUT unconditionally (idempotent) vs conditional create/update logic?
- [ ] A11 cancel cascading: should cancelling an Encounter also update linked Conditions/Coverages?
- [ ] A12 PV1 interpretation: does PV1 contain the original location (to restore) or the cancelled transfer location?
- [ ] A04 new segments: implement PD1/GT1 now, or defer ACC/UB1/UB2?
- [ ] Update pattern: overwrite via PUT, conditional update, or read-before-write?

## Relevant Files

- `src/v2-to-fhir/messages/adt-a01.ts` — base implementation to fork/extend
- `src/v2-to-fhir/converter.ts` — message type routing (add new cases here)
- `src/v2-to-fhir/segments/pv1-encounter.ts` — PV1 converter (status from PV1-2 + PV1-45)
- `src/v2-to-fhir/id-generation.ts` — Encounter ID from PV1-19 (works unchanged)
- `config/hl7v2-to-fhir.json` — per-message-type config (PV1 required/optional)
- `data/local/awie_case/awie_case_data/ASTRA-ADT-A04-01/` — ASTRA A04 sample with PD1/GT1

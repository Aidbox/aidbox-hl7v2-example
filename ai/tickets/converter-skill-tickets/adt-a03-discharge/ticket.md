# Goal

Add support for HL7v2 `ADT^A03` (Discharge/End Visit) messages to the HL7v2 → FHIR pipeline.

Currently routing fails with `Unsupported message type: ADT_A03`. Need a converter that produces the appropriate FHIR resources (Patient, Encounter at minimum, plus Practitioners/Locations/etc. per V2-to-FHIR IG) and registers the route.

## Examples

Real example messages live under `examples/` (de-identified). Sample sender observed: `ST01 / W`, HL7v2 v2.2, includes `MSH`, `EVN`, `PID`, `PV1`, `PV2` segments.

---

# Requirements

## Scope

The ADT^A03 converter produces a FHIR Transaction Bundle from an HL7v2 Discharge/End Visit message. Its primary clinical obligation is to close the Encounter (status `finished`) and record the discharge date/time. The converter follows the same architecture as `convertADT_A01`:

- New file: `src/v2-to-fhir/messages/adt-a03.ts`
- Exported function: `convertADT_A03(parsed, context): Promise<ConversionResult>`
- Registered in `src/v2-to-fhir/converter.ts` router under key `ADT_A03`
- Exported from `src/v2-to-fhir/messages/index.ts`

**FHIR resources produced (minimum):**

| Resource | Source segment | Notes |
|---|---|---|
| Patient | PID | Required |
| Encounter | PV1 | Required; status MUST be `finished` |
| RelatedPerson[] | NK1[] | Optional; 0..* |
| Condition[] | DG1[] | Optional; 0..* |
| AllergyIntolerance[] | AL1[] | Optional; 0..* |
| Coverage[] | IN1[] | Optional; 0..* |

PV2 fields (admit reason, length of stay) are incorporated into the Encounter produced from PV1. No new resources are created from PV2 alone.

---

## Normative Mapping Requirements (Spec/IG-Based)

The V2-to-FHIR IG does not publish a dedicated ADT_A03 message mapping CSV. The normative basis is the ADT_A01 message mapping (`docs/v2-to-fhir-spec/mappings/messages/HL7 Message - FHIR R4_ ADT_A01 - Sheet1.csv`) combined with the PV1[Encounter] segment mapping (`docs/v2-to-fhir-spec/mappings/segments/HL7 Segment - FHIR R4_ PV1[Encounter] - PV1.csv`), which explicitly encodes the A03 discharge logic via a conditional rule on PV1-45.

### REQ-1 — Encounter status MUST be `finished`

**Evidence:** PV1[Encounter] segment mapping row for PV1-45: `IF PV1-45 VALUED → status = "finished"`. A03 is the discharge event; PV1-45 (Discharge Date/Time) is expected to be valued. The converter MUST unconditionally set `Encounter.status = "finished"` for all A03 messages regardless of whether PV1-45 is present in the individual message, because the trigger event itself declares the encounter ended.

**Contrast with A01:** `convertADT_A01` derives status from PV1-2 Patient Class (typically `in-progress`). A03 overrides this — the event semantics take precedence over patient class.

### REQ-2 — PV1-45 Discharge Date/Time → `Encounter.period.end`

**Evidence:** PV1[Encounter] CSV row: `PV1-45 → period.end (dateTime)`. This is A03's clinically critical output. The existing `buildEncounterFromPV1` in `pv1-encounter.ts` already maps PV1-45 to `period.end`; no new conversion logic is needed — but the converter must pass status `finished` rather than deriving it from patient class.

**Field spec (v2.5):** PV1.45 — TS, optional, cardinality `[0..*]`. v2.8.2: DTM, optional, `[0..1]`. The existing code reads `pv1.$45_discharge?.[0]` (first repeat) — correct for both versions.

### REQ-3 — PV1-44 Admit Date/Time → `Encounter.period.start`

**Evidence:** PV1[Encounter] CSV row: `PV1-44 → period.start (dateTime)`. Preserve for continuity with the A01 admit. The existing `buildEncounterFromPV1` already handles this.

### REQ-4 — PV1-36 Discharge Disposition → `Encounter.hospitalization.dischargeDisposition`

**Evidence:** PV1[Encounter] CSV row: `PV1-36 → hospitalization.dischargeDisposition (CodeableConcept)`, vocabulary mapping: `DischargeDisposition`. In v2.5 PV1-36 is IS/Table 0112; in v2.8.2 it is CWE/Table 0112. The existing `buildEncounterFromPV1` handles both IS and CWE via `convertCEOrCWEToCodeableConcept`. A03 is the primary message type where this field carries meaning — it must not be silently skipped.

### REQ-5 — PV1-2 Patient Class → `Encounter.class`

**Evidence:** PV1[Encounter] CSV: `PV1-2 → class (Coding)`, vocabulary mapping `PatientClass[EncounterClass]`. Required field (R). Example message sends `E` (Emergency). The existing `resolvePatientClass` / `PATIENT_CLASS_MAP` already covers this. The A03 converter calls `convertPV1WithMappingSupport` but OVERRIDES the returned `status` to `finished` after the call.

### REQ-6 — PV1-7/8/9/17 Practitioners → `Encounter.participant`

**Evidence:** PV1[Encounter] CSV rows for PV1-7 (ATND), PV1-8 (REF), PV1-9 (CON), PV1-17 (ADM). All optional. The existing `buildEncounterFromPV1` handles all four. Example message populates PV1-7 (Attending) and PV1-8 (Referring) and PV1-17 (Admitting).

### REQ-7 — PV1-3 Assigned Location → `Encounter.location[1]`

**Evidence:** PV1[Encounter] CSV row: `PV1-3 → location[1].location(Location)`. For A03 (discharge), location status should reflect the final state. The IG rule is `IF PV1-2.1 NOT EQUALS "P" → location[1].status = "active"` (general case). For discharge, the existing `buildEncounterFromPV1` uses `assignedLocationStatus` derived from FHIR class — this is acceptable.

### REQ-8 — PV1-19 Visit Number → `Encounter.identifier` + `Encounter.id`

**Evidence:** PV1[Encounter] CSV: `PV1-19 → identifier[1]`, type code `VN`. The existing `buildEncounterIdentifier` enforces CX.4 authority. **This is the deduplication key** — the same Visit Number in an A01 and a subsequent A03 must resolve to the same Encounter resource so the update (status + period.end) is applied to the correct resource.

**v2.5 note:** PV1-19 is marked `X (Not used)` in v2.5 but is still commonly populated. The example message does NOT populate PV1-19. See fallback chain in § Fallback Chains.

### REQ-9 — PV2-3 Admit Reason → `Encounter.reasonCode`

**Evidence:** PV2[Encounter] CSV row: `PV2-3 → reasonCode[1] (CodeableConcept)`, mapped via `CWE[CodeableConcept]`. v2.5 datatype is CE; v2.8.2 is CWE. No vocabulary mapping. The existing `convertCEToCodeableConcept` / `convertCWEToCodeableConcept` handle both.

### REQ-10 — PV2-11 Actual Length of Inpatient Stay → `Encounter.length`

**Evidence:** PV2[Encounter] CSV row: `PV2-11 → length (Duration)`, datatype mapping `NM[Quantity-LengthOfStay]`. This is particularly relevant for A03 (discharge closes the stay). Example message does not populate PV2-11 but the spec includes it.

### REQ-11 — PV2-12 Visit Description → `Encounter.text.div`

**Evidence:** PV2[Encounter] CSV row: `PV2-12 → text.div (xhtml)`. Optional.

### REQ-12 — PV2-25 Visit Priority Code → `Encounter.priority`

**Evidence:** PV2[Encounter] CSV row: `PV2-25 → priority (CodeableConcept)`, vocabulary mapping `EncounterPriority`. Optional.

### REQ-13 — PID → Patient (same as A01)

**Evidence:** ADT_A01 message mapping CSV row 6. `convertPIDToPatient` is reused unchanged.

### REQ-14 — NK1[] → RelatedPerson[] (same as A01)

**Evidence:** ADT_A01 CSV row 15.1. Reuse `convertNK1ToRelatedPerson`.

### REQ-15 — DG1[] → Condition[] (same as A01)

**Evidence:** ADT_A01 CSV row 25. Reuse `convertDG1ToCondition` with deduplication.

### REQ-16 — AL1[] → AllergyIntolerance[] (same as A01)

**Evidence:** ADT_A01 CSV row 23. Reuse `convertAL1ToAllergyIntolerance` with allergen validity filter.

### REQ-17 — IN1[] → Coverage[] (same as A01)

**Evidence:** ADT_A01 CSV row 29.1. Reuse `convertIN1ToCoverage` with payor validity filter.

### REQ-18 — EVN-2 Recorded Date/Time (not mapped to FHIR Encounter)

**Evidence:** EVN[Provenance] CSV: `EVN-2 → Provenance.recorded`. The IG maps EVN to Provenance, not to Encounter. This converter does not produce a Provenance resource (same as A01). EVN-2 is acknowledged but not mapped. No deviation from A01 pattern.

---

## Real Message Profile

Observed from `examples/example-01.hl7` (inspector output — no pipe counting):

| Segment | Field | Value | Notes |
|---|---|---|---|
| MSH | MSH-3 | `ST01` | Sending application |
| MSH | MSH-4 | `W` | Sending facility |
| MSH | MSH-9 | `ADT^A03` | Message type |
| MSH | MSH-11 | `2.2` | HL7v2 version — **very old** |
| EVN | EVN-1 | `A03` | Event type (backward-compat field) |
| EVN | EVN-2 | `20260301101500` | Recorded date/time |
| PID | PID-3 | `X999001^^CERNER^MR` | MR identifier, no CX.4 authority OID |
| PID | PID-5 | `DOEJANE^SAMPLE` | Patient name |
| PV1 | PV1-2 | `E` | Patient class = Emergency |
| PV1 | PV1-4 | `1` | Admission type (bare IS code) |
| PV1 | PV1-7 | `99001^TESTPROV^ALEX^P^^^MD^HL70010^0000000001` | Attending doctor |
| PV1 | PV1-8 | `99002^TESTPROV^JAMIE^S^^^CRNP^HL70010^0000000002` | Referring doctor |
| PV1 | PV1-10 | `ETU` | Hospital service |
| PV1 | PV1-13 | `N` | Re-admission indicator |
| PV1 | PV1-14 | `1` | Admit source (bare IS code) |
| PV1 | PV1-17 | `99001^TESTPROV^ALEX^P^^^MD^HL70010^0000000001` | Admitting doctor |
| PV1 | PV1-36 | `O` | Discharge disposition = Other |
| PV1 | PV1-44 | `202603010900` | Admit date/time (DTM, no timezone) |
| PV1 | PV1-45 | `202603011015` | Discharge date/time (DTM, no timezone) |
| PV1 | PV1-19 | (absent) | Visit Number — **not populated** |
| PV1 | PV1-50 | (absent) | Alternate Visit ID — **not populated** |
| PV2 | PV2-21 | `!` | Visit publicity code (non-standard value) |
| PV2 | PV2-36 | `N` | Newborn baby indicator (not mapped to FHIR Encounter) |

Key observations:
- PV1-19 (Visit Number) is absent — encounter ID cannot be derived from PV1-19.
- PV1-45 is present with discharge time — `period.end` will be populated.
- PV1-2 = `E` — Emergency class maps to `EMER` / `in-progress` by default; A03 converter must override status to `finished`.
- PV1-3 (Assigned Location) is absent.
- PV1-36 = `O` — bare IS code, not CWE. Existing code handles IS as bare string.
- MSH version 2.2 — no SFT, no ARV, no UAC. No impact on conversion logic.
- PV2-21 `!` is a non-standard character. PV2-21 maps to `Encounter.meta.security` (via `ID[Coding]`, vocabulary `Yes/NoIndicator`) — `!` is not a valid Yes/No value. Skip silently.

---

## Gaps Between Normative and Real

### MIS-1 — PV1-19 absent: Encounter cannot be keyed by Visit Number

The IG assigns `Encounter.id` from PV1-19 (Visit Number). The example sender does not populate PV1-19. Without it, `buildEncounterFromPV1` returns `identifierError` which by default causes `conversion_error` in ADT flows.

**Impact:** If treated the same as A01 with `pv1Required=true` and no fallback, every A03 from this sender fails.

**Resolution:** See REQ-F1 (fallback chain) and REQ-R1 (relaxed requirement).

### MIS-2 — MSH version 2.2 (XCN.7 Degree field semantics differ)

PV1-7 XCN.7 = `MD` is a Degree code. In v2.2/v2.5 XCN.7 is IS (Degree, e.g., MD). In v2.8.2 XCN.7 is deprecated (W). The existing `convertXCNToPractitioner` ignores XCN.7 (degree) for practitioner generation — no impact.

### MIS-3 — PV1-36 Discharge Disposition is bare IS code, not CWE

In v2.5, PV1-36 is `IS`. The existing `buildEncounterFromPV1` already handles this as a bare string: `hospitalization.dischargeDisposition = { coding: [{ code: pv1.$36_dischargeDisposition }] }`. No gap — existing code is compatible.

### MIS-4 — PV2-21 non-standard value `!`

PV2-21 (Visit Publicity Code) maps to `Encounter.meta.security` via `ID[Coding]` / `Yes/NoIndicator`. The value `!` is not a valid HL7 Table 0136 (Y/N) code. Must be silently skipped rather than producing an invalid Coding. This field is not implemented in the existing `buildEncounterFromPV1` (PV2 is not currently processed at all). A new PV2 processor would need to guard against this.

### MIS-5 — No DG1, AL1, NK1, or IN1 in example message

Example only has MSH+EVN+PID+PV1+PV2. The converter must handle these optional segments gracefully (zero iterations), which mirrors the A01 pattern exactly.

---

## Preprocessor Requirements

### REQ-P1 — `fix-pv1-authority-with-msh` on PV1-19

Same preprocessor as A01. If PV1-19 is present but lacks CX.4 authority, inject `MSH-3/MSH-4` namespace. In the example message PV1-19 is absent — the preprocessor is a no-op. Must be registered under `messages["ADT-A03"].preprocess.PV1["19"]` in `config/hl7v2-to-fhir.json`.

### REQ-P2 — `move-pid2-into-pid3` / `inject-authority-from-msh` on PID

Same preprocessors as A01. The example message has PID-2 populated (`90000001^^OCCAM^PE`). The `move-pid2-into-pid3` preprocessor should be applied for senders that use PID-2 for alternate identifiers. Register under `messages["ADT-A03"].preprocess.PID`.

---

## Relaxed Requirements (Proposal)

### REQ-R1 — [Proposal] When PV1-19 absent, derive Encounter ID from PID patient ID + admit timestamp

**Normative position:** PV1-19 is the encounter identifier. If absent, the IG provides no fallback.

**Proposed relaxation:** If PV1-19 is absent (or `buildEncounterIdentifier` returns `identifierError`):
1. Derive a synthetic encounter ID: `{patientId}-{sanitized-admit-datetime}` where admit datetime comes from PV1-44, or if absent, MSH-7 (message date).
2. Set `Encounter.id` to the derived value. Do NOT add it to `Encounter.identifier` (that array should only contain real identifiers from the message).
3. Set encounter status to `conversion_error` if neither PV1-44 nor MSH-7 is available (no basis for any ID).

**Risk:** If an A01 and a subsequent A03 for the same visit use different MSH-7 values, they will generate different encounter IDs and the A03 will create a duplicate Encounter instead of updating the existing one. This is a known patient safety concern for systems that rely on Encounter continuity. The fallback should only be enabled via config (`converter.PV1.required = false`) so senders that do send PV1-19 are not affected.

**Alternative (safer):** Use the PV1-44 admit datetime as the ID suffix — this is stable across A01/A03 pairs from the same sender as long as the admit time does not change. Prefer PV1-44 over MSH-7.

### REQ-R2 — [Proposal] When PV1-19 absent, warn (not error) if `pv1Required = false`

Mirror the A01 config-driven PV1 policy: if `config.messages["ADT-A03"].converter.PV1.required = false`, a missing/invalid PV1-19 produces a `warning` status rather than `conversion_error`, and the Encounter is still created with the synthetic ID.

**Risk:** Silent encounter ID instability (see REQ-R1). Must be clearly documented in config comments.

---

## Fallback Chains

### Encounter ID derivation

| Priority | Source | Condition | Result |
|---|---|---|---|
| 1 | PV1-19 (Visit Number) | CX.1 present + authority resolved | `{system}-{value}` (existing `buildEncounterIdentifier` logic) |
| 2 | PV1-44 (Admit DateTime) | PV1-44 non-empty | `{patientId}-{sanitizedAdmitDateTime}` |
| 3 | MSH-7 (Message DateTime) | MSH-7 non-empty | `{patientId}-{sanitizedMsgDateTime}` |
| 4 | None | All absent | `conversion_error` |

### Patient ID derivation

Identical to ADT_A01: `resolvePatientId(pid.$3_identifier)` via `src/v2-to-fhir/identity-system/patient-id.ts`. No A03-specific changes.

### Encounter.period.start

| Priority | Source | Condition |
|---|---|---|
| 1 | PV1-44 Admit Date/Time | Field non-empty |
| 2 | Absent | `period.start` omitted |

### Encounter.period.end

| Priority | Source | Condition |
|---|---|---|
| 1 | PV1-45 Discharge Date/Time | Field non-empty |
| 2 | EVN-2 Recorded Date/Time | PV1-45 absent (fallback for retroactive updates) |
| 3 | Absent | `period.end` omitted — Encounter is `finished` but without an end timestamp |

> **EDG-1:** PV1-45 absent in an A03 message is unusual but valid per spec (field is optional). The Encounter should still be set to `finished` (REQ-1) even without a `period.end`. Do not treat missing PV1-45 as an error.

### Encounter.class

| Priority | Source | Condition |
|---|---|---|
| 1 | PV1-2 via `PATIENT_CLASS_MAP` | Standard code |
| 2 | PV1-2 via ConceptMap lookup | Non-standard sender code |
| 3 | `FALLBACK_ENCOUNTER_CLASS` (AMB) | No mapping found → `mappingError` returned; `code_mapping_error` status |

### Encounter.hospitalization.dischargeDisposition

| Priority | Source | Condition |
|---|---|---|
| 1 | PV1-36 | Field non-empty |
| 2 | Absent | `hospitalization.dischargeDisposition` omitted |

---

## Acceptance Criteria for Implementation

### EDG-2 — A03 with PV1-19 present: updates existing Encounter

If the same Visit Number was established by an A01, the A03 MUST resolve to the same Encounter ID. The upsert logic in the FHIR transaction bundle handles this — no special A03 logic needed as long as `Encounter.id` is stable.

### EDG-3 — A03 with PV1-45 absent: Encounter is still `finished`

A message with no discharge datetime must still produce `Encounter.status = "finished"`. Status is driven by the A03 trigger event, not by field presence.

### EDG-4 — A03 with PV1-2 unmappable patient class: `code_mapping_error`

Same behavior as A01: create Task for code mapping, return `code_mapping_error` status. Do not block conversion for this.

### EDG-5 — A03 with PV1 missing: `conversion_error` (default) or `warning` (if configured)

Mirrors A01 PV1 optionality policy. Default is `pv1Required = true` → `conversion_error`. Config override: `pv1Required = false` → `warning`, Patient still saved.

### EDG-6 — A03 with PID missing: `conversion_error`

PID is mandatory. Throw immediately.

### EDG-7 — A03 PV2 fields processed without blocking

PV2-3 (admit reason) and PV2-11 (length of stay) are incorporated into Encounter. If PV2 is absent, these fields are simply omitted — no error or warning.

### EDG-8 — Smoke test: example-01.hl7 converts to Patient + Encounter with status `finished`

A smoke test (`smoke: ADT_A03 discharge`) must verify: (1) status `processed` or `warning`, (2) `Encounter.status = "finished"`, (3) `Encounter.period.end` set from PV1-45, (4) `Patient` created/updated.

---

## Open Questions / Unknowns

**OQ-1 — Encounter upsert vs create on A03 when no prior A01 exists.**
If an A03 arrives without a preceding A01 (standalone discharge), the converter creates a new Encounter. This is clinically unusual but technically valid. The FHIR transaction upsert (PUT) will create it. No special handling needed — document as expected behavior.

**OQ-2 — PV2 segment converter: new function or inline in A03?**
There is no existing `pv2-encounter.ts` segment converter. PV2 fields mapped to Encounter (PV2-3, PV2-11, PV2-12, PV2-25) could be added inline in the A03 converter or extracted to a shared `pv2-encounter.ts` for future reuse by other ADT event types. Recommendation: create `src/v2-to-fhir/segments/pv2-encounter.ts` for reusability, but this is a scope decision for the implementation plan.

**OQ-3 — Encounter ID fallback stability across A01/A03 pairs.**
If REQ-R1 fallback is adopted (PV1-44-based ID), the A01 converter must also use the same fallback scheme — otherwise A01 and A03 generate different IDs and the A03 produces a second Encounter. This requires a coordinated change to A01 as well, or a decision that the fallback is A03-only (accepting the duplicate risk for these senders).

---

# Implementation Plan

## Overview

Build ADT_A03 converter following ADT_A01 pattern. Key difference: unconditionally set `Encounter.status = "finished"` (REQ-1), and require PV1-19 for Encounter ID with no fallback (same behavior as A01 default). Reuse existing segment converters (Patient, Encounter, RelatedPerson, Condition, AllergyIntolerance, Coverage) and registration pattern.

## Validation

- `bun test:local` (unit + smoke tests)
- `bun run typecheck`

## Task 1: Create adt-a03.ts converter

- [x] Create `src/v2-to-fhir/messages/adt-a03.ts`
- [x] Import: `convertPIDToPatient`, `convertNK1ToRelatedPerson`, `convertDG1ToCondition`, `convertAL1ToAllergyIntolerance`, `convertIN1ToCoverage`, `convertPV1WithMappingSupport`, `buildEncounterIdentifier`, `resolvePatientId`
- [x] Export `convertADT_A03(parsed: HL7v2Message, context: ConverterContext): Promise<ConversionResult>`
- [x] Signature mirrors `convertADT_A01`; return type `ConversionResult` with `entries: DomainResource[]`
- [x] Core logic:
  - Call `convertPV1WithMappingSupport(...)` with PV1 from parsed message
  - Override returned `encounter.status = "finished"` (REQ-1, not conditional on PV1-45 presence)
  - Reuse Encounter identifier from PV1-19 via `buildEncounterFromPV1`; no fallback chain (PV1 required)
  - Build Patient from PID via `convertPIDToPatient` (required)
  - Add optional segments: NK1→RelatedPerson[], DG1→Condition[], AL1→AllergyIntolerance[], IN1→Coverage[]
  - Assemble and return transaction bundle
- [x] Handle PV2 fields inline (PV2-11 length of stay, PV2-12 description) — incorporate into Encounter if present; omit if absent (no error)
- [x] Run `bun run typecheck` — must pass
- [x] Stop for review

## Task 2: Register converter in router

- [x] Open `src/v2-to-fhir/converter.ts`
- [x] Add import: `import { convertADT_A03 } from "./messages/adt-a03"`
- [x] Add switch case: `case "ADT_A03": return await convertADT_A03(parsed, context);` (alphabetically after ADT_A01)
- [x] Open `src/v2-to-fhir/messages/index.ts`
- [x] Add export: `export * from "./adt-a03"`
- [x] Run `bun run typecheck` — must pass
- [x] Stop for review

## Task 3: Configure ADT_A03 in config

- [x] Open `config/hl7v2-to-fhir.json`
- [x] Add `"ADT-A03"` config block (after `"ADT-A01"`) with:
  - `preprocess.PID`: Apply `move-pid2-into-pid3`, `inject-authority-from-msh` (same as A01; per REQ-P2)
  - `preprocess.PV1`: Apply `fix-pv1-authority-with-msh` on field `"19"` (per REQ-P1)
  - `converter.PV1.required: true` (no fallback; PV1 mandatory)
- [x] Run `bun run typecheck` — must pass
- [x] Stop for review

## Task 4: Write unit tests

- [ ] Create `test/unit/v2-to-fhir/messages/adt-a03.test.ts`
- [ ] Test structure mirrors `adt-a01.test.ts`:
  - Import `{ parseMessage, convertADT_A03 }` and test utilities
  - Describe block: `"convertADT_A03 - discharge converter"`
  - Test 1: "with valid PV1-19 creates Encounter with status finished" — parse example message, convert, assert `messageUpdate.status === "processed"`, Encounter.status === "finished", period.end from PV1-45
  - Test 2: "with missing PV1-19 returns conversion_error" — omit PV1-19, assert `conversion_error` status
  - Test 3: "with valid NK1/DG1/AL1/IN1 includes all resource types" — add optional segments, assert array lengths
- [ ] Test 4: Smoke test (name prefix `"smoke: ADT_A03 discharge"`) using de-identified example-01.hl7 from `ai/tickets/converter-skill-tickets/adt-a03-discharge/examples/` — assert status `processed` or `warning`, Encounter.status `finished`, Patient created
- [ ] Run `bun test:local` — must pass
- [ ] Stop for review

## Task 5: Validate against real message

- [ ] Run `bun scripts/check-message-support.ts ai/tickets/converter-skill-tickets/adt-a03-discharge/examples/example-01.hl7`
- [ ] Verify output: `verdict: supported — message converts cleanly` (exit code 0)
- [ ] Run `bun test:all` locally to ensure no regressions in other converters
- [ ] Stop for review before merge

## Task 6: Cleanup

- [ ] Update CLAUDE.md if converter patterns changed (none expected — this is straightforward reuse)
- [ ] Review code for unnecessary comments or debug statements
- [ ] Final `bun test:local` pass

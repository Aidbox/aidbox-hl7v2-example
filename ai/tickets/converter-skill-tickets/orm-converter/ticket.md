# Goal

Implement an HL7v2 ORM (Order Message) to FHIR converter. This converter will handle incoming ORM^O01 messages and convert them into appropriate FHIR resources (e.g., ServiceRequest, MedicationRequest, Condition, Observation, Patient, Encounter, Coverage) following the V2-to-FHIR IG mappings and existing project patterns.

## Example Messages

Located in: `ai/tickets/converter-skill-tickets/orm-converter/examples/`

---

# Requirements

## Scope

### Message Types/Events In Scope

- **ORM^O01** (General Order Message) -- the only trigger event for ORM. [REQ-SCOPE-1]
  - Evidence: All 6 example messages use MSH-9 = `ORM^O01`.
  - HL7v2 spec defines ORM_O01 in v2.3, v2.4, v2.5, v2.5.1. It was retired after v2.5.1 and does NOT exist in v2.8.2. (Evidence: `bun scripts/hl7v2-ref-lookup.ts ORM_O01 --version 2.8.2` returns "not found".)

- **ORDER_CHOICE variants in scope**:
  - OBR-based orders (diagnostic/lab/radiology orders) -> ServiceRequest [REQ-SCOPE-2]
  - RXO-based orders (pharmacy/medication orders) -> MedicationRequest [REQ-SCOPE-3]
  - Evidence: V2-to-FHIR IG message mapping (rows 4.2.1.1 and 4.2.1.7) defines both OBR->ServiceRequest and RXO->MedicationRequest.
  - Example messages 1-5 contain OBR-based orders; example 6 contains RXO-based orders.

- **Version coverage**: Real messages declare versions 2.3, 2.4, 2.5, 2.5.1. The converter must handle all of them. [REQ-SCOPE-4]
  - Evidence: MSH-12 values across examples: "2.3" (ex2, ex5), "2.4" (ex3, ex4), "2.5.1" (ex1). Example 6 has no version declared.

### Out-of-Scope Items

- RQD, RQ1, ODS, ODT order choice variants (no example messages; rare in practice). [REQ-SCOPE-5]
- FT1 (Financial Transaction), CTI (Clinical Trial), BLG (Billing) segments. [REQ-SCOPE-6]
- PV2 (Patient Visit Additional), GT1 (Guarantor), AL1 (Allergy) segments. [REQ-SCOPE-7]
  - Note: GT1 and AL1 appear in the v2.5 message structure but none of the 6 examples contain them. Can be added later.
- Task resource creation from ORC (the IG notes Task should only be created when the receiver is the intended filler). [REQ-SCOPE-8]
  - Evidence: V2-to-FHIR IG message mapping row 4.1 note: "The creation of a Task resource...should only happen when the receiving system is responsible for fulfillment."
- Provenance resource creation (ORC[Provenance], MSH[Provenance]). Deferred for consistency with existing converters. [REQ-SCOPE-9]

---

## Normative Mapping Requirements (Spec/IG-Based)

### Message Structure (v2.5 Spec)

The ORM_O01 message structure is (from `bun scripts/hl7v2-ref-lookup.ts ORM_O01 --version 2.5`):

```
MSH [1..1]
NTE [0..*]                           -- header-level notes (out of scope)
PATIENT [0..1]
  PID [1..1]
  PD1 [0..1]
  NTE [0..*]                         -- patient notes (out of scope)
  PATIENT_VISIT [0..1]
    PV1 [1..1]
    PV2 [0..1]
  INSURANCE [0..*]
    IN1 [1..1]
    IN2 [0..1]
    IN3 [0..1]
  GT1 [0..1]
  AL1 [0..*]
ORDER [1..*]
  ORC [1..1]
  ORDER_DETAIL [0..1]
    ORDER_CHOICE [1..1]              -- OBR | RQD | RQ1 | RXO | ODS | ODT
    NTE [0..*]                       -- order notes
    CTD [0..1]
    DG1 [0..*]                       -- diagnoses
    OBSERVATION [0..*]
      OBX [1..1]
      NTE [0..*]                     -- observation notes
  FT1 [0..*]
  CTI [0..*]
  BLG [0..1]
```

### FHIR Resource Outputs per IG Message Mapping

Source: `docs/v2-to-fhir-spec/mappings/messages/HL7 Message - FHIR R4_ ORM_O01 - Sheet1.csv`

| HL7v2 Source | FHIR Resource | Condition | Evidence (IG Row) |
|---|---|---|---|
| MSH | Bundle | always | 1 |
| MSH | MessageHeader[1] | always | 1 |
| PID | Patient[1] | always (when PATIENT present) | 3.1 |
| PD1 | Patient[1] (merge) | if PD1 present | 3.2 |
| PV1 | Encounter[1] | if PATIENT_VISIT present | 3.4.1 |
| IN1 | Coverage[1] | per INSURANCE group | 3.5.1 |
| ORC | ServiceRequest[1] | per ORDER group | 4.1 |
| OBR | ServiceRequest[1] (merge) | if ORDER_CHOICE is OBR | 4.2.1.1 |
| RXO | MedicationRequest | if ORDER_CHOICE is RXO | 4.2.1.7 |
| NTE (order-level) | ServiceRequest[1].note | per NTE in ORDER_DETAIL (IG-defined) | 4.2.2 |
| DG1 | Condition | per DG1, referenced from ServiceRequest.reasonReference (IG-defined) | 4.2.4 |
| OBX (in ORDER_DETAIL) | Observation[1] | per OBSERVATION group; linked via ServiceRequest.supportingInfo (IG-defined) | 4.2.5.1 |

**Note on RXO-based order linkages**: The IG message mapping rows 4.2.2, 4.2.4, and 4.2.5.1 all reference `ServiceRequest[1]` as the linkage target. When the ORDER_CHOICE is RXO, there is no ServiceRequest -- only a MedicationRequest. The IG does not explicitly define NTE/DG1/OBX linkage for RXO orders. As an implementation extension (not spec-mandated), we map these to the equivalent MedicationRequest fields: NTE -> `MedicationRequest.note`, DG1 -> `MedicationRequest.reasonReference(Condition)`, OBX -> `MedicationRequest.supportingInformation(Observation)`. All three FHIR R4 fields exist on MedicationRequest and serve the same semantic purpose. [REQ-RXO-LINKAGE-1]

### ORC -> ServiceRequest Mapping [REQ-ORC-1]

Source: `docs/v2-to-fhir-spec/mappings/segments/HL7 Segment - FHIR R4_ ORC[ServiceRequest] - ORC.csv`

| ORC Field | FHIR Path | Condition | Evidence |
|---|---|---|---|
| ORC-1 (Order Control) | ServiceRequest.status | IF ORC-5 NOT VALUED, use OrderControlCode[ServiceRequest.status] vocab map | Row 1 |
| ORC-1 | ServiceRequest.intent | always = "order" | Row 1 |
| ORC-2 (Placer Order Number) | ServiceRequest.identifier[PLAC] | IF OBR-2 NOT VALUED | Row 2 |
| ORC-3 (Filler Order Number) | ServiceRequest.identifier[FILL] | IF OBR-3 NOT VALUED | Row 3 |
| ORC-4 (Placer Group Number) | ServiceRequest.requisition | always (EI type) | Row 4 |
| ORC-5 (Order Status) | ServiceRequest.status | if valued, use OrderStatus vocab map | Row 5 |
| ORC-9 (Date/Time of Transaction) | ServiceRequest.authoredOn | IF ORC-1 = "NW" | Row 9 |
| ORC-12 (Ordering Provider) | ServiceRequest.requester -> PractitionerRole.practitioner(Practitioner) | always | Row 12 |
| ORC-14 (Call Back Phone Number) | extension servicerequest-order-callback-phone-number | IF OBR-17 NOT VALUED | Row 14 |
| ORC-21 (Ordering Facility Name) | ServiceRequest.requester -> PractitionerRole.organization(Organization) | if valued | Row 21 |
| ORC-22 (Ordering Facility Address) | ServiceRequest.requester -> PractitionerRole.organization(Organization.address) | if valued | Row 22 |
| ORC-23 (Ordering Facility Phone) | ServiceRequest.requester -> PractitionerRole.organization(Organization.telecom) | if valued | Row 23 |
| ORC-29 (Order Type) | ServiceRequest.locationCode | if valued | Row 29 |

**Status Resolution Logic** [REQ-ORC-STATUS-1]:
- IF ORC-5 is valued: use `OrderStatus` concept map (Table 0038 -> FHIR request-status). If ORC-5 value not in standard map, use `orc-status` mapping type for ConceptMap-based resolution per sender.
- IF ORC-5 is NOT valued: use ORC-1 `OrderControlCode[ServiceRequest.status]` concept map (Table 0119 -> FHIR request-status)
- IF neither ORC-5 nor ORC-1 yields a mapping: set ServiceRequest.status = "unknown"
- Evidence: ORC[ServiceRequest] rows 1 and 5.

**OrderStatus Vocabulary Map** (from `docs/v2-to-fhir-spec/mappings/codesystems/HL7 Concept Map_ OrderStatus - Sheet1.csv`):

| v2 Code | FHIR Status |
|---|---|
| CA | revoked |
| CM | completed |
| DC | revoked |
| ER | entered-in-error |
| HD | on-hold |
| IP | active |
| RP | revoked |
| SC | active |

**OrderControlCode Vocabulary Map** (from `docs/v2-to-fhir-spec/mappings/codesystems/HL7 Concept Map_ OrderControlCode[ServiceRequest.status] - Sheet1.csv`):

| v2 Code | FHIR Status | Notes |
|---|---|---|
| NW | active | New order |
| CA | active | Cancel request (in-flight) |
| OC | revoked | Order canceled |
| DC | revoked | Discontinue |
| HD | active | Hold request |
| OH | on-hold | Order held |
| HR | on-hold | On hold as requested |
| CR | revoked | Canceled as requested |
| DR | revoked | Discontinued as requested |
| SC | (empty - no mapping) | Status changed -- fallback to ORC-5 |

### OBR -> ServiceRequest Mapping [REQ-OBR-1]

Source: `docs/v2-to-fhir-spec/mappings/segments/HL7 Segment - FHIR R4_ OBR[ServiceRequest] - OBR.csv`

| OBR Field | FHIR Path | Condition | Evidence |
|---|---|---|---|
| OBR-2 (Placer Order Number) | ServiceRequest.identifier[PLAC] | IF ORC-2 NOT VALUED | Row 2 |
| OBR-3 (Filler Order Number) | ServiceRequest.identifier[FILL] | IF ORC-3 NOT VALUED | Row 3 |
| OBR-4 (Universal Service ID) | ServiceRequest.code | always (CWE->CodeableConcept) | Row 4 |
| OBR-5 (Priority) | ServiceRequest.priority | if valued | Row 5 |
| OBR-6 (Requested Date/Time) | ServiceRequest.occurrenceDateTime | if valued | Row 6 |
| OBR-11 (Specimen Action Code) | ServiceRequest.intent override | "G" -> "reflex-order"; "A" -> "order" (see note below); else "order" | Row 11 |
| OBR-16 (Ordering Provider) | ServiceRequest.requester(Practitioner) | IF ORC-12 NOT VALUED | Row 16 |
| OBR-17 (Order Callback Phone) | extension servicerequest-order-callback-phone-number | if valued | Row 17 |
| OBR-27 (Quantity/Timing) | ServiceRequest (TQ mapping) | IF ORC-7 NOT VALUED | Row 27 |
| OBR-31 (Reason for Study) | ServiceRequest.reasonCode | if valued | Row 31 |
| OBR-46 (Placer Supplemental Service Info) | ServiceRequest.orderDetail | if valued | Row 46 |

**OBR-11 "A" (add-on) intent note**: The IG maps OBR-11="A" to the non-standard value `#add-on#`, which is NOT a valid FHIR `ServiceRequest.intent` code. Valid R4 intent codes are: proposal, plan, directive, order, original-order, reflex-order, filler-order, instance-order, option. Since `#add-on#` is not representable without a custom extension and no example messages use OBR-11="A", we map "A" to the default `"order"` for v1. This can be extended later with a custom extension if a real need arises.

### RXO -> MedicationRequest Mapping [REQ-RXO-1]

Source: `docs/v2-to-fhir-spec/mappings/segments/HL7 Segment - FHIR R4_ RXO[MedicationRequest] - Sheet1.csv`

| RXO Field | FHIR Path | Condition | Evidence |
|---|---|---|---|
| (fixed) | MedicationRequest.intent | always = "original-order" | Row 0 |
| RXO-1 (Requested Give Code) | MedicationRequest.medication(Medication.code) | if valued | Row 1 |
| RXO-2 (Requested Give Amount Min) | dosageInstruction.doseAndRate.doseRange.low.value | if valued | Row 2 |
| RXO-3 (Requested Give Amount Max) | dosageInstruction.doseAndRate.doseRange.high.value | if valued | Row 3 |
| RXO-4 (Requested Give Units) | dosageInstruction.doseAndRate.doseRange.low.code / .high.code | if RXO-2 valued | Row 4 |
| RXO-5 (Requested Dosage Form) | medication(Medication.doseForm) | if valued | Row 5 |
| RXO-9 (Allow Substitutions) | substitution.allowedCodeableConcept | if valued | Row 9 |
| RXO-11 (Requested Dispense Amount) | dispenseRequest.quantity.value | if valued | Row 11 |
| RXO-12 (Requested Dispense Units) | dispenseRequest.quantity.code | if valued | Row 12 |
| RXO-13 (Number of Refills) | dispenseRequest.numberOfRepeatsAllowed | if valued | Row 13 |
| RXO-14 (Ordering Provider DEA) | requester(Practitioner) | if valued | Row 14 |
| RXO-18 (Requested Give Strength) | medication(Medication.ingredient.strength.numerator.value) | if valued | Row 18 |
| RXO-19 (Requested Give Strength Units) | medication(Medication.ingredient.strength.numerator.code) | if valued | Row 19 |
| RXO-25 (Requested Drug Strength Volume) | medication(Medication.ingredient.strength.denominator.value) | if valued | Row 25 |
| RXO-26 (Requested Drug Strength Volume Units) | medication(Medication.ingredient.strength.denominator.code) | if valued | Row 26 |

### DG1 -> Condition Mapping [REQ-DG1-1]

Source: `docs/v2-to-fhir-spec/mappings/segments/HL7 Segment - FHIR R4_ DG1[Condition] - Sheet1.csv`

| DG1 Field | FHIR Path | Condition | Evidence |
|---|---|---|---|
| DG1-3 (Diagnosis Code) | Condition.code (CWE->CodeableConcept) | always | Row 3 |
| DG1-4 (Diagnosis Description) | Condition.code.text | if valued | Row 4 |
| DG1-5 (Diagnosis Date/Time) | Condition.onsetDateTime | if valued | Row 5 |
| DG1-16 (Diagnosing Clinician) | Condition.asserter(Practitioner) | if valued | Row 16 |
| DG1-19 (Attestation Date/Time) | Condition.recordedDate | if valued | Row 19 |
| DG1-20 (Diagnosis Identifier) | Condition.identifier (EI->Identifier) | if valued | Row 20 |
| DG1-21 (Diagnosis Action Code) | Condition.verificationStatus = "entered-in-error" | if "D" (delete) | Row 21 |

### NTE -> ServiceRequest.note Mapping [REQ-NTE-1]

Source: `docs/v2-to-fhir-spec/mappings/segments/HL7 Segment - FHIR R4_ NTE[ServiceRequest] - NTE.csv`

| NTE Field | FHIR Path | Condition | Evidence |
|---|---|---|---|
| NTE-3 (Comment) | ServiceRequest.note.text (markdown) | if valued | Row 3 |
| NTE-4 (Comment Type) | extension noteType (CodeableConcept) | if valued | Row 4 |
| NTE-5 (Entered By) | note.authorReference(Practitioner) | if valued | Row 5 |
| NTE-6 (Entered Date/Time) | note.time | if valued | Row 6 |

### OBX -> Observation Mapping [REQ-OBX-1]

Source: `docs/v2-to-fhir-spec/mappings/segments/HL7 Segment - FHIR R4_ OBX[Observation] - OBX.csv`

The OBX segments within ORDER_DETAIL.OBSERVATION map to standalone Observation resources linked via `ServiceRequest.supportingInfo`. Key fields:

| OBX Field | FHIR Path | Evidence |
|---|---|---|
| OBX-3 (Observation Identifier) | Observation.code (CWE->CodeableConcept) | Row 3 |
| OBX-5 (Observation Value) | Observation.value[x] (type-dependent on OBX-2) | Row 5 |
| OBX-11 (Result Status) | Observation.status | Row 11 |
| OBX-14 (Date/Time of Observation) | Observation.effectiveDateTime | Row 14 |

**Important**: Unlike ORU_R01, OBX in ORM context are supporting observations (ask-at-order-entry questions, clinical context), NOT lab results. They are NOT subject to LOINC resolution via ConceptMap. [REQ-OBX-NOLOINC-1]
- Evidence: ORM OBX segments carry order context, not results. The message mapping row 4.2.5.1 links to `ServiceRequest.supportingInfo`, not to a DiagnosticReport.
- Rationale: Forcing LOINC resolution on order-context OBX codes would create unnecessary mapping_error blocks on order messages.

### IN1 -> Coverage Mapping [REQ-IN1-1]

Source: `docs/v2-to-fhir-spec/mappings/segments/HL7 Segment - FHIR R4_ IN1[Coverage] - Sheet1.csv`

Key fields:

| IN1 Field | FHIR Path | Evidence |
|---|---|---|
| IN1-2 (Health Plan ID) | Coverage.identifier | Row 2 |
| IN1-4 (Insurance Company Name) | Coverage.payor(Organization) | Row 4 |
| IN1-5 (Insurance Company Address) | payor(Organization.address) | Row 5 |
| IN1-12 (Plan Effective Date) | Coverage.period.start | Row 12 |
| IN1-13 (Plan Expiration Date) | Coverage.period.end | Row 13 |
| IN1-15 (Plan Type) | Coverage.type | Row 15 |
| IN1-17 (Insured's Relationship) | Coverage.relationship | Row 17 |
| IN1-36 (Policy Number) | (deferred, not in IG) | Row 36 |

### PID -> Patient [REQ-PID-1]

Reuse existing `convertPIDToPatient()` from `src/v2-to-fhir/segments/pid-patient.ts`. Same behavior as ORU/ADT converters.

### PV1 -> Encounter [REQ-PV1-1]

Reuse existing `convertPV1ToEncounter()` from `src/v2-to-fhir/segments/pv1-encounter.ts`. ORM should follow ORU PV1 policy: PV1 optional; if PV1 missing or PV1-19 invalid, skip Encounter and continue with warning status.

---

## Real Message Profile

### Segment Presence Matrix

Based on analysis of all 6 example messages:

| Segment | Ex1 | Ex2 | Ex3 | Ex4 | Ex5 | Ex6 | Frequency |
|---|---|---|---|---|---|---|---|
| MSH | Y | Y | Y | Y | Y | Y | 6/6 (always) |
| PID | Y | Y | Y | Y | Y | Y | 6/6 (always) |
| PD1 | Y | N | N | N | N | N | 1/6 (rare) |
| PV1 | Y | Y | Y | Y | Y | Y* | 6/6 (always, but ex6 PV1 is empty) |
| IN1 | N | Y(1) | N | N | N | Y(3) | 2/6 (uncommon, can repeat) |
| ORC | Y | Y | Y | Y | Y | Y | 6/6 (always) |
| OBR | Y | Y(2) | Y | Y | Y | N | 5/6 (most) |
| RXO | N | N | N | N | N | Y | 1/6 (medication orders) |
| DG1 | Y(1) | Y(2) | Y(1) | Y(2) | N | Y(6) | 5/6 (common, can repeat) |
| NTE | N | N | N | N | Y(2) | Y(6) | 2/6 (uncommon) |
| OBX | N | N | N | N | N | Y(6) | 1/6 (rare in ORM context) |

### Multiple Orders Per Message

- Example 2: 2 OBR-based orders in one message (OBR-1=1, OBR-1=2), each with its own DG1.
- Example 6: 2 RXO-based orders in one message, each with NTE, DG1, OBX groups.
- All other examples: single order per message. [REQ-MULTI-ORDER-1]

---

## Gaps Between Normative and Real

### GAP-1: ORC-1 Missing [MIS-1]

- **Spec**: ORC-1 (Order Control) is Required [R] in all versions.
- **Real**: Example 6 omits ORC-1 entirely.
- **Handling**: If ORC-1 missing and ORC-5 valued, derive status from ORC-5. If both missing, default to "unknown". [RELAX-1]

### GAP-2: Non-Standard ORC-5 Values [MIS-2]

- **Spec**: Table 0038 defines: A, CA, CM, DC, ER, HD, IP, RP, SC.
- **Real**: Ex1 uses "Final" (not in Table 0038). Ex2 uses "Pending" (not in Table 0038). Ex6 uses "SC" (valid).
- **Handling**: Non-standard ORC-5 values routed through `orc-status` mapping type (ConceptMap-based resolution per sender). If no mapping found, set mapping_error status with Task creation.

### GAP-3: OBR-25 Used in ORM Context [MIS-3]

- **Spec IG**: OBR[ServiceRequest] mapping explicitly notes OBR-25 is NOT mapped for ServiceRequest context.
- **Real**: Ex1 has OBR-25 = "Final".
- **Handling**: Ignored per IG.

### GAP-4: DG1-1 Set ID Violations [MIS-4]

- **Spec**: DG1-1 (Set ID) is Required [R].
- **Real**: Ex1 omits DG1-1 entirely. Ex4 has two DG1 segments both with Set ID = 1.
- **Handling**: Use positional index (1-based) within the order group for ID generation. Do not rely on DG1-1. [RELAX-2]

### GAP-5: DG1-2 Coding Method Not Used [MIS-5]

- **Real**: Values include "I10", "ICD", "ICD-10-CM". Ex6 omits DG1-2.
- **Handling**: DG1-2 is not mapped in the IG Condition mapping. No conversion impact. [RELAX-3]

### GAP-6: DG1-6 Diagnosis Type Not Used [MIS-6]

- **Real**: Only ex3 and ex4 populate DG1-6 with "ICD-9 to Order" (non-standard).
- **Handling**: DG1-6 is not mapped in the IG. No conversion impact. [RELAX-4]

### GAP-7: PV1 Empty or Minimal [MIS-7]

- **Real**: Ex6 has PV1 segment present but completely empty (`PV1|`). Ex5 has PV1-2 = "1" (non-standard).
- **Handling**: Empty PV1 treated as absent (no Encounter, status = "processed"). Non-standard PV1-2 routed through existing `patient-class` mapping type. [RELAX-6, RELAX-8]

### GAP-8: PV1-19 (Visit Number) Absent [MIS-8]

- **Real**: Only ex1 has PV1-19 populated. Others have no PV1-19.
- **Handling**: When PV1-19 absent, skip Encounter creation entirely. ORM does not use PID-18 as fallback. Status = "processed" (not "warning" -- PV1 is optional for ORM).

### GAP-9: ORC-3 Rarely Present [MIS-9]

- **Real**: Only ex1 has ORC-3. All others omit ORC-3 and OBR-3.
- **Handling**: Most ServiceRequests will have only PLAC identifier, not FILL. This is expected.

### GAP-10: OBX-11 Missing [MIS-10]

- **Real**: Ex6 OBX segments have no OBX-11 value.
- **Handling**: In ORM context, missing OBX-11 defaults Observation.status to "registered". [RELAX-5]

### GAP-11: PID-5 (Patient Name) Missing [MIS-11]

- **Real**: Ex6 does not populate PID-5.
- **Handling**: Allow empty PID-5. Create Patient without name. FHIR Patient.name is 0..*. [RELAX-7]

### GAP-12: ORC-2 / OBR-2 Identifier Format Inconsistency [MIS-12]

- **Real**: ORC-2 formats vary dramatically across examples.
- **Handling**: Extract EI.1 (entity identifier) as the primary value. If EI.2 (namespace) is present, include it in the deterministic ID. See FALL-1.

### GAP-13: DG1-3 Coding System Inconsistency [MIS-13]

- **Real**: DG1-3.3 varies: "I10", "ICD-10-CM". Ex6 has DG1-3 with only text component.
- **Handling**: Add "ICD-10-CM" as a new entry in `normalizeSystem()` mapping to `http://hl7.org/fhir/sid/icd-10-cm`. Keep existing "I10" -> `http://hl7.org/fhir/sid/icd-10` unchanged (see D-7 for rationale).

---

## Preprocessor Requirements

### PREP-1: No ORM-specific preprocessors required at this time

The ORM converter reuses existing preprocessors from config (PID-2/PID-3, PV1-19 authority fix from MSH). DG1 coding system normalization is handled in the global `normalizeSystem()` function, not a preprocessor.

---

## Fallback Chains

### ServiceRequest ID [FALL-1]

| Priority | Source | Precondition | ID Format |
|---|---|---|---|
| 1 | ORC-2 (Placer Order Number) | ORC-2.1 non-empty | `{ORC-2.1}` or `{ORC-2.1}-{ORC-2.2}` if namespace present |
| 2 | OBR-2 (Placer Order Number) | ORC-2 empty, OBR-2.1 non-empty | `{OBR-2.1}` or `{OBR-2.1}-{OBR-2.2}` if namespace present |
| FAIL | -- | Both empty | Reject order group with error |

### MedicationRequest ID [FALL-2]

| Priority | Source | Precondition | ID Format |
|---|---|---|---|
| 1 | ORC-2 (Placer Order Number) | ORC-2.1 non-empty | `{ORC-2.1}` or `{ORC-2.1}-{ORC-2.2}` if namespace present |
| FAIL | -- | ORC-2 empty | Reject order group with error |

### Condition ID [FALL-3]

| Priority | Source | Precondition | ID Format |
|---|---|---|---|
| 1 | DG1-20 (Diagnosis Identifier) | DG1-20.1 non-empty | `{DG1-20.1}` |
| 2 | Derived from order + DG1 position | DG1-20 empty | `{orderNumber}-dg1-{positional-index}` |

### Observation ID (supporting OBX in ORM) [FALL-4]

| Priority | Source | Precondition | ID Format |
|---|---|---|---|
| 1 | Derived from order + OBX position | Always | `{orderNumber}-obx-{positional-index}` |

### Patient ID [FALL-5]

Follow existing project pattern:
| Priority | Source | Precondition |
|---|---|---|
| 1 | PID-3 (Patient Identifier List) | Config-driven resolution via PatientIdResolver |
| 2 | PID-2 (Patient ID) | PID-3 yields no usable ID |
| FAIL | -- | Neither yields usable ID | Reject message |

### Encounter ID [FALL-6]

| Priority | Source | Precondition |
|---|---|---|
| 1 | PV1-19 (Visit Number) | PV1-19.1 non-empty and authority valid |
| SKIP | -- | PV1-19 not usable | Skip Encounter creation, status = processed |

### Coverage ID [FALL-7]

| Priority | Source | Precondition | ID Format |
|---|---|---|---|
| 1 | Reuse ADT `generateCoverageId()` | Always when IN1 present | `{patientId}-{payorId}` (payor from IN1-3 or IN1-4) |

Note: This aligns with the ADT converter's Coverage ID scheme (`{patientId}-{payorId}`) to prevent duplicate Coverage resources when the same patient is processed via both ADT and ORM. The existing `generateCoverageId()` function from `adt-a01.ts` should be extracted to a shared utility and reused.

---

## Acceptance Criteria

### Core Converter

- [AC-1] The converter registers as `ORM_O01` in `src/v2-to-fhir/converter.ts` and is routed correctly.
- [AC-2] All 6 example messages can be processed without crashing.
- [AC-3] OBR-based orders produce ServiceRequest resources with correct status, intent, identifiers, code, and provider references.
- [AC-4] RXO-based orders produce MedicationRequest resources with intent="original-order", medication code, dosage, and dispense information.
- [AC-5] DG1 segments produce Condition resources linked via ServiceRequest.reasonReference (IG-defined). For RXO orders, linked via MedicationRequest.reasonReference (implementation extension, see REQ-RXO-LINKAGE-1).
- [AC-6] NTE segments in ORDER_DETAIL produce ServiceRequest.note entries (IG-defined). For RXO orders, produce MedicationRequest.note entries (implementation extension, see REQ-RXO-LINKAGE-1).
- [AC-7] OBX segments in ORDER_DETAIL produce Observation resources linked via ServiceRequest.supportingInfo (IG-defined). For RXO orders, linked via MedicationRequest.supportingInformation (implementation extension, see REQ-RXO-LINKAGE-1).
- [AC-8] IN1 segments produce Coverage resources linked to Patient.
- [AC-9] Multiple ORDER groups in a single message produce separate ServiceRequest/MedicationRequest resources (verified with ex2 and ex6).
- [AC-10] Each produced resource has a deterministic ID per the Fallback Chain tables.

### Patient/Encounter Handling

- [AC-11] Patient lookup/draft creation follows existing ORU pattern (lookup by ID, create draft with active=false if not found).
- [AC-12] PV1 is optional for ORM. Missing PV1 or empty PV1 does not cause an error. No Encounter is created in that case.
- [AC-13] When PV1 is present and valid, Encounter is created following existing PV1 conversion logic.
- [AC-14] Non-standard PV1-2 values are routed through existing `patient-class` code mapping type.

### Status/Error Handling

- [AC-15] ServiceRequest.status and MedicationRequest.status derived from ORC-5 when valued (using OrderStatus map). When ORC-5 not valued, derived from ORC-1 (using OrderControlCode map). When neither yields a mapping, status = "unknown". The same resolution logic applies to both resource types (see D-1).
- [AC-16] Non-standard ORC-5 values ("Final", "Pending") that are not in OrderStatus map are handled via `orc-status` mapping type for ConceptMap-based resolution per sender.
- [AC-17] Missing MSH segment causes message rejection (status=error).
- [AC-18] Missing PID segment causes message rejection (status=error).
- [AC-19] PID without usable patient identifier causes message rejection (status=error).
- [AC-20] ORC without any identifiable order number (no ORC-2, no OBR-2) causes order group rejection. If all order groups fail, message status=error.
- [AC-21] OBX in ORM context does NOT go through LOINC resolution pipeline. OBX-3 is mapped directly to Observation.code as CodeableConcept.

### Testing

- [AC-22] All 6 example messages have corresponding unit tests verifying output resource types and counts.
- [AC-23] Integration test verifying end-to-end processing (MLLP receive -> processing -> FHIR resources in Aidbox).
- [AC-24] `bun test:all` passes after implementation.

---

# Implementation Design

## Key Decisions

### D-1: ORC Status Resolution -- Two-Tier with ConceptMap Fallback [REQ-ORC-STATUS-1, AC-15, AC-16]

ORC-based order status uses a three-tier resolution that applies to both ServiceRequest.status and MedicationRequest.status:
1. **ORC-5 standard map**: If ORC-5 is valued and matches Table 0038, use `ORDER_STATUS_MAP`.
2. **ORC-5 ConceptMap**: If ORC-5 is valued but NOT in Table 0038, attempt sender-specific ConceptMap lookup via new `orc-status` mapping type. If no mapping found, return `MappingError` (message gets `mapping_error` status with Task creation).
3. **ORC-1 fallback**: If ORC-5 is empty, use `ORDER_CONTROL_STATUS_MAP` from ORC-1. If ORC-1 is also empty or has no mapping (e.g., "SC"), set status = "unknown".

This follows the established pattern used by `obx-status` and `patient-class` mapping types.

**Shared `orc-status` mapping type**: The same `orc-status` mapping type is used for both ServiceRequest and MedicationRequest status resolution. The IG only defines `ORC[ServiceRequest]` segment mapping (no `ORC[MedicationRequest]` exists), but the same ORC-5 OrderStatus vocabulary applies to both resource types since MedicationRequest uses the same `medicationrequest-status` value set which overlaps with `request-status`. The mapping type metadata uses `target: { resource: "ServiceRequest", field: "status" }` as the canonical target; this is an intentional simplification since the mapping resolution logic is identical for both resources. The resolved status value (e.g., "active", "completed", "revoked") is passed from the order group processor to both `buildOBRServiceRequest()` and `buildRXOMedicationRequest()`.

### D-2: ORM OBX -- No LOINC Resolution [REQ-OBX-NOLOINC-1, AC-21]

ORM OBX segments map directly to `Observation.code` via `convertCEToCodeableConcept()` without LOINC resolution. Use `convertOBXWithMappingSupportAsync()` for status mapping only (handles OBX-11 ConceptMap lookup for non-standard values). Do NOT call `convertOBXToObservationResolving()` (which includes LOINC resolution).

When OBX-11 is missing in ORM context, default to `Observation.status = "registered"` rather than creating a mapping error. This is implemented by a small wrapper that provides the default before calling the mapping-aware function.

Note: The existing codebase has some duplication between `convertOBXToObservation()` (sync, no LOINC) and `convertOBXWithMappingSupportAsync()` (async, with status ConceptMap). The ORM wrapper adds another layer. This is a pre-existing concern; a future cleanup could consolidate these into a single configurable function.

### D-3: Encounter -- PV1-19 Only, No PID-18 Fallback [FALL-6, AC-12]

When PV1-19 is absent, Encounter creation is skipped entirely. No PID-18 fallback. Status remains "processed" (not "warning"), because PV1 is optional for ORM. Empty PV1 segments (e.g., `PV1|`) are treated as absent.

### D-4: Order Grouping -- ORC-Starts-Group Pattern [REQ-MULTI-ORDER-1]

ORM message segments are grouped by ORC boundaries. Each ORC starts a new ORDER group. Segments between ORCs belong to the current group. The ORDER_CHOICE type is detected by scanning for the first OBR or RXO segment within the group.

### D-5: ID Generation -- Placer-First with EI Namespace [FALL-1, FALL-2, AC-10]

ServiceRequest/MedicationRequest IDs are derived primarily from ORC-2 (Placer Order Number), with OBR-2 as fallback for OBR-based orders. The EI type extraction uses `sanitizeForId(ei.$1_value)` as the base, optionally appending `-{sanitizeForId(ei.$2_namespace)}` when the namespace is present and different from the value. This ensures uniqueness across senders with the same order numbers.

### D-6: Coverage Included [REQ-IN1-1, AC-8]

IN1 segments are processed using existing `convertIN1ToCoverage()` from ADT. Coverage IDs use the same scheme as ADT: `{patientId}-{payorId}` where payor is derived from IN1-3 (Insurance Company ID) or IN1-4 (Insurance Company Name). The existing `generateCoverageId()` function from `adt-a01.ts` should be extracted to a shared utility (e.g., `src/v2-to-fhir/segments/in1-coverage.ts`) and reused by both converters. This prevents duplicate Coverage resources when the same patient/insurance appears in both ADT and ORM messages.

### D-7: DG1-3 Coding System -- Additive Normalizer Update [GAP-13]

The global `normalizeSystem()` is updated additively: "ICD-10-CM" is added as a new entry mapping to `http://hl7.org/fhir/sid/icd-10-cm`. The existing "I10" -> `http://hl7.org/fhir/sid/icd-10` mapping is left unchanged to avoid breaking existing converters and tests (ADT fixtures use "ICD10"/"I10" with the expectation of `icd-10` international). This is a safe approach: ORM example messages that use "ICD-10-CM" explicitly will get the correct US clinical modification system, while messages using the ambiguous "I10" abbreviation continue to map to the international system. If a sender needs "I10" to mean ICD-10-CM, this can be handled via a sender-specific preprocessor or ConceptMap in the future.

### D-8: RXO Segment Type -- Manual Wrapper [GAP-C from exploration]

RXO is not in the generated HL7v2 types (ORM is pre-v2.8.2). A manual `RXO` interface and `fromRXO()` parser are created in `src/hl7v2/wrappers/rxo.ts`, following the same wrapper pattern as `src/hl7v2/wrappers/obx.ts`. Only fields needed for the IG mapping (RXO-1 through RXO-26 as specified in REQ-RXO-1) are typed.

---

## New Components

### `src/hl7v2/wrappers/rxo.ts` -- RXO Segment Wrapper

Manual RXO interface and `fromRXO()` parser. Fields mapped per REQ-RXO-1.

```typescript
export interface RXO {
  $1_requestedGiveCode?: CE;
  $2_requestedGiveAmountMin?: string;
  $3_requestedGiveAmountMax?: string;
  $4_requestedGiveUnits?: CE;
  $5_requestedDosageForm?: CE;
  $9_allowSubstitutions?: string;
  $11_requestedDispenseAmount?: string;
  $12_requestedDispenseUnits?: CE;
  $13_numberOfRefills?: string;
  $14_orderingProviderDea?: XCN[];
  $18_requestedGiveStrength?: string;
  $19_requestedGiveStrengthUnits?: CE;
  $25_requestedDrugStrengthVolume?: string;
  $26_requestedDrugStrengthVolumeUnits?: CWE;
}

export function fromRXO(segment: HL7v2Segment): RXO { ... }
```

The parser reads from `segment.fields[N]` and converts using existing `fromCE()`, `fromXCN()`, `fromCWE()` helpers, following the `fromOBX` wrapper pattern.

### `src/v2-to-fhir/segments/orc-servicerequest.ts` -- ORC->ServiceRequest Converter

New segment converter. Core function signature:

```typescript
export interface ORCServiceRequestResult {
  serviceRequest: Partial<ServiceRequest>;
  mappingError?: MappingError;
}

/**
 * Build partial ServiceRequest from ORC segment.
 * Returns base ServiceRequest with status, intent, identifiers, requester, etc.
 * Caller merges OBR fields on top.
 */
export async function convertORCToServiceRequest(
  orc: ORC,
  senderContext: SenderContext,
): Promise<ORCServiceRequestResult>
```

**Status resolution** is the core complexity. Extracted as a private function:

```typescript
// Three-tier resolution:
// 1. ORC-5 valued + in standard map -> use it
// 2. ORC-5 valued + NOT in standard map -> ConceptMap lookup via orc-status
// 3. ORC-5 empty -> ORC-1 control code map
// 4. Neither -> "unknown"
async function resolveServiceRequestStatus(
  orc: ORC,
  senderContext: SenderContext,
): Promise<{ status: ServiceRequest["status"]; mappingError?: MappingError }>
```

Standard maps are defined as constants:

```typescript
const ORDER_STATUS_MAP: Record<string, ServiceRequest["status"]> = {
  CA: "revoked", CM: "completed", DC: "revoked", ER: "entered-in-error",
  HD: "on-hold", IP: "active", RP: "revoked", SC: "active",
};

const ORDER_CONTROL_STATUS_MAP: Record<string, ServiceRequest["status"]> = {
  NW: "active", CA: "active", OC: "revoked", DC: "revoked",
  HD: "active", OH: "on-hold", HR: "on-hold", CR: "revoked", DR: "revoked",
};
```

ORC-12 (Ordering Provider) maps to `ServiceRequest.requester` as an inline display reference using `convertXCNToPractitioner()`. Note: the IG specifies the target as `requester(PractitionerRole.practitioner)`, meaning a PractitionerRole intermediate resource. For v1, we use a simplified inline Practitioner reference for consistency with existing converters (ORU, ADT). This can be extended to PractitionerRole if needed.

ORC-4 (Placer Group Number) maps to `ServiceRequest.requisition` (0..1, type `Identifier`) via EI conversion. Since `requisition` is singular, only the first ORC-4 value is used.

ORC-9 (Date/Time of Transaction) maps to `ServiceRequest.authoredOn` only when ORC-1 = "NW" (New Order). When ORC-1 has any other value or is empty, ORC-9 is not mapped to `authoredOn`. This condition is per IG row 9.

### `src/v2-to-fhir/segments/obr-servicerequest.ts` -- OBR->ServiceRequest Merger

Merges OBR data into a ServiceRequest created from ORC. Separate from existing `obr-diagnosticreport.ts` which produces DiagnosticReport for ORU.

```typescript
/**
 * Merge OBR fields into an existing ServiceRequest.
 * OBR provides: code (OBR-4), identifiers (OBR-2/3 fallback), priority (OBR-5),
 * occurrenceDateTime (OBR-6), intent override (OBR-11), reasonCode (OBR-31), etc.
 */
export function mergeOBRIntoServiceRequest(
  obr: OBR,
  serviceRequest: ServiceRequest,
  orc: ORC,
): void
```

Key fields:
- OBR-4 -> `code` via `convertCEToCodeableConcept()`
- OBR-2 -> `identifier[PLAC]` (only if ORC-2 empty, per IG condition)
- OBR-3 -> `identifier[FILL]` (only if ORC-3 empty)
- OBR-5 -> `priority` (mapped: S/A->stat, R->routine, T->urgent)
- OBR-6 -> `occurrenceDateTime` via `convertDTMToDateTime()`
- OBR-11 -> `intent` override: "G"->"reflex-order", "A"->"order" (IG maps to non-standard `#add-on#`; we use "order" default since add-on is not a valid FHIR intent code), else unchanged
- OBR-31 -> `reasonCode` via `convertCEToCodeableConcept()`

### `src/v2-to-fhir/segments/rxo-medicationrequest.ts` -- RXO->MedicationRequest Converter

```typescript
/**
 * Convert RXO segment to MedicationRequest.
 * Creates a MedicationRequest with intent="original-order".
 */
export function convertRXOToMedicationRequest(
  rxo: RXO,
  orc: ORC,
): MedicationRequest
```

Key mappings:
- `intent`: always "original-order" (per IG RXO[MedicationRequest] row 0)
- `status`: inherited from ORC resolution (passed in from the order group processor, not re-resolved). Uses the same three-tier `resolveServiceRequestStatus()` logic as OBR orders (see D-1). The IG does not define a separate `ORC[MedicationRequest]` segment mapping, so the `OrderStatus` and `OrderControlCode[ServiceRequest.status]` vocabulary maps are reused.
- RXO-1 -> `medicationCodeableConcept` via `convertCEToCodeableConcept()`
- RXO-2/3/4 -> `dosageInstruction[0].doseAndRate[0].doseRange` (low.value, high.value, units)
- RXO-5 -> not mapped to MedicationRequest directly (it maps to `Medication.form` which would require a contained Medication resource -- deferred for simplicity, store as extension or omit)
- RXO-9 -> `substitution.allowedCodeableConcept` (map "Y"/"T" to allowed, "N" to not allowed)
- RXO-11/12 -> `dispenseRequest.quantity`
- RXO-13 -> `dispenseRequest.numberOfRepeatsAllowed`
- RXO-18/19/25/26 -> Medication strength (requires contained Medication -- deferred for simplicity unless the implementation finds a straightforward approach)

Note on RXO-5, RXO-18/19/25/26: These map to `Medication` resource properties per the IG. The simplest approach is to use `medicationCodeableConcept` for the drug code (RXO-1) and skip the contained Medication for dose form and strength in v1. This can be extended later.

**RXO order linkages** (implementation extension, see REQ-RXO-LINKAGE-1): When the ORDER_CHOICE is RXO, the order group processor links NTE, DG1, and OBX to the MedicationRequest instead of a ServiceRequest:
- NTE -> `MedicationRequest.note` (same mapping as NTE[ServiceRequest].note)
- DG1-derived Conditions -> `MedicationRequest.reasonReference`
- OBX-derived Observations -> `MedicationRequest.supportingInformation`
This is handled in `processOrderGroup()` which detects the order type and links to the appropriate resource.

### `src/v2-to-fhir/messages/orm-o01.ts` -- Main Message Converter

The main converter function orchestrating the full ORM_O01 conversion:

```typescript
export async function convertORM_O01(
  parsed: HL7v2Message,
  context: ConverterContext,
): Promise<ConversionResult>
```

**High-level flow:**

```
convertORM_O01(parsed, context)
    |
    +-> parseMSH(parsed, "ORM_O01")           // reuse from msh-parsing.ts
    +-> parsePID(parsed)                        // reuse pattern from oru-r01.ts
    +-> extractSenderTag(pid) + addSenderTagToMeta()
    +-> handlePatient(pid, ...)                 // reuse from pid-patient.ts
    +-> parsePV1(parsed)                        // reuse from pv1-encounter.ts
    +-> handleEncounter(pv1, ..., "ORM-O01")    // reuse from pv1-encounter.ts
    |
    +-> processINSURANCE(parsed, patientId)     // IN1 -> Coverage[]
    +-> groupORMOrders(parsed)                  // ORC-based grouping
    |
    +-> for each ORDER group:
    |     +-> processOrderGroup(group, ...)
    |           +-> resolveOrderNumber(orc, obr)
    |           +-> detectOrderType(group)       // OBR or RXO
    |           +-> if OBR: buildOBRServiceRequest(orc, obr, sender)
    |           +-> if RXO: buildRXOMedicationRequest(orc, rxo)
    |           +-> processDG1s(group.dg1s, orderNumber, patientRef)
    |           +-> processNTEs(group.ntes) -> ServiceRequest/MedicationRequest.note
    |           +-> processOBXs(group.observations, orderNumber, sender)
    |           +-> link references
    |
    +-> collect mapping errors
    +-> if mapping errors: buildMappingErrorResult()
    +-> else: build transaction bundle
```

**Order grouping** (`groupORMOrders`):

```typescript
interface ORMOrderGroup {
  orc: HL7v2Segment;
  orderChoice?: HL7v2Segment;  // First OBR or RXO after ORC
  orderChoiceType: "OBR" | "RXO" | "unknown";
  ntes: HL7v2Segment[];
  dg1s: HL7v2Segment[];
  observations: Array<{ obx: HL7v2Segment; ntes: HL7v2Segment[] }>;
}
```

Walk through message segments sequentially:
- On `ORC`: start a new group (flush any pending observation to the previous group)
- On `OBR` or `RXO`: set as `orderChoice` for current group (detect type)
- On `NTE`: if after OBX, attach to current observation; else attach as order-level NTE
- On `DG1`: attach to current group
- On `OBX`: start a new observation entry in current group
- Segments before the first ORC (PID, PV1, IN1) are handled separately by the main function

---

## Affected Existing Components

| File | Change Type | Description |
|---|---|---|
| `src/v2-to-fhir/converter.ts` | Modify | Add `case "ORM_O01"` routing and import |
| `config/hl7v2-to-fhir.json` | Modify | Add `"ORM-O01"` entry with PID/PV1 preprocessors and `PV1.required: false` |
| `src/code-mapping/mapping-types.ts` | Modify | Add `"orc-status"` mapping type entry |
| `src/code-mapping/mapping-type-options.ts` | Modify | Add `"orc-status"` valid values (FHIR request-status codes) |
| `src/v2-to-fhir/code-mapping/coding-systems.ts` | Modify | Update `normalizeSystem()`: add "ICD-10-CM" -> `icd-10-cm` (keep "I10" -> `icd-10` unchanged) |
| `src/hl7v2/wrappers/index.ts` | Modify | Export `fromRXO` and `RXO` from new rxo.ts wrapper |
| `src/v2-to-fhir/segments/in1-coverage.ts` | Modify | Extract `generateCoverageId()` from `adt-a01.ts` into this shared module |
| `src/v2-to-fhir/messages/adt-a01.ts` | Modify | Import `generateCoverageId()` from `in1-coverage.ts` instead of defining locally |
| `test/integration/helpers.ts` | Modify | Add `getServiceRequests()`, `getMedicationRequests()` helper functions |

---

## Error/Warning/Mapping_Error Handling

### Error (status = "error") -- Message Rejected

| Condition | How Detected | Evidence |
|---|---|---|
| Missing MSH | `parseMSH()` throws | [AC-17] |
| Missing PID | `parsePID()` helper throws | [AC-18] |
| PID without usable patient ID | `handlePatient()` returns error | [AC-19] |
| All order groups fail (no ORC-2 or OBR-2 for any order) | Every `processOrderGroup()` returns error | [AC-20] |

### Warning (status = "warning")

| Condition | How Detected | Evidence |
|---|---|---|
| PV1-19 present but authority invalid | `handleEncounter()` returns warning | [REQ-PV1-1] |

### Mapping Error (status = "mapping_error")

| Condition | How Detected | Evidence |
|---|---|---|
| Non-standard ORC-5 value not in ConceptMap | `resolveServiceRequestStatus()` returns MappingError | [AC-16, D-1] |
| Non-standard PV1-2 value not in ConceptMap | `handleEncounter()` returns patientClassTaskEntry | [AC-14] |
| Non-standard OBX-11 value not in ConceptMap | `convertOBXWithMappingSupportAsync()` returns error | Existing pattern |

### Processed Normally (status = "processed")

| Condition | Evidence |
|---|---|
| PV1 missing entirely | [AC-12] |
| PV1 empty (no populated fields) | [RELAX-8] |
| PV1-19 missing (no Encounter created) | [FALL-6] |
| OBX-11 missing in ORM context (defaults to "registered") | [RELAX-5, D-2] |

---

## Edge Cases Handling

### EC-1: Empty PV1 Segment (`PV1|`) [RELAX-8, AC-12]

Detection: After parsing PV1 via `fromPV1()`, check if all fields are empty/undefined. If the parsed PV1 has no PV1-2 and no PV1-19, treat as absent. The existing `handleEncounter()` already handles absent PV1 gracefully when `required=false`.

Implementation: The existing `parsePV1()` returns `undefined` when there's no PV1 segment. For an empty PV1 segment like `PV1|`, the parser will return a PV1 object with all fields undefined. The key check is PV1-2 (patient class) -- when PV1-2 is empty, `extractPatientClass()` returns "U" which maps to `AMB` in the standard map. But PV1-19 will be empty, so `buildEncounterIdentifier()` will fail, and `handleEncounter()` will return no encounter (with warning). Since PV1 is not required for ORM, this warning is acceptable.

Actually, on closer examination: an empty PV1 means PV1-19 is missing, which means the encounter builder returns an identifier error. With `PV1.required=false`, this produces `warning` status per the existing `handleEncounter()` flow. This is slightly suboptimal -- an empty PV1 should be "processed", not "warning". To handle this, the ORM converter should detect empty PV1 before calling `handleEncounter()` and pass `undefined` instead.

**Implementation approach**: Add a helper `isEmptyPV1(pv1: PV1): boolean` that returns true when no meaningful fields are populated (PV1-2 empty AND PV1-19 empty AND no other clinical fields). If `isEmptyPV1(pv1)` is true, treat as absent PV1.

### EC-2: Multiple Orders with Different Types in Same Message [REQ-MULTI-ORDER-1, AC-9]

Example 6 has two RXO-based orders. Example 2 has two OBR-based orders. Each ORDER group is processed independently, producing its own ServiceRequest/MedicationRequest, Conditions, Observations, and NTEs. All are included in the same transaction bundle.

Theoretically, a message could mix OBR and RXO orders (though no example demonstrates this). The grouping logic handles this naturally since each ORC starts a new group and the order choice type is detected independently.

### EC-3: ORC Without ORDER_DETAIL [AC-20]

Per spec, ORDER_DETAIL is optional (0..1). An ORC without OBR or RXO following it produces no ServiceRequest/MedicationRequest. This order group is skipped with a warning log. If ALL order groups are skipped, the message gets `status=error` with a message like "No processable order groups found."

### EC-4: DG1 Deduplication Within Order Group [GAP-4]

Unlike ADT (where DG1 segments are message-level and may duplicate across encounters), ORM DG1 segments are scoped to their ORDER_DETAIL group. No cross-group deduplication is needed. Within a group, DG1 segments are processed sequentially and get positional IDs (`{orderNumber}-dg1-1`, `{orderNumber}-dg1-2`, etc.).

Ex4 has two DG1 segments with the same Set ID = 1 but different codes -- these produce two separate Condition resources with different positional IDs.

### EC-5: ORC-1 Empty with ORC-5 Non-Standard [GAP-1, GAP-2]

Ex6: ORC-1 is empty, ORC-5 = "SC". Since "SC" IS in the standard OrderStatus map (maps to "active"), this case is handled without ConceptMap lookup. The ORC-1 fallback is never reached.

If ORC-5 were a non-standard value and ORC-1 were empty, the ConceptMap lookup would be attempted for ORC-5. If that fails, status = "unknown" (no ORC-1 to fall back to).

### EC-6: ServiceRequest with Callback Phone Fallback [REQ-ORC-1, REQ-OBR-1]

Per IG, ORC-14 (callback phone) maps to ServiceRequest extension only "IF OBR-17 NOT VALUED". Conversely, OBR-17 maps unconditionally. The implementation checks: if OBR-17 is present, use OBR-17; otherwise, use ORC-14.

### EC-7: Ordering Provider Fallback [REQ-ORC-1, REQ-OBR-1]

Per IG, OBR-16 maps to ServiceRequest.requester only "IF ORC-12 NOT VALUED". The implementation checks: if ORC-12 is present, use ORC-12 for requester; otherwise, use OBR-16.

---

## Test Cases

### Unit Tests

Location: `test/unit/v2-to-fhir/messages/orm-o01.test.ts`

**Message-Level Tests** (using inline HL7v2 message strings, following ORU test pattern):

| Test | Validates | References |
|---|---|---|
| ORM with single OBR order produces ServiceRequest | Basic OBR->ServiceRequest conversion with correct resourceType, intent="order", code, identifiers | [AC-3, REQ-OBR-1] |
| ORM with single RXO order produces MedicationRequest | RXO->MedicationRequest with intent="original-order", medication code | [AC-4, REQ-RXO-1] |
| ORM with multiple OBR orders produces multiple ServiceRequests | Ex2 pattern: 2 ORCs + 2 OBRs -> 2 ServiceRequests with distinct IDs | [AC-9, REQ-MULTI-ORDER-1] |
| ORM with multiple RXO orders produces multiple MedicationRequests | Ex6 pattern: 2 ORCs + 2 RXOs -> 2 MedicationRequests | [AC-9] |
| DG1 segments produce Conditions linked via reasonReference | ServiceRequest.reasonReference contains Condition references | [AC-5, REQ-DG1-1] |
| NTE segments produce ServiceRequest.note entries | Order-level NTEs -> note array | [AC-6, REQ-NTE-1] |
| OBX segments produce Observations linked via supportingInfo | ServiceRequest.supportingInfo contains Observation references | [AC-7, REQ-OBX-1] |
| IN1 segments produce Coverage resources | Coverage with correct beneficiary and payor | [AC-8, REQ-IN1-1] |
| OBX in ORM context does NOT trigger LOINC resolution | Observation.code has original OBX-3 coding, no LOINC enrichment | [AC-21, REQ-OBX-NOLOINC-1] |
| Missing OBX-11 defaults to status=registered | In ORM context, empty OBX-11 -> Observation.status="registered" | [RELAX-5] |
| ServiceRequest.status from ORC-5 standard value ("SC") | ORC-5="SC" -> status="active" | [AC-15] |
| ServiceRequest.status from ORC-1 when ORC-5 empty | ORC-1="NW", ORC-5 empty -> status="active" | [AC-15] |
| ServiceRequest.status = "unknown" when both ORC-1 and ORC-5 empty | Neither valued -> status="unknown" | [AC-15, RELAX-1] |
| Missing PID rejects message | status="error" with appropriate error message | [AC-18] |
| Missing MSH rejects message | Throws Error (caught by processor-service) | [AC-17] |
| Missing ORC-2 and OBR-2 rejects order group | No processable identifier -> error for that group | [AC-20] |
| ORM without PV1 processes normally (status=processed) | No Encounter created, clinical data preserved | [AC-12] |
| ORM with empty PV1 processes normally | Empty PV1 treated as absent | [EC-1, RELAX-8] |
| ORM with valid PV1-19 creates Encounter | Encounter with correct ID from PV1-19 | [AC-13] |
| ORM with PV1 but no PV1-19 skips Encounter (status=processed) | PV1-2 present but PV1-19 absent -> no Encounter | [FALL-6] |
| Deterministic ServiceRequest ID from ORC-2 | ID = sanitized ORC-2.1 [-ORC-2.2] | [AC-10, FALL-1] |
| Deterministic Condition ID from order + position | ID = {orderNumber}-dg1-{index} | [AC-10, FALL-3] |
| Deterministic Observation ID from order + position | ID = {orderNumber}-obx-{index} | [AC-10, FALL-4] |
| OBR-4 maps to ServiceRequest.code | CWE->CodeableConcept | [REQ-OBR-1] |
| OBR-11 "G" overrides intent to "reflex-order" | intent changes from "order" to "reflex-order" | [REQ-OBR-1] |
| OBR-11 "A" keeps intent as "order" | "A" (add-on) does not change intent from default "order" (IG `#add-on#` is non-standard) | [REQ-OBR-1] |
| ORC-12 maps to ServiceRequest.requester | Practitioner display reference | [REQ-ORC-1] |
| OBR-16 used as requester fallback when ORC-12 empty | requester from OBR-16 | [EC-7] |
| RXO dosage mapping (dose range, dispense quantity) | dosageInstruction and dispenseRequest populated | [REQ-RXO-1] |
| Mixed order types: OBR + RXO in one message | One ORC+OBR + one ORC+RXO -> 1 ServiceRequest + 1 MedicationRequest | [EC-2] |
| NTE in RXO order maps to MedicationRequest.note | NTE segments produce note entries on MedicationRequest | [REQ-RXO-LINKAGE-1] |
| DG1 in RXO order maps to MedicationRequest.reasonReference | Condition linked via MedicationRequest.reasonReference | [REQ-RXO-LINKAGE-1] |
| OBX in RXO order maps to MedicationRequest.supportingInformation | Observation linked via MedicationRequest.supportingInformation | [REQ-RXO-LINKAGE-1] |

Location: `test/unit/v2-to-fhir/segments/orc-servicerequest.test.ts`

| Test | Validates |
|---|---|
| resolveServiceRequestStatus with standard ORC-5 values | Each Table 0038 code maps to correct FHIR status |
| resolveServiceRequestStatus with ORC-1 fallback | Each Table 0119 code maps correctly |
| resolveServiceRequestStatus with non-standard ORC-5 returns mapping error | MappingError with `mappingType: "orc-status"` |
| ORC-4 maps to requisition Identifier | EI conversion |
| ORC-9 maps to authoredOn when ORC-1="NW" | Date conversion |
| ORC-9 NOT mapped to authoredOn when ORC-1 != "NW" | ORC-1="CA" with ORC-9 valued -> authoredOn not set |
| ORC-29 maps to locationCode | CWE->CodeableConcept |

Location: `test/unit/v2-to-fhir/segments/rxo-medicationrequest.test.ts`

| Test | Validates |
|---|---|
| RXO-1 maps to medicationCodeableConcept | CE->CodeableConcept |
| RXO-2/3/4 maps to dosageInstruction doseRange | Low, high, units |
| RXO-9 maps to substitution | "T"->allowed, "N"->not allowed |
| RXO-11/12 maps to dispenseRequest quantity | Value and units |
| RXO-13 maps to numberOfRepeatsAllowed | Number conversion |

### Integration Tests

Location: `test/integration/v2-to-fhir/orm-o01.integration.test.ts`

Test fixtures: `test/fixtures/hl7v2/orm-o01/` (copied from example messages with de-identification verified)

| Test | Description | Fixture |
|---|---|---|
| Happy path: single OBR order E2E | Submit ORM with OBR -> verify ServiceRequest, Condition, Patient created in Aidbox | `base-obr.hl7` (derived from ex1) |
| Happy path: single RXO order E2E | Submit ORM with RXO -> verify MedicationRequest, Observation, Coverage created | `base-rxo.hl7` (derived from ex6, simplified to single order) |
| Multiple OBR orders in one message | Submit ex2-like message -> verify 2 ServiceRequests created | `multi-obr.hl7` (derived from ex2) |
| Multiple RXO orders with DG1/OBX/NTE | Submit ex6-like message -> verify 2 MedicationRequests, 6 Conditions, 6 Observations | `multi-rxo.hl7` (derived from ex6) |
| Non-standard ORC-5 triggers mapping_error | Submit with ORC-5="Final" -> verify mapping_error status, Task created | `non-standard-orc5.hl7` |
| ORC-5 mapping resolution after ConceptMap created | Create ConceptMap, reprocess -> verify processed status | Uses `createTestConceptMapForType()` |
| IN1 produces Coverage resources | Submit with IN1 segments -> verify Coverage in Aidbox | `with-insurance.hl7` |
| Missing PV1 processes normally | Submit without PV1 -> verify processed, no Encounter, ServiceRequest created | `no-pv1.hl7` |
| Patient draft creation | Submit with unknown patient -> verify draft Patient (active=false) | `new-patient.hl7` |

### Fixture Strategy

- **De-identify** example messages from the ticket (replace real patient names, IDs, etc. with synthetic data).
- **Minimal fixtures** for unit tests: construct inline HL7v2 strings with only the segments needed for each test case (follow the pattern in `test/unit/v2-to-fhir/messages/oru-r01.test.ts`).
- **Realistic fixtures** for integration tests: derive from the 6 examples but with synthetic identifiers. Place in `test/fixtures/hl7v2/orm-o01/`.
- **Edge case fixtures**: create specific fixtures for empty PV1, missing ORC-1, missing OBX-11, etc.

---

# Implementation Plan

## Overview

Implement an ORM^O01 (General Order Message) to FHIR converter that handles incoming order messages and produces ServiceRequest (from OBR-based orders), MedicationRequest (from RXO-based orders), Condition (from DG1), Observation (from OBX), and Coverage (from IN1) resources. The converter supports multiple order groups per message, ORC-based status resolution with ConceptMap fallback, and follows the existing project patterns established by the ORU_R01, ADT_A01, and VXU_V04 converters.

## Development Approach
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan when scope changes**

## Validation Commands
- `bun test:all` - Run all tests (unit + integration)
- `bun run typecheck` - Type checking

## Implementation Note: ServiceRequest vs MedicationRequest Status Types

The FHIR R4 type definitions differ between the two resources:
- `ServiceRequest.status`: `"draft" | "active" | "on-hold" | "revoked" | "completed" | "entered-in-error" | "unknown"`
- `MedicationRequest.status`: `"active" | "on-hold" | "cancelled" | "completed" | "entered-in-error" | "stopped" | "draft" | "unknown"`

The `OrderStatus` vocabulary map (D-1) maps CA/DC/RP to `"revoked"`, which is valid for ServiceRequest but NOT for MedicationRequest. For MedicationRequest, `"revoked"` must be translated to `"cancelled"` (the semantic equivalent). The `resolveOrderStatus()` function should return a generic string, and each consumer (ServiceRequest builder, MedicationRequest builder) should validate/adapt the value to its own allowed status codes. This is an implementation detail not explicitly called out in the design; implementing agents should handle this mapping at the resource builder level.

---

## Task 1: Infrastructure -- `orc-status` mapping type and `normalizeSystem` update

- [ ] Add `"orc-status"` entry to `MAPPING_TYPES` in `src/code-mapping/mapping-types.ts` with `source: { segment: "ORC", field: 5 }`, `target: { resource: "ServiceRequest", field: "status" }`, `targetSystem: "http://hl7.org/fhir/request-status"` [D-1]
- [ ] Add `"orc-status"` valid values to `VALID_VALUES` in `src/code-mapping/mapping-type-options.ts` with FHIR request-status codes: `active`, `on-hold`, `revoked`, `completed`, `entered-in-error`, `unknown`, `draft` [D-1]
- [ ] Add `"ICD-10-CM"` entry to `normalizeSystem()` in `src/v2-to-fhir/code-mapping/coding-systems.ts` mapping to `http://hl7.org/fhir/sid/icd-10-cm`. Keep existing `"I10"` mapping unchanged. [D-7]
- [ ] Add `"ORM-O01"` entry to `config/hl7v2-to-fhir.json` with: PID preprocessors (`move-pid2-into-pid3`, `inject-authority-from-msh`), PV1 preprocessor (`fix-pv1-authority-with-msh`), and `converter.PV1.required: false` [PREP-1, D-3]
- [ ] Write unit test for `normalizeSystem("ICD-10-CM")` returning `http://hl7.org/fhir/sid/icd-10-cm`
- [ ] Verify existing `normalizeSystem` tests still pass (e.g., `"I10"` still returns `icd-10`)
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 2: RXO segment wrapper

- [ ] Create `src/hl7v2/wrappers/rxo.ts` with `RXO` interface and `fromRXO()` parser following the `fromOBX` wrapper pattern in `src/hl7v2/wrappers/obx.ts` [D-8]
- [ ] Define all fields per REQ-RXO-1: `$1_requestedGiveCode` (CE), `$2_requestedGiveAmountMin` (string), `$3_requestedGiveAmountMax` (string), `$4_requestedGiveUnits` (CE), `$5_requestedDosageForm` (CE), `$9_allowSubstitutions` (string), `$11_requestedDispenseAmount` (string), `$12_requestedDispenseUnits` (CE), `$13_numberOfRefills` (string), `$14_orderingProviderDea` (XCN[]), `$18_requestedGiveStrength` (string), `$19_requestedGiveStrengthUnits` (CE), `$25_requestedDrugStrengthVolume` (string), `$26_requestedDrugStrengthVolumeUnits` (CWE)
- [ ] Parser reads from `segment.fields[N]` using existing `fromCE()`, `fromXCN()`, `fromCWE()` helpers
- [ ] Export `fromRXO` and `RXO` from `src/hl7v2/wrappers/index.ts`
- [ ] Write unit tests for `fromRXO()`: parse a segment with populated fields, parse a segment with minimal fields, verify CE/XCN/CWE conversion
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 3: Extract `generateCoverageId` to shared module

- [ ] Extract `generateCoverageId()` and `hasValidPayorInfo()` functions from `src/v2-to-fhir/messages/adt-a01.ts` into `src/v2-to-fhir/segments/in1-coverage.ts` (the existing IN1 segment converter module) [D-6, FALL-7]
- [ ] Update `src/v2-to-fhir/messages/adt-a01.ts` to import `generateCoverageId` and `hasValidPayorInfo` from `in1-coverage.ts` instead of defining locally
- [ ] Verify the ADT tests pass unchanged (no behavior change, just code relocation)
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 4: ORC -> ServiceRequest segment converter

- [ ] Create `src/v2-to-fhir/segments/orc-servicerequest.ts` with `convertORCToServiceRequest()` [D-1, REQ-ORC-1]
- [ ] Implement three-tier status resolution as private function `resolveOrderStatus()`:
  - Tier 1: ORC-5 valued + in `ORDER_STATUS_MAP` (Table 0038) -> use it
  - Tier 2: ORC-5 valued + NOT in standard map -> ConceptMap lookup via `orc-status` mapping type. On failure, return `MappingError`
  - Tier 3: ORC-5 empty -> use `ORDER_CONTROL_STATUS_MAP` from ORC-1 (Table 0119)
  - Tier 4: Neither -> return `"unknown"`
  - Handle GAP-1: ORC-1 missing gracefully [RELAX-1]
- [ ] Define `ORDER_STATUS_MAP` constant: CA->revoked, CM->completed, DC->revoked, ER->entered-in-error, HD->on-hold, IP->active, RP->revoked, SC->active
- [ ] Define `ORDER_CONTROL_STATUS_MAP` constant: NW->active, CA->active, OC->revoked, DC->revoked, HD->active, OH->on-hold, HR->on-hold, CR->revoked, DR->revoked (SC has no mapping)
- [ ] Map ORC-2 -> `identifier[PLAC]` (with type coding), ORC-3 -> `identifier[FILL]` (with type coding)
- [ ] Map ORC-4 -> `requisition` (EI -> Identifier)
- [ ] Map ORC-9 -> `authoredOn` only when ORC-1 = "NW"
- [ ] Map ORC-12 -> `requester` (display reference via `convertXCNToPractitioner()`)
- [ ] Map ORC-29 -> `locationCode` (CWE -> CodeableConcept)
- [ ] Set `intent = "order"` as default
- [ ] Return `ORCServiceRequestResult` with partial ServiceRequest and optional MappingError
- [ ] Write unit tests in `test/unit/v2-to-fhir/segments/orc-servicerequest.test.ts`:
  - Status from standard ORC-5 values (each Table 0038 code)
  - Status from ORC-1 fallback (each Table 0119 code)
  - Non-standard ORC-5 returns mapping error with `mappingType: "orc-status"`
  - Both ORC-1 and ORC-5 empty -> status "unknown"
  - ORC-4 -> requisition Identifier
  - ORC-9 mapped to authoredOn when ORC-1="NW", NOT mapped when ORC-1="CA"
  - ORC-12 -> requester display reference
  - ORC-29 -> locationCode
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 5: OBR -> ServiceRequest merger

- [ ] Create `src/v2-to-fhir/segments/obr-servicerequest.ts` with `mergeOBRIntoServiceRequest()` [REQ-OBR-1]
- [ ] Map OBR-4 -> `code` via `convertCEToCodeableConcept()`
- [ ] Map OBR-2 -> `identifier[PLAC]` only if ORC-2 empty (check via parameter)
- [ ] Map OBR-3 -> `identifier[FILL]` only if ORC-3 empty (check via parameter)
- [ ] Map OBR-5 -> `priority`: S/A -> "stat", R -> "routine", T -> "urgent"
- [ ] Map OBR-6 -> `occurrenceDateTime` via `convertDTMToDateTime()`
- [ ] Map OBR-11 -> `intent` override: "G" -> "reflex-order", all other values keep existing intent [REQ-OBR-1 note on "A"]
- [ ] Map OBR-16 -> `requester` only if ORC-12 not valued (fallback) [EC-7]
- [ ] Map OBR-31 -> `reasonCode` via `convertCEToCodeableConcept()`
- [ ] Write unit tests in `test/unit/v2-to-fhir/segments/obr-servicerequest.test.ts`:
  - OBR-4 maps to code
  - OBR-2 used as PLAC identifier when ORC-2 empty
  - OBR-2 NOT used when ORC-2 present
  - OBR-5 priority mapping (S->stat, R->routine, T->urgent)
  - OBR-6 maps to occurrenceDateTime
  - OBR-11 "G" -> reflex-order, "A" -> keeps "order"
  - OBR-16 requester fallback when ORC-12 empty
  - OBR-31 maps to reasonCode
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 6: RXO -> MedicationRequest converter

- [ ] Create `src/v2-to-fhir/segments/rxo-medicationrequest.ts` with `convertRXOToMedicationRequest()` [REQ-RXO-1]
- [ ] Set `intent = "original-order"` always
- [ ] Accept resolved status as parameter (from ORC resolution); adapt `"revoked"` to `"cancelled"` for MedicationRequest type compatibility (see Implementation Note above)
- [ ] Map RXO-1 -> `medicationCodeableConcept` via `convertCEToCodeableConcept()`
- [ ] Map RXO-2/3/4 -> `dosageInstruction[0].doseAndRate[0].doseRange` (low.value, high.value, units from RXO-4)
- [ ] Map RXO-9 -> `substitution.allowedCodeableConcept` (map "Y"/"T" to allowed, "N" to not allowed)
- [ ] Map RXO-11/12 -> `dispenseRequest.quantity` (value and units)
- [ ] Map RXO-13 -> `dispenseRequest.numberOfRepeatsAllowed` (parse as integer)
- [ ] Write unit tests in `test/unit/v2-to-fhir/segments/rxo-medicationrequest.test.ts`:
  - RXO-1 maps to medicationCodeableConcept
  - RXO-2/3/4 maps to dosageInstruction doseRange (low, high, units)
  - RXO-2 only (no max) -> doseRange.low only
  - RXO-9 "T" -> allowed, "N" -> not allowed
  - RXO-11/12 maps to dispenseRequest quantity
  - RXO-13 maps to numberOfRepeatsAllowed
  - Intent is always "original-order"
  - Status "revoked" adapted to "cancelled" for MedicationRequest
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 7: ORM order grouping and ID generation

- [ ] Create the `ORMOrderGroup` interface and `groupORMOrders()` function in `src/v2-to-fhir/messages/orm-o01.ts` (or a separate file if the main converter gets too large) [D-4]
- [ ] Implement ORC-starts-group pattern: walk through segments sequentially, ORC starts new group, OBR/RXO sets orderChoice, NTE/DG1/OBX attach to current group. Handle observation-level NTEs (NTE after OBX attaches to observation, not order) [D-4]
- [ ] Implement `resolveOrderNumber()`: ORC-2 first, OBR-2 fallback for OBR-based orders, ORC-2 only for RXO-based orders. Uses `sanitizeForId()` with optional namespace suffix [FALL-1, FALL-2, D-5]
- [ ] Implement `isEmptyPV1()` helper to detect PV1 segments with no meaningful content (PV1-2 empty AND PV1-19 empty) [EC-1]
- [ ] Write unit tests for `groupORMOrders()`:
  - Single ORC + OBR groups correctly
  - Two ORC + OBR groups (multi-order)
  - ORC + RXO groups correctly
  - Mixed ORC+OBR and ORC+RXO in one message
  - NTEs after OBX attach to observation, NTEs before OBX attach to order
  - DG1 attaches to current order group
  - OBX starts new observation entry
- [ ] Write unit tests for `resolveOrderNumber()`:
  - ORC-2 present -> uses ORC-2.1 (with namespace suffix when ORC-2.2 present)
  - ORC-2 empty, OBR-2 present -> uses OBR-2.1
  - Both empty -> returns error
  - Sanitization applied correctly
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 8: Main ORM_O01 converter -- core flow (Patient, Encounter, OBR orders)

- [ ] Create `src/v2-to-fhir/messages/orm-o01.ts` with `convertORM_O01()` function [D-8, AC-1]
- [ ] Implement main flow: parseMSH -> parsePID -> extractSenderTag -> handlePatient -> parsePV1 (with empty PV1 detection) -> handleEncounter (with messageTypeKey "ORM-O01")
- [ ] Process IN1 segments -> Coverage[] using existing `convertIN1ToCoverage()` and extracted `generateCoverageId()` + `hasValidPayorInfo()` from `in1-coverage.ts` [D-6]
- [ ] Call `groupORMOrders()` to partition segments
- [ ] For each OBR-based order group: call `convertORCToServiceRequest()`, then `mergeOBRIntoServiceRequest()`, process DG1s into Conditions (using `convertDG1ToCondition()` with positional IDs `{orderNumber}-dg1-{index}`), process order-level NTEs into `ServiceRequest.note`, process OBX observations (see next point), link `reasonReference`, `supportingInfo`, `note`
- [ ] For OBX in ORM context: use `convertOBXWithMappingSupportAsync()` for status mapping but NOT LOINC resolution. When OBX-11 is missing, default to status `"registered"` before calling the mapping-aware function [D-2, REQ-OBX-NOLOINC-1, RELAX-5]. Use positional IDs `{orderNumber}-obx-{index}` [FALL-4]
- [ ] Collect mapping errors. If any: return `buildMappingErrorResult()`. Otherwise build transaction bundle
- [ ] Handle error cases: missing MSH (throw), missing PID (return error), no processable order groups (return error) [AC-17, AC-18, AC-20]
- [ ] Handle warning case: PV1-19 present but invalid authority -> warning status [REQ-PV1-1]
- [ ] Handle processed case: no PV1 or empty PV1 -> processed (not warning) [D-3, EC-1]
- [ ] Register `ORM_O01` in `src/v2-to-fhir/converter.ts`: add `case "ORM_O01"` and import [AC-1]
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 9: Main ORM_O01 converter -- RXO order support and linkages

- [ ] Add RXO-based order processing in `processOrderGroup()`: when orderChoiceType is "RXO", call `convertRXOToMedicationRequest()` with the resolved ORC status [AC-4]
- [ ] Link NTE segments to `MedicationRequest.note` (not ServiceRequest.note) for RXO orders [REQ-RXO-LINKAGE-1, AC-6]
- [ ] Link DG1-derived Conditions to `MedicationRequest.reasonReference` for RXO orders [REQ-RXO-LINKAGE-1, AC-5]
- [ ] Link OBX-derived Observations to `MedicationRequest.supportingInformation` for RXO orders [REQ-RXO-LINKAGE-1, AC-7]
- [ ] Set MedicationRequest `subject` (patientRef) and `encounter` (encounterRef, when present)
- [ ] Set MedicationRequest ID using `resolveOrderNumber()` with ORC-2 only (no OBR fallback for RXO) [FALL-2]
- [ ] Add meta tags to MedicationRequest (baseMeta)
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 10: Unit tests for ORM_O01 message converter

- [ ] Create `test/unit/v2-to-fhir/messages/orm-o01.test.ts` following the pattern in `oru-r01.test.ts` (inline HL7v2 message strings, `makeTestContext()`)
- [ ] Test: ORM with single OBR order produces ServiceRequest with correct resourceType, intent="order", code, identifiers [AC-3]
- [ ] Test: ORM with single RXO order produces MedicationRequest with intent="original-order", medication code [AC-4]
- [ ] Test: ORM with multiple OBR orders produces multiple ServiceRequests with distinct IDs [AC-9]
- [ ] Test: ORM with multiple RXO orders produces multiple MedicationRequests [AC-9]
- [ ] Test: DG1 segments produce Conditions linked via reasonReference [AC-5]
- [ ] Test: NTE segments produce ServiceRequest.note entries [AC-6]
- [ ] Test: OBX segments produce Observations linked via supportingInfo [AC-7]
- [ ] Test: IN1 segments produce Coverage resources [AC-8]
- [ ] Test: OBX in ORM context does NOT trigger LOINC resolution [AC-21]
- [ ] Test: Missing OBX-11 defaults to status=registered [RELAX-5]
- [ ] Test: ServiceRequest.status from ORC-5 standard value "SC" -> "active" [AC-15]
- [ ] Test: ServiceRequest.status from ORC-1 "NW" when ORC-5 empty -> "active" [AC-15]
- [ ] Test: Status = "unknown" when both ORC-1 and ORC-5 empty [AC-15, RELAX-1]
- [ ] Test: Missing PID rejects message (status="error") [AC-18]
- [ ] Test: Missing ORC-2 and OBR-2 rejects order group [AC-20]
- [ ] Test: ORM without PV1 processes normally (status=processed) [AC-12]
- [ ] Test: ORM with empty PV1 processes normally (treated as absent) [EC-1]
- [ ] Test: ORM with valid PV1-19 creates Encounter [AC-13]
- [ ] Test: ORM with PV1 but no PV1-19 skips Encounter (status=processed) [FALL-6]
- [ ] Test: Deterministic ServiceRequest ID from ORC-2 [AC-10, FALL-1]
- [ ] Test: Deterministic Condition ID from order + position [AC-10, FALL-3]
- [ ] Test: Deterministic Observation ID from order + position [AC-10, FALL-4]
- [ ] Test: OBR-11 "G" overrides intent to "reflex-order" [REQ-OBR-1]
- [ ] Test: ORC-12 maps to ServiceRequest.requester [REQ-ORC-1]
- [ ] Test: OBR-16 used as requester fallback when ORC-12 empty [EC-7]
- [ ] Test: Mixed order types in one message: OBR + RXO -> 1 ServiceRequest + 1 MedicationRequest [EC-2]
- [ ] Test: NTE in RXO order maps to MedicationRequest.note [REQ-RXO-LINKAGE-1]
- [ ] Test: DG1 in RXO order maps to MedicationRequest.reasonReference [REQ-RXO-LINKAGE-1]
- [ ] Test: OBX in RXO order maps to MedicationRequest.supportingInformation [REQ-RXO-LINKAGE-1]
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 11: Integration test fixtures

- [ ] Create `test/fixtures/hl7v2/orm-o01/` directory
- [ ] Create `base-obr.hl7`: single OBR-based order with ORC, OBR, DG1, PV1 (derived from ex1, de-identified with synthetic data)
- [ ] Create `base-rxo.hl7`: single RXO-based order with ORC, RXO (derived from ex6, simplified to single order, de-identified)
- [ ] Create `multi-obr.hl7`: two OBR-based orders in one message (derived from ex2, de-identified)
- [ ] Create `multi-rxo.hl7`: two RXO-based orders with DG1/OBX/NTE per order (derived from ex6, de-identified)
- [ ] Create `non-standard-orc5.hl7`: ORC-5="Final" (non-standard value triggering mapping_error)
- [ ] Create `with-insurance.hl7`: ORM with IN1 segments (derived from ex2 or ex6, de-identified)
- [ ] Create `no-pv1.hl7`: ORM without PV1 segment
- [ ] Create `new-patient.hl7`: ORM with a patient ID that won't exist in Aidbox (for draft patient creation test)
- [ ] Verify all fixtures parse correctly with `parseMessage()` (no syntax errors)
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 12: Integration tests

- [ ] Add `getServiceRequests()` and `getMedicationRequests()` helper functions to `test/integration/helpers.ts`
- [ ] Add `immunization`, `medicationrequest`, `servicerequest` to the TRUNCATE list in `cleanupTestResources()` if not already present
- [ ] Create `test/integration/v2-to-fhir/orm-o01.integration.test.ts`
- [ ] Test: Happy path single OBR order E2E: submit ORM -> verify ServiceRequest, Condition, Patient created in Aidbox [AC-3, AC-22]
- [ ] Test: Happy path single RXO order E2E: submit ORM with RXO -> verify MedicationRequest created [AC-4, AC-22]
- [ ] Test: Multiple OBR orders in one message -> 2 ServiceRequests [AC-9]
- [ ] Test: Multiple RXO orders with DG1/OBX/NTE -> verify MedicationRequests, Conditions, Observations created [AC-9]
- [ ] Test: Non-standard ORC-5 triggers mapping_error status and Task creation [AC-16]
- [ ] Test: ORC-5 mapping resolution after ConceptMap created + reprocess -> verify processed status [AC-16]
- [ ] Test: IN1 produces Coverage resources in Aidbox [AC-8]
- [ ] Test: Missing PV1 processes normally, no Encounter created [AC-12]
- [ ] Test: Patient draft creation (submit with unknown patient -> verify draft Patient active=false) [AC-11]
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 13: Update documentation

- [ ] Update CLAUDE.md:
  - Add `ORM_O01` to the converter list in the Architecture Overview / Components table
  - Add ORM to the "Supported message types" in the converter.ts comment (if applicable)
  - Document the `orc-status` mapping type alongside existing mapping types
  - Add any gotchas discovered during implementation
- [ ] Add inline documentation for complex functions (especially `resolveOrderStatus` three-tier logic, `groupORMOrders` segment walking, and the ServiceRequest/MedicationRequest status type adaptation)
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 14: Cleanup design artifacts

- [ ] Remove all `DESIGN PROTOTYPE: YYYY-MM-DD-feature-name` comments from codebase (note: VXU still has one at the top of `vxu-v04.ts` -- only remove ORM-related ones if any were added)
- [ ] Verify no prototype markers remain: `grep -r "DESIGN PROTOTYPE" src/`
- [ ] Update design document status to `implemented` (add a note at the top of the Requirements section)
- [ ] Run `bun test:all` and `bun run typecheck` - final verification

---

## Post-Completion Verification

1. **Functional test**: Process each of the 6 example messages (from `ai/tickets/converter-skill-tickets/orm-converter/examples/`) through the converter by running the integration test suite. Verify each produces the expected resource types without crashing [AC-2].
2. **Edge case test**: Submit an ORM with empty PV1 (`PV1|`) and verify status is `processed` (not `warning` or `error`). Submit an ORM with ORC-5="Pending" (non-standard) and verify `mapping_error` status with Task creation.
3. **Integration check**: Verify the ORM converter is routed correctly by `convertToFHIR()` when MSH-9 contains `ORM^O01`. Verify that existing ORU, ADT, VXU tests still pass unchanged (no regressions from shared code changes like `normalizeSystem`, `generateCoverageId` extraction).
4. **No regressions**: All existing tests pass (`bun test:all` green).
5. **Cleanup verified**: No DESIGN PROTOTYPE comments remain in ORM-related files.

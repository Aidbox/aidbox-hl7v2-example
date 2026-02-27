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
| NTE (order-level) | ServiceRequest[1].note | per NTE in ORDER_DETAIL | 4.2.2 |
| DG1 | Condition | per DG1, referenced from ServiceRequest.reasonReference | 4.2.4 |
| OBX (in ORDER_DETAIL) | Observation[1] | per OBSERVATION group; linked via ServiceRequest.supportingInfo | 4.2.5.1 |

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
| OBR-11 (Specimen Action Code) | ServiceRequest.intent override | "A" -> intent "add-on"; "G" -> "reflex-order"; else "order" | Row 11 |
| OBR-16 (Ordering Provider) | ServiceRequest.requester(Practitioner) | IF ORC-12 NOT VALUED | Row 16 |
| OBR-17 (Order Callback Phone) | extension servicerequest-order-callback-phone-number | if valued | Row 17 |
| OBR-27 (Quantity/Timing) | ServiceRequest (TQ mapping) | IF ORC-7 NOT VALUED | Row 27 |
| OBR-31 (Reason for Study) | ServiceRequest.reasonCode | if valued | Row 31 |
| OBR-46 (Placer Supplemental Service Info) | ServiceRequest.orderDetail | if valued | Row 46 |

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
- **Handling**: Normalize via updated global `normalizeSystem()`: "I10" and "ICD-10-CM" both map to `http://hl7.org/fhir/sid/icd-10-cm`.

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
| 1 | Derived from patient + IN1 position | Always when IN1 present | `{patientId}-coverage-{positional-index}` |

---

## Acceptance Criteria

### Core Converter

- [AC-1] The converter registers as `ORM_O01` in `src/v2-to-fhir/converter.ts` and is routed correctly.
- [AC-2] All 6 example messages can be processed without crashing.
- [AC-3] OBR-based orders produce ServiceRequest resources with correct status, intent, identifiers, code, and provider references.
- [AC-4] RXO-based orders produce MedicationRequest resources with intent="original-order", medication code, dosage, and dispense information.
- [AC-5] DG1 segments produce Condition resources linked via ServiceRequest.reasonReference or MedicationRequest.reasonReference.
- [AC-6] NTE segments in ORDER_DETAIL produce ServiceRequest.note or MedicationRequest.note entries.
- [AC-7] OBX segments in ORDER_DETAIL produce Observation resources linked via ServiceRequest.supportingInfo.
- [AC-8] IN1 segments produce Coverage resources linked to Patient.
- [AC-9] Multiple ORDER groups in a single message produce separate ServiceRequest/MedicationRequest resources (verified with ex2 and ex6).
- [AC-10] Each produced resource has a deterministic ID per the Fallback Chain tables.

### Patient/Encounter Handling

- [AC-11] Patient lookup/draft creation follows existing ORU pattern (lookup by ID, create draft with active=false if not found).
- [AC-12] PV1 is optional for ORM. Missing PV1 or empty PV1 does not cause an error. No Encounter is created in that case.
- [AC-13] When PV1 is present and valid, Encounter is created following existing PV1 conversion logic.
- [AC-14] Non-standard PV1-2 values are routed through existing `patient-class` code mapping type.

### Status/Error Handling

- [AC-15] ServiceRequest.status derived from ORC-5 when valued (using OrderStatus map). When ORC-5 not valued, derived from ORC-1 (using OrderControlCode map). When neither yields a mapping, status = "unknown".
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

ServiceRequest.status uses a three-tier resolution:
1. **ORC-5 standard map**: If ORC-5 is valued and matches Table 0038, use `ORDER_STATUS_MAP`.
2. **ORC-5 ConceptMap**: If ORC-5 is valued but NOT in Table 0038, attempt sender-specific ConceptMap lookup via new `orc-status` mapping type. If no mapping found, return `MappingError` (message gets `mapping_error` status with Task creation).
3. **ORC-1 fallback**: If ORC-5 is empty, use `ORDER_CONTROL_STATUS_MAP` from ORC-1. If ORC-1 is also empty or has no mapping (e.g., "SC"), set status = "unknown".

This follows the established pattern used by `obx-status` and `patient-class` mapping types.

### D-2: ORM OBX -- No LOINC Resolution [REQ-OBX-NOLOINC-1, AC-21]

ORM OBX segments map directly to `Observation.code` via `convertCEToCodeableConcept()` without LOINC resolution. Use `convertOBXWithMappingSupportAsync()` for status mapping only (handles OBX-11 ConceptMap lookup for non-standard values). Do NOT call `convertOBXToObservationResolving()` (which includes LOINC resolution).

When OBX-11 is missing in ORM context, default to `Observation.status = "registered"` rather than creating a mapping error. This is implemented by a small wrapper that provides the default before calling the mapping-aware function.

### D-3: Encounter -- PV1-19 Only, No PID-18 Fallback [FALL-6, AC-12]

When PV1-19 is absent, Encounter creation is skipped entirely. No PID-18 fallback. Status remains "processed" (not "warning"), because PV1 is optional for ORM. Empty PV1 segments (e.g., `PV1|`) are treated as absent.

### D-4: Order Grouping -- ORC-Starts-Group Pattern [REQ-MULTI-ORDER-1]

ORM message segments are grouped by ORC boundaries. Each ORC starts a new ORDER group. Segments between ORCs belong to the current group. The ORDER_CHOICE type is detected by scanning for the first OBR or RXO segment within the group.

### D-5: ID Generation -- Placer-First with EI Namespace [FALL-1, FALL-2, AC-10]

ServiceRequest/MedicationRequest IDs are derived primarily from ORC-2 (Placer Order Number), with OBR-2 as fallback for OBR-based orders. The EI type extraction uses `sanitizeForId(ei.$1_value)` as the base, optionally appending `-{sanitizeForId(ei.$2_namespace)}` when the namespace is present and different from the value. This ensures uniqueness across senders with the same order numbers.

### D-6: Coverage Included [REQ-IN1-1, AC-8]

IN1 segments are processed using existing `convertIN1ToCoverage()` from ADT. Coverage resources get deterministic IDs: `{patientId}-coverage-{positional-index}`. They reference the Patient via `beneficiary`.

### D-7: DG1-3 Coding System -- Global Normalizer Update [GAP-13]

The global `normalizeSystem()` is updated: "I10" now maps to `http://hl7.org/fhir/sid/icd-10-cm` (was `icd-10`), and "ICD-10-CM" is added as a new entry also mapping to `http://hl7.org/fhir/sid/icd-10-cm`. This affects all converters consistently.

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

ORC-12 (Ordering Provider) maps to `ServiceRequest.requester` as an inline display reference using `convertXCNToPractitioner()`. ORC-4 (Placer Group Number) maps to `ServiceRequest.requisition` as an `Identifier` via EI conversion.

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
- OBR-11 -> `intent` override: "A"->"reflex-order", "G"->"reflex-order", else unchanged
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
- `intent`: always "original-order"
- `status`: inherited from ORC resolution (passed in from the order group processor, not re-resolved)
- RXO-1 -> `medicationCodeableConcept` via `convertCEToCodeableConcept()`
- RXO-2/3/4 -> `dosageInstruction[0].doseAndRate[0].doseRange` (low.value, high.value, units)
- RXO-5 -> not mapped to MedicationRequest directly (it maps to `Medication.form` which would require a contained Medication resource -- deferred for simplicity, store as extension or omit)
- RXO-9 -> `substitution.allowedCodeableConcept` (map "Y"/"T" to allowed, "N" to not allowed)
- RXO-11/12 -> `dispenseRequest.quantity`
- RXO-13 -> `dispenseRequest.numberOfRepeatsAllowed`
- RXO-18/19/25/26 -> Medication strength (requires contained Medication -- deferred for simplicity unless the implementation finds a straightforward approach)

Note on RXO-5, RXO-18/19/25/26: These map to `Medication` resource properties per the IG. The simplest approach is to use `medicationCodeableConcept` for the drug code (RXO-1) and skip the contained Medication for dose form and strength in v1. This can be extended later.

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
| `src/v2-to-fhir/code-mapping/coding-systems.ts` | Modify | Update `normalizeSystem()`: change "I10" -> `icd-10-cm`; add "ICD-10-CM" -> `icd-10-cm` |
| `src/hl7v2/wrappers/index.ts` | Modify | Export `fromRXO` and `RXO` from new rxo.ts wrapper |
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
| OBR-11 "A" overrides intent to "reflex-order" | intent changes from "order" to "reflex-order" | [REQ-OBR-1] |
| ORC-12 maps to ServiceRequest.requester | Practitioner display reference | [REQ-ORC-1] |
| OBR-16 used as requester fallback when ORC-12 empty | requester from OBR-16 | [EC-7] |
| RXO dosage mapping (dose range, dispense quantity) | dosageInstruction and dispenseRequest populated | [REQ-RXO-1] |

Location: `test/unit/v2-to-fhir/segments/orc-servicerequest.test.ts`

| Test | Validates |
|---|---|
| resolveServiceRequestStatus with standard ORC-5 values | Each Table 0038 code maps to correct FHIR status |
| resolveServiceRequestStatus with ORC-1 fallback | Each Table 0119 code maps correctly |
| resolveServiceRequestStatus with non-standard ORC-5 returns mapping error | MappingError with `mappingType: "orc-status"` |
| ORC-4 maps to requisition Identifier | EI conversion |
| ORC-9 maps to authoredOn when ORC-1="NW" | Date conversion |
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

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
- IF ORC-5 is valued: use `OrderStatus` concept map (Table 0038 -> FHIR request-status)
- IF ORC-5 is NOT valued: use ORC-1 `OrderControlCode[ServiceRequest.status]` concept map (Table 0119 -> FHIR request-status)
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
| OBR-24 (Diagnostic Serv Sect ID) | not mapped in IG | -- | Row 24 |
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

### ORC Field Population Patterns

| Field | Description | Populated In | Notes |
|---|---|---|---|
| ORC-1 | Order Control | 5/6 | Ex6 omits ORC-1. Always "NW" when present. |
| ORC-2 | Placer Order Number | 6/6 | Various formats: simple ("47"), compound EI ("654321^EUPHORIA"), alphanumeric ("Order891234") |
| ORC-3 | Filler Order Number | 1/6 | Only ex1 has it (89012^EPC) |
| ORC-5 | Order Status | 3/6 | Values: "Final" (ex1), "Pending" (ex2), "SC" (ex6). Non-standard values present. |
| ORC-9 | Date/Time | 5/6 | Ex6 omits |
| ORC-10 | Entered By | 3/6 | |
| ORC-12 | Ordering Provider | 6/6 | Always present |
| ORC-13 | Enterer's Location | 3/6 | |
| ORC-14 | Callback Phone | 2/6 | |
| ORC-15 | Order Effective Date/Time | 2/6 | Only ex5, ex6 |
| ORC-29 | Order Type | 2/6 | Only ex3, ex4 ("O" = outpatient) |

### OBR Field Population Patterns (5 messages with OBR)

| Field | Populated In | Notes |
|---|---|---|
| OBR-1 | 5/5 | Set ID, always starts at 1 |
| OBR-2 | 5/5 | Placer Order Number -- sometimes same as ORC-2, sometimes different |
| OBR-3 | 1/5 | Only ex1 |
| OBR-4 | 5/5 | Universal Service ID -- always present, local codes |
| OBR-5 | 1/5 | Priority, only ex2 ("0") |
| OBR-6 | 3/5 | Requested Date/Time |
| OBR-7 | 1/5 | Observation Date/Time (ex5 only) |
| OBR-11 | 1/5 | Specimen Action Code ("L" in ex3, ex4) |
| OBR-16 | 5/5 | Ordering Provider |
| OBR-17 | 2/5 | Callback Phone (ex1, ex3, ex4) |
| OBR-24 | 2/5 | Diagnostic Serv Sect ID (ex3, ex4: "OPHTHALMOLOG") |
| OBR-25 | 1/5 | Result Status (ex1 only: "Final") |
| OBR-27 | 4/5 | Quantity/Timing (TQ) |
| OBR-32 | 1/5 | Principal Result Interpreter (ex1) |

### DG1 Field Population Patterns

| Field | Pattern | Notes |
|---|---|---|
| DG1-1 (Set ID) | 4/5 messages | Ex1 omits, others start at 1. Ex4 has two DG1 both with Set ID = 1 (non-compliant). |
| DG1-2 (Coding Method) | 4/5 | Values: "I10", "ICD", "ICD-10-CM". Not populated in ex6. |
| DG1-3 (Diagnosis Code) | 5/5 | Always populated. Component structure varies: `code^text^system` or `^text-only`. |
| DG1-4 (Description) | 4/5 | Text description. Ex6 omits. |
| DG1-6 (Diagnosis Type) | 2/5 | "ICD-9 to Order" in ex3, ex4 (non-standard value). |
| DG1-20 (Diagnosis Identifier) | 1/5 | Only ex1: "condition-id-sample-1". |

### Multiple Orders Per Message

- Example 2: 2 OBR-based orders in one message (OBR-1=1, OBR-1=2), each with its own DG1.
- Example 6: 2 RXO-based orders in one message, each with NTE, DG1, OBX groups.
- All other examples: single order per message. [REQ-MULTI-ORDER-1]

### Version Distribution

| Version | Examples | Notes |
|---|---|---|
| 2.3 | Ex2, Ex5 | Oldest; no version in ex6 |
| 2.4 | Ex3, Ex4 | |
| 2.5.1 | Ex1 | |
| (empty) | Ex6 | No version declared |

---

## Gaps Between Normative and Real

### GAP-1: ORC-1 Missing [MIS-1]

- **Spec**: ORC-1 (Order Control) is Required [R] in all versions.
- **Real**: Example 6 omits ORC-1 entirely.
- **Impact**: Cannot determine ServiceRequest.status from ORC-1 when ORC-5 is also non-standard (ex6 uses ORC-5="SC").
- **Evidence**: Ex6 raw: `ORC||order-1^assigning-authority|||SC||...`

### GAP-2: Non-Standard ORC-5 Values [MIS-2]

- **Spec**: Table 0038 defines: A, CA, CM, DC, ER, HD, IP, RP, SC.
- **Real**: Ex1 uses "Final" (not in Table 0038). Ex2 uses "Pending" (not in Table 0038). Ex6 uses "SC" (valid).
- **Impact**: Cannot use OrderStatus vocabulary map for non-standard values. Need fallback behavior.
- **Evidence**: ORC-5 field values across examples.

### GAP-3: OBR-25 Used in ORM Context [MIS-3]

- **Spec IG**: OBR[ServiceRequest] mapping explicitly notes OBR-25 is NOT mapped for ServiceRequest context ("This should not be populated in a message corresponding to a ServiceRequest").
- **Real**: Ex1 has OBR-25 = "Final".
- **Impact**: Should be ignored per IG. Document this as expected behavior.
- **Evidence**: OBR[ServiceRequest] mapping row 25 is empty; IG comment says should not be populated for ORM.

### GAP-4: DG1-1 Set ID Violations [MIS-4]

- **Spec**: DG1-1 (Set ID) is Required [R].
- **Real**: Ex1 omits DG1-1 entirely. Ex4 has two DG1 segments both with Set ID = 1 (should be 1, 2).
- **Impact**: Cannot rely on DG1-1 for ordering or deduplication. Must use positional ordering.
- **Evidence**: Ex1 raw: `DG1||I10|S82^ANKLE FRACTURE^I10|...` (field 1 empty). Ex4 raw: two `DG1|1|...` segments.

### GAP-5: DG1-2 Coding Method Variants [MIS-5]

- **Spec**: DG1-2 (Diagnosis Coding Method) is Required [R] in v2.5. Table 0053 defines standard values.
- **Real**: Values include "I10", "ICD", "ICD-10-CM" -- these are NOT standard Table 0053 values. Ex6 omits DG1-2.
- **Impact**: DG1-2 is not used in the Condition mapping per IG. The coding system comes from DG1-3.3 (Name of Coding System component). Gaps in DG1-2 do not affect conversion.
- **Evidence**: DG1[Condition] mapping has no row for DG1-2.

### GAP-6: DG1-6 Diagnosis Type Missing or Non-Standard [MIS-6]

- **Spec**: DG1-6 (Diagnosis Type) is Required [R] in v2.5. Table 0052 defines: A=Admitting, W=Working, F=Final.
- **Real**: Only ex3 and ex4 populate DG1-6 with "ICD-9 to Order" (not a Table 0052 value). Others omit it.
- **Impact**: DG1-6 is not mapped in the Condition IG mapping. No conversion impact.
- **Evidence**: DG1[Condition] mapping has no row for DG1-6.

### GAP-7: PV1 Empty or Minimal [MIS-7]

- **Spec**: When PATIENT_VISIT is present, PV1 is [1..1] with PV1-2 (Patient Class) Required [R].
- **Real**: Ex6 has PV1 segment present but completely empty (`PV1|`). Ex3, Ex4 have PV1-2 = "O" (outpatient). Ex5 has PV1-2 = "1" (non-standard; Table 0004 expects I/O/E/etc.). Ex2 has PV1-2 empty.
- **Impact**: Must handle empty PV1 gracefully. PV1-2 non-standard values should go through existing patient-class mapping type.
- **Evidence**: Ex6 raw line 3: `PV1|`; Ex5: `PV1|1|1|...` (PV1-2 = "1").

### GAP-8: PV1-19 (Visit Number) Absent [MIS-8]

- **Spec**: PV1-19 (Visit Number) is used by ORU for Encounter ID generation.
- **Real**: Only ex1 has PV1-19 populated (720845^VN). Others have no PV1-19.
- **Impact**: Encounter ID cannot be derived from PV1-19 in most cases. Need alternative ID strategy.
- **Evidence**: PV1 field 19 populated only in ex1.

### GAP-9: ORC-3 (Filler Order Number) Rarely Present [MIS-9]

- **Spec**: ORC-3 is Conditional [C]. IG maps ORC-3 to ServiceRequest.identifier[FILL] when OBR-3 is empty.
- **Real**: Only ex1 has ORC-3 = `89012^EPC`. All others omit ORC-3 and OBR-3.
- **Impact**: Most ServiceRequests will have only PLAC identifier, not FILL.
- **Evidence**: ORC field 3 populated only in ex1.

### GAP-10: OBX-11 (Observation Result Status) Missing [MIS-10]

- **Spec**: OBX-11 is Required [R].
- **Real**: Ex6 OBX segments have no OBX-11 value. All OBX segments in ex6 have the pattern `OBX||ST|code||value|||||||||date`.
- **Impact**: OBX-11 is Required in FHIR Observation.status. Need a fallback or default.
- **Evidence**: Ex6 OBX segments have 14 populated fields but OBX-11 is empty.

### GAP-11: PID-5 (Patient Name) Missing [MIS-11]

- **Spec**: PID-5 (Patient Name) is Required [R].
- **Real**: Ex6 does not populate PID-5 at all.
- **Impact**: Existing PID->Patient converter may reject this. Need to handle gracefully.
- **Evidence**: Ex6 raw: `PID|||patient-1^^^UNIPAT^PE|||||||||||||||encounter-1` (field 5 empty).

### GAP-12: ORC-2 / OBR-2 Identifier Format Inconsistency [MIS-12]

- **Spec**: ORC-2 and OBR-2 are EI (Entity Identifier) data type with components: identifier, namespace, universal ID, universal ID type.
- **Real**: ORC-2 formats vary dramatically: simple string "47" (ex2), compound "654321^EUPHORIA" (ex1), alphanumeric "Order891234" (ex3), "22984-73" (ex5), "order-1^assigning-authority" (ex6). OBR-2 sometimes duplicates ORC-2, sometimes differs.
- **Impact**: For deterministic resource ID generation, need a robust extraction strategy from the EI type.
- **Evidence**: Various ORC-2 values across examples.

### GAP-13: DG1-3 Coding System Inconsistency [MIS-13]

- **Spec**: DG1-3 (Diagnosis Code) is CE/CWE with components: identifier^text^coding-system.
- **Real**: DG1-3.3 varies: "I10" (ex1, ex2), "ICD-10-CM" (ex3, ex4). Ex6 has DG1-3 with only text component (`^headache-1`). Mix of ICD-10 code system identifiers.
- **Impact**: Must normalize diagnosis coding system. "I10" and "ICD-10-CM" both refer to ICD-10-CM. Need system URI mapping.
- **Evidence**: DG1-3 component 3 values across examples.

---

## Preprocessor Requirements

### PREP-1: No ORM-specific preprocessors required at this time

After analysis, the ORM converter does not require custom preprocessors beyond what the existing infrastructure provides (e.g., the existing `fix-pv1-authority-with-msh` preprocessor from config).

- The PV1-19 authority fix from MSH may be relevant for the one example (ex1) that has PV1-19.
- DG1 coding system normalization should be handled in the segment converter, not a preprocessor, because it is a domain mapping (not a restoration of lost data).

---

## Relaxed Requirements (Proposal)

### RELAX-1: ORC-1 (Order Control) NOT Required [Proposal]

- **Spec**: ORC-1 is Required [R].
- **Proposed relaxation**: If ORC-1 is missing and ORC-5 is valued, derive status from ORC-5 only. If both ORC-1 and ORC-5 are missing, default ServiceRequest.status to "unknown".
- **Why needed**: Ex6 omits ORC-1. Real-world senders may not populate it.
- **Risk**: "unknown" is a valid FHIR request-status value, but downstream consumers may not handle it gracefully. Low risk -- better than rejecting the message.

### RELAX-2: DG1-1 (Set ID) NOT Required [Proposal]

- **Spec**: DG1-1 is Required [R].
- **Proposed relaxation**: If DG1-1 is missing, use positional index (1-based) within the order group.
- **Why needed**: Ex1 omits DG1-1. Ex4 has duplicate Set IDs.
- **Risk**: None -- DG1-1 is only used for ordering, which positional index provides.

### RELAX-3: DG1-2 (Diagnosis Coding Method) NOT Required [Proposal]

- **Spec**: DG1-2 is Required [R].
- **Proposed relaxation**: Allow empty DG1-2. Not used in conversion per IG mapping.
- **Why needed**: Ex6 omits it. It is not mapped to any FHIR field.
- **Risk**: None -- IG does not use this field.

### RELAX-4: DG1-6 (Diagnosis Type) NOT Required [Proposal]

- **Spec**: DG1-6 is Required [R].
- **Proposed relaxation**: Allow empty or non-standard DG1-6. Not used in conversion per IG mapping.
- **Why needed**: Most examples omit it or use non-standard values.
- **Risk**: None -- IG does not use this field.

### RELAX-5: OBX-11 (Observation Result Status) Default for ORM Context [Proposal]

- **Spec**: OBX-11 is Required [R].
- **Proposed relaxation**: If OBX-11 is missing in ORM context (supporting observations), default Observation.status to "registered".
- **Why needed**: Ex6 OBX segments omit OBX-11. In ORM context, these are supporting observations at order time, not finalized results.
- **Risk**: Low -- "registered" accurately reflects observations captured at order entry. Downstream consumers should handle "registered" observations as preliminary/order-context data.

### RELAX-6: PV1-2 (Patient Class) Non-Standard Values [Proposal]

- **Spec**: PV1-2 is Required [R], Table 0004 (I/O/E/P/R/B/C/N/U).
- **Proposed relaxation**: Route non-standard PV1-2 values through existing `patient-class` mapping type (ConceptMap-based resolution). If unmapped, set mapping_error status like other converters.
- **Why needed**: Ex5 uses "1" instead of a Table 0004 value. Ex6 has empty PV1.
- **Risk**: Low -- follows established project pattern.

### RELAX-7: PID-5 (Patient Name) Allow Empty [Proposal]

- **Spec**: PID-5 is Required [R].
- **Proposed relaxation**: Allow empty PID-5. Create Patient without name.
- **Why needed**: Ex6 omits PID-5.
- **Risk**: Low -- FHIR Patient.name is not required (0..*).

### RELAX-8: Empty PV1 Treated as Absent [Proposal]

- **Spec**: When PATIENT_VISIT group is present, PV1 is required with PV1-2 Required.
- **Proposed relaxation**: If PV1 segment is present but completely empty (no populated fields), treat as absent PV1. Do not create Encounter. Set message status to "processed" (not "warning").
- **Why needed**: Ex6 has `PV1|` with no data.
- **Risk**: None -- an empty PV1 carries no information. Treating as absent is safe.

---

## Fallback Chains

### ServiceRequest ID [FALL-1]

| Priority | Source | Precondition | ID Format |
|---|---|---|---|
| 1 | ORC-2 (Placer Order Number) | ORC-2.1 non-empty | `{ORC-2.1}` or `{ORC-2.1}-{ORC-2.2}` if namespace present |
| 2 | OBR-2 (Placer Order Number) | ORC-2 empty, OBR-2.1 non-empty | `{OBR-2.1}` or `{OBR-2.1}-{OBR-2.2}` if namespace present |
| FAIL | -- | Both empty | Reject order group with error |

Rationale: Placer order number is the most consistent identifier across examples (6/6 have ORC-2). Filler order number (ORC-3/OBR-3) is rarely present (1/6).

### MedicationRequest ID [FALL-2]

| Priority | Source | Precondition | ID Format |
|---|---|---|---|
| 1 | ORC-2 (Placer Order Number) | ORC-2.1 non-empty | `{ORC-2.1}` or `{ORC-2.1}-{ORC-2.2}` if namespace present |
| FAIL | -- | ORC-2 empty | Reject order group with error |

Rationale: RXO does not have its own order number fields. The order number comes from ORC.

### Condition ID [FALL-3]

| Priority | Source | Precondition | ID Format |
|---|---|---|---|
| 1 | DG1-20 (Diagnosis Identifier) | DG1-20.1 non-empty | `{DG1-20.1}` |
| 2 | Derived from order + DG1 position | DG1-20 empty | `{orderNumber}-dg1-{positional-index}` |
| FAIL | -- | Cannot determine order number | Reject order group with error |

Rationale: Only ex1 has DG1-20. All others need derived IDs. The positional index is 1-based within the order group's DG1 segments.

### Observation ID (supporting OBX in ORM) [FALL-4]

| Priority | Source | Precondition | ID Format |
|---|---|---|---|
| 1 | Derived from order + OBX position | Always | `{orderNumber}-obx-{positional-index}` |

Rationale: OBX in ORM context has no inherent unique identifier like OBX-1 Set ID. Ex6 OBX segments have no OBX-1.

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
| 2 | PID-18 (Patient Account Number) | PV1-19 not usable, PID-18 non-empty |
| SKIP | -- | Neither available | Skip Encounter creation, status = processed (not warning for ORM -- since PV1 is optional) |

Rationale: PV1-19 is rarely populated in ORM examples (1/6). PID-18 is populated in 4/6 examples and can serve as an account-based encounter identifier. This is an ORM-specific extension beyond ORU behavior.

### Coverage ID [FALL-7]

| Priority | Source | Precondition | ID Format |
|---|---|---|---|
| 1 | Derived from patient + IN1 position | Always when IN1 present | `{patientId}-coverage-{positional-index}` |

Rationale: IN1 segments lack a unique identifier field in the examples. Positional index within the message provides uniqueness.

---

## Acceptance Criteria for Implementation

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
- [AC-16] Non-standard ORC-5 values ("Final", "Pending") that are not in OrderStatus map should be handled via a new `orc-status` mapping type for code resolution (similar to `obr-status` pattern), OR mapped to "unknown". -- Open Question, see below.
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

## Open Questions / Unknowns

### OQ-1: ORC-5 Non-Standard Values Handling Strategy [Blocking: Medium]

**Options**:
(A) Create a new `orc-status` mapping type (like existing `obr-status`), allowing ConceptMap-based resolution per sender.
(B) Map non-standard ORC-5 values to "unknown" and log a warning.
(C) Reject orders with non-standard ORC-5 values.

**Recommendation**: Option A follows established project patterns and allows sender-specific customization. But it adds complexity for a field that is only rarely non-standard. Option B is simpler but loses information.

### OQ-2: ORM OBX LOINC Resolution [Blocking: High]

This document proposes that ORM OBX segments should NOT go through LOINC resolution (REQ-OBX-NOLOINC-1). This is a deliberate deviation from how ORU OBX works. **Confirmation needed** that this is the desired behavior. Alternative: treat ORM OBX like ORU OBX (with LOINC resolution and potential mapping_error).

### OQ-3: Encounter ID from PID-18 [Blocking: Medium]

The Encounter ID fallback chain (FALL-6) proposes using PID-18 (Patient Account Number) as an Encounter identifier when PV1-19 is missing. This is an ORM-specific extension. **Confirmation needed** that this is acceptable, or whether to simply skip Encounter creation when PV1-19 is absent.

### OQ-4: IN1 -> Coverage Scope [Blocking: Low]

The V2-to-FHIR IG maps IN1 to Coverage. Example 2 has 1 IN1, example 6 has 3 IN1 segments. **Question**: Should Coverage resources be created as part of ORM processing, or is this deferred? The existing ORU converter does not handle IN1. Adding Coverage would be new functionality.

### OQ-5: Order Type -- OBR vs RXO Detection [Blocking: Low]

How should the converter detect order type? Per spec, ORDER_CHOICE is exactly one of OBR/RXO/RQD/etc. **Proposal**: Scan ORDER_DETAIL for the first segment that is OBR, RXO, or other known ORDER_CHOICE type. If OBR found, map to ServiceRequest. If RXO found, map to MedicationRequest. If neither found, skip the order group with a warning.

### OQ-6: DG1-3 Coding System URI Normalization [Blocking: Low]

Real messages use "I10", "ICD-10-CM" as DG1-3.3 values. These need to be normalized to FHIR system URIs. **Proposal**: Map "I10" and "ICD-10-CM" to `http://hl7.org/fhir/sid/icd-10-cm`. This should use the existing coding system normalization infrastructure if available, or be added as a new mapping in the system URI normalizer.

---

# Codebase Exploration

## Exploration Summary

- **Router**: `src/v2-to-fhir/converter.ts` routes messages by MSH-9 type. Currently supports ADT_A01, ADT_A08, ORU_R01, VXU_V04. ORM_O01 is not registered. Adding it requires a new `case "ORM_O01"` and importing a new converter function.
- **Existing segment converters cover most ORM needs**: PID->Patient, PV1->Encounter, DG1->Condition, IN1->Coverage, OBX->Observation, NTE->Annotation all exist and are reusable. No segment converter exists for ORC->ServiceRequest or RXO->MedicationRequest.
- **RXO segment type is completely missing**: No `fromRXO` parser, no `RXO` interface in generated types (`src/hl7v2/generated/fields.ts`). This must be generated via `bun run regenerate-hl7v2` or manually created.
- **ORM_O01 message structure not in generated HL7v2 types**: The spec lookup confirms ORM_O01 is a pre-v2.8.2 message type (retired after v2.5.1). The `data/hl7v2-reference/` only has v2.5 and v2.8.2. The v2.5 reference has ORM_O01 structure, but no generated message type exists in `src/hl7v2/generated/messages.ts`.
- **Pattern: ORU_R01 is the closest analog** for ORM converter design. Both have multi-group structures (OBR groups in ORU; ORDER groups with ORC+OBR/RXO in ORM). The ORU pattern of grouping segments, processing each group, collecting mapping errors, and building a transaction bundle is directly reusable.
- **ADT_A01 is the closest analog for DG1/IN1 handling**: ADT already integrates `convertDG1ToCondition` and `convertIN1ToCoverage` with ID generation and patient/encounter linking. The ORM converter should follow the same integration patterns.
- **No ORC->ServiceRequest mapping exists anywhere in the codebase**: This is entirely new functionality. The ORC type (`src/hl7v2/generated/fields.ts:3409`) is fully generated with all 31 fields. The IG mapping CSV (`docs/v2-to-fhir-spec/mappings/segments/HL7 Segment - FHIR R4_ ORC[ServiceRequest] - ORC.csv`) is available.
- **Status mapping complexity**: ORC status resolution requires a two-tier fallback (ORC-5 -> ORC-1) with vocabulary maps from two different IG CSVs. This is more complex than existing status mappings (OBR-25, OBX-11) which use single-table lookups.
- **Config infrastructure is ready**: `config/hl7v2-to-fhir.json` supports per-message-type preprocessors and converter settings. Adding `"ORM-O01"` config follows existing patterns.
- **`normalizeSystem()` partially covers DG1 coding systems**: `"I10"` maps to `http://hl7.org/fhir/sid/icd-10` (note: ICD-10, not ICD-10-CM). `"ICD-10-CM"` is NOT in the normalizer. The ticket requirement [OQ-6] calls for both to map to `http://hl7.org/fhir/sid/icd-10-cm`. The existing normalizer maps `"I10"` to the wrong system URI for this use case.

## What Already Exists (Evidence-Backed)

### Reusable Segment Converters

| Converter | Location | Used By | ORM Usage |
|---|---|---|---|
| `convertPIDToPatient()` | `src/v2-to-fhir/segments/pid-patient.ts:174` | ADT, ORU, VXU | Reuse as-is for PID->Patient |
| `handlePatient()` | `src/v2-to-fhir/segments/pid-patient.ts:608` | ORU, VXU | Reuse for lookup/draft creation |
| `extractSenderTag()` | `src/v2-to-fhir/segments/pid-patient.ts:122` | ORU | Reuse for sender tag extraction |
| `parsePV1()` | `src/v2-to-fhir/segments/pv1-encounter.ts:829` | ORU | Reuse for PV1 segment extraction |
| `handleEncounter()` | `src/v2-to-fhir/segments/pv1-encounter.ts:873` | ORU | Reuse for encounter lookup/draft creation |
| `convertDG1ToCondition()` | `src/v2-to-fhir/segments/dg1-condition.ts:96` | ADT | Reuse for DG1->Condition (returns `Omit<Condition, "subject">`) |
| `convertIN1ToCoverage()` | `src/v2-to-fhir/segments/in1-coverage.ts:100` | ADT | Reuse for IN1->Coverage |
| `convertOBXToObservation()` | `src/v2-to-fhir/segments/obx-observation.ts:303` | ORU | Reuse for OBX->Observation (sync version, no LOINC resolution -- appropriate for ORM) |
| `convertOBXWithMappingSupportAsync()` | `src/v2-to-fhir/segments/obx-observation.ts:559` | ORU | Reuse for OBX->Observation with OBX-11 status mapping support (but WITHOUT LOINC resolution) |
| `convertNTEsToAnnotation()` | `src/v2-to-fhir/segments/nte-annotation.ts:20` | ORU | Reuse for NTE->ServiceRequest.note |

### Reusable Infrastructure

| Module | Location | Purpose | ORM Usage |
|---|---|---|---|
| `parseMSH()` | `src/v2-to-fhir/segments/msh-parsing.ts:50` | Extract sender context, meta tags | Reuse as-is |
| `addSenderTagToMeta()` | `src/v2-to-fhir/segments/msh-parsing.ts:41` | Add sender tag to resource meta | Reuse as-is |
| `createBundleEntry()` | `src/v2-to-fhir/fhir-bundle.ts:7` | Create PUT bundle entries | Reuse as-is |
| `buildMappingErrorResult()` | `src/code-mapping/mapping-errors.ts:44` | Build ConversionResult for mapping errors | Reuse as-is |
| `sanitizeForId()` | `src/v2-to-fhir/identity-system/utils.ts:5` | Sanitize strings for FHIR IDs | Reuse as-is |
| `normalizeSystem()` | `src/v2-to-fhir/code-mapping/coding-systems.ts:13` | Normalize coding system URIs | Reuse + extend |
| `convertCEToCodeableConcept()` | `src/v2-to-fhir/datatypes/ce-codeableconcept.ts` | CE->CodeableConcept | Reuse for OBR-4, DG1-3 |
| `convertXCNToPractitioner()` | `src/v2-to-fhir/datatypes/xcn-practitioner.ts` | XCN->Practitioner | Reuse for ORC-12 |
| `convertXONToOrganization()` | `src/v2-to-fhir/datatypes/xon-organization.ts` | XON->Organization | Reuse for ORC-21 |
| `convertXADToAddress()` | `src/v2-to-fhir/datatypes/xad-address.ts` | XAD->Address | Reuse for ORC-22 |
| `convertXTNToContactPoint()` | `src/v2-to-fhir/datatypes/xtn-contactpoint.ts` | XTN->ContactPoint | Reuse for ORC-14, OBR-17 |
| `convertCXToIdentifier()` | `src/v2-to-fhir/datatypes/cx-identifier.ts` | CX->Identifier | Reuse for various |
| `makeTestContext()` | `test/unit/v2-to-fhir/helpers.ts:5` | Create test converter context | Reuse in unit tests |
| `ConverterContext` | `src/v2-to-fhir/converter-context.ts:12` | Context with config, patient/encounter lookups | Reuse as-is |
| `preprocessMessage()` | `src/v2-to-fhir/preprocessor.ts:28` | Config-driven message preprocessing | Reuse as-is (add ORM-O01 config) |

### Reusable Patterns from ADT for DG1/IN1

| Pattern | ADT Location | Description |
|---|---|---|
| DG1 deduplication | `src/v2-to-fhir/messages/adt-a01.ts:106-150` | `prepareDG1ForExtraction()` -- dedup by diagnosis code+display, keep lowest priority. Useful pattern but ORM DG1s are per-order-group, not message-level. |
| Condition ID generation | `src/v2-to-fhir/messages/adt-a01.ts:157-167` | `generateConditionId()` -- uses DG1-4 or DG1-3 text + prefix. ORM needs different strategy: order-number + positional index. |
| Coverage ID generation | `src/v2-to-fhir/messages/adt-a01.ts:174-202` | `generateCoverageId()` -- uses IN1-3 or IN1-4 + patient prefix. ORM can reuse or simplify. |
| IN1 validity check | `src/v2-to-fhir/messages/adt-a01.ts:209-224` | `hasValidPayorInfo()` -- checks IN1-3 or IN1-4 present. Reusable. |
| Linking DG1 Conditions | `src/v2-to-fhir/messages/adt-a01.ts:426-441` | Sets `condition.subject`, `condition.encounter`, `condition.id`. ORM: similar but links via `ServiceRequest.reasonReference`. |
| Linking IN1 Coverages | `src/v2-to-fhir/messages/adt-a01.ts:479-496` | Sets `coverage.beneficiary`, `coverage.id`. ORM: same pattern. |

### Generated HL7v2 Types Available

| Type | Location | Fields | Notes |
|---|---|---|---|
| `ORC` | `src/hl7v2/generated/fields.ts:3409` | 31 fields ($1 through $31) | Full type with all fields needed for ServiceRequest mapping |
| `OBR` | `src/hl7v2/generated/fields.ts:3251` | 50+ fields | Full type, already used by ORU converter |
| `DG1` | `src/hl7v2/generated/fields.ts` (via `fromDG1`) | All fields | Already used by ADT converter |
| `IN1` | `src/hl7v2/generated/fields.ts` (via `fromIN1`) | All fields | Already used by ADT converter |
| `NTE` | `src/hl7v2/generated/fields.ts` (via `fromNTE`) | All fields | Already used by ORU converter |
| `OBX` | `src/hl7v2/wrappers` (via `fromOBX`) | All fields | Already used by ORU converter (wrapper version) |
| `RXO` | **NOT GENERATED** | N/A | Must be generated or manually created |
| `fromORC()` | `src/hl7v2/generated/fields.ts:6742` | Parser | Available but only imported by VXU (unused in practice since VXU is stub) |

### FHIR Types Available

| Type | Location | Required Fields | Notes |
|---|---|---|---|
| `ServiceRequest` | `src/fhir/hl7-fhir-r4-core/ServiceRequest.ts:27` | `intent`, `status`, `subject` | All needed fields: `identifier`, `code`, `reasonReference`, `supportingInfo`, `note`, `requester`, `requisition`, `authoredOn`, `locationCode`, `orderDetail`, `priority`, `occurrenceDateTime` |
| `MedicationRequest` | `src/fhir/hl7-fhir-r4-core/MedicationRequest.ts:48` | `intent`, `status`, `subject` | All needed fields: `medicationCodeableConcept`, `dosageInstruction`, `dispenseRequest`, `substitution`, `requester`, `note`, `reasonReference` |
| `Condition` | Already used by ADT | `subject` | Already proven in ADT converter |
| `Coverage` | Already used by ADT | `beneficiary`, `payor`, `status` | Already proven in ADT converter |
| `Observation` | Already used by ORU | `status`, `code` | Already proven in ORU converter |

## Reusable Patterns for New Converter

### Pattern 1: Message-Level MSH/PID/PV1 Handling
- **Where used**: `src/v2-to-fhir/messages/oru-r01.ts:468-515`
- **Why reuse**: The ORU converter demonstrates the exact pattern needed: `parseMSH()` -> `parsePID()` -> `handlePatient()` -> `parsePV1()` -> `handleEncounter()` -> group-level processing -> bundle assembly. The ORM converter follows the same structure with PV1 optional (same as ORU).
- **Caveats**: The ORU validates OBR presence (`validateOBRPresence`). ORM must validate ORC presence instead, and OBR/RXO presence within ORDER_DETAIL is conditional.

### Pattern 2: Segment Grouping
- **Where used**: `src/v2-to-fhir/messages/oru-r01.ts:65-118` (`groupSegmentsByOBR`)
- **Why reuse**: The state-machine approach to grouping segments (iterate, switch on segment type, accumulate into groups) is the right pattern for ORM ORDER groups. ORM groups are more complex (ORC starts a group, then OBR/RXO/NTE/DG1/OBX follow) but the same pattern applies.
- **Caveats**: ORU groups are flat (OBR -> OBX* -> NTE* -> SPM*). ORM groups have a two-level nesting: ORDER (ORC) -> ORDER_DETAIL (OBR/RXO + NTE* + DG1* + OBSERVATION(OBX + NTE*)). The grouping logic must be more sophisticated.

### Pattern 3: Mapping Error Collection and Result Building
- **Where used**: `src/v2-to-fhir/messages/oru-r01.ts:522-538` and `src/code-mapping/mapping-errors.ts:44`
- **Why reuse**: Collect `MappingError[]` across all order groups, then call `buildMappingErrorResult()` if any errors exist. The pattern of short-circuiting on mapping errors while preserving Tasks is essential.
- **Caveats**: ORM adds a new mapping type (ORC status, if OQ-1 Option A is chosen). The `MAPPING_TYPES` registry in `src/code-mapping/mapping-types.ts` must be extended.

### Pattern 4: Deterministic ID Generation
- **Where used**: Various locations -- ORU uses `getOrderNumber()` from OBR-3/OBR-2 (`src/v2-to-fhir/messages/oru-r01.ts:225-239`), ADT uses `generateConditionId()` / `generateCoverageId()`, OBX uses `{orderNumber}-obx-{setId}` pattern.
- **Why reuse**: The `sanitizeForId()` utility and the pattern of deriving IDs from EI components are standard. ORM should follow the same convention.
- **Caveats**: ORM ID generation differs from ORU: ORM prefers ORC-2 (placer) over OBR-3 (filler) because this is an ORDER (not a result). The fallback chain is specified in the ticket (FALL-1 through FALL-7).

### Pattern 5: Config-Driven PV1 Policy
- **Where used**: `src/v2-to-fhir/segments/pv1-encounter.ts:873-926` (`handleEncounter` with config key)
- **Why reuse**: The config key `"ORM-O01"` follows the same pattern as `"ORU-R01"` and `"VXU-V04"`. Set `PV1.required = false` for ORM.
- **Caveats**: None -- the infrastructure is designed for this exact extensibility.

### Pattern 6: Draft Patient/Encounter Creation
- **Where used**: `src/v2-to-fhir/segments/pid-patient.ts:608-632` (`handlePatient`) and `src/v2-to-fhir/segments/pv1-encounter.ts:873-926` (`handleEncounter`)
- **Why reuse**: Uses POST with If-None-Exist for race condition safety. ORM follows the same ownership model: ORM does not own Patient/Encounter (ADT does), so it creates drafts.
- **Caveats**: None.

### Anti-Pattern: Large Monolithic Converter Functions
- **Where seen**: `src/v2-to-fhir/messages/adt-a01.ts:270-556` -- the `convertADT_A01` function is ~290 lines with inline MSH parsing, patient handling, encounter handling, and all segment processing.
- **Why avoid**: The code style guide says functions >100 lines should be critically reviewed. The ORU converter already demonstrates the better pattern: extract helper functions (`parsePID`, `processObservations`, `processOBRGroup`, `buildBundleEntries`) and compose them in the main function.
- **Recommendation**: ORM should follow the ORU decomposition pattern, not the ADT monolith pattern. Extract `groupORMOrders()`, `processOrderGroup()`, `buildServiceRequestFromORC()`, `buildServiceRequestFromOBR()`, `buildMedicationRequestFromRXO()`.

## Gaps and Missing Pieces

### GAP-A: No ORC->ServiceRequest Converter [Critical]
- **Impact**: The core conversion from ORC to ServiceRequest does not exist anywhere. All 31 ORC fields need mapping per the IG CSV.
- **Evidence**: No file in `src/v2-to-fhir/segments/` handles ORC->ServiceRequest. The only ORC usage is `fromORC` imported by VXU (`src/v2-to-fhir/messages/vxu-v04.ts:30`) but never called (VXU is a stub).
- **Suggested direction**: Create `src/v2-to-fhir/segments/orc-servicerequest.ts` following the pattern of `obr-diagnosticreport.ts` but mapping to ServiceRequest per `docs/v2-to-fhir-spec/mappings/segments/HL7 Segment - FHIR R4_ ORC[ServiceRequest] - ORC.csv`. Include the two-tier status resolution (ORC-5 then ORC-1).

### GAP-B: No OBR->ServiceRequest Converter [Critical]
- **Impact**: The existing `obr-diagnosticreport.ts` maps OBR to DiagnosticReport (for ORU). ORM needs OBR mapped to ServiceRequest (different fields, different semantics). Cannot reuse the existing converter -- it produces the wrong resource type.
- **Evidence**: `src/v2-to-fhir/segments/obr-diagnosticreport.ts` only creates `DiagnosticReport`. The IG mapping `docs/v2-to-fhir-spec/mappings/segments/HL7 Segment - FHIR R4_ OBR[ServiceRequest] - OBR.csv` defines a completely different field mapping.
- **Suggested direction**: Create `src/v2-to-fhir/segments/obr-servicerequest.ts` that merges OBR data into a ServiceRequest created from ORC. Fields: OBR-2 (placer fallback), OBR-3 (filler fallback), OBR-4 (code), OBR-5 (priority), OBR-6 (occurrenceDateTime), OBR-11 (intent override), OBR-16 (requester fallback), OBR-17 (callback phone), OBR-27 (quantity/timing), OBR-31 (reasonCode), OBR-46 (orderDetail).

### GAP-C: No RXO->MedicationRequest Converter [Critical]
- **Impact**: RXO segment type is not in generated HL7v2 types. No `fromRXO` parser, no `RXO` interface. The converter cannot parse RXO segments at all.
- **Evidence**: `grep -r "RXO" src/hl7v2/` returns no results. The generated fields file has no RXO interface or parser.
- **Suggested direction**: (1) Run `bun run regenerate-hl7v2` to check if RXO can be auto-generated. If not (likely, since ORM is pre-v2.8.2), manually create `src/hl7v2/wrappers/rxo.ts` with the RXO interface and `fromRXO()` parser, following the wrapper pattern used for OBX (`src/hl7v2/wrappers/`). (2) Create `src/v2-to-fhir/segments/rxo-medicationrequest.ts` per the IG mapping.

### GAP-D: No ORM_O01 Routing [Low]
- **Impact**: `convertToFHIR()` throws "Unsupported message type: ORM_O01" for any ORM message.
- **Evidence**: `src/v2-to-fhir/converter.ts:91-107` -- switch statement only handles ADT_A01, ADT_A08, ORU_R01, VXU_V04.
- **Suggested direction**: Add `case "ORM_O01": return await convertORM_O01(parsed, context);` and import the new converter.

### GAP-E: No ORM Config Entry [Low]
- **Impact**: Preprocessing and PV1 policy not configured for ORM messages.
- **Evidence**: `config/hl7v2-to-fhir.json` has entries for ADT-A01, ADT-A08, ORU-R01, VXU-V04 but not ORM-O01.
- **Suggested direction**: Add `"ORM-O01"` entry with same PID/PV1 preprocessors as ORU-R01, and `"converter": { "PV1": { "required": false } }`.

### GAP-F: ORC Status Resolution is Novel [Medium]
- **Impact**: No existing pattern for the two-tier ORC-5/ORC-1 status fallback described in the IG. All existing status resolvers (OBR-25, OBX-11, PV1-2) use a single source field.
- **Evidence**: The IG specifies: if ORC-5 valued, use OrderStatus map; else use ORC-1 OrderControlCode map. The OrderControlCode map has gaps (SC has no mapping). Both vocabulary maps exist as CSVs in `docs/v2-to-fhir-spec/mappings/codesystems/`.
- **Suggested direction**: Implement in `orc-servicerequest.ts` as a function `resolveServiceRequestStatus(orc1, orc5, senderContext)` that: (1) tries ORC-5 against OrderStatus hardcoded map, (2) if not valued or not found, tries ORC-1 against OrderControlCode hardcoded map, (3) if still not found, falls back to "unknown". Whether to add an `orc-status` mapping type depends on the answer to OQ-1.

### GAP-G: `normalizeSystem()` Does Not Cover ICD-10-CM [Low]
- **Impact**: DG1-3.3 values "ICD-10-CM" will not be normalized to a FHIR system URI. "I10" maps to `http://hl7.org/fhir/sid/icd-10` (generic ICD-10), not `http://hl7.org/fhir/sid/icd-10-cm` (US clinical modification).
- **Evidence**: `src/v2-to-fhir/code-mapping/coding-systems.ts:23` -- `if (upper === "ICD10" || upper === "I10")` maps to `/icd-10`. No handling for "ICD-10-CM".
- **Suggested direction**: Add `"ICD-10-CM"` and `"ICD10CM"` to `normalizeSystem()` mapping to `http://hl7.org/fhir/sid/icd-10-cm`. Consider whether "I10" should also map to icd-10-cm (this is a broader question that may affect other converters).

### GAP-H: No ORDER Group Segmentation Logic [Critical]
- **Impact**: ORM messages contain ORDER groups (ORC + ORDER_DETAIL) that must be segmented before processing. No existing grouping logic handles the ORM structure.
- **Evidence**: ORU has `groupSegmentsByOBR()` which groups by OBR. ORM groups by ORC, with ORDER_DETAIL containing OBR/RXO + NTE + DG1 + OBX. The structure is different enough that a new grouper is needed.
- **Suggested direction**: Create `groupORMOrders()` in the new `orm-o01.ts` message converter. Each group starts with ORC. Within each group, detect ORDER_CHOICE type (first OBR or RXO after ORC). Collect NTE, DG1, OBX following the ORDER_CHOICE.

### GAP-I: MedicationRequest Status from ORC [Medium]
- **Impact**: The IG maps ORC->ServiceRequest status. For RXO-based orders, ORC maps to MedicationRequest (different resource, different status value set). The MedicationRequest.status value set differs from ServiceRequest.status.
- **Evidence**: `ServiceRequest.status`: draft, active, on-hold, revoked, completed, entered-in-error, unknown. `MedicationRequest.status`: active, on-hold, cancelled, completed, entered-in-error, stopped, draft, unknown. "revoked" (ServiceRequest) vs "cancelled" (MedicationRequest) -- the OrderStatus vocabulary map outputs "revoked" for CA/DC/RP, but MedicationRequest uses "cancelled".
- **Suggested direction**: The ORC status resolution for MedicationRequest must use MedicationRequest-compatible status values. Either create a separate status resolver for MedicationRequest, or apply a translation layer (revoked -> cancelled).

## Test Readiness Assessment

### Existing Tests That Provide Coverage

| Test File | Relevance | What It Covers |
|---|---|---|
| `test/unit/v2-to-fhir/messages/oru-r01.test.ts` | Pattern reference | PV1 policy, encounter handling, mapping error flow -- same patterns needed for ORM |
| `test/unit/v2-to-fhir/messages/adt-a01.test.ts` | Pattern reference | DG1->Condition, IN1->Coverage integration, patient ID resolution |
| `test/unit/v2-to-fhir/segments/obx-observation.test.ts` | Reusable | OBX->Observation conversion, status mapping, value type parsing |
| `test/unit/v2-to-fhir/segments/pv1-encounter.test.ts` | Reusable | PV1->Encounter conversion, patient class resolution |
| `test/unit/v2-to-fhir/segments/pid-patient.test.ts` | Reusable | PID->Patient conversion |
| `test/unit/v2-to-fhir/segments/nte-annotation.test.ts` | Reusable | NTE->Annotation conversion |
| `test/unit/code-mapping/mapping-errors.test.ts` | Reusable | `buildMappingErrorResult()` behavior |
| `test/unit/code-mapping/mapping-types.test.ts` | Must update | Must add new mapping type(s) if OQ-1 Option A is chosen |
| `test/unit/v2-to-fhir/coding-systems.test.ts` | Must update | Must add tests for "ICD-10-CM" normalization |
| `test/integration/v2-to-fhir/oru-r01.integration.test.ts` | Pattern reference | End-to-end processing pipeline pattern |
| `test/integration/v2-to-fhir/converter-pipeline.integration.test.ts` | Pattern reference | Converter pipeline integration |

### Missing Tests Required Before/During Implementation

| Test Needed | Type | Priority | Description |
|---|---|---|---|
| ORC->ServiceRequest unit tests | Unit | Critical | Field mapping: ORC-1/5 status resolution, ORC-2/3 identifiers, ORC-4 requisition, ORC-9 authoredOn, ORC-12 requester, ORC-21/22/23 ordering facility, ORC-29 locationCode |
| OBR->ServiceRequest (merge) unit tests | Unit | Critical | Field mapping: OBR-2/3 identifier fallback, OBR-4 code, OBR-5 priority, OBR-6 occurrenceDateTime, OBR-11 intent override, OBR-16 requester fallback, OBR-17 callback phone, OBR-27 timing, OBR-31 reasonCode |
| RXO->MedicationRequest unit tests | Unit | Critical | Field mapping: RXO-1 medication code, RXO-2/3/4 dosage, RXO-5 doseForm, RXO-9 substitution, RXO-11/12 dispense, RXO-13 refills, RXO-14 requester, RXO-18/19/25/26 strength |
| ORM_O01 message converter unit tests | Unit | Critical | All 6 examples processed correctly: resource types, counts, IDs, linking |
| ORDER group segmentation tests | Unit | Critical | Multi-order messages (ex2: 2 OBR orders, ex6: 2 RXO orders), segment grouping correctness |
| ORC status fallback chain tests | Unit | High | ORC-5 valued -> OrderStatus map; ORC-5 empty + ORC-1 valued -> OrderControlCode map; both empty -> "unknown"; non-standard values |
| DG1->ServiceRequest.reasonReference linking tests | Unit | High | Multiple DG1s per order group, positional ID generation, correct linking |
| OBX->ServiceRequest.supportingInfo linking tests | Unit | High | OBX without LOINC resolution, positional ID generation, correct linking |
| NTE->ServiceRequest.note tests | Unit | Medium | Multiple NTE per order group, concatenation behavior |
| IN1->Coverage tests for ORM context | Unit | Medium | Multiple IN1s, positional ID generation, patient linking |
| Empty PV1 handling tests | Unit | Medium | PV1 present but empty -> treated as absent, no Encounter created |
| ORM end-to-end integration test | Integration | High | MLLP receive -> IncomingHL7v2Message -> processing -> FHIR resources in Aidbox |
| ORM test fixtures | Fixture | Critical | Need `.hl7` fixtures in `test/fixtures/hl7v2/orm-o01/` based on example messages (de-identified) |

## Open Questions / Unknowns

### OQ-RXO-GENERATION: How to generate RXO type?
- **Why unresolved**: RXO is not in the generated HL7v2 types. ORM_O01 is a pre-v2.8.2 message type. The code generation pipeline (`bun run regenerate-hl7v2`) uses v2.8.2 reference data, which does not include ORM_O01. RXO may exist in the v2.5 reference data (`data/hl7v2-reference/v2.5/`), but the code generation scripts may not support v2.5.
- **Options**: (A) Manually create `RXO` interface and `fromRXO()` parser in `src/hl7v2/wrappers/rxo.ts` following the OBX wrapper pattern. (B) Extend the code generation pipeline to also process v2.5 data. (C) Check if `@atomic-ehr/hl7v2` parser returns raw segment data that can be manually extracted.
- **Recommendation**: Option A is lowest risk and fastest. The RXO segment has ~30 fields but only ~15 are mapped per the IG. A manual wrapper with just the needed fields is sufficient.

### OQ-OBX-STATUS-DEFAULT: Should ORM OBX use "registered" default for missing OBX-11?
- **Why unresolved**: The ticket proposes RELAX-5 (default to "registered" for missing OBX-11 in ORM context). The existing `convertOBXWithMappingSupportAsync()` returns a mapping error for missing OBX-11. To use a default, the ORM converter would need to either: (A) bypass the mapping support version and use the sync `convertOBXToObservation()` (which throws on invalid status), or (B) create a new ORM-specific OBX conversion function that defaults missing status to "registered", or (C) add an options parameter to the existing function.
- **Recommendation**: Option C -- add an optional `defaultStatus` parameter to `convertOBXWithMappingSupportAsync()`. When provided and OBX-11 is missing, use the default instead of returning a mapping error. This is backward-compatible.

### OQ-SERVICE-REQUEST-FHIR-TYPE: ServiceRequest.status "unknown" validity
- **Why unresolved**: The ticket proposes RELAX-1 (default to "unknown" when ORC-1 and ORC-5 both fail to map). The FHIR ServiceRequest.status value set includes "unknown" (`src/fhir/hl7-fhir-r4-core/ServiceRequest.ts:65`), confirming it is valid. No question remains -- "unknown" is a valid default.

### OQ-MULTI-ORDER-DG1-SCOPE: Are DG1 segments per-order or per-message?
- **Why unresolved**: In the ORM spec, DG1 segments appear inside ORDER_DETAIL (per-order). In example 6, there are DG1 segments that appear between different ORC groups. The grouping logic must correctly associate DG1 segments with their parent order group.
- **Impact**: If DG1 segments are mis-associated, Conditions will be linked to the wrong ServiceRequest via reasonReference.
- **Recommendation**: The grouping function should associate DG1 segments with the most recent ORC/ORDER_CHOICE segment, following the spec structure where DG1 is inside ORDER_DETAIL.

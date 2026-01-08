# ORU_R01 Core Processing (Without Custom Mappings)

This document covers the basic ORU_R01 message parsing and conversion to FHIR resources, assuming all codes are already resolvable (either inline LOINC or pre-existing mappings).

## Overview

ORU_R01 (Unsolicited Observation Result) messages contain laboratory results and must be converted to FHIR DiagnosticReport and Observation resources.

## Use Case: Successful Mapping (Happy Path)

**Scenario:** An ORU_R01 message arrives with lab results where all OBX observation codes either:
- Already contain a valid LOINC code in the alternate coding fields (OBX-3.4 through OBX-3.6), or
- Have been previously mapped in the ConceptMap for this sender

**Flow:**
1. MLLP server receives ORU_R01 message → creates `IncomingHL7v2Message` with `status=received`
2. Processor service picks up the message
3. For each OBX segment:
   - Extract local code from OBX-3.1-3 (identifier, text, system)
   - Check if LOINC code exists in OBX-3.4-6 (alternate identifier, text, system)
   - If no LOINC, lookup in sender-specific ConceptMap
   - All codes resolve → continue processing
4. Convert to FHIR Bundle:
   - PID → Patient (lookup or create)
   - PV1 → Encounter (lookup existing visit, do NOT create)
   - OBR → DiagnosticReport
   - OBX → Observation (linked to DiagnosticReport)
   - NTE → Annotation (attached to Observation or DiagnosticReport)
5. Submit transaction bundle to Aidbox
6. Update `IncomingHL7v2Message` to `status=processed`

**Expected Outcome:** Lab results appear in patient's record as DiagnosticReport with linked Observations.

---

## FHIR Resources Created

```
DiagnosticReport
├── id: {messageControlId}-{obrSetId}
├── status: from OBR-25 (mapped to FHIR status)
├── code: from OBR-4 (Universal Service Identifier)
├── subject: Reference(Patient)
├── encounter: Reference(Encounter) - looked up, not created
├── effectiveDateTime: from OBR-7 (Observation Date/Time)
├── issued: from OBR-22 (Results Report/Status Change)
├── performer: from OBR-16 (Ordering Provider)
├── result: [Reference(Observation), ...]
└── meta.tag: [{system: "urn:aidbox:hl7v2:message-id", code: "{messageControlId}"}]

Observation
├── id: {diagnosticReportId}-obx-{setId}
├── status: from OBX-11 (Observation Result Status)
├── code: CodeableConcept with LOINC (resolved via mapping)
├── subject: Reference(Patient)
├── encounter: Reference(Encounter)
├── effectiveDateTime: from OBX-14 (Date/Time of Observation)
├── valueQuantity | valueString | valueCodeableConcept: from OBX-5 based on OBX-2
├── interpretation: from OBX-8 (Abnormal Flags)
├── referenceRange: from OBX-7 (Reference Range)
├── performer: from OBX-16 (Responsible Observer)
└── note: from associated NTE segments
```

---

## File Structure

```
src/
├── v2-to-fhir/
│   ├── messages/
│   │   └── oru-r01.ts                 # ORU_R01 message converter
│   ├── segments/
│   │   ├── obr-diagnosticreport.ts    # OBR → DiagnosticReport
│   │   ├── obx-observation.ts         # OBX → Observation
│   │   └── nte-annotation.ts          # NTE → Annotation
│   └── converter.ts                   # Add ORU_R01 case to router
```

---

## OBX Value Type Mapping

| OBX-2 (Value Type) | FHIR Observation.value[x] | Notes |
|--------------------|---------------------------|-------|
| NM | valueQuantity | Numeric with OBX-6 units |
| ST | valueString | String/text |
| TX | valueString | Text data |
| CE | valueCodeableConcept | Coded entry |
| CWE | valueCodeableConcept | Coded with exceptions |
| SN | valueQuantity or valueRange or valueRatio or valueString | Structured numeric (see below) |
| DT | valueDateTime | Date |
| TM | valueTime | Time |
| TS | valueDateTime | Timestamp |

**SN (Structured Numeric) Parsing Logic:**
- SN format: `<comparator>^<num1>^<separator>^<num2>` (e.g., ">^90", "<^5", "^10^-^20", "^1^:^500")
- **Comparator + number** (e.g., ">^90"): Use `valueQuantity` with `comparator` field set to `>`, `<`, `>=`, `<=`
- **Range** (e.g., "^10^-^20"): Use `valueRange` with `low` and `high` Quantity values
- **Ratio** (e.g., "^1^:^500"): Use `valueRatio` with `numerator` and `denominator` Quantity values
- **Plain number** (e.g., "^90"): Use `valueQuantity`
- **Fallback**: If pattern cannot be parsed, use `valueString` with raw value

---

## Implementation Tasks

### Phase 1: Core ORU_R01 Processing

- [ ] **1.0** Add sendingApplication and sendingFacility fields to IncomingHL7v2Message
  - Update StructureDefinition in init-bundle.json
  - Update TypeScript interface in `src/fhir/aidbox-hl7v2-custom/`

- [ ] **1.1** Write tests for ORU_R01 processing (TDD - write tests first)
  - **Unit tests:**
    - OBR → DiagnosticReport field mapping
    - OBX → Observation for each value type (NM, ST, TX, CE, CWE, SN)
    - Reference range parsing (simple "3.5-5.5", comparator ">60", text "negative")
    - Abnormal flag mapping (version-aware: simple string for v2.6-, CWE for v2.7+)
  - **Integration tests:**
    - Full ORU_R01 message → FHIR Bundle conversion
    - Sample messages from spec (v2.3 and v2.5.1 examples)
  - **Edge cases:**
    - Missing optional fields
    - Multiple OBR groups
    - NTE attachment to correct parent
    - Invalid/malformed values
  - **Error handling:**
    - Missing required fields
    - Patient not found
    - Encounter not found

- [ ] **1.2** Create segment converter: `obr-diagnosticreport.ts`
  - Extract OBR fields to DiagnosticReport
  - Map OBR-25 status to FHIR DiagnosticReport.status
  - Generate deterministic ID: `{messageControlId}-{obrSetId}`

- [ ] **1.3** Create segment converter: `obx-observation.ts`
  - Extract OBX fields to Observation
  - Map OBX-11 status to FHIR Observation.status
  - Handle all OBX-2 value types (NM, ST, TX, CE, CWE, SN, etc.)
  - Parse OBX-7 reference range into Observation.referenceRange
  - Handle OBX-8 interpretation codes with version awareness:
    - Check MSH-12 for HL7 version
    - For v2.6 and earlier: parse as simple code string (H, L, A, N, etc.)
    - For v2.7+: parse as CWE, extract code from OBX-8.1 and system from OBX-8.3
    - Fallback to simple string parsing if CWE parsing fails
  - Generate deterministic ID: `{diagnosticReportId}-obx-{setId}`

- [ ] **1.4** Create segment converter: `nte-annotation.ts`
  - Convert NTE segments to Annotation
  - Attach to parent Observation or DiagnosticReport

- [ ] **1.5** Create message converter: `oru-r01.ts`
  - Parse full ORU_R01 message structure
  - Lookup existing Patient by PID-3 (do NOT create)
  - Lookup existing Encounter by PV1-19 or account number (do NOT create)
  - Assemble DiagnosticReport with linked Observations
  - Return FHIR transaction Bundle

- [ ] **1.6** Integrate into converter router
  - Add `ORU_R01` case to `src/v2-to-fhir/converter.ts`

---

## Appendix: OBX Field Reference

| Field | Name | Usage |
|-------|------|-------|
| OBX-1 | Set ID | Sequence number within OBR group |
| OBX-2 | Value Type | Determines how to interpret OBX-5 |
| OBX-3 | Observation Identifier | Local code (1-3) + LOINC (4-6) |
| OBX-4 | Observation Sub-ID | Used for multi-part results |
| OBX-5 | Observation Value | The actual result value |
| OBX-6 | Units | UCUM or local unit code |
| OBX-7 | Reference Range | Normal range (e.g., "3.5-5.5") |
| OBX-8 | Abnormal Flags | H=High, L=Low, A=Abnormal, etc. |
| OBX-11 | Observation Result Status | F=Final, P=Preliminary, C=Corrected |
| OBX-14 | Date/Time of Observation | When observation was made |
| OBX-16 | Responsible Observer | Person/entity that performed test |

## Appendix: OBR Field Reference

| Field | Name | Usage |
|-------|------|-------|
| OBR-1 | Set ID | Sequence number for multiple OBR |
| OBR-2 | Placer Order Number | Ordering system's order ID |
| OBR-3 | Filler Order Number | Lab's order ID |
| OBR-4 | Universal Service ID | Test/panel code |
| OBR-7 | Observation Date/Time | When specimen collected |
| OBR-16 | Ordering Provider | Physician who ordered test |
| OBR-22 | Results Rpt/Status Chng | When results reported |
| OBR-25 | Result Status | F=Final, P=Preliminary, etc. |

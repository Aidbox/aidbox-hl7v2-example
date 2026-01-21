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
   - If no LOINC and no mapping - stop the mapping with an error
   - All codes resolve → continue processing
4. Convert to FHIR Bundle:
   - PID → Patient (lookup only)
   - PV1 → Encounter (lookup existing visit, do NOT create)
   - ORC + OBR → DiagnosticReport
   - OBX → Observation (linked to DiagnosticReport)
   - PRT → PractitionerRole/Device (linked to DiagnosticReport or Observation based on context)
   - NTE → Observation.note (attached to parent Observation)
   - SPM/OBR-15 → Specimen
5. Submit transaction bundle to Aidbox
6. Update `IncomingHL7v2Message` to `status=processed`

**Expected Outcome:** Lab results appear in patient's record as DiagnosticReport with linked Observations.

---

## FHIR Resources Created

```
DiagnosticReport
├── id: {OBR-3} (filler order number)
├── status: from OBR-25 (mapped to FHIR status)
├── code: from OBR-4 (Universal Service Identifier)
├── subject: Reference(Patient)
├── encounter: Reference(Encounter) - looked up, not created
├── effectiveDateTime: from OBR-7 (Observation Date/Time)
├── issued: from OBR-22 (Results Report/Status Change)
├── performer: from PRT (ARI/TN/TR roles) → PractitionerRole
├── resultsInterpreter: from PRT (PRI role) → PractitionerRole
├── result: [Reference(Observation), ...]
├── specimen: [Reference(Specimen), ...]
└── meta.tag: [{system: "urn:aidbox:hl7v2:message-id", code: "{messageControlId}"}]

Observation
├── id: {OBR-3}-obx-{OBX-1}
├── status: from OBX-11 (Observation Result Status)
├── code: CodeableConcept with LOINC (resolved via mapping)
├── subject: Reference(Patient)
├── encounter: Reference(Encounter)
├── effectiveDateTime: from OBX-14 (Date/Time of Observation)
├── valueQuantity | valueString | valueCodeableConcept: from OBX-5 based on OBX-2
├── interpretation: from OBX-8 (Abnormal Flags)
├── referenceRange: from OBX-7 (Reference Range)
├── performer: from PRT (PRT-5 valued) → PractitionerRole
├── device: from PRT (PRT-10 valued) → Device
├── specimen: Reference(Specimen)
└── note: from NTE segments following OBX
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
│   │   ├── prt-practitionerrole.ts    # PRT → PractitionerRole/Device
│   │   └── nte-annotation.ts          # NTE → Annotation (Observation.note)
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
  - Init sendingApplication and sendingFacility fields during the initial message insert (along with messageType)

- [ ] **1.1** Write tests for ORU_R01 processing (TDD - write tests first)

  **Unit tests - Segment converters:**
  - OBR → DiagnosticReport:
    - All field mappings (id, status, code, effectiveDateTime, issued)
    - OBR-25 status mapping (O/I/S→registered, P→preliminary, A/R/N→partial, C/M→corrected, F→final, X→cancelled)
    - Deterministic ID from OBR-3 (filler order number)
  - PRT → DiagnosticReport fields:
    - PRT with role ARI/TN/TR → DiagnosticReport.performer (via PractitionerRole)
    - PRT with role PRI → DiagnosticReport.resultsInterpreter (via PractitionerRole)
  - OBX → Observation:
    - Value type handling:
      - NM with OBX-6 units → valueQuantity (pass through units as-is)
      - ST/TX → valueString
      - CE/CWE → valueCodeableConcept
      - SN parsing:
        - Plain number (`^90`) → valueQuantity
        - Comparator (`<^5`, `>^90`) → valueQuantity with comparator
        - Range (`^10^-^20`) → valueRange with low/high
        - Ratio (`^1^:^128`) → valueRatio with numerator/denominator
        - Unparseable SN → valueString fallback
      - DT/TS → valueDateTime
      - TM → valueTime
    - OBX-11 status mapping (F/B/V/U→final, P/R/S→preliminary, I/O→registered, C→corrected, A→amended, D/W→entered-in-error, X→cancelled)
    - Reference range parsing:
      - Simple range: "3.5-5.5" → low/high
      - Comparator: ">60", "<5" → text or parsed
      - Text: "negative", "normal" → text only
    - OBX-8 interpretation (version-aware via MSH-12):
      - v2.6 and earlier: parse as simple string, lookup display from Table 0078
      - v2.7+: parse as CWE, extract code/display from CWE fields
      - Fallback to string parsing if CWE parsing fails
    - Deterministic ID: `{OBR-3}-obx-{OBX-1}`
  - PRT → Observation fields:
    - PRT with PRT-5 valued → Observation.performer (via PractitionerRole)
    - PRT with PRT-10 valued → Observation.device (via Device)
    - PRT with PRT-9 or PRT-14 valued → Observation location extension
  - NTE → Observation.note:
    - NTE segments following OBX → Observation.note
    - Multiple NTE segments → concatenated into single note (newline-separated, empty NTE-3 creates paragraph break)
  - SPM → Specimen:
    - Field mappings: type from SPM-4, collectedDateTime from SPM-17, receivedTime from SPM-18
    - Deterministic ID: `{OBR-3}-specimen-{SPM-2 or setId}`
  - OBR-15 → Specimen (fallback for v2.4 and earlier):
    - Specimen source from OBR-15 → Specimen.type

  **Integration tests - Full message processing:**
  - Happy path:
    - Single OBR with multiple OBX → DiagnosticReport with linked Observations
    - Multiple OBR groups → Multiple DiagnosticReports (one per OBR)
    - OBR without OBX → DiagnosticReport with empty result array
    - Complete ORU_R01 flow: Patient lookup, Encounter lookup, Specimen creation, resource linking
  - Specimen source selection (version-aware):
    - v2.4 message with OBR-15 only → Specimen created from OBR-15
    - v2.5+ message with SPM segment → Specimen created from SPM
    - Both SPM and OBR-15 present → SPM takes precedence, OBR-15 ignored
    - No SPM and no OBR-15 → no Specimen created (valid scenario)
  - Idempotency (via PUT with deterministic IDs):
    - Same OBR-3, different MSH-10 → resources updated in place (e.g., preliminary → final)
    - Same message replayed (same MSH-10) → resources overwritten, no duplicates
  - Resource tagging:
    - All resources tagged with `meta.tag` containing MSH-10 (message control ID)

  **Error cases:**
  - Structure errors:
    - Missing MSH → reject
    - Missing OBR → reject
    - Missing OBR-3 (filler order number) → reject
    - OBX without parent OBR → reject
  - Validation errors:
    - OBX-3 not LOINC → reject
    - OBR-25 missing or Y/Z → reject
    - OBX-11 missing or N → reject
  - Lookup failures:
    - Patient not found (PID-3) → reject
    - Encounter not found (PV1-19) → reject

  **Edge cases:**
  - Missing optional fields (OBX-14, OBR-22, etc.) → proceed with available data
  - Invalid/malformed values in OBX-5 → fallback to valueString
  - Empty OBX-5 (no value) → Observation with dataAbsentReason or omit value
  - Empty NTE-3 values → skipped (used as paragraph separators in concatenated text)
  - Multiple NTE segments after OBX → concatenated into single Observation.note
  - OBX-4 (Sub-ID) present → incorporate into Observation ID for uniqueness
  - No PRT segments → performer/device fields remain empty

- [ ] **1.2** Create segment converter: `obr-diagnosticreport.ts`
  - Extract OBR fields to DiagnosticReport
  - Map OBR-25 status to FHIR DiagnosticReport.status
  - Generate deterministic ID from OBR-3 (filler order number)

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
  - Generate deterministic ID: `{OBR-3}-obx-{OBX-1}`

- [ ] **1.4** Create segment converter: `prt-practitionerrole.ts`
  - Convert PRT segments to PractitionerRole (when PRT-5 valued)
  - Convert PRT segments to Device (when PRT-10 valued)
  - Handle role-based routing:
    - ARI/TN/TR roles → DiagnosticReport.performer
    - PRI role → DiagnosticReport.resultsInterpreter
    - PRT-5 in OBSERVATION context → Observation.performer

- [ ] **1.5** Create segment converter: `nte-annotation.ts`
  - Convert multiple NTE segments to single Annotation (concatenate NTE-3 values with newlines)
  - Skip empty NTE-3 values (they serve as paragraph separators)
  - Attach to parent Observation (Observation.note)

- [ ] **1.6** Create message converter: `oru-r01.ts`
  - Parse full ORU_R01 message structure
  - Lookup existing Patient by PID-3 (do NOT create)
  - Lookup existing Encounter by PV1-19 or account number (do NOT create)
  - Assemble DiagnosticReport with linked Observations
  - Process PRT segments for performer/resultsInterpreter/device references
  - Return FHIR transaction Bundle

- [ ] **1.7** Integrate into converter router
  - Add `ORU_R01` case to `src/v2-to-fhir/converter.ts`

### Phase 2: ConceptMap Code Resolution

- [ ] **1.8** Write tests for ConceptMap code resolution (TDD - write tests first)

  **Unit tests - ConceptMap lookup:**
  - ConceptMap structure and querying:
    - Lookup local code by (code, system) pair → returns LOINC mapping
    - Lookup returns null when no mapping exists
    - ConceptMap is sender-specific (filtered by sendingApplication + sendingFacility)
  - Code resolution logic:
    - OBX-3 with LOINC in alternate fields (OBX-3.4-6) → use inline LOINC, skip ConceptMap lookup
    - OBX-3 with local code only → lookup in ConceptMap → return resolved LOINC
    - OBX-3 with local code, no ConceptMap match → throw error with descriptive message
  - ConceptMap source identification:
    - Build ConceptMap identifier from sender fields of IncomingHL7v2Message

  **Integration tests - Code resolution in ORU_R01 flow:**
  - Happy path with inline LOINC:
    - OBX-3 contains LOINC in alternate fields → Observation.code uses inline LOINC
  - Happy path with ConceptMap:
    - OBX-3 contains local code only, ConceptMap has mapping → Observation.code uses mapped LOINC
    - Multiple OBX segments with mixed codes (some inline, some mapped) → all resolve correctly
  - Error cases:
    - OBX-3 contains local code only, no ConceptMap exists for sender → reject with error
    - OBX-3 contains local code only, ConceptMap exists but code not mapped → reject with error
    - Error message includes: local code, local system, sendingApplication, sendingFacility

  **Edge cases:**
  - OBX-3.4-6 partially populated (e.g., code but no system) → treat as no inline LOINC, use ConceptMap
  - OBX-3.6 is not "LN" (LOINC system) → treat as no inline LOINC, use ConceptMap
  - ConceptMap has multiple target codes for same source → reject with error
  - Empty sendingApplication or sendingFacility → reject with error

- [ ] **1.9** Create ConceptMap lookup service: `src/v2-to-fhir/conceptmap-lookup.ts`
  - Define interface for code resolution input (local code, system, sender info)
  - Implement `resolveToLoinc()` function:
    - Accept OBX-3 CWE and sender identifiers (sendingApplication, sendingFacility)
    - Check if LOINC already present in OBX-3.4-6 (OBX-3.6 = "LN")
    - If inline LOINC found, return it directly
    - If no inline LOINC, query Aidbox for sender-specific ConceptMap
    - Query ConceptMap for local code → LOINC mapping
    - Return resolved LOINC CodeableConcept or throw descriptive error
  - ConceptMap ID convention: `hl7v2-{sendingApplication}-{sendingFacility}-to-loinc`
  - Handle ConceptMap not found (different error from mapping not found)

- [ ] **1.10** Integrate ConceptMap lookup into OBX converter
  - Update `obx-observation.ts` to accept sender context (sendingApplication, sendingFacility)
  - Call `resolveToLoinc()` when building Observation.code
  - Propagate errors with context (which OBX segment failed, what code was unresolvable)
  - Ensure error stops entire message processing (no partial results)

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

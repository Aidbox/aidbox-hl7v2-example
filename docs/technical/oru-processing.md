# ORU Processing

Converts HL7v2 ORU_R01 lab result messages into FHIR DiagnosticReport, Observation, and Specimen resources. ORU_R01 messages carry laboratory results from lab information systems.

## How It Works

### Processing Flow

1. **Receive**: MLLP server receives ORU_R01 → creates `IncomingHL7v2Message` with `status=received`

2. **Validate**: Parse message structure, verify required fields:
   - MSH segment present
   - At least one OBR with OBR-3 (filler order number) or OBR-2 (placer order number)
   - OBR-25 (result status) valued and valid
   - OBX-11 (observation status) valued and valid for each OBX

3. **Resolve Codes**: For each OBX-3, attempt LOINC resolution:
   - Check inline LOINC (component 3 or 6 = "LN")
   - If not inline, lookup in sender's ConceptMap
   - If any fail → set `status=mapping_error`, create Tasks, stop

4. **Handle Patient** (PID segment required):
   - Extract ID from PID-2 or PID-3.1
   - Lookup existing Patient by ID
   - If not found → create draft Patient with `active=false` (lab results can arrive before ADT registration; drafts preserve results without losing data)

5. **Handle Encounter** (PV1 segment optional):
   - If PV1 present with PV1-19 (visit number) → lookup Encounter
   - If not found → create draft Encounter with `status=unknown`
   - If PV1 missing → proceed without encounter reference

6. **Convert Resources**:
   - ORC + OBR → DiagnosticReport
   - OBX + trailing NTE → Observation
   - SPM or OBR-15 → Specimen

7. **Submit**: Transaction bundle with all resources, update message to `status=processed`

### Resource ID Strategy

All resource IDs are deterministic, derived from source data. This enables idempotent reprocessing—the same message always produces the same resources, allowing safe retries without duplicates:

| Resource | ID Pattern | Example |
|----------|------------|---------|
| DiagnosticReport | `{OBR-3}` or `{OBR-2}` | `LAB-2024-00123` |
| Observation | `{orderNumber}-obx-{OBX-1}` | `LAB-2024-00123-obx-1` |
| Specimen | `{orderNumber}-specimen-{SPM-2 or seq}` | `LAB-2024-00123-specimen-1` |

### Race Condition Handling

Draft Patient and Encounter use `POST` with `If-None-Exist` header to handle concurrent messages:
- Multiple ORU messages for same unknown patient arriving simultaneously
- Only one draft resource created, others reuse it

## Implementation Details

### Code Locations

| Component | File | Entry Point |
|-----------|------|-------------|
| Processor service | `src/v2-to-fhir/processor-service.ts` | `processNextMessage()` |
| ORU message converter | `src/v2-to-fhir/messages/oru-r01.ts` | `convertORU_R01()` |
| OBR→DiagnosticReport | `src/v2-to-fhir/segments/obr-diagnosticreport.ts` | `convertOBR()` |
| OBX→Observation | `src/v2-to-fhir/segments/obx-observation.ts` | `convertOBX()` |
| PID→Patient | `src/v2-to-fhir/segments/pid-patient.ts` | `convertPID()` |
| PV1→Encounter | `src/v2-to-fhir/segments/pv1-encounter.ts` | `convertPV1()` |
| NTE→Annotation | `src/v2-to-fhir/segments/nte-annotation.ts` | `convertNTE()` |
| LOINC resolution | `src/v2-to-fhir/code-mapping/index.ts` | `resolveLOINCCode()` |
| Datatype converters | `src/v2-to-fhir/datatypes/*.ts` | Various |

### DiagnosticReport Mapping (from ORC + OBR)

| FHIR Field | HL7v2 Source | Notes |
|------------|--------------|-------|
| id | OBR-3 or OBR-2 | Filler preferred, placer as fallback |
| identifier | OBR-2, OBR-3 | Both placer and filler order numbers |
| status | OBR-25 | See status mapping below |
| category | OBR-24 | Diagnostic Service Section ID |
| code | OBR-4 | Universal Service Identifier |
| subject | PID-3 | Reference to Patient |
| encounter | PV1-19 | Reference to Encounter (if present) |
| effectiveDateTime | OBR-7 | Observation Date/Time |
| issued | OBR-22 | Results Report/Status Change Date/Time |
| performer | OBR-16 or PRT | Legacy field or PRT segment |
| result | OBX refs | References to Observations |
| specimen | SPM refs | References to Specimens |

**OBR-25 → DiagnosticReport.status:**

| HL7v2 Code | FHIR Status | Meaning |
|------------|-------------|---------|
| O, I, S | `registered` | Order received, in progress, scheduled |
| P | `preliminary` | Preliminary results |
| A, R, N | `partial` | Some results available |
| C, M | `corrected` | Corrected or modified |
| F | `final` | Final results |
| X | `cancelled` | Order cancelled |
| Y, Z, missing | error | Invalid - reject message |

### Observation Mapping (from OBX)

| FHIR Field | HL7v2 Source | Notes |
|------------|--------------|-------|
| id | `{orderNumber}-obx-{OBX-1}` | Deterministic |
| status | OBX-11 | See status mapping below |
| category | fixed | `laboratory` |
| code | OBX-3 | Must resolve to LOINC |
| subject | PID-3 | Same as DiagnosticReport |
| encounter | PV1-19 | Same as DiagnosticReport |
| value[x] | OBX-5 | Type determined by OBX-2 |
| interpretation | OBX-8 | Abnormal flags (version-aware) |
| referenceRange | OBX-7 | Parse ranges like `10-20`, `<100` |
| effectiveDateTime | OBX-14 | Observation timestamp |
| specimen | SPM ref | Reference to Specimen |
| note | NTE-3 | From trailing NTE segments |

**OBX-11 → Observation.status:**

| HL7v2 Code | FHIR Status | Meaning |
|------------|-------------|---------|
| F, B, V, U | `final` | Final, below/above limits, unverified |
| P, R, S | `preliminary` | Preliminary, results entered, partial |
| I, O | `registered` | Identification pending, order detail |
| C | `corrected` | Correction |
| A | `amended` | Amended |
| D, W | `entered-in-error` | Delete, withdrawn |
| X | `cancelled` | Cancelled |
| N, missing | error | Not asked for - reject message |

**OBX-2 → value[x] Type:**

| OBX-2 | FHIR Type | Notes |
|-------|-----------|-------|
| NM | valueQuantity | Units from OBX-6 |
| ST, TX | valueString | Text values |
| CE, CWE | valueCodeableConcept | Coded values |
| SN | varies | Parse: `<5`→Quantity with comparator, `10^-^20`→Range |
| DT, TS | valueDateTime | Date/time values |
| TM | valueTime | Time only |

**OBX-8 Interpretation (Abnormal Flags):**

Version-aware parsing (MSH-12): v2.6 and earlier uses ID type, v2.7+ uses CWE.

| Code | Display |
|------|---------|
| N | Normal |
| A | Abnormal |
| AA | Critical abnormal |
| H / HH | High / Critical high |
| L / LL | Low / Critical low |
| S / R / I | Susceptible / Resistant / Intermediate |

### Specimen Mapping (from SPM or OBR-15)

| FHIR Field | HL7v2 Source | Notes |
|------------|--------------|-------|
| id | `{orderNumber}-specimen-{SPM-2 or seq}` | Deterministic |
| type | SPM-4 or OBR-15 | SPM preferred; OBR-15 is legacy |
| subject | PID-3 | Reference to Patient |
| collection.collectedDateTime | SPM-17 | Collection time |
| receivedTime | SPM-18 | Lab receipt time |

OBR-15 format: Repeating field with `~` separator (e.g., `BLOOD~Blood`). Use first value.

### OBX-3 LOINC Resolution

OBX-3 is CE/CWE datatype with primary (1-3) and alternate (4-6) identifier slots:

| Component | Name |
|-----------|------|
| 1 | Identifier |
| 2 | Text |
| 3 | Name of Coding System |
| 4 | Alternate Identifier |
| 5 | Alternate Text |
| 6 | Name of Alternate Coding System |

**Resolution algorithm:**
1. If component 3 = "LN" → use components 1-3 as LOINC
2. Else if component 6 = "LN" → use components 4-6 as LOINC
3. Else lookup local code (components 1-3) in sender's ConceptMap
4. If not found → `mapping_error`, create Task

**Example:**
```
12345^Potassium^LOCAL^2823-3^Potassium SerPl-sCnc^LN
```
Components 4-6 contain LOINC, so use `2823-3`.

When both local and LOINC present, include both in Observation.code.coding.

### NTE Segment Association

NTE segments immediately following OBX belong to that Observation:
- Continue until next OBX, SPM, or end of ORDER_OBSERVATION group
- Multiple NTE concatenated into single `Observation.note`
- Empty NTE-3 values treated as paragraph separators

### Error Conditions

| Condition | Action |
|-----------|--------|
| Missing MSH | Reject message |
| Missing OBR | Reject message |
| Missing OBR-3 and OBR-2 | Reject (need ID for resources) |
| OBX without parent OBR | Reject message |
| PID segment missing | Reject message |
| PID without usable ID | Reject message |
| Patient not found | Create draft Patient (`active=false`) |
| PV1 missing | Proceed without encounter |
| PV1-19 empty | Proceed without encounter |
| Encounter not found | Create draft Encounter (`status=unknown`) |
| OBX-3 has no LOINC | Set `mapping_error`, create Task |
| OBR-25 invalid (Y/Z/missing) | Reject message |
| OBX-11 invalid (N/missing) | Reject message |
| OBR without OBX | Create DiagnosticReport with empty result |

## See Also

- [Code Mapping](code-mapping.md) - Handling unmapped OBX-3 codes
- [Architecture](architecture.md) - Design decisions on draft resources and deterministic IDs
- [HL7v2 Module](hl7v2-module.md) - Message parsing and field access

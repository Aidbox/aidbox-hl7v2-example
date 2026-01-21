# ORU_R01 Core Processing Spec

## Goal

Convert ORU_R01 messages to FHIR DiagnosticReport + Observation + Specimen resources.

## Key Behaviors

- Patient: match existing or create draft (`active=false`); PID segment required (error if missing)
- Encounter: lookup only, never create (proceed without if not found)
- One DiagnosticReport per ORDER_OBSERVATION group (ORC/OBR pair)
- Deterministic IDs from OBR-3 (filler order number) for idempotency via PUT
- Tag all resources with MSH-10 (message control ID) for audit trail
- OBX-3 must resolve to LOINC code (inline or via sender-specific ConceptMap, see Appendix E)
- Unmapped OBX-3 codes block processing with `mapping_error` and create/track mapping Tasks
- OBX-8 interpretation: version-aware (MSH-12: v2.6- string, v2.7+ CWE)
- Specimen: SPM preferred (v2.5+), OBR-15 for backward compatibility (repeating field with `~` separator)
- NTE segments immediately following OBX → associated Observation.note

## Processing Flow

1. MLLP receives ORU_R01 → `IncomingHL7v2Message` with `status=received`
2. Parse message structure; validate MSH, OBR-3, OBR-25, OBX-11 required fields
3. Resolve all OBX-3 codes to LOINC (inline or via sender-specific ConceptMap, see Appendix E)
4. If any OBX-3 cannot be resolved → set `status=mapping_error`, create mapping Tasks (see Code Mapping), stop processing
5. Handle Patient (PID):
   - PID segment required - error if missing
   - Extract patient ID from PID-2 or PID-3.1 (first identifier's ID) - error if no usable ID
   - Lookup Patient by ID: if exists → use existing (do NOT update - ADT is source of truth)
   - If Patient not found → create draft Patient with `active=false`
6. Lookup Encounter (PV1-19) - error if not found
7. Convert:
   - Patient (if creating draft) → Patient with `active=false`
   - ORC + OBR → DiagnosticReport (one per ORDER_OBSERVATION group)
   - OBX + trailing NTE → Observation (linked to DiagnosticReport)
   - SPM or OBR-15 → Specimen (linked to DiagnosticReport and Observations)
8. Submit transaction bundle via PUT (idempotent), update status to `processed`

### Code Mapping Failure Handling

When a message contains OBX codes that cannot be resolved to LOINC, ORU processing is blocked and mapping Tasks are created.

1. Encounter unmapped OBX-3 codes during conversion
2. Set `IncomingHL7v2Message.status = mapping_error`
3. Deduplicate unmapped codes by sender + local system + code
4. Create or update a `Task` per unique code (deterministic ID, PUT/upsert)
5. Store `unmappedCodes[]` entries with task references on the message

**Task example (unresolved):**

```json
{
  "resourceType": "Task",
  "status": "requested",
  "intent": "order",
  "code": {
    "coding": [
      {
        "system": "http://example.org/task-codes",
        "code": "local-to-loinc-mapping",
        "display": "Local code to LOINC mapping"
      }
    ]
  },
  "input": [
    { "type": { "text": "Sending application" }, "valueString": "NEXUSLIS" },
    { "type": { "text": "Sending facility" }, "valueString": "NORTHRIDGE" },
    { "type": { "text": "Local code" }, "valueString": "K_SERUM" },
    { "type": { "text": "Local display" }, "valueString": "Potassium [Serum/Plasma]" },
    { "type": { "text": "Local system" }, "valueString": "NRD-LAB-CODES" }
  ]
}
```

## Resource Mapping

### DiagnosticReport (from ORC + OBR)

| FHIR field | Source | Notes |
|------------|--------|-------|
| id | `{OBR-3}` | Filler order number (stable across updates) |
| identifier | OBR-2, OBR-3 | Placer and filler order numbers |
| status | OBR-25 | See Appendix A |
| category | OBR-24 | Diagnostic Service Section ID (if valued) |
| code | OBR-4 | Universal Service Identifier |
| subject | PID-3 | Patient lookup |
| encounter | PV1-19 | Encounter lookup |
| effectiveDateTime | OBR-7 | Observation Date/Time |
| issued | OBR-22 | Results Rpt/Status Change Date/Time |
| performer | OBR-16 or PRT | Legacy: OBR-16 (Ordering Provider); Modern: PRT (ARI/TN/TR) |
| resultsInterpreter | PRT (PRI) | PRT-4.1 = PRI with PRT-4.3 = HL70443 |
| result | OBX refs | References to Observations |
| specimen | SPM/OBR-15 refs | References to Specimens |

### Observation (from OBX)

| FHIR field | Source | Notes |
|------------|--------|-------|
| id | `{OBR-3}-obx-{OBX-1}` | Deterministic |
| status | OBX-11 | See Appendix B |
| category | (fixed) | `laboratory` (http://terminology.hl7.org/CodeSystem/observation-category) |
| code | OBX-3 | Extract LOINC from CE/CWE (see Appendix E) |
| subject | PID-3 | Reference to Patient (same as DiagnosticReport) |
| encounter | PV1-19 | Reference to Encounter (same as DiagnosticReport) |
| value[x] | OBX-5 | Type from OBX-2, see Appendix C |
| interpretation | OBX-8 | Version-aware, see Appendix D |
| referenceRange | OBX-7 | Parse: `10-20`, `<100`, `>5` |
| effectiveDateTime | OBX-14 | |
| performer | OBX-16 or PRT | Legacy: OBX-16 (Responsible Observer); Modern: PRT with PRT-5 |
| device | PRT (PRT-10) | PRT with PRT-10 valued → Device (optional) |
| specimen | SPM ref | Reference to Specimen |
| note | NTE-3 | NTE segments immediately following this OBX |

### Specimen (from SPM or OBR-15)

| FHIR field | Source | Notes |
|------------|--------|-------|
| id | `{OBR-3}-specimen-{SPM-2 or 1}` | Deterministic; use SPM-2 if present, else sequence number |
| type | SPM-4 or OBR-15 | SPM preferred; OBR-15 is repeating (`~` separator), use first value |
| subject | PID-3 | Patient lookup |
| collection.collectedDateTime | SPM-17 | |
| receivedTime | SPM-18 | |

**OBR-15 format**: Repeating field with `~` separator (e.g., `BLOOD~Blood`). First component is the specimen source code.

## Error Conditions

| Condition | Action |
|-----------|--------|
| Missing MSH | Reject message |
| Missing OBR | Reject message |
| Missing OBR-3 | Reject message (required for resource IDs) |
| OBX without parent OBR | Reject message |
| OBX-3 has no LOINC (inline or ConceptMap) | Set `mapping_error`, create/update mapping Task(s), store `unmappedCodes[]` |
| ConceptMap not found for sender | Set `mapping_error` when OBX-3 has no inline LOINC |
| PID segment missing | Reject message with error |
| PID without usable ID (PID-2/PID-3 empty) | Reject message with error |
| Patient not found (PID-2/PID-3) | Create draft Patient with `active=false` |
| Encounter not found (PV1-19) | Reject message with error |
| OBR-25 missing or Y/Z | Reject message |
| OBX-11 missing or N | Reject message |
| OBR without OBX | Create DiagnosticReport with empty result |

## Open Questions

- **DiagnosticReport.category**: Derive from OBR-24 (Diagnostic Service Section ID)?
- **OBX-6 units**: Map to UCUM or pass through as-is?
- **Timezone handling**: Timestamps without timezone - server default or local time?

## Design Decisions

Based on HL7 v2-to-FHIR mapping spec and example messages:

- **PRT segment handling**: PRT segments are optional. When absent, use legacy fields (OBR-16, OBX-16). When present, PRT takes precedence.
- **ORC segment**: Process ORC for DiagnosticReport metadata (ORC-2/3 for identifiers). ServiceRequest creation is out of scope for this phase.
- **Observation.category**: Set to "laboratory" for all observations in ORU_R01 lab results context.
- **Legacy performer fields**: OBX-16 (Responsible Observer) used when PRT absent. OBR-16 (Ordering Provider) maps to DiagnosticReport if no PRT.
- **OBX-3 code handling**: Accept LOINC in either primary identifier (components 1-3) or alternate identifier (components 4-6). When no inline LOINC present, lookup local code in sender-specific ConceptMap. If not found, create mapping Tasks and mark message as `mapping_error`. See Appendix E.

---

## Appendix A: OBR-25 Result Status → DiagnosticReport.status

| HL7v2 | FHIR status |
|-------|-------------|
| O, I, S | `registered` |
| P | `preliminary` |
| A, R, N | `partial` |
| C, M | `corrected` |
| F | `final` |
| X | `cancelled` |
| Y, Z, (missing) | error |

## Appendix B: OBX-11 Result Status → Observation.status

| HL7v2 | FHIR status |
|-------|-------------|
| F, B, V, U | `final` |
| P, R, S | `preliminary` |
| I, O | `registered` |
| C | `corrected` |
| A | `amended` |
| D, W | `entered-in-error` |
| X | `cancelled` |
| N, (missing) | error |

## Appendix C: OBX-2 Value Type → FHIR value[x]

| OBX-2 | FHIR | Notes |
|-------|------|-------|
| NM | valueQuantity | Units from OBX-6 |
| ST, TX | valueString | |
| CE, CWE | valueCodeableConcept | |
| SN | valueQuantity/Range/Ratio/String | Parse comparator/range/ratio |
| DT, TS | valueDateTime | |
| TM | valueTime | |

**SN parsing**: `<5` → valueQuantity with comparator; `10^-^20` → valueRange; `1^:^128` → valueRatio; else → valueString

## Appendix D: OBX-8 Interpretation (Table 0078)

**Version detection via MSH-12:**
- v2.6 and earlier: OBX-8 is ID (string) → lookup display from table
- v2.7+: OBX-8 is CWE → use CWE.1/CWE.2, fallback to table lookup

**Mapping**: `coding.system` = `http://terminology.hl7.org/CodeSystem/v2-0078`

No validation - pass through unknown codes. Common codes:

| Code | Display |
|------|---------|
| N | Normal |
| A | Abnormal |
| AA | Critical abnormal |
| H | High |
| HH | Critical high |
| L | Low |
| LL | Critical low |
| >, < | Above/Below absolute |
| S, R, I | Susceptible/Resistant/Intermediate |

## Appendix E: OBX-3 LOINC Code Detection and Mapping Tasks

OBX-3 is a CE (Coded Element) or CWE (Coded With Exceptions) data type with the following structure:

| Component | CE Name | CWE Name |
|-----------|---------|----------|
| 1 | Identifier | Identifier |
| 2 | Text | Text |
| 3 | Name of Coding System | Name of Coding System |
| 4 | Alternate Identifier | Alternate Identifier |
| 5 | Alternate Text | Alternate Text |
| 6 | Name of Alternate Coding System | Name of Alternate Coding System |

**LOINC resolution algorithm:**

1. Check if component 3 (Name of Coding System) = "LN" → use components 1-3 as LOINC
2. Else check if component 6 (Name of Alternate Coding System) = "LN" → use components 4-6 as LOINC
3. If neither has "LN", lookup local code (components 1-3) in sender-specific ConceptMap:
   - ConceptMap ID: `hl7v2-{sendingApplication}-{sendingFacility}-to-loinc`
   - If ConceptMap exists and mapping found → use mapped LOINC code
   - If ConceptMap not found or mapping not found → set `status=mapping_error`, create/update mapping Task(s), and store `unmappedCodes[]`

**Example:**

```
12345^Potassium^LOCAL^2823-3^Potassium SerPl-sCnc^LN
```

- Components 1-3: `12345` / `Potassium` / `LOCAL` (local code)
- Components 4-6: `2823-3` / `Potassium SerPl-sCnc` / `LN` (LOINC code)
- Result: Use `2823-3` as the LOINC code

**FHIR Observation.code mapping:**

When both local and LOINC codes are present, include both in CodeableConcept.coding:

```json
{
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "2823-3",
        "display": "Potassium SerPl-sCnc"
      },
      {
        "system": "urn:oid:local-system-oid",
        "code": "12345",
        "display": "Potassium"
      }
    ]
  }
}
```

## Appendix F: NTE Segment Association

NTE (Notes and Comments) segments follow the segment they annotate. In ORU_R01 OBSERVATION groups:

**Association rules:**
- NTE segments immediately following an OBX belong to that OBX
- NTE continues until the next OBX, SPM, or end of ORDER_OBSERVATION group
- Multiple NTE segments are concatenated into a single Observation.note

**Example:**

```
OBX|1|NM|12345^Glucose^LOCAL^2345-7^Glucose SerPl-mCnc^LN||95|mg/dL|70-99||||F
NTE|1|L|Fasting specimen required for accurate results.||
NTE|2|L|||
NTE|3|L|Values may vary based on time of collection.||
OBX|2|NM|12346^Sodium^LOCAL^2951-2^Sodium SerPl-sCnc^LN||140|mmol/L|136-145||||F
```

Result: NTE 1-3 are associated with OBX-1 (Glucose), creating:

```json
{
  "note": [
    {
      "text": "Fasting specimen required for accurate results.\n\nValues may vary based on time of collection."
    }
  ]
}
```

**NTE field mapping:**
- NTE-1: Set ID (for ordering)
- NTE-2: Source of Comment (L=Lab, etc.) - informational only
- NTE-3: Comment text → Observation.note.text
- Empty NTE-3 values are skipped (used as paragraph separators)

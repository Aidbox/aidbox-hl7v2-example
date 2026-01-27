# ORU Processing

Converts HL7v2 ORU_R01 lab result messages into FHIR DiagnosticReport, Observation, and Specimen resources. For conceptual background on HL7v2 and FHIR, see the [User Guide](../user-guide/concepts.md).

## Code Organization

The `src/v2-to-fhir/` module handles HL7v2 to FHIR conversion:

```
src/v2-to-fhir/
├── messages/
│   ├── oru-r01.ts        # ORU_R01 message converter (main entry point)
│   ├── adt-a01.ts        # ADT_A01 message converter
│   └── adt-a08.ts        # ADT_A08 message converter
├── segments/
│   ├── pid-patient.ts    # PID → Patient
│   ├── pv1-encounter.ts  # PV1 → Encounter
│   ├── obr-diagnosticreport.ts  # OBR → DiagnosticReport
│   ├── obx-observation.ts       # OBX → Observation
│   └── nte-annotation.ts        # NTE → Annotation
├── datatypes/
│   ├── cwe-codeableconcept.ts   # CWE → CodeableConcept
│   ├── xpn-humanname.ts         # XPN → HumanName
│   └── ...
├── code-mapping/
│   ├── index.ts          # Re-exports LOINC resolution functions
│   └── coding-systems.ts # System URI normalization
├── converter.ts          # Message routing and ConversionResult type
└── processor-service.ts  # Polling service for IncomingHL7v2Message
```

**Key entry points:**

- `convertORU_R01(message)` in `messages/oru-r01.ts` - Converts parsed message to FHIR Bundle
- `processNextMessage()` in `processor-service.ts` - Polls and processes one IncomingHL7v2Message

## Implementation Walkthrough

### Message Processing Flow

The processor service (`processor-service.ts`) orchestrates the flow:

```
processNextMessage()
    │
    ├─► Poll: IncomingHL7v2Message?status=received&_sort=_lastUpdated&_count=1
    │
    ├─► parseMessage(raw)          // Parse HL7v2 wire format
    │
    ├─► routeMessage(parsed)       // Dispatch to convertORU_R01, convertADT_A01, etc.
    │       │
    │       └─► convertORU_R01()   // Returns ConversionResult
    │
    ├─► Submit bundle to Aidbox    // POST /fhir (transaction)
    │
    └─► Update message status      // processed | error | mapping_error
```

### ORU_R01 Conversion Detail

The `convertORU_R01()` function in `messages/oru-r01.ts` orchestrates the conversion:

```
convertORU_R01(parsed, lookupPatient, lookupEncounter)
    │
    ├─► parseMSH()                 // Extract sender context, build meta tags
    ├─► validateOBRPresence()      // Ensure at least one OBR exists
    ├─► parsePID()                 // Extract PID segment (required)
    │
    ├─► handlePatient()            // Lookup or create draft Patient
    │       ├─► extractPatientId(pid)        // PID-2 or PID-3.1
    │       ├─► lookupPatient(id)            // Check if exists
    │       └─► createDraftPatient() if not found  // active=false
    │
    ├─► parsePV1()                 // Extract PV1 segment (optional)
    ├─► handleEncounter()          // Lookup or create draft Encounter
    │
    ├─► groupSegmentsByOBR()       // Group OBX/NTE/SPM under parent OBR
    │
    └─► for each OBR group:
            ├─► processOBRGroup()
            │       ├─► convertOBRToDiagnosticReport()
            │       ├─► processObservations()
            │       │       └─► convertOBXToObservationResolving()
            │       │               ├─► resolveToLoinc()  // May throw LoincResolutionError
            │       │               └─► convertOBXToObservation()
            │       ├─► processSpecimens()
            │       │       └─► convertSPMToSpecimen() or createSpecimenFromOBR15()
            │       └─► Link resources (patient, encounter, specimen refs)
            │
            └─► Collect entries and mapping errors

    If mapping errors:
        └─► buildMappingErrorResult()  // Create Tasks, set status=mapping_error

    Else:
        └─► Return bundle with all resources
```

## Key Patterns

### Deterministic Resource IDs

All resource IDs are derived from source data, enabling idempotent reprocessing:

| Resource | ID Pattern | Example |
|----------|------------|---------|
| DiagnosticReport | `{OBR-3}` or `{OBR-2}` | `lab-2024-00123` |
| Observation | `{orderNumber}-obx-{OBX-1}` | `lab-2024-00123-obx-1` |
| Specimen | `{orderNumber}-specimen-{index}` | `lab-2024-00123-specimen-1` |

The same message always produces the same resources, allowing safe retries.

### OBX-3 LOINC Resolution

OBX-3 (Observation Identifier) uses the CE/CWE datatype with primary and alternate coding slots:

| Component | Name | Typical Content |
|-----------|------|-----------------|
| 1 | Identifier | Local code (e.g., `K_SERUM`) |
| 2 | Text | Display name |
| 3 | Name of Coding System | `L` (local) or `LN` (LOINC) |
| 4 | Alternate Identifier | LOINC code (e.g., `2823-3`) |
| 5 | Alternate Text | LOINC display |
| 6 | Name of Alternate Coding System | `LN` |

**Resolution algorithm** (see `resolveToLoinc()` in `code-mapping/concept-map/lookup.ts`):

1. **Check primary coding** (components 1-3): If OBX-3.3 is "LN", use OBX-3.1 as LOINC code
2. **Check alternate coding** (components 4-6): If OBX-3.6 is "LN", use OBX-3.4 as LOINC code (preserving local code from primary)
3. **Lookup in ConceptMap**: Query sender-specific ConceptMap for local→LOINC mapping

If all three steps fail, `LoincResolutionError` is thrown, which triggers `status=mapping_error` and Task creation for manual mapping. See [Code Mapping](code-mapping.md) for the full workflow.

### Draft Resource Creation

When Patient or Encounter doesn't exist, ORU processing creates drafts:

```typescript
// Draft Patient: active=false
const draftPatient = convertPIDToPatient(pid);
draftPatient.active = false;

// Draft Encounter: status=unknown
const draftEncounter = convertPV1ToEncounter(pv1);
draftEncounter.status = "unknown";
```

Race condition handling uses `POST` with `If-None-Exist`:

```typescript
function createConditionalPatientEntry(patient: Patient): BundleEntry {
  return {
    resource: patient,
    request: {
      method: "POST",
      url: "Patient",
      ifNoneExist: `_id=${patient.id}`,  // Prevents duplicates
    },
  };
}
```

### Segment Grouping

OBX, NTE, and SPM segments are grouped under their parent OBR:

```typescript
function groupSegmentsByOBR(message: HL7v2Message): OBRGroup[] {
  // Each OBR starts a new group
  // OBX segments belong to current group
  // NTE segments following OBX attach to that Observation
  // SPM segments attach to current group
}
```

The structure mirrors the HL7v2 message hierarchy:

```
OBR (Order)
├── OBX (Result 1)
│   └── NTE (Comment for Result 1)
├── OBX (Result 2)
└── SPM (Specimen)
```

## Extension Points

### Adding a New Segment Converter

1. Create converter in `segments/{segment}-{resource}.ts`
2. Follow the pattern: accept typed segment, return FHIR resource
3. Generate deterministic ID from message data
4. Call from message converter (e.g., `convertORU_R01`)

### Supporting New Message Types

1. Create converter in `messages/{type}.ts` (e.g., `orm-o01.ts`)
2. Implement `convert{TYPE}(parsed): ConversionResult`
3. Add routing in `converter.ts`

## Reference

### Processing Flow Summary

1. **Receive**: MLLP server stores `IncomingHL7v2Message` with `status=received`
2. **Validate**: Parse message, verify MSH, OBR, PID presence
3. **Resolve Codes**: For each OBX-3, attempt LOINC resolution
4. **Handle Patient**: Lookup or create draft (`active=false`)
5. **Handle Encounter**: Lookup or create draft (`status=unknown`)
6. **Convert**: OBR→DiagnosticReport, OBX→Observation, SPM→Specimen
7. **Submit**: Transaction bundle, update message to `status=processed`

### Status Mappings

<details>
<summary>OBR-25 → DiagnosticReport.status</summary>

| HL7v2 Code | FHIR Status | Meaning |
|------------|-------------|---------|
| O, I, S | `registered` | Order received, in progress, scheduled |
| P | `preliminary` | Preliminary results |
| A, R, N | `partial` | Some results available |
| C, M | `corrected` | Corrected or modified |
| F | `final` | Final results |
| X | `cancelled` | Order cancelled |
| Y, Z, missing | error | Invalid - reject message |

</details>

<details>
<summary>OBX-11 → Observation.status</summary>

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

</details>

<details>
<summary>OBX-2 → value[x] Type</summary>

| OBX-2 | FHIR Type | Notes |
|-------|-----------|-------|
| NM | valueQuantity | Units from OBX-6 |
| ST, TX | valueString | Text values |
| CE, CWE | valueCodeableConcept | Coded values |
| SN | varies | Parse comparators and ranges |
| DT, TS | valueDateTime | Date/time values |
| TM | valueTime | Time only |

</details>

### Error Conditions

| Condition | Action |
|-----------|--------|
| Missing MSH | Reject message |
| Missing OBR | Reject message |
| Missing OBR-3 and OBR-2 | Reject (need ID for resources) |
| PID segment missing | Reject message |
| PID without usable ID | Reject message |
| Patient not found | Create draft Patient (`active=false`) |
| PV1 missing | Proceed without encounter |
| Encounter not found | Create draft Encounter (`status=unknown`) |
| OBX-3 has no LOINC | Set `mapping_error`, create Task |
| Invalid OBR-25 or OBX-11 | Reject message |

### Message Rejection Behavior

When a message is rejected during processing, the system:

1. **Stores the message**: The raw HL7v2 message is always stored in `IncomingHL7v2Message` with `status=received` upon MLLP receipt, before processing begins. Rejection happens during the conversion phase, not receipt.

2. **Updates status to `error`**: The `IncomingHL7v2Message.status` changes from `received` to `error`.

3. **Records the error reason**: The error message is stored in `IncomingHL7v2Message.error`. Common error strings:
   - `"Missing required MSH segment"`
   - `"Missing required OBR segment"`
   - `"Missing required PID segment"`
   - `"PID segment has no usable patient identifier (PID-2 or PID-3)"`
   - `"OBR missing both filler order number (OBR-3) and placer order number (OBR-2)"`
   - `"Invalid OBR-25 result status: {value}"`
   - `"Invalid OBX-11 observation status: {value}"`

4. **Creates no FHIR resources**: Rejected messages produce no Patient, DiagnosticReport, Observation, or other FHIR resources. The transaction is atomic—either all resources are created or none.

5. **MLLP ACK is unaffected**: The MLLP server sends `AA` (Application Accept) when the message is successfully stored, regardless of later processing outcome. Processing happens asynchronously. The ACK confirms receipt, not successful conversion.

**Recovery:** Users can fix the source system and resend the message, or use "Mark for Retry" in the UI to reset status to `received` and reprocess (useful if the issue was transient or the code was fixed).

**Distinguishing rejection from mapping errors:** Rejected messages have `status=error`. Messages with unmapped LOINC codes have `status=mapping_error` and can be resolved via the Mapping Tasks UI without resending.

## See Also

- [Code Mapping](code-mapping.md) - Handling unmapped OBX-3 codes
- [MLLP Server](mllp-server.md) - How messages arrive
- [HL7v2 Module](hl7v2-module.md) - Message parsing and field access
- [Architecture](architecture.md) - Draft resources and deterministic IDs design decisions

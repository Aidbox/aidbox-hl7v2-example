# ORU_R01 Core Processing Spec

## Goal

Convert ORU_R01 messages to FHIR DiagnosticReport + Observation + Specimen resources.

## Key Behaviors

- Patient/Encounter: lookup only, never create (hard error if not found)
- One DiagnosticReport per OBR (no consolidation)
- Deterministic IDs from OBR-3 (filler order number) for idempotency via PUT
- Tag all resources with MSH-10 (message control ID) for audit trail
- OBX-3 must be LOINC (error if not)
- OBX-8 interpretation: version-aware (MSH-12: v2.6- string, v2.7+ CWE)
- Specimen: SPM preferred (v2.5+), OBR-15 for backward compatibility
- NTE segments (after OBR and OBX) → DiagnosticReport.conclusion

## Processing Flow

1. MLLP receives ORU_R01 → `IncomingHL7v2Message` with `status=received`
2. Lookup Patient (PID-3) and Encounter (PV1-19) - error if not found
3. Validate all OBX-3 codes are LOINC
4. Convert: OBR → DiagnosticReport, OBX → Observation, SPM/OBR-15 → Specimen
5. Submit transaction bundle, update status to `processed`

## Resource Mapping

### DiagnosticReport (from OBR)

| FHIR field | Source | Notes |
|------------|--------|-------|
| id | `{OBR-3}` | Filler order number (stable across updates) |
| status | OBR-25 | See Appendix A |
| code | OBR-4 | |
| subject | PID-3 | Patient lookup |
| encounter | PV1-19 | Encounter lookup |
| effectiveDateTime | OBR-7 | |
| issued | OBR-22 | |
| performer | OBR-16 | See Open Questions |
| result | OBX refs | |
| specimen | SPM/OBR-15 refs | |
| conclusion | NTE-3 | All NTEs concatenated with newlines |
| conclusionCode | NTE-2 | See Appendix C |

### Observation (from OBX)

| FHIR field | Source | Notes |
|------------|--------|-------|
| id | `{OBR-3}-obx-{OBX-1}` | Deterministic |
| status | OBX-11 | See Appendix B |
| code | OBX-3 | Must be LOINC |
| value[x] | OBX-5 | Type from OBX-2, see Appendix D |
| interpretation | OBX-8 | Version-aware, see Appendix E |
| referenceRange | OBX-7 | Parse: `10-20`, `<100`, `>5` |
| effectiveDateTime | OBX-14 | |
| performer | OBX-16 | See Open Questions |
| specimen | SPM ref | |

### Specimen (from SPM or OBR-15)

| FHIR field | Source | Notes |
|------------|--------|-------|
| id | `{OBR-3}-specimen-{SPM-2 or setId}` | Deterministic |
| type | SPM-4 or OBR-15 | SPM preferred (v2.5+) |
| subject | PID-3 | Patient lookup |
| collection.collectedDateTime | SPM-17 | |
| receivedTime | SPM-18 | |

## Error Conditions

| Condition | Action |
|-----------|--------|
| Missing MSH | Reject message |
| Missing OBR | Reject message |
| Missing OBR-3 | Reject message (required for resource IDs) |
| OBX without parent OBR | Reject message |
| OBX-3 not LOINC | Reject message |
| Patient not found (PID-3) | Reject message |
| Encounter not found (PV1-19) | Reject message |
| OBR-25 missing or Y/Z | Reject message |
| OBX-11 missing or N | Reject message |
| OBR without OBX | Create DiagnosticReport with empty result |

## Test Scenarios

**Approach**: Test-driven development. Write tests first, then implement.

### Happy Path
- Single OBR with multiple OBX → DiagnosticReport + Observations
- Multiple OBR groups → Multiple DiagnosticReports
- OBR without OBX → DiagnosticReport with empty result array

### Version-Aware
- v2.4 message with OBR-15 → Specimen from OBR-15
- v2.5+ message with SPM → Specimen from SPM
- Both SPM and OBR-15 → SPM takes precedence
- v2.6 OBX-8 string → interpretation with Table 0078 lookup
- v2.7+ OBX-8 CWE → interpretation from CWE fields

### Value Types (OBX-2)
- NM with OBX-6 units → valueQuantity
- ST/TX → valueString
- CE/CWE → valueCodeableConcept
- SN with comparator (`<5`) → valueQuantity with comparator
- SN with range (`10^-^20`) → valueRange
- SN with ratio (`1^:^128`) → valueRatio
- DT/TS → valueDateTime
- TM → valueTime

### Error Cases
- Missing MSH → error
- Missing OBR → error
- Missing OBR-3 → error
- OBX without OBR → error
- Non-LOINC OBX-3 → error
- Patient not found → error
- Encounter not found → error

### Idempotency
- Same OBR-3 with different MSH-10 → resources updated (preliminary → final)
- Same message twice (same MSH-10) → resources overwritten, no duplicates

## Open Questions

- **Performer handling**: Create Practitioner resources, contained resources, or display-only references?
- **DiagnosticReport.category**: Derive from OBR-24 (Diagnostic Service Section ID)?
- **Multiple NTE-2 values**: How to handle different source codes in conclusionCode?
- **OBX-6 units**: Map to UCUM or pass through as-is?
- **Missing PV1**: Error or proceed without encounter?
- **ORC segment**: Process for ServiceRequest/order metadata?
- **Observation.category**: Set "laboratory" based on context?
- **Timezone handling**: Timestamps without timezone - server default or local time?

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

## Appendix C: NTE-2 Source of Comment (Table 0105)

| Value | Description |
|-------|-------------|
| L | Ancillary (filler) department |
| O | Other system |
| P | Orderer (placer) |

## Appendix D: OBX-2 Value Type → FHIR value[x]

| OBX-2 | FHIR | Notes |
|-------|------|-------|
| NM | valueQuantity | Units from OBX-6 |
| ST, TX | valueString | |
| CE, CWE | valueCodeableConcept | |
| SN | valueQuantity/Range/Ratio/String | Parse comparator/range/ratio |
| DT, TS | valueDateTime | |
| TM | valueTime | |

**SN parsing**: `<5` → valueQuantity with comparator; `10^-^20` → valueRange; `1^:^128` → valueRatio; else → valueString

## Appendix E: OBX-8 Interpretation (Table 0078)

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

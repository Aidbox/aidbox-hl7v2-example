# ORU_R01 Core Processing Spec

## Goal

Convert ORU_R01 messages to FHIR DiagnosticReport + Observation resources.

## Key Behaviors

- Patient/Encounter: lookup only, never create
- OBX-8 interpretation: version-aware (v2.6- string, v2.7+ CWE)
- Deterministic IDs for idempotency
- Tag resources with message control ID
- One DiagnosticReport per OBR (no consolidation)
- OBX without parent OBR: reject message
- OBR without OBX: create DiagnosticReport with empty `result`

## Processing Flow

1. MLLP receives ORU_R01 → `IncomingHL7v2Message` with `status=received`
2. Validate OBX-3 codes are LOINC (error if not)
3. Convert to FHIR:
   - PID → Patient (lookup only)
   - PV1 → Encounter (lookup only)
   - OBR → DiagnosticReport
   - OBX → Observation
   - SPM/OBR-15 → Specimen
   - NTE → Annotation
4. Submit bundle, update status to `processed`

## Resource Mapping

**DiagnosticReport** (from OBR):
- `id`: `{messageControlId}-{obrSetId}`
- `status`: OBR-25
- `code`: OBR-4
- `subject`: Patient ref
- `encounter`: Encounter ref
- `effectiveDateTime`: OBR-7
- `issued`: OBR-22
- `performer`: OBR-16
- `result`: Observation refs
- `conclusion`: all NTE texts (concatenated with newlines)
- `conclusionCode`: NTE-2 source of comment

**Observation** (from OBX):
- `id`: `{diagnosticReportId}-obx-{setId}`
- `status`: OBX-11
- `code`: OBX-3 (must be LOINC)
- `value[x]`: OBX-5 per OBX-2 type
- `interpretation`: OBX-8
- `referenceRange`: OBX-7
- `effectiveDateTime`: OBX-14
- `performer`: OBX-16

## OBX Value Types

| OBX-2 | FHIR value[x] |
|-------|---------------|
| NM | valueQuantity |
| ST, TX | valueString |
| CE, CWE | valueCodeableConcept |
| SN | valueQuantity/Range/Ratio/String |
| DT, TS | valueDateTime |
| TM | valueTime |

**SN parsing**: comparator → valueQuantity; range (^-^) → valueRange; ratio (^:^) → valueRatio; fallback → valueString

## OBX Handling

**OBX-11 Observation Result Status Mapping:**

| HL7v2 | FHIR status |
|-------|-------------|
| F, B, V, U | `final` |
| P, R, S | `preliminary` |
| I, O | `registered` |
| C | `corrected` |
| A | `amended` |
| D, W | `entered-in-error` |
| X | `cancelled` |
| N | error |
| (missing) | error |

**OBX-8 Interpretation (version-aware):**

Version detection via MSH-12:
- v2.6 and earlier: OBX-8 is ID (string) → look up display from Table 0078
- v2.7+: OBX-8 is CWE → use provided display/system, fall back to Table 0078 if missing

Mapping to `Observation.interpretation` (CodeableConcept):
- `coding.code`: OBX-8 code (or CWE.1)
- `coding.display`: from Table 0078 lookup (v2.6-) or CWE.2 (v2.7+)
- `coding.system`: `http://terminology.hl7.org/CodeSystem/v2-0078`
- `text`: display value

No code validation - pass through unknown codes with system URI. Aidbox handles validation if configured.

**Table 0078 display values (common codes):**

| Code | Display |
|------|---------|
| N | Normal |
| A | Abnormal |
| AA | Critical abnormal |
| H | High |
| HH | Critical high |
| L | Low |
| LL | Critical low |
| > | Above absolute high |
| < | Below absolute low |
| S | Susceptible |
| R | Resistant |
| I | Intermediate |

## OBR Handling

**OBR-25 Result Status Mapping:**

| HL7v2 | FHIR status |
|-------|-------------|
| O, I, S | `registered` |
| P | `preliminary` |
| A, R, N | `partial` |
| C, M | `corrected` |
| F | `final` |
| X | `cancelled` |
| Y, Z | error |
| (missing) | error |

## NTE Handling

All NTE segments (both after OBR and after OBX) map to the parent DiagnosticReport:
- `DiagnosticReport.conclusion`: concatenate all NTE-3 (Comment) texts with newlines
- `DiagnosticReport.conclusionCode`: from NTE-2 (Source of Comment)

**NTE-2 Source of Comment (HL7 Table 0105):**

| Value | Description |
|-------|-------------|
| L | Ancillary (filler) department is source of comment |
| O | Other system is source of comment |
| P | Orderer (placer) is source of comment |

## Specimen Handling

**Version-aware source selection:**
- v2.5+: Use SPM segment (preferred)
- Pre-v2.5: Use OBR-15 (Specimen Source) for backward compatibility
- If both present: SPM takes precedence

**Specimen** (from SPM or OBR-15):
- `id`: `{messageControlId}-specimen-{setId}`
- `type`: SPM-4 or OBR-15 component
- `subject`: Patient ref
- `collection.collectedDateTime`: SPM-17
- `receivedTime`: SPM-18

**References:**
- `DiagnosticReport.specimen`: refs to Specimen resources
- `Observation.specimen`: ref to associated Specimen

## Test Cases

**Approach**: Test-driven development. Write tests first, then implement to pass them.

### Message Conversion
- ORU_R01 → transaction bundle with DiagnosticReport + Observations
- Deterministic IDs for idempotency
- Resources tagged with message control ID
- Multiple OBR/OBX groups handled correctly
- NTE segments (after OBR and OBX) concatenated to DiagnosticReport.conclusion
- Missing MSH or OBR throws error
- OBX without parent OBR throws error
- OBR without OBX creates DiagnosticReport with empty result array

### Patient/Encounter Lookup
- Patient resolved from PID-3 (lookup only, error if not found)
- Encounter resolved from PV1-19 (lookup only, error if not found)

### OBR → DiagnosticReport
- OBR-4 → code
- OBR-7 → effectiveDateTime
- OBR-16 → performer
- OBR-22 → issued
- OBR-25 → status (see table above)
- NTE-2 → conclusionCode (L/O/P mapping)

### OBX → Observation
- OBX-3 → code (must be LOINC, error if not)
- OBX-7 → referenceRange (range parsing: `10-20`, `<100`, `>5`)
- OBX-8 → interpretation (version-aware, see above)
- OBX-11 → status (see table above)
- OBX-14 → effectiveDateTime
- OBX-16 → performer

### OBX Value Types (OBX-2 → value[x])
- NM: numeric with units from OBX-6
- ST/TX: string/text
- CE/CWE: coded values
- SN: comparator, range, ratio, or fallback string
- DT/TS: date/datetime
- TM: time

### Specimen (SPM/OBR-15 → Specimen)
- v2.5+ message with SPM segment → Specimen from SPM
- Pre-v2.5 message with OBR-15 → Specimen from OBR-15
- Both SPM and OBR-15 present → SPM takes precedence
- DiagnosticReport.specimen references created Specimen
- Observation.specimen references associated Specimen

## Open Questions

- **Performer handling**: Should OBR-16/OBX-16 create Practitioner resources, use contained resources, or display-only references?
- **DiagnosticReport.category**: Should we derive category from OBR-24 (Diagnostic Service Section ID) like LAB, RAD, PATH?
- **Multiple NTE-2 values**: If different NTE segments have different source codes (L, O, P), how to handle conclusionCode?
- **OBX-6 units system**: Should we map units to UCUM or pass through as-is?
- **Missing PV1**: Is encounter optional? Error or proceed without encounter reference?
- **ORC segment**: Should we process ORC (Common Order) for ServiceRequest or order metadata?
- **Observation.category**: Should we set category (e.g., "laboratory") based on message context?
- **Timezone handling**: How to handle OBX-14/OBR-7 timestamps without timezone? Use server default or leave as local time?

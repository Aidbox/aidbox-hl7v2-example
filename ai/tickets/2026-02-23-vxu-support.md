---
status: explored
reviewer-iterations: 0
prototype-files: []
---

# Design: VXU_V04 Conversion — Immunizations

## Problem Statement
[To be filled in Phase 4]

## Proposed Approach
[To be filled in Phase 4]

## Key Decisions
[To be filled in Phase 4]

## Trade-offs
[To be filled in Phase 4]

## Affected Components
[To be filled in Phase 4]

## Technical Details
[To be filled in Phase 4]

## Edge Cases and Error Handling
[To be filled in Phase 4]

## Test Cases
[To be filled in Phase 4]

# Context

## Exploration Findings

### VXU_V04 Message Structure (HL7v2 v2.8.2)

```
VXU_V04:
  MSH [1..1]
  SFT [0..*]
  UAC [0..1]
  PID [1..1]
  PD1 [0..1]
  NK1 [0..*]
  ARV [0..*]
  PATIENT_VISIT [0..1]
    PV1 [1..1]
    PV2 [0..1]
    ARV [0..*]
  GT1 [0..*]
  INSURANCE [0..*]
    IN1 [1..1]
    IN2 [0..1]
    IN3 [0..1]
  PERSON_OBSERVATION [0..*]
    OBX [1..1]
    PRT [0..*]
    NTE [0..*]
  ORDER [0..*]
    ORC [1..1]
    PRT [0..*]
    TIMING [0..*]
      TQ1 [1..1]
      TQ2 [0..*]
    RXA [1..1]
    RXR [0..1]
    OBSERVATION [0..*]
      OBX [1..1]
      PRT [0..*]
      NTE [0..*]
```

### Key Segments for Conversion

**RXA (Pharmacy/Treatment Administration)** — the vaccine given:
- RXA-3: Date/Time Start of Administration (DTM) [R]
- RXA-5: Administered Code (CWE, table 0292/CVX) [R]
- RXA-6: Administered Amount (NM) [R]
- RXA-7: Administered Units (CWE) [C]
- RXA-9: Administration Notes (CWE, repeating) [O] — `00`=new, `01`=historical
- RXA-10: Administering Provider (XCN, repeating) [B]
- RXA-15: Substance Lot Number (ST, repeating) [O]
- RXA-16: Substance Expiration Date (DTM, repeating) [O]
- RXA-17: Substance Manufacturer Name (CWE, repeating) [O] — MVX codes
- RXA-18: Substance/Treatment Refusal Reason (CWE, repeating) [O]
- RXA-19: Indication (CWE, repeating) [O]
- RXA-20: Completion Status (ID, table 0322) [O] — CP/PA/RE/NA
- RXA-21: Action Code - RXA (ID, table 0206) [O] — D=deleted
- RXA-22: System Entry Date/Time (DTM) [O]

**RXR (Pharmacy/Treatment Route)**:
- RXR-1: Route (CWE, table 0162) [R]
- RXR-2: Administration Site (CWE, table 0550) [O]

**ORC (Common Order)**:
- ORC-1: Order Control (ID, table 0119) [R]
- ORC-2: Placer Order Number (EI) [C]
- ORC-3: Filler Order Number (EI) [C]
- ORC-9: Date/Time of Transaction (DTM) [O]
- ORC-12: Ordering Provider (XCN, repeating) [B]

### RXA → FHIR Immunization Mapping (from HL7 V2-to-FHIR IG)

| RXA Field | FHIR Immunization Path | Notes |
|-----------|----------------------|-------|
| RXA-3 | `occurrenceDateTime` | Required |
| RXA-5 | `vaccineCode` | CVX code system: `http://hl7.org/fhir/sid/cvx` |
| RXA-6 | `doseQuantity.value` | |
| RXA-7 | `doseQuantity` (unit) | UCUM units |
| RXA-9 | `primarySource` / `reportOrigin` | `00`=primarySource:true, `01`=primarySource:false |
| RXA-10 | `performer.actor` (function=AP) | Administering Provider |
| RXA-15 | `lotNumber` | |
| RXA-16 | `expirationDate` | |
| RXA-17 | `manufacturer` (Organization) | MVX code system: `http://hl7.org/fhir/sid/mvx` |
| RXA-18 | `statusReason` | When status=not-done |
| RXA-19 | `reasonCode` | |
| RXA-20 | `status` | CP/PA→completed, RE/NA→not-done |
| RXA-21 | `status` override | D→entered-in-error (overrides RXA-20) |
| RXA-22 | `recorded` | When RXA-21=A |

**RXA-20 Completion Status → FHIR Immunization.status:**

| V2 Code | V2 Display | FHIR status |
|---------|-----------|-------------|
| CP | Complete | `completed` |
| PA | Partially Administered | `completed` (with note/subpotent) |
| RE | Refused | `not-done` |
| NA | Not Administered | `not-done` |
| (empty) | (default) | `completed` |
| RXA-21=D | Deleted | `entered-in-error` |

### ORC → FHIR Immunization Mapping

| ORC Field | FHIR Immunization Path | Notes |
|-----------|----------------------|-------|
| ORC-2 | `identifier` (type=PLAC) | |
| ORC-3 | `identifier` (type=FILL) + ID generation | |
| ORC-9 | `recorded` | |
| ORC-12 | `performer.actor` (function=OP) | Ordering Provider |

### RXR → FHIR Immunization Mapping

| RXR Field | FHIR Immunization Path |
|-----------|----------------------|
| RXR-1 | `route` |
| RXR-2 | `site` |

### ORDER-level OBX → Immunization Fields (CDC IIS IG)

Well-defined set of LOINC codes that map to specific Immunization fields:

| LOINC | Name | Immunization Field |
|-------|------|--------------------|
| 64994-7 | Vaccine funding program eligibility | `programEligibility` |
| 30963-3 | Vaccine funding source | `fundingSource` |
| 69764-9 | VIS Document type | `education.documentType` |
| 29768-9 | VIS Publication date | `education.publicationDate` |
| 29769-7 | VIS Presentation date | `education.presentationDate` |
| 30973-2 | Dose number in series | `protocolApplied.doseNumber` |

### FHIR Immunization Required Fields

- `status`: completed / entered-in-error / not-done
- `vaccineCode`: CodeableConcept (CVX)
- `patient`: Reference(Patient)
- `occurrence[x]`: dateTime or string

### Example VXU_V04 Message (CDC IIS pattern)

```
MSH|^~\&|MyEMR|DE-000001||DEST|20160701123030-0700||VXU^V04^VXU_V04|CA0001|P|2.5.1|||ER|AL|||||Z22^CDCPHINVS
PID|1||PA123456^^^MYEMR^MR||JONES^GEORGE^M^JR^^^L||20140227|M||2106-3^WHITE^CDCREC|1234 W FIRST ST^^BEVERLY HILLS^CA^90210^^H||^PRN^PH^^^555^5551234
PV1|1|R
ORC|RE||65930^DCS||||||20160701|||1234567890^SMITH^JOHN^W^^^MD^^^NPI
RXA|0|1|20160701||08^HEPB-ADOLESCENT OR PEDIATRIC^CVX|999|||01^HISTORICAL^NIP001||||||MSD456789||MSD^MERCK^MVX||||A
RXR|IM^INTRAMUSCULAR^NCIT|LA^LEFT ARM^HL70163
OBX|1|CE|64994-7^VACCINE FUND PGM ELIG CAT^LN|1|V02^VFC ELIGIBLE-MEDICAID^HL70064||||||F
OBX|2|CE|30963-3^VACCINE FUNDING SOURCE^LN|2|VXC1^MEDICAID^CDCPHINVS||||||F
OBX|3|CE|69764-9^DOCUMENT TYPE^LN|3|253088698300026411121116^HEPB^cdcgs1vis||||||F
OBX|4|DT|29768-9^VIS PUBLICATION DATE^LN|3|20120202||||||F
OBX|5|DT|29769-7^VIS PRESENTATION DATE^LN|3|20160701||||||F
```

### Codebase Patterns

**Message converter registration:** Switch in `src/v2-to-fhir/converter.ts` — add `VXU_V04` case.

**Standard converter structure:**
1. Extract MSH → sender context
2. Extract PID → resolve patient (create draft if missing, active=false)
3. Extract PV1 (optional) → Encounter (config-driven, like ORU)
4. Extract message-specific segments → FHIR resources
5. Handle mapping errors
6. Build transaction bundle
7. Return ConversionResult with bundle + messageUpdate

**Config pattern:** `config/hl7v2-to-fhir.json` — add `VXU-V04` entry with PV1 policy and preprocessors.

**ID generation:**
- Patient: `{assigner}-{value}` from PID-3 authority (safe)
- Encounter: `{system}-{value}` from PV1-19 authority (safe)
- DiagnosticReport: raw order number only (BUG — no sender scoping)
- For Immunization: use preprocessor to inject MSH authority into ORC-3 EI when missing, then use `{authority}-{value}` in converter

**Existing segment converters:** PID, PV1, OBR, OBX, DG1, AL1, IN1, NK1, SPM, NTE all exist. Need new: RXA→Immunization, RXR→route/site.

**FHIR Immunization type:** Already exists at `src/fhir/hl7-fhir-r4-core/Immunization.ts`.

**HL7v2 generated types:** Need to verify RXA, RXR, ORC exist in `src/hl7v2/generated/`. May need `bun run regenerate-hl7v2`.

**Test patterns:** Unit tests in `test/unit/v2-to-fhir/messages/`, integration in `test/integration/v2-to-fhir/`. Fixtures in `test/fixtures/hl7v2/`.

### Web Research Sources

- CDC HL7 v2.5.1 IG for Immunization: https://www.cdc.gov/vaccines/programs/iis/technical-guidance/downloads/hl7guide-1-5-2014-11.pdf
- HL7 V2-to-FHIR IG (RXA→Immunization): https://build.fhir.org/ig/HL7/v2-to-fhir/ConceptMap-segment-rxa-to-immunization.html
- HL7 V2-to-FHIR IG (ORC→Immunization): https://build.fhir.org/ig/HL7/v2-to-fhir/ConceptMap-segment-orc-to-immunization.html
- HL7 V2-to-FHIR IG (RXR→Immunization): https://build.fhir.org/ig/HL7/v2-to-fhir/ConceptMap-segment-rxr-to-immunization.html
- CVX Code System: https://terminology.hl7.org/NamingSystem-CVX.html
- FHIR R4 Immunization: https://hl7.org/fhir/R4/immunization.html

## User Requirements & Answers

**Original requirement:** Implement conversion of VXU messages (immunizations).

### Scope Decisions

1. **Direction:** Incoming only (VXU → FHIR). No outgoing VXU generation.

2. **Segments in scope:**
   - ORDER group: ORC + RXA + RXR + OBX → Immunization + fields
   - PERSON_OBSERVATION: Patient-level OBX → standalone Observations
   - PID → Patient, PV1 → Encounter (optional)
   - Skip: INSURANCE, GT1

3. **Not-administered immunizations:** Yes, handle RXA-20=NA/RE as Immunization status=not-done with statusReason from RXA-18.

### Implementation Decisions

4. **CVX code mapping:** No ConceptMap needed. CVX is already a standard FHIR code system (`http://hl7.org/fhir/sid/cvx`). Pass through directly. If a sender uses non-standard local vaccine codes, that's a separate future concern.

5. **PV1 policy:** Optional (like ORU). If present, create/link Encounter. If missing, skip Encounter and process normally.

6. **ORDER-level OBX:** Map known LOINC codes (64994-7, 30963-3, VIS codes, 30973-2) directly to Immunization fields. Hard error on unknown OBX codes — don't create Observations, don't use mapping_error. Unknown codes in VXU ORDER context are unexpected and need developer attention, not user mapping resolution.

7. **PERSON_OBSERVATION OBX:** Create standalone Observation resources with `subject: Reference(Patient)`.

8. **Immunization ID generation:** Use ORC-3 (Filler Order Number) with authority from EI.2/EI.3. Add preprocessor to inject MSH-3/MSH-4 into ORC-3 authority when missing. Core converter requires authority — fails if missing after preprocessing.

9. **DiagnosticReport ID collision:** Separate ticket created at `ai/tickets/2026-02-24-diagnosticreport-id-collision.md` — same pattern needs fixing for OBR-3 in existing ORU conversion.

### Architecture Decisions

10. **Single ticket, includes CDC IIS logic:** VXU is effectively only used with CDC IIS — splitting core/IG into separate tickets doesn't make practical sense. The CDC IIS OBX handling and NIP001 interpretation are inherent to VXU conversion.

11. **ConversionProfile interface — pattern for IG enrichment:**
    ```typescript
    interface ConversionProfile {
      name: string;
      enrich(
        parsedMessage: HL7v2Message,
        result: ConversionResult,
        context: SenderContext,
      ): ConversionResult;
    }
    ```
    This is a **code pattern/contract**, not a framework. No registry, no config-driven selection, no applied-profiles tracking. The interface exists so that:
    - Future message types can reuse the same pattern
    - Future dynamic profile selection can be added trivially (add registry + config) because the interface already exists
    - The pattern is discoverable and consistent across converters

12. **VXU converter directly imports and calls CDC IIS profile:**
    The VXU converter imports `cdcIisProfile` and calls `enrich()` explicitly. This is NOT dynamic — VXU without CDC IIS is a broken converter, not a valid configuration. The IG enrichment is part of the conversion spec, not a deployment-time choice.

    The conversion flow in `vxu-v04.ts`:
    1. Core conversion: RXA/RXR/ORC → base Immunization (standard V2-to-FHIR IG mappings)
    2. CDC IIS enrichment: ORDER OBX → Immunization fields + RXA-9 NIP001 interpretation
    3. Both steps are visible in one file — reading the converter shows the complete VXU pipeline

    What's dynamic (per-sender): preprocessing, ConceptMaps — already handled by existing infrastructure.
    What's NOT dynamic: which IG defines VXU semantics — hardcoded direct import.

13. **Profile validation:** Separate future ticket. Validates that converted resources conform to the IG's expected FHIR profiles.

14. **Performers (RXA-10, ORC-12):** Include in core converter. Create Practitioner resources from XCN and link via Immunization.performer with function codes AP/OP.

15. **Manufacturer (RXA-17):** Out of scope for this ticket. Separate ticket for Organization creation from MVX codes.

## AI Review Notes
[To be filled in Phase 5]

## User Feedback
[To be filled in Phase 6]

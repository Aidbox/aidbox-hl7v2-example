---
status: ai-reviewed
reviewer-iterations: 2
prototype-files:
  - src/v2-to-fhir/messages/vxu-v04.ts
  - src/v2-to-fhir/segments/rxa-immunization.ts
  - src/v2-to-fhir/ig-enrichment/ig-enrichment.ts
  - src/v2-to-fhir/ig-enrichment/cdc-iis-enrichment.ts
  - test/fixtures/hl7v2/vxu-v04/base.hl7
  - test/fixtures/hl7v2/vxu-v04/not-administered.hl7
  - test/fixtures/hl7v2/vxu-v04/with-person-observations.hl7
  - test/fixtures/hl7v2/vxu-v04/historical.hl7
  - test/fixtures/hl7v2/vxu-v04/entered-in-error.hl7
  - test/fixtures/hl7v2/vxu-v04/multiple-orders.hl7
  - test/fixtures/hl7v2/vxu-v04/error/missing-rxa.hl7
  - test/fixtures/hl7v2/vxu-v04/error/missing-orc3.hl7
  - test/fixtures/hl7v2/vxu-v04/error/unknown-order-obx.hl7
  - test/unit/v2-to-fhir/messages/vxu-v04.test.ts
  - test/unit/v2-to-fhir/segments/rxa-immunization.test.ts
  - test/unit/v2-to-fhir/ig-enrichment/cdc-iis-enrichment.test.ts
  - test/integration/v2-to-fhir/vxu-v04.integration.test.ts
---

# Design: VXU_V04 Conversion — Immunizations

## Problem Statement

The system currently supports incoming HL7v2 ADT and ORU messages but cannot process VXU_V04 (Unsolicited Vaccination Record Update) messages. Immunization registries and EHR systems send VXU messages to report administered and historical vaccinations. Without VXU support, immunization data must be manually entered or left unprocessed, creating gaps in patient records.

This ticket implements the full VXU_V04-to-FHIR conversion pipeline, including CDC IIS Implementation Guide semantics (ORDER-level OBX interpretation, NIP001 source coding), which is how VXU is used in practice.

## Proposed Approach

Follow the established converter pattern (ORU_R01 as primary reference) with these VXU-specific additions:

1. **Core converter** (`vxu-v04.ts`): Extracts ORDER groups (ORC+RXA+RXR), converts each to a FHIR Immunization resource. Handles PID/PV1 using existing infrastructure (patient lookup/draft, config-driven PV1 policy). Converts PERSON_OBSERVATION OBX to standalone Observations.

2. **Segment converter** (`rxa-immunization.ts`): Pure function mapping RXA+RXR+ORC fields to a base FHIR Immunization. Handles status derivation (RXA-20/21), dose quantity, lot number, expiration date, performer creation from XCN, and identifier generation from ORC-2/3.

3. **IGEnrichment interface + CDC IIS implementation**: Defines a reusable contract (`IGEnrichment`) for IG-specific post-conversion logic. The CDC IIS enrichment maps ORDER-level OBX segments (known LOINC codes) to Immunization fields (programEligibility, fundingSource, education, protocolApplied) and interprets RXA-9 NIP001 source codes.

4. **Preprocessor for ORC-3 authority**: Extends the existing preprocessor registry to inject MSH-3/MSH-4 into ORC-3 EI.2 when the authority is missing, ensuring deterministic ID generation.

5. **HL7v2 type generation**: Run `bun run regenerate-hl7v2` to generate RXA/RXR types (currently missing from generated code). ORC already exists.

## Key Decisions

| # | Decision | Options Considered | Chosen | Rationale |
|---|----------|-------------------|--------|-----------|
| 1 | CVX code handling | (a) ConceptMap lookup, (b) Pass-through | Pass-through | CVX is already a standard FHIR code system. No sender-specific translation needed. |
| 2 | ORDER-level OBX handling | (a) mapping_error + Task, (b) Hard error, (c) Create Observation | Hard error | ORDER OBX in VXU has a well-defined set of LOINC codes per CDC IIS IG. Unknown codes indicate a programming error or unsupported sender, not a user-resolvable mapping issue. |
| 3 | PERSON_OBSERVATION OBX | (a) Ignore, (b) Create Observation | Create Observation | Patient-level observations (e.g., disease history) are clinically relevant standalone resources. |
| 4 | RXA-9 NIP001 interpretation | (a) Core converter, (b) CDC IIS enrichment | CDC IIS enrichment | NIP001 table (00=new, 01=historical) is CDC IIS-specific, not core HL7v2. Keep IG-specific logic in the enrichment layer. |
| 5 | Immunization ID source | (a) ORC-3 only, (b) ORC-3 with fallback to ORC-2 | ORC-3 with ORC-2 fallback | Mirrors the OBR-3/OBR-2 pattern in ORU. ORC-3 (filler) is preferred; ORC-2 (placer) is fallback. Both need authority scoping. |
| 6 | Performers (RXA-10, ORC-12) | (a) In scope, (b) Separate ticket | In scope | Performers are core to the Immunization resource. XCN converter already exists. |
| 7 | Manufacturer (RXA-17) | (a) In scope, (b) Separate ticket | Separate ticket | Requires Organization resource creation from MVX codes -- different concern than Immunization conversion. |
| 8 | PV1 policy | (a) Required, (b) Optional | Optional | VXU messages frequently omit PV1 or send minimal PV1 (e.g., `PV1\|1\|R`). Same policy as ORU. |
| 9 | IGEnrichment pattern | (a) Post-processor at service level, (b) Inline in converter | Inline in converter | Single file shows the complete VXU pipeline. Splitting across service + converter hurts readability. |
| 10 | VIS OBX grouping | (a) Flat list, (b) Group by OBX-4 sub-ID | Group by OBX-4 sub-ID | CDC IIS IG uses OBX-4 to group VIS document type with its publication/presentation dates. Required for correct `education[]` construction. |

## Trade-offs

**Pros:**
- Follows established converter patterns -- consistent architecture, reusable infrastructure (patient lookup, PV1 handling, preprocessors, meta tags)
- IGEnrichment interface enables future IG-specific enrichments for other message types without changing the converter framework
- Deterministic IDs with authority scoping (via ORC-3 preprocessor) prevent cross-sender collisions
- Hard error on unknown ORDER OBX codes catches integration issues early rather than silently dropping data

**Cons:**
- Hard error on unknown ORDER OBX codes means a message with a single unexpected LOINC code fails entirely. **Mitigation:** The error message names the unknown code, and the "Mark for Retry" UI flow works once a developer adds support.
- RXA/RXR types must be generated before implementation can start. **Mitigation:** `bun run regenerate-hl7v2` is a known workflow; if RXA/RXR aren't in the generator's scope, manual type definitions in the segment converter file are acceptable (small surface area, 2 types).
- CDC IIS enrichment is hardcoded in the VXU converter (not dynamic). **Mitigation:** This is intentional -- VXU without CDC IIS is not a real use case. The IGEnrichment interface enables future dynamism when needed.

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|
| `src/v2-to-fhir/messages/vxu-v04.ts` | **New** | VXU_V04 message converter |
| `src/v2-to-fhir/segments/rxa-immunization.ts` | **New** | RXA+RXR+ORC → Immunization segment converter |
| `src/v2-to-fhir/ig-enrichment/ig-enrichment.ts` | **New** | IGEnrichment interface definition |
| `src/v2-to-fhir/ig-enrichment/cdc-iis-enrichment.ts` | **New** | CDC IIS enrichment: ORDER OBX → Immunization fields, RXA-9 NIP001 |
| `src/v2-to-fhir/converter.ts` | **Modify** | Add `VXU_V04` case to switch, import `convertVXU_V04` |
| `src/v2-to-fhir/config.ts` | **Modify** | Add `ORC` to `MessageTypeConfig.preprocess` type |
| `src/v2-to-fhir/preprocessor-registry.ts` | **Modify** | Add `inject-authority-into-orc3` preprocessor |
| `config/hl7v2-to-fhir.json` | **Modify** | Add `VXU-V04` message config entry |
| `test/fixtures/hl7v2/vxu-v04/` | **New** | VXU test fixtures (9 files) |
| `test/unit/v2-to-fhir/messages/vxu-v04.test.ts` | **New** | Unit tests for VXU converter |
| `test/unit/v2-to-fhir/segments/rxa-immunization.test.ts` | **New** | Unit tests for RXA segment converter |
| `test/unit/v2-to-fhir/ig-enrichment/cdc-iis-enrichment.test.ts` | **New** | Unit tests for CDC IIS enrichment |
| `test/integration/v2-to-fhir/vxu-v04.integration.test.ts` | **New** | E2E integration tests for VXU processing |

## Technical Details

### ORDER Group Extraction

The VXU_V04 message has a flat segment list that must be grouped into ORDER groups. Each ORDER starts with ORC and contains RXA, optional RXR, and optional OBX segments:

```typescript
interface VXUOrderGroup {
  orc: HL7v2Segment;
  rxa: HL7v2Segment;
  rxr?: HL7v2Segment;
  observations: Array<{ obx: HL7v2Segment; ntes: HL7v2Segment[] }>;
}

function groupVXUOrders(message: HL7v2Message): VXUOrderGroup[]
```

PERSON_OBSERVATION OBX segments (before the first ORC) are extracted separately.

### Immunization ID Generation

```typescript
// From ORC-3 (Filler Order Number) with authority scoping:
// ID = sanitize("{authority}-{value}")
// where authority = EI.2 (namespace) or EI.3 (universal ID)
// Preprocessor injects MSH-3/MSH-4 into EI.2 when missing

function generateImmunizationId(orc: ORC): string {
  const filler = orc.$3_fillerOrderNumber;
  const placer = orc.$2_placerOrderNumber;
  const ei = filler ?? placer;
  // ei.$2_namespace or ei.$3_system is authority (required after preprocessing)
  // ei.$1_value is the order number
  const authority = ei.$2_namespace || ei.$3_system;
  const value = ei.$1_value;
  return sanitize(`${authority}-${value}`);
}
```

### RXA-20/21 Status Derivation

```typescript
function deriveImmunizationStatus(
  completionStatus: string | undefined,  // RXA-20
  actionCode: string | undefined,        // RXA-21
): Immunization["status"] {
  // RXA-21=D overrides everything
  if (actionCode?.toUpperCase() === "D") {
    return "entered-in-error";
  }
  // RXA-20 mapping
  switch (completionStatus?.toUpperCase()) {
    case "RE":
    case "NA":
      return "not-done";
    case "CP":
    case "PA":
    case undefined:
    case "":
      return "completed";
    default:
      return "completed";
  }
}
```

### RXA-9 NIP001 Source Interpretation (CDC IIS enrichment)

```typescript
// NIP001 Administration Notes table:
// "00" = New immunization record (primarySource: true)
// "01" = Historical information (primarySource: false, reportOrigin populated)
function interpretRXA9Source(
  administrationNotes: CE[] | undefined,
): { primarySource: boolean; reportOrigin?: CodeableConcept } {
  const nip001Entry = administrationNotes?.find(
    (ce) => ce.$3_system === "NIP001" || ce.$3_system?.toUpperCase().includes("NIP001")
  );
  if (!nip001Entry) return { primarySource: true }; // default

  if (nip001Entry.$1_code === "00") {
    return { primarySource: true };
  }
  if (nip001Entry.$1_code === "01") {
    return {
      primarySource: false,
      reportOrigin: { coding: [{ code: "01", display: "Historical", system: "urn:oid:2.16.840.1.114222.4.5.274" }] },
    };
  }
  return { primarySource: true }; // unknown codes default to new
}
```

### IGEnrichment Interface

```typescript
// src/v2-to-fhir/ig-enrichment/ig-enrichment.ts
import type { HL7v2Message } from "../../hl7v2/generated/types";
import type { ConversionResult } from "../converter";
import type { SenderContext } from "../../code-mapping/concept-map";

export interface IGEnrichment {
  name: string;
  enrich(
    parsedMessage: HL7v2Message,
    result: ConversionResult,
    context: SenderContext,
  ): ConversionResult;
}
```

### CDC IIS Enrichment: ORDER OBX Mapping

```typescript
// Known LOINC codes mapped to Immunization fields
const ORDER_OBX_HANDLERS: Record<string, (immunization, obxValue) => void> = {
  "64994-7": (imm, val) => { imm.programEligibility = [toCodeableConcept(val)]; },
  "30963-3": (imm, val) => { imm.fundingSource = toCodeableConcept(val); },
  "69764-9": (imm, val) => { /* VIS doc type — group by OBX-4 sub-ID */ },
  "29768-9": (imm, val) => { /* VIS pub date — group by OBX-4 sub-ID */ },
  "29769-7": (imm, val) => { /* VIS presentation date — group by OBX-4 sub-ID */ },
  "30973-2": (imm, val) => { imm.protocolApplied = [{ doseNumberString: val }]; },
};
```

VIS OBX segments (69764-9, 29768-9, 29769-7) share the same OBX-4 sub-ID to form a single `education[]` entry. The enrichment groups them by sub-ID before populating the Immunization.

### Performer Creation

```typescript
// RXA-10 → Immunization.performer with function=AP (Administering Provider)
// ORC-12 → Immunization.performer with function=OP (Ordering Provider)
function createPerformer(
  xcn: XCN,
  functionCode: "AP" | "OP",
): { performer: ImmunizationPerformer; practitionerEntry?: BundleEntry } {
  const practitioner = convertXCNToPractitioner(xcn);
  // Generate deterministic Practitioner ID from XCN.1 + XCN.9
  // Return both the performer reference and a bundle entry for the Practitioner
}
```

### ORC-3 Authority Preprocessor

```typescript
// New preprocessor: "inject-authority-into-orc3"
// Triggered on ORC field 3
// If ORC-3.1 (Entity Identifier) is present but ORC-3.2/3 (authority) are missing,
// inject MSH-3/MSH-4 derived namespace into ORC-3.2
function injectAuthorityIntoOrc3(
  context: PreprocessorContext,
  segment: HL7v2Segment,
): void {
  // Same MSH namespace derivation as existing inject-authority-from-msh
  // Sets EI.2 on the ORC segment's field 3
}
```

### Config Entry

```json
{
  "VXU-V04": {
    "preprocess": {
      "PID": {
        "2": ["move-pid2-into-pid3"],
        "3": ["inject-authority-from-msh"]
      },
      "PV1": { "19": ["fix-authority-with-msh"] },
      "ORC": { "3": ["inject-authority-into-orc3"] }
    },
    "converter": { "PV1": { "required": false } }
  }
}
```

### Conversion Flow (vxu-v04.ts)

```
convertVXU_V04(parsed, context)
    |
    +-> parseMSH()                    // Sender context, meta tags
    +-> parsePID()                    // Required
    +-> handlePatient()               // Lookup or draft (reuse from ORU)
    +-> parsePV1()                    // Optional
    +-> handleEncounter()             // Config-driven (reuse from ORU)
    |
    +-> extractPersonObservations()   // OBX before first ORC -> standalone Observations
    +-> groupVXUOrders()              // ORC+RXA+RXR+OBX grouping
    |
    +-> for each ORDER group:
    |       +-> convertOrderToImmunization()
    |       |       +-> convertRXAToImmunization()    // Core fields
    |       |       +-> applyRXR()                     // Route + site
    |       |       +-> applyORC()                     // Identifiers + ordering provider
    |       |       +-> createPerformers()             // Practitioner resources
    |       +-> Collect entries
    |
    +-> cdcIisEnrichment.enrich()     // ORDER OBX -> Immunization fields, RXA-9 NIP001
    |
    +-> Build transaction bundle
    +-> Return ConversionResult
```

## Edge Cases and Error Handling

| Condition | Handling |
|-----------|----------|
| Missing ORC in message | Error: "ORDER group requires ORC segment" |
| Missing RXA in ORDER group | Error: "ORDER group requires RXA segment" |
| ORC-3 and ORC-2 both missing | Error: "Either ORC-3 or ORC-2 required for Immunization ID" |
| ORC-3 authority missing after preprocessing | Error: "ORC-3 authority required for deterministic ID" |
| RXA-20 with unknown value | Default to `completed` (spec says field is optional; unknown values treated as omitted) |
| RXA-21=D (deleted) | Set status=`entered-in-error`, override RXA-20 |
| RXA-20=PA (partially administered) | Set status=`completed`, set `isSubpotent=true` |
| RXA-20=RE (refused) with RXA-18 | Set status=`not-done`, populate `statusReason` from RXA-18 |
| RXA-20=NA (not administered) without RXA-18 | Set status=`not-done`, `statusReason` omitted (no reason given) |
| Unknown LOINC code in ORDER OBX | Hard error: "Unknown OBX code {code} in VXU ORDER context" |
| Missing LOINC in ORDER OBX (OBX-3.3 not "LN") | Hard error: "ORDER OBX-3 must use LOINC coding system" |
| VIS OBX with mismatched sub-IDs | Group by sub-ID; partial VIS entries (e.g., doc type without dates) are still valid |
| PERSON_OBSERVATION OBX without LOINC | Same as ORU: use existing LOINC resolution (mapping_error + Task) |
| Multiple RXA-9 entries | Find the NIP001-coded one; ignore non-NIP001 entries |
| RXA-10 with empty XCN | Skip performer (no practitioner created) |
| PV1 with `PV1\|1\|R` (minimal) | Valid: patient class R maps to IMP (inpatient), Encounter created |
| Multiple ORDER groups in one message | Each produces a separate Immunization + associated resources |
| RXA-15 (lot number) repeating | Use first value (FHIR Immunization.lotNumber is singular string) |
| RXA-16 (expiration date) repeating | Use first value (FHIR Immunization.expirationDate is singular) |

## Test Cases

| # | Type | Description |
|---|------|-------------|
| 1 | Unit | Base VXU: single ORDER with ORC+RXA+RXR produces Immunization with correct vaccineCode, status=completed, occurrenceDateTime, doseQuantity, lotNumber, route, site |
| 2 | Unit | Status: RXA-20=RE produces status=not-done, statusReason from RXA-18 |
| 3 | Unit | Status: RXA-20=NA produces status=not-done without statusReason |
| 4 | Unit | Status: RXA-21=D overrides RXA-20=CP, produces status=entered-in-error |
| 5 | Unit | Status: RXA-20=PA produces status=completed with isSubpotent=true |
| 6 | Unit | Status: RXA-20 empty/missing defaults to status=completed |
| 7 | Unit | Historical: RXA-9 with NIP001 code "01" produces primarySource=false, reportOrigin populated |
| 8 | Unit | New record: RXA-9 with NIP001 code "00" produces primarySource=true |
| 9 | Unit | Performers: RXA-10 creates performer with function=AP, ORC-12 with function=OP |
| 10 | Unit | Identifiers: ORC-3 produces identifier with type=FILL, ORC-2 produces type=PLAC |
| 11 | Unit | ID generation: Immunization.id derived from ORC-3 with authority scoping |
| 12 | Unit | ID generation: fallback to ORC-2 when ORC-3 missing |
| 13 | Unit | Error: missing ORC-3 and ORC-2 returns error status |
| 14 | Unit | Error: missing RXA returns error status |
| 15 | Unit | RXR: route and site correctly mapped to Immunization.route and Immunization.site |
| 16 | Unit | ORC-9: maps to Immunization.recorded (primary); RXA-22 fallback when ORC-9 empty and RXA-21=A |
| 17 | Unit | Multiple ORDER groups: produces multiple Immunization resources with distinct IDs |
| 18 | Unit | PERSON_OBSERVATION: OBX before first ORC creates standalone Observation |
| 19 | Unit | CDC IIS: OBX 64994-7 maps to programEligibility |
| 20 | Unit | CDC IIS: OBX 30963-3 maps to fundingSource |
| 21 | Unit | CDC IIS: VIS OBX group (69764-9 + 29768-9 + 29769-7) grouped by OBX-4 into education[] |
| 22 | Unit | CDC IIS: OBX 30973-2 maps to protocolApplied.doseNumber |
| 23 | Unit | CDC IIS: unknown ORDER OBX LOINC code returns hard error |
| 24 | Unit | PV1 optional: missing PV1 produces processed status, no Encounter |
| 25 | Unit | PV1 present: valid PV1 creates/links Encounter |
| 26 | Unit | Patient handling: unknown patient creates draft with active=false |
| 27 | Integration | E2E: submit VXU via MLLP, process, verify Immunization + Patient created in Aidbox |
| 28 | Integration | E2E: VXU with CDC IIS OBX, verify programEligibility and education on Immunization |
| 29 | Integration | E2E: VXU with PERSON_OBSERVATION, verify standalone Observation created |
| 30 | Integration | E2E: multiple ORDER groups, verify multiple Immunizations with distinct IDs |
| 31 | Integration | E2E: idempotent reprocessing -- same VXU processed twice produces same resources |

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
| RXA-22 | `recorded` | Fallback only: used when ORC-9 is empty and RXA-21=A |

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
| ORC-9 | `recorded` | Primary source; fallback to RXA-22 when ORC-9 empty and RXA-21=A |
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

### Real-World Sample Analysis

**Source:** `data/local/vxu/` (2 files). WARNING: these files may contain confidential data — do not quote any identifiers, names, or dates from them in this document.

Two real VXU messages from production senders were analyzed. Both declare v2.5.1. Key findings that diverge from our design assumptions:

#### F1. No ORC segment (BOTH samples)

Neither sender includes an ORC segment. Messages go straight from PV1 to RXA. The spec says ORC is [1..1] in the ORDER group, but real senders omit it entirely. This **breaks our ID generation strategy** (decision #8 depends entirely on ORC-3).

Also lost without ORC: identifiers (ORC-2/ORC-3), recorded date (ORC-9), ordering provider (ORC-12).

#### F2. RXA-6 (Administered Amount) has embedded units

- Sample 1: `20-40 mg` (range string + units in a numeric field)
- Sample 2: `0.3 mL` (value + units, RXA-7 is empty)

Spec says RXA-6 is NM (numeric) with separate CWE units in RXA-7. Real senders stuff everything into field 6.

Additionally, "999" appears in CDC IIS as a sentinel value meaning "unknown amount" — doseQuantity should be omitted when RXA-6=999.

#### F3. RXA-9 bare code without NIP001 system

Sample 2 sends `00` instead of `00^NEW RECORD^NIP001`. No coding system declared. The primarySource derivation logic must handle bare codes.

#### F4. RXR-1 (Route) empty despite spec-Required

Sample 2: `RXR||RD^Right Deltoid^HL70163` — route is empty, only site (RXR-2) populated. The spec says RXR-1 is Required.

#### F5. RXA-5 dual coding: CVX + NDC

Sample 2: `309^PVT Pfizer 12+^CVX^00069239201^^NDC` — primary CVX coding in CWE components 1-3, alternate NDC coding in components 4-6. Design only discusses CVX pass-through; CWE→CodeableConcept conversion must preserve alternate codings.

#### F6. No ORDER-level OBX in either sample

Neither sender includes CDC IIS OBX (no program eligibility, funding source, or VIS documents). CDC IIS enrichment is a no-op for these senders. This confirms not all senders follow the full CDC IIS pattern.

#### F7. PV1 minimal — no PV1-19 (Visit Number)

Both samples: `PV1|1|R|...|<admit-date-at-PV1-44>`. Only patient class and admit date. No visit number means no Encounter ID generation possible.

#### F8. MSH-3 (Sending Application) empty

Sample 1 has empty MSH-3, only MSH-4 (Sending Facility) populated. The `deriveMshNamespace` function handles this correctly (filters empty parts), producing just the facility name.

#### F9. RXA-3 (Date/Time Start) empty

Sample 1 has empty RXA-3. This is spec-Required and maps to FHIR Immunization.occurrenceDateTime (also Required). Missing administration date must be an error.

#### F10. RXA-17 (Manufacturer) text-only, no MVX code

Both samples: `^Pfizer`, `^Generic` — component 1 (code) empty, component 2 (text) has manufacturer name but no MVX code. Manufacturer is already out of scope (decision #16).

#### Preprocessor Feasibility Analysis

| Finding | Preprocessor can fix? | Rationale |
|---------|----------------------|-----------|
| F1. Missing ORC | **No** | Current preprocessors modify existing segments; can't create segments that don't exist. Converter must have fallback ID strategy. |
| F2. RXA-6 embedded units | **Yes** | Parse numeric prefix, move units to RXA-7 if empty. Sender-specific — config-driven. |
| F3. RXA-9 bare code | **Better in converter** | Preprocessor could wrap bare code into CWE, but converter can just check bare string "00"/"01" directly — simpler. |
| F4. RXR-1 empty | **No** | Nothing to fix — no data exists. Converter must treat as optional. |
| F5. RXA-5 dual coding | **Not needed** | Standard CWE behavior — converter should already handle components 4-6. |
| F6. No ORDER OBX | **Not needed** | CDC IIS enrichment is already a no-op when no OBX found. |
| F7. PV1 no PV1-19 | **Not needed** | PV1 handling already supports missing visit number. |
| F8. MSH-3 empty | **Not needed** | `deriveMshNamespace` already handles this. |
| F9. RXA-3 empty | **No** | Can't invent administration date. Must be error. |
| F10. RXA-17 text-only | **Not needed** | Manufacturer out of scope. |

**Summary:** Only F2 (embedded units) is a good preprocessor candidate. The biggest issue (F1, missing ORC) requires a converter-level fallback — preprocessors can't synthesize absent segments.

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

11. **IGEnrichment interface — pattern for IG-specific conversion logic:**
    ```typescript
    interface IGEnrichment {
      name: string;
      enrich(
        parsedMessage: HL7v2Message,
        result: ConversionResult,
        context: SenderContext,
      ): ConversionResult;
    }
    ```
    Design principles:
    - **Code pattern/contract**, not a framework. No registry, no config-driven selection. The interface enables future dynamic use by defining the contract now.
    - **Sync, not async.** IG enrichment is pure data transformation (reads segments, adds fields). No Aidbox lookups.
    - **Operates on whole ConversionResult.** Not per-resource, because some enrichments need cross-resource context (e.g., grouping VIS OBX by sub-ID).
    - **Correlation via IDs.** The enrichment matches ORDER OBX to Immunization resources in the bundle using deterministic IDs derived from ORC-3.
    - **Error handling.** On hard error (unknown OBX code), sets `messageUpdate.status = "error"` and `messageUpdate.error`.
    - **Deliberately minimal.** No `supportedMessageTypes`, `requiredPackages`, or `validate()` — add as properties later when registry/infra needs them.

    Note: renamed from "ConversionProfile" to "IGEnrichment" to avoid confusion with FHIR profiles (StructureDefinitions). An IG contains profiles, terminology, and capability statements — the enrichment is a conversion-time concept, not any of those.

12. **VXU converter directly imports and calls CDC IIS enrichment:**
    The VXU converter imports `cdcIisEnrichment` and calls `enrich()` explicitly. This is NOT dynamic — VXU without CDC IIS is a broken converter, not a valid configuration. The IG enrichment is part of the conversion spec, not a deployment-time choice.

    The conversion flow in `vxu-v04.ts`:
    1. Core conversion: RXA/RXR/ORC → base Immunization (standard V2-to-FHIR IG mappings)
    2. CDC IIS enrichment: ORDER OBX → Immunization fields + RXA-9 NIP001 interpretation
    3. Both steps are visible in one file — reading the converter shows the complete VXU pipeline

    What's dynamic (per-sender): preprocessing, ConceptMaps — already handled by existing infrastructure.
    What's NOT dynamic: which IG defines VXU semantics — hardcoded direct import.

    Why NOT post-processing at processor-service level: splitting conversion logic across converter + distant post-processor hurts readability and debugging. The converter should be the single place to understand the full VXU pipeline.

13. **No extensions needed for the Immunization resource.** All CDC IIS OBX codes map to standard FHIR R4 Immunization fields (programEligibility, fundingSource, education, protocolApplied.doseNumber). The US Core Immunization Profile also defines no extensions. However, PID-10 (Race) and PID-22 (Ethnic Group) require US Core extensions (`us-core-race`, `us-core-ethnicity`) on Patient — this is a cross-cutting concern shared with ADT/ORU, tracked separately in `ai/tickets/2026-02-25-us-core-patient-extensions.md`.

14. **Profile/IG validation:** Separate future ticket (`2026-02-24-profiles-support.md`). Validates converted resources conform to IG expectations.

15. **Performers (RXA-10, ORC-12):** Include in core converter. Create Practitioner resources from XCN and link via Immunization.performer with function codes AP/OP.

16. **Manufacturer (RXA-17):** Out of scope for this ticket. Separate ticket for Organization creation from MVX codes.

## AI Review Notes

**Reviewer:** Claude Opus 4.6 (ai-review skill)
**Date:** 2026-02-24
**Verdict:** BLOCKERS FOUND (fixture correctness issues)

### BLOCKERS

#### B1. Fixture RXA field positions are wrong (off by 3 pipes)

**Affected fixtures:** `entered-in-error.hl7`, `not-administered.hl7`, `with-person-observations.hl7`, `historical.hl7`, `multiple-orders.hl7`

The Completion Status (table 0322) appears at field 17 instead of field 20, and Action Code appears shifted correspondingly. This is because there are only 8 pipes between RXA-9 and the Completion Status value, but 11 pipes are needed (fields 10-19 must each have a separator even when empty).

**Example (entered-in-error.hl7):**
```
Current:  RXA|0|1|20160701||08^...^CVX|999|||00^NEW RECORD^NIP001||||||||CP||D|A
                                                                  ^^^^^^^^ 8 pipes (CP lands at field 17)
Expected: RXA|0|1|20160701||08^...^CVX|999|||00^NEW RECORD^NIP001|||||||||||CP||D|A
                                                                  ^^^^^^^^^^^ 11 pipes (CP lands at field 20)
```

**Verification:** The `base.hl7` fixture is correct because populated RXA-15 (lot number) and RXA-17 (manufacturer) implicitly account for the intermediate fields. The CDC reference example in the design's Context section (line 500) also counts correctly.

**Impact:** All tests relying on RXA-20 (Completion Status), RXA-21 (Action Code), or intermediate fields will parse wrong values. Every fixture except `base.hl7` needs 3 additional pipes between RXA-9 and RXA-20.

**Fix:** Add 3 pipes after RXA-9's value in each affected fixture to correctly pad fields 10-19 before the Completion Status at field 20.

#### B2. `not-administered.hl7` — RE is at field 18 instead of field 20

Same root cause as B1 but slightly different pipe count. The fixture has:
```
RXA|0|1|20160701||998^NO VACCINE ADMINISTERED^CVX|999||||||||||||RE
```
RE appears at field 18 (12 pipes after field 6, 10 empty fields 7-16, then 2 more for 17-18). Needs 2 additional pipes so RE lands at field 20.

### ISSUES (non-blocking)

#### I1. RXA type uses CE instead of CWE for v2.8.2 target

The prototype `RXA` interface in `rxa-immunization.ts` declares `$5_administeredCode: CE`, `$9_administrationNotes?: CE[]`, etc. Per v2.8.2 spec (confirmed via hl7v2-info), these fields are CWE, not CE. Since the project targets v2.8.2 and types will be generated via `bun run regenerate-hl7v2`, the generated types will use CWE.

**Resolution:** Noted in prototype as placeholder types. The TODO comment already says "Replace with generated types." Implementation must use CWE-compatible conversion (or the existing `convertCEToCodeableConcept` which works for CWE since CWE extends CE's component structure). No design change needed, but the implementer should be aware.

#### I2. CVX/MVX system URI normalization missing

`convertCEToCodeableConcept` passes through the raw system string (e.g., "CVX"). The V2-to-FHIR IG specifies the FHIR system URI `http://hl7.org/fhir/sid/cvx`. The `normalizeSystem` function in `coding-systems.ts` does not include CVX or MVX mappings.

**Resolution:** The design says "CVX is already a standard FHIR code system" which is true at the conceptual level, but the system *URI* needs normalization. Two options: (a) add CVX/NCIT/HL70163 to `normalizeSystem`, or (b) do it in the RXA converter. Option (a) is better since it benefits all converters. This is a minor implementation detail, not a design blocker — note it as a TODO for the implementer.

#### I3. RXR prototype declares `$1_route: CE` but v2.8.2 says CWE; table number discrepancy

The RXR interface comment says `table 0163` for RXR.2, but v2.8.2 uses table 0550 (Body Parts). Table 0163 is the v2.5 table. Same as I1 — prototype placeholder types will be replaced by generated types.

**Resolution:** No design change needed. Implementer should use generated types which will have the correct table references.

#### I4. PERSON_OBSERVATION group doesn't exist in v2.5.1

The fixtures declare `MSH|...|2.5.1` but the design handles PERSON_OBSERVATION OBX (a v2.8.2 group). In v2.5.1 spec, the VXU_V04 structure has no PERSON_OBSERVATION group — OBX before ORC is not formally part of the message structure.

**Resolution:** This is acceptable. The CDC IIS IG (which targets v2.5.1) does use OBX before ORC for patient-level observations. The design correctly follows CDC IIS IG practice rather than base v2.5.1 structure. The code handles this by position (OBX before first ORC) rather than by named group, which works regardless of version. No change needed.

#### I5. Design says "RXA-21 table 0323" but v2.8.2 uses table 0206

The design's Context section says RXA-21 uses table 0323 (Action Code). Per v2.8.2 spec (confirmed), RXA-21 uses table 0206 (Segment Action Code). Table 0323 is the v2.5 table. Both tables have the same values (A, D, U, X), so this has no functional impact.

**Resolution:** Minor documentation inaccuracy. The deriveImmunizationStatus function handles the correct values regardless. No code change needed.

#### I6. RXA-10 is "Backward compatible" [B] in v2.8.2, not Optional [O]

The design labels RXA-10 as `[O]` (Optional) but v2.8.2 marks it as `[B]` (Backward compatible / retained for backward compatibility). This means RXA-10 is deprecated in favor of PRT (Participation) segments. The prototype correctly uses RXA-10, which is appropriate for v2.5.1 messages from CDC IIS senders.

**Resolution:** No design change needed. The code is pragmatically correct for real-world VXU messages which still use RXA-10. If PRT segment support is needed later, it can be added.

#### I7. Shared helper extraction (ORU/VXU code duplication)

The VXU prototype has TODO comments about extracting shared helpers (parseMSH, extractMetaTags, createBundleEntry, handlePatient, handleEncounter) from oru-r01.ts. This duplication is acknowledged but not resolved in the design.

**Resolution:** The design correctly identifies this as implementation work. The TODO comments in the prototype provide clear guidance. Extracting to `src/v2-to-fhir/shared/converter-helpers.ts` during implementation is straightforward. No design change needed.

#### I8. `recorded` field has two potential sources (ORC-9 and RXA-22) without explicit precedence

The design maps both ORC-9 and RXA-22 to `Immunization.recorded`, with RXA-22 conditional on RXA-21=A. The prototype code (step 11) says "ORC-9 (or RXA-22 when RXA-21=A)" but doesn't clarify precedence when both are present.

**Resolution:** Suggest specifying: "Use ORC-9 as primary source for `recorded`. If ORC-9 is empty and RXA-21=A, use RXA-22 as fallback." This matches the V2-to-FHIR IG mapping which maps ORC-9 to Immunization.recorded in the ORC->Immunization ConceptMap. Minor implementation detail.

### OBSERVATIONS (informational)

#### O1. Design completeness is strong

All sections are filled out. Mappings cover the key RXA, RXR, ORC, and ORDER OBX fields. Edge cases table is comprehensive with 19 scenarios. Test cases cover 31 items across unit and integration. Key decisions are well-documented with rationale.

#### O2. Pattern consistency with ORU is good

The VXU converter follows the established pattern: parseMSH -> parsePID -> handlePatient -> parsePV1 -> handleEncounter -> extract groups -> convert -> build bundle. The config entry structure matches existing patterns. The IGEnrichment interface is a clean addition that doesn't disrupt existing code.

#### O3. Prototype quality is appropriate for design phase

Prototypes are correctly marked as "DESIGN PROTOTYPE" with clear TODO comments. They provide enough structure to guide implementation without being premature implementations. The modified files (converter.ts, config.ts, preprocessor-registry.ts) have inline markers that are easy to find and uncomment.

#### O4. CDC IIS enrichment re-parsing concern

The enrichment's `enrich()` method receives the full parsed message and must re-extract ORDER groups to find OBX segments. This means the grouping logic runs twice (once in the converter, once in the enrichment). Consider passing pre-grouped data to avoid re-parsing. However, since the enrichment interface operates on `ConversionResult` (which doesn't include parsed groups), this is an acceptable tradeoff — the enrichment only needs the OBX segments and can walk the flat segment list efficiently.

#### O5. Test fixtures cover the key scenarios well

The 9 fixture files cover: base case, not-administered, person observations, historical, entered-in-error, multiple orders, and 3 error cases. Once the pipe count issues (B1, B2) are fixed, these will be solid test data.

### Iteration 2

**Reviewer:** Claude Opus 4.6 (ai-review skill)
**Date:** 2026-02-24
**Verdict:** BLOCKERS FOUND (1 missed error fixture)

#### Blocker verification results

**B1 (fixture pipe counts) -- 5 of 6 affected fixtures FIXED:**

Verified via manual field-by-field counting against HL7v2 v2.5 RXA spec (26 fields, field 20 = Completion Status, field 21 = Action Code):

| Fixture | Field 20 | Field 21 | Status |
|---------|----------|----------|--------|
| `base.hl7` | (empty) | A | CORRECT (was already correct) |
| `entered-in-error.hl7` | CP | D | FIXED -- 11 pipes after field 9, CP at 20, D at 21 |
| `not-administered.hl7` | RE | (absent) | FIXED -- 13 pipes after field 6, RE at 20 |
| `with-person-observations.hl7` | CP | A | FIXED -- 11 pipes after field 9, CP at 20, A at 21 |
| `historical.hl7` | CP | A | FIXED -- 11 pipes after field 9, CP at 20, A at 21 |
| `multiple-orders.hl7` (both RXA lines) | CP | A | FIXED -- 11 pipes after field 9, CP at 20, A at 21 |

**B2 (not-administered.hl7 RE position) -- FIXED:** RE now at field 20 with 13 empty pipes between field 6 and RE.

**I8 (recorded field precedence) -- FIXED:** Design now explicitly states in three locations (test case 16, RXA mapping table line 444, ORC mapping table line 463): "ORC-9 is primary source; RXA-22 is fallback when ORC-9 empty and RXA-21=A."

#### NEW BLOCKER

##### B3. `error/unknown-order-obx.hl7` -- RXA Completion Status at wrong position

This error fixture was not in the iteration 1 B1 fix scope but has the same bug. The RXA line:
```
RXA|0|1|20160701||08^HEPB-ADOLESCENT OR PEDIATRIC^CVX|999|||00^NEW RECORD^NIP001||||||||CP|||A
```

Field-by-field analysis: 8 pipes between field 9 and CP places CP at field 17 (Substance Manufacturer Name), not field 20 (Completion Status). A lands at field 20 instead of field 21.

**Fix:** Add 3 pipes between field 9 and CP:
```
RXA|0|1|20160701||08^HEPB-ADOLESCENT OR PEDIATRIC^CVX|999|||00^NEW RECORD^NIP001|||||||||||CP|||A
```
This gives 11 pipes after field 9: fields 10-19 empty, CP at field 20, empty at 21, empty at 22, A at... wait, that's wrong too. The intent is CP at 20 and A at 21. Current has `CP|||A` which is CP, empty, empty, A. After fixing the position of CP to field 20, the trailing `|||A` would put A at field 23.

The correct fix should be: `|||||||||||CP|A` (11 pipes, CP at 20, A at 21) -- matching the pattern in the other fixed fixtures. The `|||A` in the original was compensating for the wrong CP position, and the fix should normalize both.

**Correct RXA line:**
```
RXA|0|1|20160701||08^HEPB-ADOLESCENT OR PEDIATRIC^CVX|999|||00^NEW RECORD^NIP001|||||||||||CP|A
```

#### Remaining non-blocking issues from iteration 1

I1 through I7: No changes needed, all correctly dispositioned. Confirmed the prototype placeholder types (I1, I3) have clear TODO markers. I2 (CVX system URI normalization) remains an implementation TODO.

## User Feedback
[To be filled in Phase 6]

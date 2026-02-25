---
status: ai-reviewed
reviewer-iterations: 4
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
  - test/fixtures/hl7v2/vxu-v04/no-orc.hl7
  - test/fixtures/hl7v2/vxu-v04/no-orc-identifiers.hl7
  - test/fixtures/hl7v2/vxu-v04/error/missing-rxa.hl7
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

1. **Core converter** (`vxu-v04.ts`): Extracts ORDER groups (optional ORC + RXA + optional RXR + optional OBX), converts each to a FHIR Immunization resource. ORC is optional — real-world senders frequently omit it. Handles PID/PV1 using existing infrastructure (patient lookup/draft, config-driven PV1 policy). Converts PERSON_OBSERVATION OBX to standalone Observations.

2. **Segment converter** (`rxa-immunization.ts`): Pure function mapping RXA+RXR+ORC fields to a base FHIR Immunization. Handles status derivation (RXA-20/21), dose quantity, lot number, expiration date, performer creation from XCN. Receives a pre-computed Immunization ID from the message converter.

3. **IGEnrichment interface + CDC IIS implementation**: Defines a reusable contract (`IGEnrichment`) for IG-specific post-conversion logic. The CDC IIS enrichment maps ORDER-level OBX segments (known LOINC codes) to Immunization fields (programEligibility, fundingSource, education, protocolApplied) and interprets RXA-9 NIP001 source codes. Uses positional correlation (ORDER group N → Nth Immunization in bundle).

4. **Preprocessors**: Extends the existing preprocessor registry with three new preprocessors:
   - `inject-authority-into-orc3`: Injects MSH-3/MSH-4 into ORC-3 EI.2 when authority is missing (for deterministic ID generation)
   - `normalize-rxa6-dose`: Handles "999" sentinel, embedded units, and unparseable values in the numeric dose field
   - `normalize-rxa9-nip001`: Injects "NIP001" system when bare "00"/"01" codes lack a coding system

5. **HL7v2 type generation**: Run `bun run regenerate-hl7v2` to generate RXA/RXR types (currently missing from generated code). ORC already exists.

## Key Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| 1 | CVX code handling | Pass-through | CVX is already a standard FHIR code system. No sender-specific translation needed. |
| 2 | Unknown ORDER-level OBX | Hard error | Unknown LOINC code in ORDER OBX is a hard error. All ORDER OBX codes are defined by the CDC IIS IG — an unknown code indicates an unsupported sender or a programming error, not a user-resolvable mapping issue. See ADR below. |
| 3 | PERSON_OBSERVATION OBX | Create standalone Observation | Patient-level observations (e.g., disease history) are clinically relevant standalone resources. |
| 4 | RXA-9 NIP001 interpretation | CDC IIS enrichment layer | NIP001 table (00=new, 01=historical) is CDC IIS-specific, not core HL7v2. |
| 5 | Immunization ID source | ORC-3 → ORC-2 → MSH fallback | ORC-3 (filler) preferred, ORC-2 (placer) as fallback. When ORC absent or both empty: `{mshNamespace}-{msh10}-imm-{orderIndex}`. |
| 6 | Performers (RXA-10, ORC-12) | In scope | Performers are core to the Immunization resource. RXA-10 → Practitioner (administering), ORC-12 → PractitionerRole (ordering). Per V2-to-FHIR IG. |
| 7 | Manufacturer (RXA-17) | Separate ticket | Requires Organization resource creation from MVX codes — different concern. |
| 8 | PV1 policy | Optional | VXU messages frequently omit PV1 or send minimal PV1 (e.g., `PV1\|1\|R`). Same policy as ORU. |
| 9 | IGEnrichment pattern | Inline in converter | Single file shows the complete VXU pipeline. Splitting across service + converter hurts readability. |
| 10 | VIS OBX grouping | Group by OBX-4 sub-ID | CDC IIS IG uses OBX-4 to group VIS document type with its publication/presentation dates. Required for correct `education[]` construction. |
| 11 | ORC optionality | ORC optional in ORDER group | Real-world senders frequently omit ORC. Converter handles both paths with honest fallback (no fabricated identifiers). |
| 12 | Enrichment correlation | Positional matching | ORDER group N → Nth Immunization in bundle. Works regardless of ORC presence. Warn only on shape mismatch. |
| 13 | ID generation responsibility | Message converter | Message converter computes Immunization ID (ORC-3/ORC-2/MSH fallback) and passes it to segment converter. Matches ORU pattern where `getOrderNumber()` is in the message converter. |
| 14 | `recorded` field rule | ORC-9 primary, RXA-22 fallback | `ORC-9 ?? (RXA-21=A ? RXA-22 : undefined)`. Applies uniformly regardless of ORC presence. When ORC absent, evaluation starts at RXA-22 fallback. |
| 15 | Performer resource types | RXA-10 → Practitioner, ORC-12 → PractitionerRole | V2-to-FHIR IG differentiates: administering provider is a person (Practitioner), ordering provider acts in a clinical role (PractitionerRole links Practitioner + Organization). Both existing XCN converters support this. |
| 16 | Performer function coding | System URI required | `performer.function` must include `system: "http://terminology.hl7.org/CodeSystem/v2-0443"` alongside the code (AP/OP). Per V2-to-FHIR IG segment mappings for RXA[Immunization] and ORC[Immunization]. |
| 17 | PRT segment support | Separate ticket, XCN fallback for now | PRT (v2.8+) replaces deprecated RXA-10/ORC-12 XCN fields. No PRT infrastructure exists yet. Implement XCN-based performers now; PRT support as cross-cutting ticket (affects VXU, ORU, ADT). See `ai/tickets/vxu/2026-02-25-prt-segment-support.md`. |

### ADR: Unknown ORDER OBX LOINC Codes → Hard Error

**Context:** The V2-to-FHIR IG's VXU_V04 message mapping (our local CSV copy) maps ORDER OBSERVATION OBX → generic `Observation` with `partOf=Immunization` as a fallback. The IG comment explicitly says: *"Some observations about the immunization may map to elements within the Immunization resource... Specific guidance on how to map, e.g., the US CDC implementation guide on immunizations, will be provided separately at a future time TBD."* The OBX[Immunization] mapping (on [HL7 Confluence](https://confluence.hl7.org/spaces/OO/pages/40731141/V2-FHIR+Mapping+-+Segment+OBX+Immunization), not yet in CSV form) defines LOINC→Immunization field mappings for the same CDC IIS codes we implement.

**Decision:** Unknown LOINC codes in ORDER-level OBX produce a **hard error**, not a generic Observation fallback.

**Rationale:**
1. **CDC IIS is the de facto standard.** The CDC IIS IG defines a closed set of LOINC codes for ORDER OBX in immunization messages. All US immunization senders follow the CDC IIS IG. The V2-to-FHIR IG's generic Observation fallback is a placeholder — the IG itself says it will be overridden by CDC-specific guidance.
2. **ORDER OBX has Immunization-specific semantics.** These are not standalone clinical observations — they are immunization metadata (funding eligibility, VIS documents, dose number). Creating a generic `Observation` with `partOf` is a lossy representation that pushes interpretation burden to consumers.
3. **Real-world data confirms.** Analysis of 3 production VXU messages (from `data/local/vxu/`) shows only CDC IIS LOINC codes in ORDER OBX. Zero unknown codes observed.
4. **Hard error is operationally safer.** An unknown code means either a programming error (we missed a CDC IIS code) or an unsupported sender profile. Both require developer attention, not silent degradation. The error message names the unknown code for fast resolution.

**Alternatives considered:**
- *Warning + skip (previous design):* Silently drops data. If the code is important, we'd never know.
- *Create Observation with `partOf=Immunization` (V2-to-FHIR IG generic fallback):* Preserves data but creates an awkward resource that doesn't match CDC IIS semantics. Consumers must know "this isn't really an observation."

**Record this decision** in project documentation (e.g., `docs/developer-guide/adr/` or equivalent) during implementation.

## Architectural Principle: Preprocessors Normalize, Converter Stays Honest

Existing preprocessors normalize data the sender actually sent (fix authority, move fields, inject metadata). They never fabricate data that doesn't exist. This boundary must be preserved:

- **Preprocessors** fix data representation (sender sent data in wrong format/location)
- **Converter** handles structural variation (data doesn't exist) with honest fallback logic
- The FHIR output accurately reflects what was actually sent — no fabricated identifiers or dates

**Example:** When ORC is absent, synthesizing an ORC segment would cross the fabrication boundary. A `{msh10}-imm-0` value is not a filler order number — it's a fabricated identifier that doesn't exist in the sender's system. Instead, the converter's fallback is honest: when ORC was missing, the Immunization has fewer fields, and that correctly reflects the source data.

## Trade-offs

**Pros:**
- Follows established converter patterns — consistent architecture, reusable infrastructure (patient lookup, PV1 handling, preprocessors, meta tags)
- IGEnrichment interface enables future IG-specific enrichments for other message types without changing the converter framework
- Deterministic IDs with authority scoping (via ORC-3 preprocessor) prevent cross-sender collisions
- Hard error on unknown ORDER OBX catches integration issues early — unknown codes indicate unsupported senders or missing CDC IIS mappings, not user-resolvable issues
- Preprocessor/converter boundary keeps FHIR output honest about source data

**Cons:**
- RXA/RXR types must be generated before implementation can start. **Mitigation:** `bun run regenerate-hl7v2` is a known workflow; if RXA/RXR aren't in the generator's scope, manual type definitions are acceptable (small surface area, 2 types).
- CDC IIS enrichment is hardcoded in the VXU converter (not dynamic). **Mitigation:** VXU without CDC IIS is not a real use case. The IGEnrichment interface enables future dynamism when needed.
- Significant shared helper extraction needed from ORU converter (~12 functions). **Mitigation:** Functions are already self-contained; extraction is mechanical.

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|
| `src/v2-to-fhir/messages/vxu-v04.ts` | **New** | VXU_V04 message converter |
| `src/v2-to-fhir/segments/rxa-immunization.ts` | **New** | RXA+RXR+ORC → Immunization segment converter |
| `src/v2-to-fhir/ig-enrichment/ig-enrichment.ts` | **New** | IGEnrichment interface definition |
| `src/v2-to-fhir/ig-enrichment/cdc-iis-enrichment.ts` | **New** | CDC IIS enrichment: ORDER OBX → Immunization fields, RXA-9 NIP001 |
| `src/v2-to-fhir/converter.ts` | **Modify** | Add `VXU_V04` case to switch, import `convertVXU_V04` |
| `src/v2-to-fhir/config.ts` | **Modify** | Add `ORC` and `RXA` to `MessageTypeConfig.preprocess` type |
| `src/v2-to-fhir/preprocessor-registry.ts` | **Modify** | Add `inject-authority-into-orc3`, `normalize-rxa6-dose`, `normalize-rxa9-nip001` preprocessors |
| `config/hl7v2-to-fhir.json` | **Modify** | Add `VXU-V04` message config entry |
| `test/fixtures/hl7v2/vxu-v04/` | **New** | VXU test fixtures (10 files) |
| `test/unit/v2-to-fhir/messages/vxu-v04.test.ts` | **New** | Unit tests for VXU converter |
| `test/unit/v2-to-fhir/segments/rxa-immunization.test.ts` | **New** | Unit tests for RXA segment converter |
| `test/unit/v2-to-fhir/ig-enrichment/cdc-iis-enrichment.test.ts` | **New** | Unit tests for CDC IIS enrichment |
| `test/integration/v2-to-fhir/vxu-v04.integration.test.ts` | **New** | E2E integration tests for VXU processing |

## Technical Details

### ORDER Group Extraction

The VXU_V04 message has a flat segment list that must be grouped into ORDER groups. Each ORDER starts with ORC **or** RXA (ORC is optional — real-world senders frequently omit it), contains RXA, optional RXR, and optional OBX segments:

```typescript
interface VXUOrderGroup {
  orc?: HL7v2Segment;  // Optional — real-world senders may omit ORC entirely
  rxa: HL7v2Segment;
  rxr?: HL7v2Segment;
  observations: Array<{ obx: HL7v2Segment; ntes: HL7v2Segment[] }>;
}

function groupVXUOrders(message: HL7v2Message): VXUOrderGroup[]
```

`groupVXUOrders()` starts a new ORDER group on either ORC or RXA (whichever appears). RXA without preceding ORC is a valid group.

PERSON_OBSERVATION OBX segments (before the first ORC or RXA) are extracted separately via `extractPersonObservations()`.

### Immunization ID Generation

ID generation is the **message converter's** responsibility (not the segment converter's), mirroring the ORU pattern.

```typescript
// In vxu-v04.ts (message converter):
function generateImmunizationId(
  orderGroup: VXUOrderGroup,
  mshNamespace: string,
  messageControlId: string,
  orderIndex: number,
): string {
  // Path 1: ORC present with ORC-3 or ORC-2
  if (orderGroup.orc) {
    const orc = orderGroup.orc;
    const filler = orc.$3_fillerOrderNumber;
    const placer = orc.$2_placerOrderNumber;
    const ei = filler ?? placer;
    if (ei?.$1_value) {
      const authority = ei.$2_namespace || ei.$3_system;
      return sanitize(`${authority}-${ei.$1_value}`);
    }
  }

  // Path 2: Fallback when ORC absent or ORC-3/ORC-2 both empty
  return sanitize(`${mshNamespace}-${messageControlId}-imm-${orderIndex}`);
}
```

The pre-computed ID is passed to `convertRXAToImmunization()`.

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
  administrationNotes: CWE[] | undefined,
): { primarySource: boolean; reportOrigin?: CodeableConcept } {
  const nip001Entry = administrationNotes?.find(
    (cwe) => cwe.$3_system === "NIP001" || cwe.$3_system?.toUpperCase().includes("NIP001")
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

Design principles:
- **Code pattern/contract**, not a framework. No registry, no config-driven selection.
- **Sync, not async.** IG enrichment is pure data transformation — no Aidbox lookups.
- **Operates on whole ConversionResult.** Some enrichments need cross-resource context (e.g., grouping VIS OBX by sub-ID).
- **Correlation via position.** ORDER group N → Nth Immunization in bundle. Works regardless of ORC presence.
- **Error handling.** On unknown OBX code: sets `messageUpdate.status = "error"` and `messageUpdate.error` naming the unknown code. See ADR above.
- **Deliberately minimal.** No `supportedMessageTypes`, `requiredPackages`, or `validate()` — add later when needed.

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
  "30956-7": (imm, val) => { /* VIS reference URI — group by OBX-4 sub-ID */ },
  "48767-8": (imm, val) => { imm.note = [{ text: val }]; },
};
```

VIS OBX segments (69764-9, 29768-9, 29769-7) share the same OBX-4 sub-ID to form a single `education[]` entry. The enrichment groups them by sub-ID before populating the Immunization.

### Performer Creation

Per the V2-to-FHIR IG, the two performer types use different FHIR resource targets:

- **RXA-10** (Administering Provider) → `Practitioner` via `XCN[Practitioner]`. The person who physically administered the vaccine.
- **ORC-12** (Ordering Provider) → `PractitionerRole` via `XCN[PractitionerRole]`. The person acting in a clinical role who ordered the immunization. PractitionerRole links Practitioner + Organization context.

Both performers require `function` coded with system `http://terminology.hl7.org/CodeSystem/v2-0443`:

```typescript
// RXA-10 → Immunization.performer with function=AP (Administering Provider)
function createAdministeringPerformer(
  xcn: XCN,
): { performer: ImmunizationPerformer; practitionerEntry?: BundleEntry } {
  const practitioner = convertXCNToPractitioner(xcn);
  return {
    performer: {
      function: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0443", code: "AP", display: "Administering Provider" }],
      },
      actor: { reference: `Practitioner/${practitioner.id}` },
    },
    practitionerEntry: createBundleEntry(practitioner),
  };
}

// ORC-12 → Immunization.performer with function=OP (Ordering Provider)
function createOrderingPerformer(
  xcn: XCN,
): { performer: ImmunizationPerformer; practitionerRoleEntry?: BundleEntry } {
  const practitionerRole = convertXCNToPractitionerRole(xcn);
  return {
    performer: {
      function: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0443", code: "OP", display: "Ordering Provider" }],
      },
      actor: { reference: `PractitionerRole/${practitionerRole.id}` },
    },
    practitionerRoleEntry: createBundleEntry(practitionerRole),
  };
}
```

### Preprocessors

#### `inject-authority-into-orc3`

```typescript
// If ORC-3.1 (Entity Identifier) is present but ORC-3.2/3 (authority) are missing,
// inject MSH-3/MSH-4 derived namespace into ORC-3.2
// Same MSH namespace derivation as existing inject-authority-from-msh
```

#### `normalize-rxa6-dose`

Config-driven preprocessor for RXA-6 (Administered Amount) normalization:

1. `"999"` → clear field (CDC IIS sentinel for unknown amount; converter omits doseQuantity). No warning — this is expected.
2. `"0"` → preserve (zero dose administered is a valid amount). Must NOT be cleared.
3. Non-numeric with parseable prefix (e.g., `"0.3 mL"`) → extract numeric value into RXA-6, move unit string to RXA-7 if RXA-7 is empty. Log warning with original value.
4. Completely unparseable → clear field (converter omits doseQuantity). Log warning with original value so silent data loss is observable.

#### `normalize-rxa9-nip001`

If any RXA-9 CWE repeat has code `"00"` or `"01"` but no coding system (CWE.3 empty), inject `"NIP001"` as the system. Same pattern as `inject-authority-from-msh` (adding missing coding metadata to existing data).

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
      "ORC": { "3": ["inject-authority-into-orc3"] },
      "RXA": {
        "6": ["normalize-rxa6-dose"],
        "9": ["normalize-rxa9-nip001"]
      }
    },
    "converter": { "PV1": { "required": false } }
  }
}
```

### Conversion Flow

```
convertVXU_V04(parsed, context)
    |
    +-> parseMSH()                    // Sender context, meta tags
    +-> parsePID()                    // Required
    +-> handlePatient()               // Lookup or draft (reuse from ORU)
    +-> parsePV1()                    // Optional
    +-> handleEncounter()             // Config-driven (reuse from ORU)
    |
    +-> extractPersonObservations()   // OBX before first ORC or RXA -> standalone Observations
    +-> groupVXUOrders()              // ORC/RXA+RXR+OBX grouping (ORC optional)
    |
    +-> for each ORDER group:
    |       +-> generateImmunizationId()    // ORC-3 → ORC-2 → MSH fallback
    |       +-> convertOrderToImmunization()
    |       |       +-> convertRXAToImmunization()    // Core fields (receives pre-computed ID)
    |       |       +-> applyRXR()                     // Route + site (both optional)
    |       |       +-> applyORC()                     // Identifiers + ordering provider (when ORC present)
    |       |       +-> linkEncounter()                // Immunization.encounter reference
    |       |       +-> createPerformers()             // Practitioner resources
    |       +-> Collect entries
    |
    +-> cdcIisEnrichment.enrich()     // ORDER OBX -> Immunization fields, RXA-9 NIP001
    |                                  // Positional correlation: ORDER group N -> Nth Immunization
    |
    +-> Build transaction bundle
    +-> Return ConversionResult
```

## Edge Cases and Error Handling

| Condition | Handling |
|-----------|----------|
| **ORC absent in ORDER group** | Valid: fallback ID from `{mshNamespace}-{msh10}-imm-{orderIndex}`. No FILL/PLAC identifiers, no ordering provider. `recorded` uses RXA-22 fallback if RXA-21=A. |
| **ORC present but ORC-3/ORC-2 both empty** | Same fallback ID as absent ORC. But ORC-9 (recorded) and ORC-12 (ordering provider) still used if populated. No FILL/PLAC identifiers. |
| **Missing RXA in ORDER group** | Error: "ORDER group requires RXA segment" |
| **RXA-3 (administration date) empty** | Error for that ORDER group. Missing administration date cannot be safely substituted with ORC-9, RXA-22, or MSH-7 — clinically misleading. |
| **RXA-20 with unknown value** | Default to `completed` (spec says field is optional; unknown values treated as omitted) |
| **RXA-21=D (deleted)** | Set status=`entered-in-error`, overrides RXA-20 |
| **RXA-20=PA (partially administered)** | Set status=`completed`, set `isSubpotent=true` |
| **RXA-20=RE (refused) with RXA-18** | Set status=`not-done`, populate `statusReason` from RXA-18 |
| **RXA-20=NA (not administered) without RXA-18** | Set status=`not-done`, `statusReason` omitted (no reason given) |
| **RXA-19 present** | Map each CWE to `Immunization.reasonCode[]`; empty → omitted |
| **RXA-6 = "999"** | Preprocessor clears field, converter omits doseQuantity (CDC IIS sentinel) |
| **RXA-6 = "0"** | Preserved — zero dose is a valid amount |
| **RXA-6 = "0.3 mL" (embedded units)** | Preprocessor extracts 0.3 to RXA-6, "mL" to RXA-7 if empty. Warning logged. |
| **RXA-6 unparseable** | Preprocessor clears field, converter omits doseQuantity. Warning logged. |
| **RXA-9 bare "00"/"01" without system** | Preprocessor injects NIP001 system, lookup succeeds |
| **RXR-1 (route) empty** | Skip `Immunization.route`, process site (RXR-2) independently |
| **Unknown LOINC in ORDER OBX** | Hard error: "Unknown OBX code {code} in VXU ORDER context". All ORDER OBX codes must be in the CDC IIS mapping. See ADR. |
| **Missing LOINC in ORDER OBX (OBX-3.3 not "LN")** | Hard error: "ORDER OBX-3 must use LOINC coding system" |
| **VIS OBX with mismatched sub-IDs** | Group by sub-ID; partial VIS entries (e.g., doc type without dates) are still valid |
| **PERSON_OBSERVATION OBX without LOINC** | Same as ORU: use existing LOINC resolution (mapping_error + Task) |
| **Multiple RXA-9 entries** | Find the NIP001-coded one; ignore non-NIP001 entries |
| **RXA-10 with empty XCN** | Skip performer (no practitioner created) |
| **PV1 absent** | Valid: skip Encounter, process normally. `Immunization.encounter` omitted. |
| **PV1 present** | Create/link Encounter. Set `Immunization.encounter` reference. |
| **PV1 with `PV1\|1\|R` (minimal)** | Valid: patient class R maps to IMP (inpatient), Encounter created |
| **Multiple ORDER groups in one message** | Each produces a separate Immunization + associated resources |
| **RXA-15 (lot number) repeating** | Use first value (FHIR Immunization.lotNumber is singular string) |
| **RXA-16 (expiration date) repeating** | Use first value (FHIR Immunization.expirationDate is singular) |
| **ORDER-level NTE segments** | Not mapped. Collected in group structure but dropped during conversion. |
| **ORDER group count ≠ Immunization count in enrichment** | Shape mismatch warning (indicates converter/grouping bug) |
| **`recorded` field** | `ORC-9 ?? (RXA-21=A ? RXA-22 : undefined)`. Uniform rule regardless of ORC presence. |

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
| 9 | Unit | Performers: RXA-10 creates performer with function=AP (Practitioner), ORC-12 with function=OP (PractitionerRole) |
| 10 | Unit | Identifiers: ORC-3 produces identifier with type=FILL, ORC-2 produces type=PLAC |
| 11 | Unit | ID generation: Immunization.id derived from ORC-3 with authority scoping |
| 12 | Unit | ID generation: fallback to ORC-2 when ORC-3 missing |
| 13 | Unit | ID generation: ORC present but ORC-3 and ORC-2 both empty uses fallback ID |
| 14 | Unit | Error: missing RXA returns error status |
| 15 | Unit | RXR: route and site correctly mapped to Immunization.route and Immunization.site |
| 16 | Unit | ORC-9: maps to Immunization.recorded (primary); RXA-22 fallback when ORC-9 empty and RXA-21=A |
| 17 | Unit | Multiple ORDER groups: produces multiple Immunization resources with distinct IDs |
| 18 | Unit | PERSON_OBSERVATION: OBX before first ORC/RXA creates standalone Observation |
| 19 | Unit | CDC IIS: OBX 64994-7 maps to programEligibility |
| 20 | Unit | CDC IIS: OBX 30963-3 maps to fundingSource |
| 21 | Unit | CDC IIS: VIS OBX group (69764-9 + 29768-9 + 29769-7) grouped by OBX-4 into education[] |
| 22 | Unit | CDC IIS: OBX 30973-2 maps to protocolApplied.doseNumber |
| 23 | Unit | CDC IIS: unknown ORDER OBX LOINC code produces hard error |
| 24 | Unit | PV1 optional: missing PV1 produces processed status, no Encounter, no Immunization.encounter |
| 25 | Unit | PV1 present: valid PV1 creates Encounter, sets Immunization.encounter reference |
| 26 | Unit | Patient handling: unknown patient creates draft with active=false |
| 27 | Integration | E2E: submit VXU via MLLP, process, verify Immunization + Patient created in Aidbox |
| 28 | Integration | E2E: VXU with CDC IIS OBX, verify programEligibility and education on Immunization |
| 29 | Integration | E2E: VXU with PERSON_OBSERVATION, verify standalone Observation created |
| 30 | Integration | E2E: multiple ORDER groups, verify multiple Immunizations with distinct IDs |
| 31 | Integration | E2E: idempotent reprocessing — same VXU processed twice produces same resources |
| 32 | Unit | ORDER group without ORC: produces Immunization with fallback ID from MSH-10 |
| 33 | Unit | ORDER group without ORC: no ordering provider, no FILL/PLAC identifiers, recorded from RXA-22 fallback if RXA-21=A |
| 34 | Unit | RXA-6 preprocessor: "999" cleared, no doseQuantity |
| 35 | Unit | RXA-6 preprocessor: "0.3 mL" extracts value=0.3, unit=mL in RXA-7 |
| 36 | Unit | RXA-9 preprocessor: bare "00" gets NIP001 system injected |
| 37 | Unit | RXR with empty RXR-1: route omitted, site preserved |
| 38 | Unit | Unknown ORDER OBX LOINC: hard error, message status = error |
| 39 | Integration | E2E: VXU without ORC (real-world pattern), verify Immunization created with fallback ID |
| 40 | Unit | RXA-19 with indication maps to Immunization.reasonCode[] |
| 41 | Unit | RXA-6 preprocessor: "0" preserved, doseQuantity.value=0 |
| 42 | Unit | CDC IIS enrichment works for ORC-less ORDER group with OBX via positional matching |
| 43 | Unit | CDC IIS: OBX 30956-7 maps to education.reference (VIS document URI) |
| 44 | Unit | CDC IIS: OBX 48767-8 maps to note.text (annotation comment) |
| 45 | Unit | Performers: RXA-10 creates Practitioner resource, ORC-12 creates PractitionerRole resource |
| 46 | Unit | Performers: function coding includes system URI `http://terminology.hl7.org/CodeSystem/v2-0443` |

## Segment Mappings

### RXA → FHIR Immunization

| RXA Field | FHIR Immunization Path | Notes |
|-----------|----------------------|-------|
| RXA-3 | `occurrenceDateTime` | Required. Empty → error. |
| RXA-5 | `vaccineCode` | CVX code system: `http://hl7.org/fhir/sid/cvx`. CWE components 4-6 preserved as alternate coding (e.g., NDC). |
| RXA-6 | `doseQuantity.value` | After preprocessor normalization. "999" → omitted. |
| RXA-7 | `doseQuantity` (unit) | UCUM units |
| RXA-9 | `primarySource` / `reportOrigin` | Via CDC IIS enrichment. `00`=primarySource:true, `01`=primarySource:false |
| RXA-10 | `performer.actor(Practitioner)` (function=AP) | Administering Provider → Practitioner resource |
| RXA-15 | `lotNumber` | First value if repeating |
| RXA-16 | `expirationDate` | First value if repeating |
| RXA-17 | — | Out of scope (separate ticket for MVX → Organization) |
| RXA-18 | `statusReason` | When status=not-done |
| RXA-19 | `reasonCode` | CWE → CodeableConcept, repeating |
| RXA-20 | `status` | CP/PA→completed, RE/NA→not-done |
| RXA-21 | `status` override | D→entered-in-error (overrides RXA-20) |
| RXA-22 | `recorded` | Fallback only: used when ORC-9 is empty and RXA-21=A |

### ORC → FHIR Immunization (when ORC present)

| ORC Field | FHIR Immunization Path | Notes |
|-----------|----------------------|-------|
| ORC-2 | `identifier` (type=PLAC) | Fallback for ID generation |
| ORC-3 | `identifier` (type=FILL) + ID generation | Primary for ID generation |
| ORC-9 | `recorded` | Primary source for recorded date |
| ORC-12 | `performer.actor(PractitionerRole)` (function=OP) | Ordering Provider → PractitionerRole resource |

### RXR → FHIR Immunization

| RXR Field | FHIR Immunization Path | Notes |
|-----------|----------------------|-------|
| RXR-1 | `route` | Optional in practice (may be empty despite spec-Required) |
| RXR-2 | `site` | Processed independently of RXR-1 |

### ORDER-level OBX → Immunization Fields (CDC IIS IG)

| LOINC | Name | Immunization Field |
|-------|------|--------------------|
| 64994-7 | Vaccine funding program eligibility | `programEligibility` |
| 30963-3 | Vaccine funding source | `fundingSource` |
| 69764-9 | VIS Document type | `education.documentType` |
| 29768-9 | VIS Publication date | `education.publicationDate` |
| 29769-7 | VIS Presentation date | `education.presentationDate` |
| 30973-2 | Dose number in series | `protocolApplied.doseNumber` |
| 30956-7 | VIS Document reference URI | `education.reference` |
| 48767-8 | Annotation comment | `note.text` |

## Implementation Notes

These are non-blocking items identified during review that implementers should be aware of:

1. **Generated types will use CWE, not CE.** Prototype placeholders use CE, but `bun run regenerate-hl7v2` will produce CWE types for v2.8.2. The existing `convertCEToCodeableConcept` works for CWE since CWE extends CE's component structure.

2. **CVX system URI normalization needed.** `convertCEToCodeableConcept` passes through raw system strings (e.g., "CVX"). The FHIR system URI `http://hl7.org/fhir/sid/cvx` needs normalization — add CVX/NCIT/HL70163 to `normalizeSystem` in `coding-systems.ts`.

3. **Shared helper extraction.** ~12 functions need extracting from `oru-r01.ts` to a shared module: parseMSH, extractMetaTags, createBundleEntry, handlePatient, handleEncounter, extractSenderTag, addSenderTagToMeta, createDraftPatient, createConditionalPatientEntry, createConditionalEncounterEntry, convertDTMToDateTime, convertDTMToDate. Also `convertOBXToObservationResolving`.

4. **`handleEncounter` parameterization.** Currently hardcodes `"ORU-R01"` config key. Must accept `messageTypeKey: string` parameter for reuse. Same for error messages in `parseMSH`.

5. **Preprocessor framework extension.** `MessageTypeConfig.preprocess` type needs `RXA` added alongside existing PID/PV1/ORC. `preprocessor.ts` iteration logic must handle RXA segments.

6. **PERSON_OBSERVATION is a CDC IIS IG practice, not base v2.5.1.** The code handles this by position (OBX before first ORC/RXA) rather than by named group, which works regardless of HL7v2 version.

7. **RXA-10 is "Backward compatible" [B] in v2.8.2**, deprecated in favor of PRT segments. Using RXA-10 is pragmatically correct for real-world v2.5.1 senders.

## Known Limitations

1. **MSH-3 empty senders will fail.** Senders with empty MSH-3 (observed in real-world data, finding F8) will fail at `parseMSH`. This is intentional — sender-specific code mapping requires sender identification. Workarounds: fix sender configuration, or future ticket to add MSH-level preprocessor for default application name injection. This is a cross-cutting concern shared by ADT, ORU, and VXU converters.

2. **Manufacturer (RXA-17) not mapped.** Separate ticket for Organization creation from MVX codes.

3. **ORDER-level NTE segments not mapped.** Collected in group structure but not converted. Rarely clinically relevant for CDC IIS ORDER OBX.

## Context

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

Note: The spec declares ORC as [1..1] in ORDER, but real-world senders frequently omit it entirely. The converter handles ORC as optional.

### Real-World Sample Analysis

**Source:** `data/local/vxu/` (3 files analyzed, 2 from distinct senders). Both declare v2.5.1.

Key divergences from spec:

| # | Finding | Impact | Resolution |
|---|---------|--------|------------|
| F1 | No ORC segment (both senders) | Breaks ORC-3 ID strategy | C1: Converter fallback ID from MSH-10 |
| F2 | RXA-6 embedded units ("0.3 mL", "20-40 mg") + "999" sentinel | Numeric field parsing fails | C2: `normalize-rxa6-dose` preprocessor |
| F3 | RXA-9 bare code without NIP001 system | NIP001 lookup fails | C3: `normalize-rxa9-nip001` preprocessor |
| F4 | RXR-1 empty despite spec-Required | Implicit error | C4: Treat as optional |
| F5 | RXA-5 dual coding (CVX + NDC in CWE) | Need alternate coding preservation | Standard CWE→CodeableConcept handles this |
| F6 | No ORDER-level OBX in either sample | CDC IIS enrichment is no-op | No change needed |
| F7 | PV1 minimal — no PV1-19 | No Encounter ID generation | PV1 handling already supports this |
| F8 | MSH-3 empty | `parseMSH` requires both | Known limitation — documented |
| F9 | RXA-3 empty | Missing administration date | C5: Error (can't fabricate dates) |
| F10 | RXA-17 text-only, no MVX code | Manufacturer out of scope | Already out of scope (decision #7) |

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

**ID generation patterns:**
- Patient: `{assigner}-{value}` from PID-3 authority
- Encounter: `{system}-{value}` from PV1-19 authority
- DiagnosticReport: raw order number only (BUG — no sender scoping, separate ticket)
- Immunization: ORC-3 with authority scoping → ORC-2 fallback → MSH fallback

**Existing segment converters:** PID, PV1, OBR, OBX, DG1, AL1, IN1, NK1, SPM, NTE all exist. Need new: RXA→Immunization, RXR→route/site.

**FHIR Immunization type:** Already exists at `src/fhir/hl7-fhir-r4-core/Immunization.ts`.

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
   - ORDER group: optional ORC + RXA + RXR + OBX → Immunization + fields
   - PERSON_OBSERVATION: Patient-level OBX → standalone Observations
   - PID → Patient, PV1 → Encounter (optional)
   - Skip: INSURANCE, GT1

3. **Not-administered immunizations:** Yes, handle RXA-20=NA/RE as Immunization status=not-done with statusReason from RXA-18.

### Architecture Decisions

4. **CVX code mapping:** No ConceptMap needed. CVX is already a standard FHIR code system. Pass through directly.

5. **PV1 policy:** Optional (like ORU). If present, create/link Encounter. If missing, skip Encounter and process normally.

6. **ORDER-level OBX:** Map known LOINC codes directly to Immunization fields. Warning + skip on unknown OBX codes — known codes still mapped correctly, message gets `warning` status.

7. **PERSON_OBSERVATION OBX:** Create standalone Observation resources with `subject: Reference(Patient)`.

8. **Immunization ID generation:** Three-level fallback: ORC-3 (filler, preferred) → ORC-2 (placer) → `{mshNamespace}-{msh10}-imm-{orderIndex}`. Preprocessor injects MSH authority into ORC-3 when missing.

9. **DiagnosticReport ID collision:** Separate ticket at `ai/tickets/2026-02-24-diagnosticreport-id-collision.md`.

10. **Single ticket, includes CDC IIS logic:** VXU is effectively only used with CDC IIS — splitting doesn't make practical sense. CDC IIS OBX handling and NIP001 interpretation are inherent to VXU conversion.

11. **IGEnrichment interface:** Code pattern/contract, not a framework. Sync, operates on whole ConversionResult, positional correlation, minimal surface area.

12. **VXU converter directly imports CDC IIS enrichment:** Not dynamic — VXU without CDC IIS is a broken converter, not a valid configuration.

13. **No extensions needed for Immunization.** All CDC IIS OBX codes map to standard FHIR R4 Immunization fields. However, PID-10 (Race) and PID-22 (Ethnic Group) require US Core extensions on Patient — cross-cutting concern tracked separately in `ai/tickets/2026-02-25-us-core-patient-extensions.md`.

14. **Profile/IG validation:** Separate future ticket (`2026-02-24-profiles-support.md`).

15. **Performers (RXA-10, ORC-12):** In scope. Create Practitioner resources from XCN, link via Immunization.performer with function codes AP/OP.

16. **Manufacturer (RXA-17):** Out of scope. Separate ticket for Organization creation from MVX codes.

## Review Summary

This design was reviewed through 4 iterations (2 by Claude Opus 4.6, 1 by independent Opus 4.6 agent, 1 by Codex/GPT-5). All blockers and significant issues have been resolved:

- **Fixture correctness:** All 10 test fixtures verified for correct field positions
- **Real-world data handling:** 3 production VXU samples analyzed, 6 corrections applied (C1-C6)
- **Internal consistency:** All prototype/stub contradictions resolved after C1/C6 corrections
- **Enrichment correlation:** Switched from ORC-3-based to positional matching
- **`recorded` field:** Single authoritative rule defined

Open implementation notes (I1-I15) are non-blocking and documented in the Implementation Notes section above.

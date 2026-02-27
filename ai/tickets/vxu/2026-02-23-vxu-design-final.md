---
status: planned
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
| `src/hl7v2/wrappers/vxu-v04.ts` | **New** | VXU_V04 message structure wrapper: VXUOrderGroup, groupVXUOrders(), extractPersonObservations() |
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
      "PV1": { "19": ["fix-pv1-authority-with-msh"] },
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

8. **`@atomic-ehr/hl7v2` uses v2.5 message structures, not v2.8.2.** Two gaps for VXU_V04: (a) PERSON_OBSERVATION group is missing (added in v2.8.2), (b) ORC is marked required in ORDER (v2.5 spec says [1..1], but real-world senders omit it). Both are corrected via a wrapper in `src/hl7v2/wrappers/vxu-v04.ts` that provides `VXUOrderGroup` (with optional ORC), `groupVXUOrders()`, and `extractPersonObservations()`. The library's stable release (0.0.1) has a breaking field naming convention change, so upgrading is not currently viable.

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

# Implementation Plan

## Overview

Implement VXU_V04 (Unsolicited Vaccination Record Update) to FHIR conversion, including ORDER group extraction, RXA→Immunization mapping, CDC IIS enrichment (ORDER OBX → Immunization fields, NIP001 source interpretation), and three new preprocessors. Follows established ORU_R01 converter patterns with shared helper extraction.

## Development Approach
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: run `bun test:all` after every change — never skip integration tests**
- **CRITICAL: run `bun run typecheck` alongside tests**
- **CRITICAL: update this plan when scope changes**
- **CRITICAL: read `.claude/code-style.md` before writing code**
- **CRITICAL: use `hl7v2-info` skill and V2-to-FHIR IG CSVs before writing any HL7v2→FHIR mapping code**
- **CRITICAL: verify all test fixtures with `scripts/hl7v2-inspect.sh --verify` before using them**

## Validation Commands
- `bun test:all` — Run all tests (unit + integration). **Always use this, never `bun test:unit` alone.**
- `bun run typecheck` — TypeScript type checking
- `scripts/hl7v2-inspect.sh <file> --verify RXA.6` — Verify fixture field positions

---

## Task 1: Generate HL7v2 types for VXU_V04

**Goal:** Get generated TypeScript types for RXA, RXR, and VXU_V04 message structure. These are prerequisites for all subsequent tasks.

- [x] Run `bun run regenerate-hl7v2` and check if VXU_V04, RXA, and RXR types are generated in `src/hl7v2/generated/types.ts`
- [x] If RXA/RXR types were NOT generated (generator scope may be limited to BAR_P01+ORU_R01+ADT_A01): check generator config and add VXU_V04 to scope, then re-run
- [x] If generator cannot produce VXU_V04 types: create manual type definitions for RXA and RXR segments based on HL7v2 v2.8.2 spec (use `hl7v2-info` skill). These are small: RXA ~27 fields, RXR ~6 fields. Follow the generated type naming convention (`$N_fieldName`)
- [x] Verify the generated/manual types include all fields referenced in the design: RXA-3, RXA-5, RXA-6, RXA-7, RXA-9, RXA-10, RXA-15, RXA-16, RXA-17, RXA-18, RXA-19, RXA-20, RXA-21, RXA-22; RXR-1, RXR-2
- [x] Verify ORC type already exists (it should — used by ORU) and includes ORC-2, ORC-3, ORC-9, ORC-12
- [x] Remove the manual RXA/RXR/ORC type stubs from `src/v2-to-fhir/segments/rxa-immunization.ts` (lines 39-62) — these will be replaced by generated types
- [x] Run `bun run typecheck` and `bun test:all` — must pass (no behavior change, only type generation)
- [x] Stop and request user feedback before proceeding

---

## Task 2: Extract shared helpers from ORU converter

**Goal:** Extract ~12 reusable functions from `src/v2-to-fhir/messages/oru-r01.ts` into shared module(s) so VXU can reuse them without duplication. Pure mechanical extraction — no behavior change.

- [x] Read `src/v2-to-fhir/messages/oru-r01.ts` completely to identify all functions that VXU needs
- [x] Create `src/v2-to-fhir/messages/shared.ts` (or similar — check code style preferences) with extracted functions:
  - `parseMSH()` — extract sender context + meta tags
  - `extractMetaTags()` — MSH → Coding[] meta tags
  - `extractSenderTag()` — PID → sender Coding tag
  - `addSenderTagToMeta()` — add sender tag to resource meta
  - `createBundleEntry()` — create transaction bundle entry
  - `handlePatient()` — patient lookup/draft creation
  - `createDraftPatient()` — draft patient with active=false
  - `createConditionalPatientEntry()` — POST with ifNoneExist
  - `handleEncounter()` — encounter lookup/creation
  - `createConditionalEncounterEntry()` — POST with ifNoneExist
  - `convertDTMToDateTime()` — DTM string → FHIR dateTime
  - `convertDTMToDate()` — DTM string → FHIR date (if it exists)
  - `convertOBXToObservationResolving()` — OBX with LOINC resolution (needed for PERSON_OBSERVATION)
- [x] **Parameterize `handleEncounter()`:** Currently hardcodes `"ORU-R01"` config key. Add `messageTypeKey: string` parameter so VXU can pass `"VXU-V04"`
- [x] **Parameterize `parseMSH()` error messages** if they contain ORU-specific text
- [x] Update `oru-r01.ts` to import from shared module instead of defining locally
- [x] Verify that `oru-r01.ts` has no remaining local copies of extracted functions
- [x] Run `bun test:all` and `bun run typecheck` — must pass with zero behavior change (pure refactor)
- [x] Stop and request user feedback before proceeding

---

## Task 3: Config and type extensions for VXU-V04

**Goal:** Add VXU-V04 config entry and extend the preprocessor type system to support RXA segments.

- [x] Add `VXU-V04` entry to `config/hl7v2-to-fhir.json` matching the design:
  ```json
  "VXU-V04": {
    "preprocess": {
      "PID": { "2": ["move-pid2-into-pid3"], "3": ["inject-authority-from-msh"] },
      "PV1": { "19": ["fix-pv1-authority-with-msh"] },
      "ORC": { "3": ["inject-authority-into-orc3"] },
      "RXA": { "6": ["normalize-rxa6-dose"], "9": ["normalize-rxa9-nip001"] }
    },
    "converter": { "PV1": { "required": false } }
  }
  ```
- [x] Extend `MessageTypeConfig.preprocess` type in `src/v2-to-fhir/config.ts` to include `RXA` alongside existing PID/PV1/ORC
- [x] Verify `preprocessor.ts` iteration logic handles RXA segments (it iterates all segments generically, so adding the type should be sufficient — verify)
- [x] Run `bun run typecheck` and `bun test:all` — must pass (config validation will fail until preprocessors exist, so may need stub IDs temporarily or add config + preprocessors together)
- [x] Stop and request user feedback before proceeding

---

## Task 4: Preprocessor — `inject-authority-into-orc3`

**Goal:** Add preprocessor that injects MSH-3/MSH-4 derived namespace into ORC-3 when authority is missing. Enables deterministic Immunization ID generation.

- [x] Add `inject-authority-into-orc3` to `src/v2-to-fhir/preprocessor-registry.ts`:
  - If ORC-3.1 (Entity Identifier) present but ORC-3.2 (Namespace ID) and ORC-3.3 (Universal ID) both missing → inject MSH-3/MSH-4 derived namespace into ORC-3.2
  - Same MSH namespace derivation pattern as existing `inject-authority-from-msh`
- [x] Write unit tests:
  - ORC-3 with value but no authority → authority injected from MSH
  - ORC-3 with value and existing authority → no change
  - ORC-3 empty (no value) → no change
  - ORC absent → no error
- [x] Run `bun test:all` and `bun run typecheck` — must pass
- [x] Stop and request user feedback before proceeding

---

## Task 5: Preprocessor — `normalize-rxa6-dose`

**Goal:** Normalize RXA-6 (Administered Amount) to handle CDC IIS sentinel "999", embedded units, and unparseable values.

- [x] Add `normalize-rxa6-dose` to `src/v2-to-fhir/preprocessor-registry.ts`:
  - `"999"` → clear field (no warning — expected CDC IIS sentinel for unknown amount)
  - `"0"` → preserve (valid zero dose administered)
  - Non-numeric with parseable prefix (e.g., `"0.3 mL"`) → extract numeric value to RXA-6, move unit string to RXA-7 if RXA-7 empty; log warning with original value
  - Completely unparseable → clear field; log warning with original value
- [x] Write unit tests:
  - `"999"` → field cleared, no doseQuantity
  - `"0"` → preserved, doseQuantity.value=0
  - `"0.3 mL"` → RXA-6="0.3", RXA-7="mL" (if empty)
  - `"0.3 mL"` with existing RXA-7 → RXA-6="0.3", RXA-7 unchanged
  - `"0.3"` → preserved as-is (already numeric)
  - `"abc"` → field cleared
  - Empty → no change
- [x] Run `bun test:all` and `bun run typecheck` — must pass
- [x] Stop and request user feedback before proceeding

---

## Task 6: Preprocessor — `normalize-rxa9-nip001`

**Goal:** Inject "NIP001" coding system when bare "00"/"01" codes lack a system identifier.

- [x] Add `normalize-rxa9-nip001` to `src/v2-to-fhir/preprocessor-registry.ts`:
  - If any RXA-9 CWE repeat has code `"00"` or `"01"` but empty CWE.3 (coding system) → inject `"NIP001"` as the system
- [x] Write unit tests:
  - Bare `"00"` without system → NIP001 injected
  - Bare `"01"` without system → NIP001 injected
  - `"00"` with NIP001 already set → no change
  - `"02"` without system → no change (not a NIP001 code)
  - Empty RXA-9 → no error
- [x] Run `bun test:all` and `bun run typecheck` — must pass
- [x] Stop and request user feedback before proceeding

---

## Task 7: CVX coding system support + converter routing

**Goal:** Add CVX/NCIT/HL70163 to normalizeSystem and wire VXU_V04 into the converter switch.

- [x] Add CVX to `normalizeSystem()` in `src/v2-to-fhir/code-mapping/coding-systems.ts`:
  - `"CVX"` → `"http://hl7.org/fhir/sid/cvx"`
- [x] Add NCIT: `"NCIT"` → `"http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl"` (from HL7 Terminology NamingSystem v3-nciThesaurus)
- [x] Add HL70163: `"HL70163"` → `"http://terminology.hl7.org/CodeSystem/v2-0163"` (from V2-to-FHIR IG BodySite CSV)
- [x] Add `VXU_V04` case to switch in `src/v2-to-fhir/converter.ts` + import `convertVXU_V04`
- [x] Run `bun test:all` and `bun run typecheck` — must pass
- [x] Stop and request user feedback before proceeding

---

## Task 8: RXA segment converter — core fields

**Goal:** Implement the core RXA→Immunization mapping: status, vaccineCode, occurrenceDateTime, doseQuantity, lotNumber, expirationDate.

**Before writing code:** Use `hl7v2-info` skill to verify RXA field positions. Consult `docs/v2-to-fhir-spec/mappings/segments/` for RXA→Immunization CSV.

- [x] Replace prototype scaffold in `src/v2-to-fhir/segments/rxa-immunization.ts` with real implementation
- [x] Implement `convertRXAToImmunization()` — receives pre-computed Immunization ID from message converter. Core fields:
  - RXA-3 → `occurrenceDateTime` (required — error if empty)
  - RXA-5 → `vaccineCode` via CWE→CodeableConcept (CVX primary coding, alternate codings preserved)
  - RXA-6/7 → `doseQuantity` (value from RXA-6, unit from RXA-7; omit if RXA-6 cleared by preprocessor)
  - RXA-15 → `lotNumber` (first value if repeating)
  - RXA-16 → `expirationDate` (first value if repeating)
  - RXA-20/21 → `status` via `deriveImmunizationStatus()` (prototype has this — verify/keep)
  - RXA-20=PA → additionally set `isSubpotent=true`
- [x] Write unit tests (design test cases #1, #2-6, #34, #41):
  - Base fields: vaccineCode, status=completed, occurrenceDateTime, doseQuantity, lotNumber
  - Status: RE→not-done, NA→not-done, D→entered-in-error, PA→completed+isSubpotent, empty→completed
  - Dose: "999" cleared (no doseQuantity), "0" preserved (value=0)
- [x] Run `bun test:all` and `bun run typecheck` — must pass
- [x] Stop and request user feedback before proceeding

---

## Task 9: RXA segment converter — statusReason, reasonCode, recorded

**Goal:** Add conditional fields: statusReason (when not-done), reasonCode, and recorded date (ORC-9 primary, RXA-22 fallback).

- [x] Implement in `rxa-immunization.ts`:
  - RXA-18 → `statusReason` (only when status=not-done)
  - RXA-19 → `reasonCode[]` (CWE → CodeableConcept, repeating; empty → omitted)
  - `recorded` field: `ORC-9 ?? (RXA-21=A ? RXA-22 : undefined)` — uniform rule regardless of ORC presence
- [x] Write unit tests (design test cases #16, #40):
  - RXA-20=RE with RXA-18 → status=not-done, statusReason populated
  - RXA-20=NA without RXA-18 → status=not-done, no statusReason
  - RXA-19 with indications → reasonCode[] populated
  - ORC-9 → recorded (primary)
  - ORC-9 empty + RXA-21=A → recorded from RXA-22
  - ORC-9 empty + RXA-21≠A → no recorded
  - ORC absent + RXA-21=A + RXA-22 present → recorded from RXA-22
- [x] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 10: RXR handling — route and site

**Goal:** Map RXR-1→route and RXR-2→site on the Immunization resource.

**Before writing code:** Use `hl7v2-info` skill to verify RXR field positions. Consult `docs/v2-to-fhir-spec/mappings/segments/` for RXR→Immunization CSV.

- [x] Implement RXR handling in `rxa-immunization.ts` (inline function or separate):
  - RXR-1 → `Immunization.route` (optional — skip if empty)
  - RXR-2 → `Immunization.site` (processed independently of RXR-1)
  - Both use CWE→CodeableConcept conversion
- [x] Write unit tests (design test cases #15, #37):
  - RXR with route and site → both mapped
  - RXR with empty RXR-1 → route omitted, site preserved
  - RXR absent → no route, no site
- [x] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 11: ORC fields — identifiers

**Goal:** Map ORC-2→PLAC identifier and ORC-3→FILL identifier on the Immunization.

- [x] Implement ORC identifier application in `rxa-immunization.ts` (when ORC present):
  - ORC-2 → `identifier` with type=PLAC (placer order number)
  - ORC-3 → `identifier` with type=FILL (filler order number)
  - When ORC absent → no identifiers
  - When ORC present but ORC-2/ORC-3 empty → no identifiers for that field
- [x] Write unit tests (design test cases #10, #13, #33):
  - ORC-3 → FILL identifier
  - ORC-2 → PLAC identifier
  - ORC present but ORC-3 and ORC-2 both empty → no identifiers
  - ORC absent → no identifiers
- [x] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 12: Performers — RXA-10 and ORC-12

**Goal:** Create Practitioner from RXA-10 (administering provider) and PractitionerRole from ORC-12 (ordering provider), link via Immunization.performer with function codes.

- [x] Implement performer creation in `rxa-immunization.ts`:
  - RXA-10 → `performer` with function=AP (`http://terminology.hl7.org/CodeSystem/v2-0443`), actor=`Practitioner/{id}` via `convertXCNToPractitioner()`
  - ORC-12 → `performer` with function=OP (`http://terminology.hl7.org/CodeSystem/v2-0443`), actor=`PractitionerRole/{id}` via `convertXCNToPractitionerRole()`
  - Return Practitioner/PractitionerRole resources as additional bundle entries
  - Skip performer when XCN is empty
  - When ORC absent → no ordering provider performer
- [x] Write unit tests (design test cases #9, #33, #45, #46):
  - RXA-10 creates Practitioner + performer with function=AP
  - ORC-12 creates PractitionerRole + performer with function=OP
  - Function coding includes system URI
  - RXA-10 empty → no administering performer
  - ORC absent → no ordering performer
- [x] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 13: IGEnrichment interface

**Goal:** Define the IGEnrichment contract — a minimal interface for IG-specific post-conversion enrichments.

- [ ] Finalize `src/v2-to-fhir/ig-enrichment/ig-enrichment.ts`:
  ```typescript
  export interface IGEnrichment {
    name: string;
    enrich(parsedMessage: HL7v2Message, result: ConversionResult, context: SenderContext): ConversionResult;
  }
  ```
- [ ] Verify imports are correct (HL7v2Message, ConversionResult, SenderContext types)
- [ ] Run `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 14: CDC IIS enrichment — RXA-9 NIP001 interpretation

**Goal:** Implement NIP001 source code interpretation (00=new/primary, 01=historical).

- [ ] Implement `interpretRXA9Source()` in `src/v2-to-fhir/ig-enrichment/cdc-iis-enrichment.ts`:
  - Find NIP001-coded entry in RXA-9 repeats (CWE.3 = "NIP001" or contains "NIP001")
  - `"00"` → `{ primarySource: true }`
  - `"01"` → `{ primarySource: false, reportOrigin: { coding: [{ code: "01", display: "Historical", system: "urn:oid:2.16.840.1.114222.4.5.274" }] } }`
  - No NIP001 entry → default `{ primarySource: true }`
  - Unknown NIP001 code → default `{ primarySource: true }`
  - Multiple RXA-9 entries → find the NIP001-coded one, ignore others
- [ ] Write unit tests (design test cases #7, #8):
  - NIP001 "01" → primarySource=false, reportOrigin populated
  - NIP001 "00" → primarySource=true
  - No NIP001 entry → primarySource=true
  - Unknown NIP001 code → primarySource=true
  - Multiple RXA-9 entries with one NIP001 → correct one found
- [ ] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 15: CDC IIS enrichment — simple ORDER OBX handlers

**Goal:** Implement the non-VIS ORDER OBX handlers: programEligibility, fundingSource, protocolApplied, note.

- [ ] Implement ORDER OBX handlers in `cdc-iis-enrichment.ts` for:
  - `64994-7` → `Immunization.programEligibility` (CWE → CodeableConcept)
  - `30963-3` → `Immunization.fundingSource` (CWE → CodeableConcept)
  - `30973-2` → `Immunization.protocolApplied[].doseNumberString`
  - `48767-8` → `Immunization.note[].text` (annotation comment)
- [ ] Implement positional correlation: ORDER group N → Nth Immunization in bundle
- [ ] Implement hard error on unknown LOINC code in ORDER OBX: set `messageUpdate.status = "error"` and `messageUpdate.error` naming the unknown code
- [ ] Implement hard error when ORDER OBX-3.3 is not `"LN"` (LOINC)
- [ ] Write unit tests (design test cases #19, #20, #22, #23, #38, #42, #44):
  - OBX 64994-7 → programEligibility
  - OBX 30963-3 → fundingSource
  - OBX 30973-2 → protocolApplied.doseNumber
  - OBX 48767-8 → note.text
  - Unknown LOINC → hard error
  - Non-LOINC OBX-3 → hard error
  - Positional matching works for ORC-less ORDER group
- [ ] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 16: CDC IIS enrichment — VIS OBX grouping

**Goal:** Implement VIS (Vaccine Information Statement) OBX grouping by OBX-4 sub-ID into `education[]` entries.

- [ ] Implement VIS OBX handlers in `cdc-iis-enrichment.ts`:
  - `69764-9` → `education[].documentType` (VIS document type)
  - `29768-9` → `education[].publicationDate` (VIS publication date)
  - `29769-7` → `education[].presentationDate` (VIS presentation date)
  - `30956-7` → `education[].reference` (VIS document URI)
- [ ] Implement grouping by OBX-4 sub-ID: entries sharing same sub-ID form a single `education[]` entry
- [ ] Handle partial VIS entries (e.g., doc type without dates) — still valid
- [ ] Write unit tests (design test cases #21, #43):
  - VIS OBX group (69764-9 + 29768-9 + 29769-7) with same OBX-4 → single education[] entry
  - VIS OBX 30956-7 → education.reference
  - Multiple VIS groups with different OBX-4 → multiple education[] entries
  - Partial VIS (doc type without dates) → education entry with only documentType
- [ ] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 17: VXU message converter — ORDER group extraction

**Goal:** Implement `groupVXUOrders()` and `extractPersonObservations()` — the segment grouping logic that splits the flat VXU segment list into structured groups. These are HL7v2 message structure concerns (correcting library gaps), so they live in `src/hl7v2/wrappers/vxu-v04.ts`.

- [ ] Create `src/hl7v2/wrappers/vxu-v04.ts` with `VXUOrderGroup` interface and grouping functions:
  - `VXUOrderGroup`: interface with `orc?` (optional — library marks ORC required per v2.5 spec, but real-world senders omit it)
  - `groupVXUOrders()`: groups flat segment list into ORDER groups
  - `extractPersonObservations()`: extracts OBX before first ORC/RXA (PERSON_OBSERVATION — v2.8.2 addition not in library's v2.5 schema)
- [ ] Implement `groupVXUOrders()`:
  - Start new ORDER group on ORC or RXA (whichever appears)
  - RXA without preceding ORC is a valid group (ORC optional)
  - Collect optional RXR and OBX+NTE for each group
  - Error if an ORDER group has no RXA
  - Return `VXUOrderGroup[]`
- [ ] Implement `extractPersonObservations()`:
  - Collect OBX (+ optional NTE) segments before the first ORC or RXA
  - These are PERSON_OBSERVATION (patient-level, not order-level)
- [ ] Remove the `VXUOrderGroup` interface and stub functions from `src/v2-to-fhir/messages/vxu-v04.ts`, import from wrapper instead
- [ ] Write unit tests:
  - Single ORC+RXA+RXR+OBX → one group with all parts
  - RXA without ORC → valid group with orc=undefined
  - Multiple ORDER groups → correct count and contents
  - ORC without following RXA → error
  - OBX before first ORC/RXA → extracted as person observations
  - No ORDER segments → empty array
- [ ] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 18: VXU message converter — Immunization ID generation

**Goal:** Implement `generateImmunizationId()` — deterministic ID from ORC-3/ORC-2/MSH fallback.

- [ ] Implement `generateImmunizationId()` in `vxu-v04.ts`:
  - Path 1: ORC present with ORC-3 (filler) → `sanitize(${authority}-${value})`
  - Path 2: ORC present with ORC-2 (placer), ORC-3 empty → `sanitize(${authority}-${value})`
  - Path 3: ORC absent or both empty → `sanitize(${mshNamespace}-${messageControlId}-imm-${orderIndex})`
  - `sanitize()`: lowercase, replace non-alphanumeric with hyphens
- [ ] Write unit tests (design test cases #11, #12, #13, #32):
  - ORC-3 with authority → authority-scoped ID
  - ORC-3 empty, ORC-2 with authority → placer-based ID
  - ORC present, both empty → MSH fallback ID
  - ORC absent → MSH fallback ID with orderIndex
  - Sanitization: special characters replaced
- [ ] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 19: VXU message converter — main conversion flow

**Goal:** Wire everything together in `convertVXU_V04()` — the main entry point.

- [ ] Implement `convertVXU_V04()` in `vxu-v04.ts` following the design's conversion flow:
  1. `parseMSH()` → sender context + meta tags (from shared module)
  2. Parse PID → `handlePatient()` → Patient resource (from shared module)
  3. Parse PV1 (optional) → `handleEncounter()` with `"VXU-V04"` key (from shared module)
  4. `extractPersonObservations()` → convert each to standalone Observation via `convertOBXToObservationResolving()`. Handle mapping errors.
  5. `groupVXUOrders()` → iterate ORDER groups
  6. For each ORDER: `generateImmunizationId()` → `convertRXAToImmunization()` → collect Immunization + performer resources
  7. `cdcIisEnrichment.enrich()` → post-process with ORDER OBX + RXA-9 NIP001
  8. Link Encounter references to Immunizations (if Encounter exists)
  9. Build transaction bundle with all entries
  10. Return `ConversionResult` with bundle + messageUpdate
- [ ] Handle mapping errors from PERSON_OBSERVATION OBX (same pattern as ORU)
- [ ] Write unit tests (design test cases #14, #17, #24-26):
  - Missing RXA → error status
  - Multiple ORDER groups → multiple Immunizations with distinct IDs
  - PV1 missing → no Encounter, Immunization.encounter omitted
  - PV1 present → Encounter created, Immunization.encounter reference set
  - Unknown patient → draft Patient with active=false
- [ ] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 20: VXU message converter — PERSON_OBSERVATION and ORC-less orders

**Goal:** Cover remaining message-level test cases: PERSON_OBSERVATION handling, ORC-less orders, and preprocessor integration.

- [ ] Write unit tests (design test cases #18, #32-33, #34-36, #41):
  - PERSON_OBSERVATION OBX before first ORC/RXA → standalone Observation with subject=Patient
  - ORDER without ORC → Immunization with fallback ID, no FILL/PLAC identifiers, no ordering provider
  - ORDER without ORC + RXA-21=A + RXA-22 → recorded from RXA-22 fallback
  - Preprocessor integration: RXA-6 "999" → no doseQuantity
  - Preprocessor integration: RXA-6 "0.3 mL" → extracted value
  - Preprocessor integration: RXA-9 bare "00" → NIP001 injected, primarySource=true
  - RXA-6 "0" → doseQuantity.value=0
- [ ] Fix any issues discovered during testing
- [ ] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 21: Verify test fixtures

**Goal:** Verify all 10 VXU test fixtures have correct field positions before integration tests.

- [ ] Run `scripts/hl7v2-inspect.sh` on each fixture to verify field positions:
  - `test/fixtures/hl7v2/vxu-v04/base.hl7` — verify RXA-5 (vaccineCode), RXA-6 (dose), RXA-20 (status), ORC-3 (filler), ORC-12 (ordering provider), RXR-1 (route), RXR-2 (site)
  - `test/fixtures/hl7v2/vxu-v04/not-administered.hl7` — verify RXA-20=RE, RXA-18 (statusReason)
  - `test/fixtures/hl7v2/vxu-v04/historical.hl7` — verify RXA-9 (NIP001 "01")
  - `test/fixtures/hl7v2/vxu-v04/entered-in-error.hl7` — verify RXA-21=D
  - `test/fixtures/hl7v2/vxu-v04/with-person-observations.hl7` — verify OBX before ORC/RXA
  - `test/fixtures/hl7v2/vxu-v04/multiple-orders.hl7` — verify 2 ORDER groups
  - `test/fixtures/hl7v2/vxu-v04/no-orc.hl7` — verify no ORC present
  - `test/fixtures/hl7v2/vxu-v04/no-orc-identifiers.hl7` — verify ORC present but empty fields
  - `test/fixtures/hl7v2/vxu-v04/error/missing-rxa.hl7` — verify ORC without RXA
  - `test/fixtures/hl7v2/vxu-v04/error/unknown-order-obx.hl7` — verify unknown LOINC code
- [ ] Fix any field position errors discovered
- [ ] Stop and request user feedback before proceeding

---

## Task 22: Integration tests — happy path

**Goal:** E2E test: submit VXU via processing pipeline, verify Immunization + Patient created in Aidbox.

- [ ] Read existing integration test patterns in `test/integration/v2-to-fhir/oru-r01.integration.test.ts`
- [ ] Implement in `test/integration/v2-to-fhir/vxu-v04.integration.test.ts`:
  - #27: Happy path — submit `base.hl7`, verify Immunization resource in Aidbox with correct vaccineCode, status, occurrenceDateTime, route, site, performers
  - #31: Idempotent reprocessing — same VXU processed twice produces same resources (deterministic IDs)
- [ ] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 23: Integration tests — CDC IIS, PERSON_OBS, multiple orders

**Goal:** E2E tests for CDC IIS enrichment, person observations, and multiple ORDER groups.

- [ ] Implement in `vxu-v04.integration.test.ts`:
  - #28: Submit message with CDC IIS OBX → verify programEligibility and education on Immunization
  - #29: Submit `with-person-observations.hl7` → verify standalone Observation created
  - #30: Submit `multiple-orders.hl7` → verify multiple Immunizations with distinct IDs
- [ ] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 24: Integration tests — edge cases and errors

**Goal:** E2E tests for no-ORC, not-administered, and error conditions.

- [ ] Implement in `vxu-v04.integration.test.ts`:
  - #39: Submit `no-orc.hl7` → verify Immunization created with fallback ID
  - Not-administered: submit `not-administered.hl7` → verify status=not-done
  - Error: submit `error/unknown-order-obx.hl7` → verify message gets error status
- [ ] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 25: Documentation

- [ ] Update CLAUDE.md:
  - Add VXU_V04 to the "Workflows" section alongside ORU/ADT
  - Add `rxa-immunization.ts` to segment converters list in Project Structure
  - Add `ig-enrichment/` directory to Project Structure
  - Mention VXU in the "ORU Processing" section title (rename to "Incoming Message Processing" or similar if appropriate)
- [ ] Record the ADR for "Unknown ORDER OBX LOINC Codes → Hard Error" in project documentation (the design specifies `docs/developer-guide/adr/` or equivalent)
- [ ] Add inline documentation for complex functions:
  - `groupVXUOrders()` — explain grouping algorithm
  - `generateImmunizationId()` — explain 3-level fallback
  - VIS OBX grouping by sub-ID — explain correlation logic
- [ ] Run `bun test:all` and `bun run typecheck` — must pass
- [ ] Stop and request user feedback before proceeding

---

## Task 26: Cleanup design artifacts

- [ ] Remove all `DESIGN PROTOTYPE: 2026-02-23-vxu-design-final.md` comments from codebase
- [ ] Delete any empty scaffold files that were replaced
- [ ] Update design document status to `implemented`
- [ ] Verify no prototype markers remain: `grep -r "DESIGN PROTOTYPE: 2026-02-23-vxu-design-final" src/ test/`
- [ ] Run `bun test:all` and `bun run typecheck` — final verification

---

## Post-Completion Verification

1. **Functional test**: Submit the `base.hl7` fixture through the processing pipeline (via `/process-incoming-messages`). Verify Immunization resource appears in Aidbox with correct vaccineCode, status, occurrenceDateTime, route, site, performers.
2. **CDC IIS test**: Submit a message with ORDER OBX (64994-7, 30963-3, VIS group). Verify programEligibility, fundingSource, and education[] populated on Immunization.
3. **Edge case — no ORC**: Submit `no-orc.hl7`. Verify Immunization created with MSH-derived fallback ID, no identifiers, no ordering provider.
4. **Edge case — historical**: Submit `historical.hl7`. Verify primarySource=false and reportOrigin populated.
5. **Edge case — entered-in-error**: Submit `entered-in-error.hl7`. Verify status=entered-in-error.
6. **Error case**: Submit `error/unknown-order-obx.hl7`. Verify message gets error status naming the unknown LOINC code.
7. **Idempotency**: Submit `base.hl7` twice. Verify same Immunization ID, no duplicates.
8. **No regressions**: All existing ADT and ORU tests pass unchanged.
9. **Cleanup verified**: No DESIGN PROTOTYPE comments remain in codebase.

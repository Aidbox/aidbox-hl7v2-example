# ADR-001: Unknown ORDER OBX LOINC Codes → Hard Error

**Status:** Accepted
**Date:** 2026-02-23
**Context:** VXU_V04 conversion — handling of ORDER-level OBX segments

## Context

The V2-to-FHIR IG's VXU_V04 message mapping maps ORDER OBSERVATION OBX → generic `Observation` with `partOf=Immunization` as a fallback. The IG comment explicitly says: *"Some observations about the immunization may map to elements within the Immunization resource... Specific guidance on how to map, e.g., the US CDC implementation guide on immunizations, will be provided separately at a future time TBD."*

The OBX[Immunization] mapping on HL7 Confluence defines LOINC→Immunization field mappings for the same CDC IIS codes we implement (programEligibility, fundingSource, education, protocolApplied, note).

## Decision

Unknown LOINC codes in ORDER-level OBX produce a **hard error**, not a generic Observation fallback. The message gets `status=error` with a message naming the unknown code.

## Rationale

1. **CDC IIS is the de facto standard.** The CDC IIS IG defines a closed set of LOINC codes for ORDER OBX in immunization messages. All US immunization senders follow the CDC IIS IG. The V2-to-FHIR IG's generic Observation fallback is a placeholder — the IG itself says it will be overridden by CDC-specific guidance.

2. **ORDER OBX has Immunization-specific semantics.** These are not standalone clinical observations — they are immunization metadata (funding eligibility, VIS documents, dose number). Creating a generic `Observation` with `partOf` is a lossy representation that pushes interpretation burden to consumers.

3. **Real-world data confirms.** Analysis of 3 production VXU messages shows only CDC IIS LOINC codes in ORDER OBX. Zero unknown codes observed.

4. **Hard error is operationally safer.** An unknown code means either a programming error (we missed a CDC IIS code) or an unsupported sender profile. Both require developer attention, not silent degradation. The error message names the unknown code for fast resolution.

## Alternatives Considered

- **Warning + skip:** Silently drops data. If the code is important, we'd never know.
- **Create Observation with `partOf=Immunization` (V2-to-FHIR IG generic fallback):** Preserves data but creates an awkward resource that doesn't match CDC IIS semantics. Consumers must know "this isn't really an observation."

## Known LOINC Codes (CDC IIS IG, at time of decision)

See `KNOWN_ORDER_OBX_LOINC_CODES` in `src/v2-to-fhir/cdc-iis-ig.ts` for the current list.

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

## Implementation

- `src/v2-to-fhir/cdc-iis-ig.ts` — `applyOrderOBXFields()` validates against `KNOWN_ORDER_OBX_LOINC_CODES` set
- Non-LOINC OBX-3 (system != "LN") also produces a hard error
- Error propagates through `ConversionResult` to set message `status=error`

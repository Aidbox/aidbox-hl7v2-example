/**
 * DESIGN PROTOTYPE: 2026-02-23-vxu-support.md
 *
 * CDC IIS (Immunization Information System) Enrichment
 *
 * Maps ORDER-level OBX segments to FHIR Immunization fields per CDC IIS IG:
 * - 64994-7 -> programEligibility
 * - 30963-3 -> fundingSource
 * - 69764-9 -> education.documentType (grouped by OBX-4 sub-ID)
 * - 29768-9 -> education.publicationDate (grouped by OBX-4 sub-ID)
 * - 29769-7 -> education.presentationDate (grouped by OBX-4 sub-ID)
 * - 30973-2 -> protocolApplied.doseNumber
 *
 * Also interprets RXA-9 NIP001 source codes:
 * - "00" -> primarySource: true
 * - "01" -> primarySource: false, reportOrigin populated
 */

import type { HL7v2Message } from "../../hl7v2/generated/types";
import type { ConversionResult } from "../converter";
import type { SenderContext } from "../../code-mapping/concept-map";
import type { IGEnrichment } from "./ig-enrichment";
// TODO: Import generated field types when available:
// import { fromOBX, fromRXA } from "../../hl7v2/generated/fields";
// import type { OBX, CE } from "../../hl7v2/generated/fields";
import type {
  Immunization,
  ImmunizationEducation,
  CodeableConcept,
  BundleEntry,
} from "../../fhir/hl7-fhir-r4-core";

// ============================================================================
// Known ORDER-level OBX LOINC codes (CDC IIS IG)
// ============================================================================

const KNOWN_ORDER_OBX_LOINC_CODES = new Set([
  "64994-7", // Vaccine funding program eligibility
  "30963-3", // Vaccine funding source
  "69764-9", // VIS Document type
  "29768-9", // VIS Publication date
  "29769-7", // VIS Presentation date
  "30973-2", // Dose number in series
]);

// VIS-related LOINC codes that group by OBX-4 sub-ID
const VIS_LOINC_CODES = new Set(["69764-9", "29768-9", "29769-7"]);

// ============================================================================
// NIP001 Source Interpretation
// ============================================================================

// TODO: Implement RXA-9 NIP001 interpretation
// function interpretRXA9Source(administrationNotes: CE[]): {
//   primarySource: boolean;
//   reportOrigin?: CodeableConcept;
// }

// ============================================================================
// ORDER OBX → Immunization Field Mapping
// ============================================================================

// TODO: Implement per-OBX-code handlers
// Each handler receives the Immunization resource and the OBX value,
// and modifies the Immunization in place.

// TODO: Implement VIS grouping by OBX-4 sub-ID
// VIS OBX segments sharing the same sub-ID form a single education[] entry:
// interface VISGroup {
//   documentType?: string;    // 69764-9
//   publicationDate?: string; // 29768-9
//   presentationDate?: string; // 29769-7
// }

// ============================================================================
// Enrichment Implementation
// ============================================================================

export const cdcIisEnrichment: IGEnrichment = {
  name: "cdc-iis",

  enrich(
    parsedMessage: HL7v2Message,
    result: ConversionResult,
    _context: SenderContext,
  ): ConversionResult {
    // TODO: Implementation steps:
    //
    // 1. Extract ORDER groups from parsedMessage (ORC+RXA+RXR+OBX)
    //    - Reuse the same grouping logic from vxu-v04.ts
    //    - Or receive pre-grouped data via a shared structure
    //
    // 2. For each ORDER group:
    //    a. Find the corresponding Immunization in result.bundle
    //       by matching deterministic ID derived from ORC-3
    //    b. For each OBX in the ORDER:
    //       - Extract LOINC code from OBX-3
    //       - If code is in KNOWN_ORDER_OBX_LOINC_CODES:
    //         Apply the corresponding handler to the Immunization
    //       - If code is NOT known:
    //         Return error result with messageUpdate.status = "error"
    //    c. Interpret RXA-9 for NIP001 source coding:
    //       - Set primarySource / reportOrigin on the Immunization
    //
    // 3. Group VIS OBX entries by OBX-4 sub-ID:
    //    - Collect 69764-9, 29768-9, 29769-7 entries per sub-ID
    //    - Build ImmunizationEducation[] from groups
    //
    // 4. Return modified result (or error result on unknown OBX code)

    return result;
  },
};

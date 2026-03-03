/**
 * DESIGN PROTOTYPE: 2026-02-23-vxu-design-final.md
 *
 * CDC IIS (Immunization Information System) IG — ORDER-level helpers
 *
 * Maps ORDER-level OBX segments to FHIR Immunization fields per CDC IIS IG:
 * - 64994-7 -> programEligibility
 * - 30963-3 -> fundingSource
 * - 69764-9 -> education.documentType (grouped by OBX-4 sub-ID)
 * - 29768-9 -> education.publicationDate (grouped by OBX-4 sub-ID)
 * - 29769-7 -> education.presentationDate (grouped by OBX-4 sub-ID)
 * - 30973-2 -> protocolApplied.doseNumber
 * - 30956-7 -> education.reference (VIS document URI)
 * - 48767-8 -> note.text (annotation comment)
 *
 * Also interprets RXA-9 NIP001 source codes:
 * - "00" -> primarySource: true
 * - "01" -> primarySource: false, reportOrigin populated
 */

import type { HL7v2Segment } from "../hl7v2/generated/types";
import type { CE } from "../hl7v2/generated/fields";
import type { WrappedOBX } from "../hl7v2/wrappers";
import { fromOBX } from "../hl7v2/wrappers";
import { convertCEToCodeableConcept } from "./datatypes/ce-codeableconcept";
import type { Immunization, CodeableConcept } from "../fhir/hl7-fhir-r4-core";

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
  "30956-7", // VIS Document reference URI
  "48767-8", // Annotation comment
]);

// VIS-related LOINC codes that group by OBX-4 sub-ID
const VIS_LOINC_CODES = new Set(["69764-9", "29768-9", "29769-7", "30956-7"]);

// ============================================================================
// NIP001 Source Interpretation
// ============================================================================

const NIP001_SYSTEM_OID = "urn:oid:2.16.840.1.114222.4.5.274";

export interface RXA9SourceResult {
  primarySource: boolean;
  reportOrigin?: CodeableConcept;
}

/**
 * Interpret RXA-9 NIP001 source codes for Immunization.primarySource/reportOrigin.
 *
 * CDC IIS IG defines NIP001 table:
 * - "00" → new immunization record (primarySource: true)
 * - "01" → historical information (primarySource: false, reportOrigin populated)
 *
 * Finds the NIP001-coded entry among RXA-9 repeats. Non-NIP001 entries are ignored.
 * Defaults to primarySource: true when no NIP001 entry found or code is unknown.
 */
export function interpretRXA9Source(administrationNotes: CE[] | undefined): RXA9SourceResult {
  if (!administrationNotes?.length) {
    return { primarySource: true };
  }

  const nip001Entry = administrationNotes.find((ce) => {
    const system = ce.$3_system?.toUpperCase();
    return system === "NIP001" || system === NIP001_SYSTEM_OID.toUpperCase();
  });

  if (!nip001Entry) {
    return { primarySource: true };
  }

  if (nip001Entry.$1_code === "01") {
    return {
      primarySource: false,
      reportOrigin: {
        coding: [{ code: "01", display: "Historical", system: NIP001_SYSTEM_OID }],
      },
    };
  }

  // "00" and any unknown codes default to primarySource: true
  return { primarySource: true };
}

// ============================================================================
// ORDER OBX → Immunization Field Mapping
// ============================================================================

type OrderOBXResult =
  | { fields: Partial<Immunization> }
  | { error: string };

/**
 * Process all ORDER OBX segments and return Immunization fields to merge.
 *
 * Iterates OBX segments within an ORDER group, validates each against the
 * CDC IIS code set, and accumulates the resulting Immunization fields.
 * Returns an error on the first unknown/invalid OBX code.
 *
 * VIS codes (69764-9, 29768-9, 29769-7, 30956-7) are skipped here — they
 * will be handled by VIS grouping logic (Task 16).
 */
export function applyOrderOBXFields(
  obxSegments: HL7v2Segment[],
): { fields: Partial<Immunization> } | { error: string } {
  let fields: Partial<Immunization> = {};

  for (const segment of obxSegments) {
    const obx = fromOBX(segment);
    const result = applyOrderOBX(obx);
    if ("error" in result) {
      return result;
    }
    fields = { ...fields, ...result.fields };
  }

  return { fields };
}

/**
 * Map a single ORDER OBX to Immunization fields.
 *
 * Returns new field values to merge into the Immunization, or an error.
 * VIS codes are skipped here (handled by VIS grouping in Task 16).
 */
function applyOrderOBX(obx: WrappedOBX): OrderOBXResult {
  const obxCode = obx.$3_observationIdentifier?.$1_code;
  const obxSystem = obx.$3_observationIdentifier?.$3_system;

  if (!obxSystem || obxSystem.toUpperCase() !== "LN") {
    const systemDisplay = obxSystem || "(empty)";
    return { error: `ORDER OBX-3 must use LOINC coding system, got "${systemDisplay}"` };
  }

  if (!obxCode || !KNOWN_ORDER_OBX_LOINC_CODES.has(obxCode)) {
    const codeDisplay = obxCode || "(empty)";
    return {
      error: `Unknown OBX code "${codeDisplay}" in VXU ORDER context.` +
        " All ORDER OBX codes must be in the CDC IIS mapping.",
    };
  }

  // VIS codes are handled by grouping logic (Task 16) — skip here
  if (VIS_LOINC_CODES.has(obxCode)) {
    return { fields: {} };
  }

  const obxValue = obx.$5_observationValue?.[0];

  switch (obxCode) {
    case "64994-7": {
      const eligibilityCC = obxValueAsCodeableConcept(obx);
      if (eligibilityCC) {
        return { fields: { programEligibility: [eligibilityCC] } };
      }
      return { fields: {} };
    }
    case "30963-3": {
      const fundingCC = obxValueAsCodeableConcept(obx);
      if (fundingCC) {
        return { fields: { fundingSource: fundingCC } };
      }
      return { fields: {} };
    }
    case "30973-2": {
      if (obxValue) {
        return { fields: { protocolApplied: [{ doseNumberString: obxValue }] } };
      }
      return { fields: {} };
    }
    case "48767-8": {
      if (obxValue) {
        return { fields: { note: [{ text: obxValue }] } };
      }
      return { fields: {} };
    }
    default:
      return { fields: {} };
  }
}

/**
 * Convert OBX-5 to a CodeableConcept.
 *
 * Uses the structured CE from $5_observationValueCE when available (CE/CWE types),
 * falls back to $5_observationValue string as text.
 */
function obxValueAsCodeableConcept(obx: WrappedOBX): CodeableConcept | undefined {
  if (obx.$5_observationValueCE) {
    return convertCEToCodeableConcept(obx.$5_observationValueCE);
  }

  const textValue = obx.$5_observationValue?.[0];
  if (!textValue) return undefined;
  return { text: textValue };
}

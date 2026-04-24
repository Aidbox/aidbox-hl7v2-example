/**
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
import type { Immunization, CodeableConcept, ImmunizationEducation } from "../fhir/hl7-fhir-r4-core";
import { convertDTMToDate } from "./datatypes/dtm-datetime";

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

interface RXA9SourceResult {
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
 * VIS codes (69764-9, 29768-9, 29769-7, 30956-7) are grouped by OBX-4 sub-ID
 * into `education[]` entries per CDC IIS IG.
 */
export function applyOrderOBXFields(
  obxSegments: HL7v2Segment[],
): { fields: Partial<Immunization> } | { error: string } {
  let fields: Partial<Immunization> = {};
  const visGroupsBySubId = new Map<string, ImmunizationEducation>();

  for (const segment of obxSegments) {
    const obx = fromOBX(segment);
    const result = applyOrderOBX(obx, visGroupsBySubId);
    if ("error" in result) {
      return result;
    }
    fields = { ...fields, ...result.fields };
  }

  const education = buildEducationEntries(visGroupsBySubId);
  if (education.length > 0) {
    fields = { ...fields, education };
  }

  return { fields };
}

/**
 * Map a single ORDER OBX to Immunization fields.
 *
 * Returns new field values to merge into the Immunization, or an error.
 * VIS codes are collected into visGroups by OBX-4 sub-ID for later grouping.
 */
function applyOrderOBX(
  obx: WrappedOBX,
  visGroups: Map<string, Partial<ImmunizationEducation>>,
): OrderOBXResult {
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

  if (VIS_LOINC_CODES.has(obxCode)) {
    collectVISField(obx, obxCode, visGroups);
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
 * Collect a VIS OBX field into the group map keyed by OBX-4 sub-ID.
 *
 * CDC IIS IG uses OBX-4 to correlate VIS document type, publication date,
 * presentation date, and reference URI into a single education[] entry.
 * OBX segments sharing the same sub-ID form one ImmunizationEducation entry.
 */
function collectVISField(
  obx: WrappedOBX,
  loincCode: string,
  visGroups: Map<string, ImmunizationEducation>,
): void {
  const subId = obx.$4_observationSubId || "_default";
  let group = visGroups.get(subId);
  if (!group) {
    group = {} as ImmunizationEducation;
    visGroups.set(subId, group);
  }

  const obxValue = obx.$5_observationValue?.[0];
  if (!obxValue) {return;}

  switch (loincCode) {
    case "69764-9":
      group.documentType = obxValue;
      break;
    case "29768-9":
      group.publicationDate = convertDTMToDate(obxValue);
      break;
    case "29769-7":
      group.presentationDate = convertDTMToDate(obxValue);
      break;
    case "30956-7":
      group.reference = obxValue;
      break;
  }
}

/** Build education[] entries from VIS groups, preserving insertion order.
 *  FHIR constraint imm-1: documentType or reference must be present. */
function buildEducationEntries(
  visGroups: Map<string, ImmunizationEducation>,
): ImmunizationEducation[] {
  const entries: ImmunizationEducation[] = [];
  for (const group of visGroups.values()) {
    if (group.documentType || group.reference) {
      entries.push(group);
    }
  }
  return entries;
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
  if (!textValue) {return undefined;}
  return { text: textValue };
}

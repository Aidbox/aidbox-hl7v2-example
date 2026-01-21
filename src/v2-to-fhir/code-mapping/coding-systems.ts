/**
 * Coding System Utilities
 *
 * Shared functions for normalizing HL7v2 coding systems to FHIR URIs.
 */

/**
 * Normalize HL7v2 coding system abbreviations to standard FHIR system URIs.
 *
 * Common mappings:
 * - "LN" / "LOINC" → http://loinc.org
 * - "SCT" / "SNOMED" / "SNOMEDCT" → http://snomed.info/sct
 * - "ICD10" / "I10" → http://hl7.org/fhir/sid/icd-10
 *
 * @param system - HL7v2 coding system identifier (e.g., "LN", "SCT")
 * @returns FHIR system URI or original value if no mapping exists
 */
export function normalizeSystem(system: string | undefined): string | undefined {
  if (!system) return undefined;

  const upper = system.toUpperCase();
  if (upper === "LN" || upper === "LOINC") {
    return "http://loinc.org";
  }
  if (upper === "SCT" || upper === "SNOMED" || upper === "SNOMEDCT") {
    return "http://snomed.info/sct";
  }
  if (upper === "ICD10" || upper === "I10") {
    return "http://hl7.org/fhir/sid/icd-10";
  }

  return system;
}

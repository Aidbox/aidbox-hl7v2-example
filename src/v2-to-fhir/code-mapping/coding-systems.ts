/**
 * Coding System Utilities
 *
 * Shared functions for normalizing HL7v2 coding systems to FHIR URIs.
 */

/**
 * Normalize HL7v2 coding system abbreviations to standard FHIR system URIs.
 *
 * @param system - HL7v2 coding system identifier
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
  if (upper === "ICD-10-CM") {
    return "http://hl7.org/fhir/sid/icd-10-cm";
  }
  if (upper === "CVX") {
    return "http://hl7.org/fhir/sid/cvx";
  }
  if (upper === "NCIT") {
    return "http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl";
  }
  if (upper === "HL70163") {
    return "http://terminology.hl7.org/CodeSystem/v2-0163";
  }
  if (upper === "UCUM") {
    return "http://unitsofmeasure.org";
  }
  if (upper === "NDC") {
    return "http://hl7.org/fhir/sid/ndc";
  }

  return system;
}

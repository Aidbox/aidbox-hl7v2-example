/**
 * Validation for resolved mapping values.
 *
 * Validates that resolved codes are valid for their target FHIR code systems.
 */

import type { MappingTypeName } from "./mapping-types";

/**
 * Valid FHIR DiagnosticReport.status values
 * @see http://hl7.org/fhir/R4/valueset-diagnostic-report-status.html
 */
const VALID_DIAGNOSTIC_REPORT_STATUS = new Set([
  "registered",
  "preliminary",
  "partial",
  "corrected",
  "final",
  "cancelled",
  "entered-in-error",
  "unknown",
]);

/**
 * Valid FHIR Observation.status values
 * @see http://hl7.org/fhir/R4/valueset-observation-status.html
 */
const VALID_OBSERVATION_STATUS = new Set([
  "registered",
  "preliminary",
  "final",
  "amended",
  "corrected",
  "cancelled",
  "entered-in-error",
  "unknown",
]);

/**
 * Valid FHIR Address.type values
 * @see http://hl7.org/fhir/R4/valueset-address-type.html
 */
const VALID_ADDRESS_TYPE = new Set([
  "postal",
  "physical",
  "both",
]);

/**
 * Valid FHIR Encounter.class codes (v3-ActCode subset for encounters)
 * @see http://terminology.hl7.org/CodeSystem/v3-ActCode
 */
const VALID_ENCOUNTER_CLASS = new Set([
  "AMB",     // ambulatory
  "EMER",    // emergency
  "FLD",     // field
  "HH",      // home health
  "IMP",     // inpatient encounter
  "ACUTE",   // inpatient acute
  "NONAC",   // inpatient non-acute
  "OBSENC",  // observation encounter
  "PRENC",   // pre-admission
  "SS",      // short stay
  "VR",      // virtual
]);

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a resolved code against the target value set for a mapping type.
 *
 * @param mappingType - The mapping type being validated
 * @param code - The resolved code to validate
 * @returns Validation result indicating if the code is valid
 */
export function validateResolvedCode(
  mappingType: MappingTypeName,
  code: string,
): ValidationResult {
  switch (mappingType) {
    case "loinc":
      // LOINC codes don't have a fixed set - accept any non-empty code
      // (Real LOINC validation would require an external terminology service)
      if (!code || code.trim() === "") {
        return {
          valid: false,
          error: "LOINC code cannot be empty",
        };
      }
      return { valid: true };

    case "obr-status":
      if (!VALID_DIAGNOSTIC_REPORT_STATUS.has(code)) {
        return {
          valid: false,
          error: `Invalid DiagnosticReport status: "${code}". Valid values: ${[...VALID_DIAGNOSTIC_REPORT_STATUS].join(", ")}`,
        };
      }
      return { valid: true };

    case "obx-status":
      if (!VALID_OBSERVATION_STATUS.has(code)) {
        return {
          valid: false,
          error: `Invalid Observation status: "${code}". Valid values: ${[...VALID_OBSERVATION_STATUS].join(", ")}`,
        };
      }
      return { valid: true };

    case "address-type":
      if (!VALID_ADDRESS_TYPE.has(code)) {
        return {
          valid: false,
          error: `Invalid Address type: "${code}". Valid values: ${[...VALID_ADDRESS_TYPE].join(", ")}`,
        };
      }
      return { valid: true };

    case "patient-class":
      if (!VALID_ENCOUNTER_CLASS.has(code)) {
        return {
          valid: false,
          error: `Invalid Encounter class: "${code}". Valid values: ${[...VALID_ENCOUNTER_CLASS].join(", ")}`,
        };
      }
      return { valid: true };

    default: {
      // Type guard - this should never happen with proper typing
      const _exhaustiveCheck: never = mappingType;
      return {
        valid: false,
        error: `Unknown mapping type: ${_exhaustiveCheck}`,
      };
    }
  }
}

/**
 * Get the list of valid values for a mapping type.
 * Returns undefined for types that don't have a fixed set (e.g., LOINC).
 */
export function getValidValues(
  mappingType: MappingTypeName,
): string[] | undefined {
  switch (mappingType) {
    case "loinc":
      return undefined; // LOINC has no fixed set

    case "obr-status":
      return [...VALID_DIAGNOSTIC_REPORT_STATUS];

    case "obx-status":
      return [...VALID_OBSERVATION_STATUS];

    case "address-type":
      return [...VALID_ADDRESS_TYPE];

    case "patient-class":
      return [...VALID_ENCOUNTER_CLASS];

    default:
      return undefined;
  }
}

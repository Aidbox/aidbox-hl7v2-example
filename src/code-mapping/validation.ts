/**
 * Validation for resolved mapping values.
 *
 * Validates that resolved codes are valid for their target FHIR code systems.
 * Uses the mapping type options registry for consistent valid values.
 */

import type { MappingTypeName } from "./mapping-types";
import {
  isValidCode,
  getValidValues as getValidValuesFromOptions,
} from "./mapping-type-options";

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
 * Uses the mapping type options registry for validation. Types without fixed
 * value sets (like LOINC) accept any non-empty code.
 *
 * @param mappingType - The mapping type being validated
 * @param code - The resolved code to validate
 * @returns Validation result indicating if the code is valid
 */
export function validateResolvedCode(
  mappingType: MappingTypeName,
  code: string,
): ValidationResult {
  // Empty codes are always invalid
  if (!code || code.trim() === "") {
    return {
      valid: false,
      error: `${getTypeLabel(mappingType)} code cannot be empty`,
    };
  }

  // Use the options registry to validate
  if (!isValidCode(mappingType, code)) {
    const validValues = getValidValuesFromOptions(mappingType);
    const valuesList = validValues ? validValues.join(", ") : "any non-empty value";
    return {
      valid: false,
      error: `Invalid ${getTypeLabel(mappingType)}: "${code}". Valid values: ${valuesList}`,
    };
  }

  return { valid: true };
}

/**
 * Get a human-readable label for the mapping type's target field.
 */
function getTypeLabel(mappingType: MappingTypeName): string {
  switch (mappingType) {
    case "observation-code-loinc":
      return "LOINC";
    case "obr-status":
      return "DiagnosticReport status";
    case "obx-status":
      return "Observation status";
    case "patient-class":
      return "Encounter class";
    case "orc-status":
      return "ServiceRequest status";
  }
}

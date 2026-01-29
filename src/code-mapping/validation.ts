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
  "partial",
  "preliminary",
  "final",
  "amended",
  "corrected",
  "appended",
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
 * Valid FHIR Address.use values
 * @see http://hl7.org/fhir/R4/valueset-address-use.html
 */
const VALID_ADDRESS_USE = new Set([
  "home",
  "work",
  "temp",
  "old",
  "billing",
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
      // Address-type mapping can resolve to either Address.type or Address.use
      if (!VALID_ADDRESS_TYPE.has(code) && !VALID_ADDRESS_USE.has(code)) {
        return {
          valid: false,
          error: `Invalid Address type/use: "${code}". Valid Address.type values: ${[...VALID_ADDRESS_TYPE].join(", ")}. Valid Address.use values: ${[...VALID_ADDRESS_USE].join(", ")}`,
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
      // Address-type mapping can resolve to either Address.type or Address.use
      return [...VALID_ADDRESS_TYPE, ...VALID_ADDRESS_USE];

    case "patient-class":
      return [...VALID_ENCOUNTER_CLASS];

    default: {
      // Exhaustive type check - TypeScript will error if a new mapping type is added
      // but not handled above
      const _exhaustiveCheck: never = mappingType;
      return undefined;
    }
  }
}

/**
 * Display names for valid values, used in UI dropdowns.
 */
const VALID_VALUES_DISPLAY: Record<string, Record<string, string>> = {
  "address-type": {
    // Address.type values
    postal: "Postal (type)",
    physical: "Physical (type)",
    both: "Postal & Physical (type)",
    // Address.use values
    home: "Home (use)",
    work: "Work (use)",
    temp: "Temporary (use)",
    old: "Old/Incorrect (use)",
    billing: "Billing (use)",
  },
  "patient-class": {
    AMB: "Ambulatory",
    EMER: "Emergency",
    FLD: "Field",
    HH: "Home Health",
    IMP: "Inpatient",
    ACUTE: "Inpatient Acute",
    NONAC: "Inpatient Non-Acute",
    OBSENC: "Observation Encounter",
    PRENC: "Pre-Admission",
    SS: "Short Stay",
    VR: "Virtual",
  },
  "obr-status": {
    registered: "Registered",
    partial: "Partial",
    preliminary: "Preliminary",
    final: "Final",
    amended: "Amended",
    corrected: "Corrected",
    appended: "Appended",
    cancelled: "Cancelled",
    "entered-in-error": "Entered in Error",
    unknown: "Unknown",
  },
  "obx-status": {
    registered: "Registered",
    preliminary: "Preliminary",
    final: "Final",
    amended: "Amended",
    corrected: "Corrected",
    cancelled: "Cancelled",
    "entered-in-error": "Entered in Error",
    unknown: "Unknown",
  },
};

/**
 * Get valid values with display names for UI dropdowns.
 * Returns empty array for types that don't have a fixed set (e.g., LOINC).
 */
export function getValidValuesWithDisplay(
  mappingType: MappingTypeName,
): Array<{ code: string; display: string }> {
  const values = getValidValues(mappingType);
  if (!values) return [];

  const displayMap = VALID_VALUES_DISPLAY[mappingType] || {};
  return values.map((code) => ({
    code,
    display: displayMap[code] || code,
  }));
}

/**
 * Get the correct target system for a resolved code.
 *
 * For most mapping types, the target system is fixed (from MAPPING_TYPES registry).
 * For address-type mapping, the system depends on whether the resolved code is
 * an Address.type value or an Address.use value:
 * - Address.type values (postal, physical, both) -> http://hl7.org/fhir/address-type
 * - Address.use values (home, work, temp, old, billing) -> http://hl7.org/fhir/address-use
 *
 * @param mappingType - The mapping type being resolved
 * @param code - The resolved code
 * @param defaultSystem - The default system from MAPPING_TYPES registry
 * @returns The correct target system for the resolved code
 */
export function getTargetSystemForCode(
  mappingType: MappingTypeName,
  code: string,
  defaultSystem: string,
): string {
  if (mappingType === "address-type") {
    if (VALID_ADDRESS_USE.has(code)) {
      return "http://hl7.org/fhir/address-use";
    }
    // For Address.type values, use the default system (address-type)
    return "http://hl7.org/fhir/address-type";
  }
  return defaultSystem;
}

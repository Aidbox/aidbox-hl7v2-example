/**
 * Mapping Type Options
 *
 * Provides valid value options for each mapping type, used for:
 * - UI dropdowns for selecting resolved codes
 * - Validation of resolved codes
 *
 * Each mapping type either has a fixed set of valid values (like status codes)
 * or allows free-form input (like LOINC codes, which are validated externally).
 */

import type { MappingTypeName } from "./mapping-types";

/**
 * A valid value option with code and display name.
 */
export interface ValidValueOption {
  code: string;
  display: string;
}

/**
 * Valid values for mapping types with fixed value sets.
 *
 * - Keys are mapping type names
 * - Values are maps of code -> display name
 * - Types with free-form input (like LOINC) are not included
 */
const VALID_VALUES: Partial<Record<MappingTypeName, Record<string, string>>> = {
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
 * Get the list of valid codes for a mapping type.
 * Returns undefined for types that don't have a fixed set (e.g., LOINC).
 *
 * @param mappingType - The mapping type name
 * @returns Array of valid code strings, or undefined if free-form
 */
export function getValidValues(
  mappingType: MappingTypeName,
): string[] | undefined {
  const values = VALID_VALUES[mappingType];
  if (!values) return undefined;
  return Object.keys(values);
}

/**
 * Get valid values with display names for UI dropdowns.
 * Returns empty array for types that don't have a fixed set (e.g., LOINC).
 *
 * @param mappingType - The mapping type name
 * @returns Array of {code, display} objects
 */
export function getValidValuesWithDisplay(
  mappingType: MappingTypeName,
): ValidValueOption[] {
  const values = VALID_VALUES[mappingType];
  if (!values) return [];

  return Object.entries(values).map(([code, display]) => ({
    code,
    display,
  }));
}

/**
 * Check if a code is valid for a given mapping type.
 * Returns true for types without fixed value sets (e.g., LOINC).
 *
 * @param mappingType - The mapping type name
 * @param code - The code to validate
 * @returns true if valid, false otherwise
 */
export function isValidCode(mappingType: MappingTypeName, code: string): boolean {
  const values = VALID_VALUES[mappingType];
  // Types without fixed values accept any non-empty code
  if (!values) return code.trim() !== "";
  return code in values;
}

/**
 * Get the display name for a valid code.
 * Returns the code itself if no display name is defined.
 *
 * @param mappingType - The mapping type name
 * @param code - The code to look up
 * @returns Display name or the code itself
 */
export function getDisplayForCode(
  mappingType: MappingTypeName,
  code: string,
): string {
  const values = VALID_VALUES[mappingType];
  return values?.[code] ?? code;
}

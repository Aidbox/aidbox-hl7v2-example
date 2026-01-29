/**
 * Mapping Type UI Utilities
 *
 * Shared UI helper functions for displaying mapping types.
 * Used by both mapping-tasks.ts and code-mappings.ts pages.
 */

import type { MappingTypeName } from "../code-mapping/mapping-types";

/**
 * Get short label for a mapping type (used in badges)
 */
export function getMappingTypeShortLabel(typeName: MappingTypeName): string {
  switch (typeName) {
    case "loinc":
      return "LOINC";
    case "patient-class":
      return "Patient Class";
    case "obr-status":
      return "OBR Status";
    case "obx-status":
      return "OBX Status";
  }
}

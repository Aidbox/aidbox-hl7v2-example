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
    case "address-type":
      return "Address";
    case "patient-class":
      return "Patient Class";
    case "obr-status":
      return "OBR Status";
    case "obx-status":
      return "OBX Status";
  }
}

/**
 * Get badge color classes for a mapping type (Tailwind CSS)
 */
export function getMappingTypeBadgeClasses(typeName: MappingTypeName): string {
  switch (typeName) {
    case "loinc":
      return "bg-purple-100 text-purple-800";
    case "address-type":
      return "bg-blue-100 text-blue-800";
    case "patient-class":
      return "bg-green-100 text-green-800";
    case "obr-status":
      return "bg-orange-100 text-orange-800";
    case "obx-status":
      return "bg-amber-100 text-amber-800";
  }
}

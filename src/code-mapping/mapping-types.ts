/**
 * Mapping Types Registry
 *
 * Centralized registry for all HL7v2-to-FHIR mapping types. This is the single source
 * of truth for mapping type configuration throughout the system.
 *
 * ## Purpose
 *
 * This registry defines how different HL7v2 fields are mapped to FHIR values when
 * automatic mapping fails. Each mapping type specifies:
 *
 * - `taskCode`: Unique identifier used in Task.code.coding[0].code for filtering
 * - `taskDisplay`: Human-readable description shown in UI
 * - `targetSystem`: FHIR code system URI for the resolved value
 * - `conceptMapSuffix`: Appended to ConceptMap ID (e.g., "-to-loinc")
 * - `sourceField`: HL7v2 field reference (e.g., "OBX-3", "PV1.2")
 * - `targetField`: FHIR field reference (e.g., "Observation.code")
 *
 * ## How to Add a New Mapping Type
 *
 * 1. Add an entry to MAPPING_TYPES below with all required fields
 * 2. Update the segment converter to detect unmapped codes and return MappingError
 * 3. Add validation logic in the resolution API endpoint
 * 4. The UI filter tabs and type badges update automatically
 *
 * ## Fail-Fast Behavior
 *
 * Functions like `getMappingType()` and `getMappingTypeOrFail()` throw errors
 * immediately if a task code or type name is not found in the registry. This
 * prevents silent failures and ensures new mapping types are properly configured.
 *
 * ## Backward Compatibility
 *
 * Legacy task codes (e.g., "local-to-loinc-mapping") are aliased to current types
 * via LEGACY_TASK_CODE_ALIASES. Add aliases here when renaming task codes.
 */

export const MAPPING_TYPES = {
  loinc: {
    taskCode: "loinc-mapping",
    taskDisplay: "Local code to LOINC mapping",
    targetSystem: "http://loinc.org",
    conceptMapSuffix: "-to-loinc",
    sourceField: "OBX-3",
    targetField: "Observation.code",
  },
  "address-type": {
    taskCode: "address-type-mapping",
    taskDisplay: "Address type mapping",
    targetSystem: "http://hl7.org/fhir/address-type",
    conceptMapSuffix: "-to-address-type",
    sourceField: "PID.11 (XAD.7)",
    targetField: "Address.type/use",
  },
  "patient-class": {
    taskCode: "patient-class-mapping",
    taskDisplay: "Patient class mapping",
    targetSystem: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    conceptMapSuffix: "-to-encounter-class",
    sourceField: "PV1.2",
    targetField: "Encounter.class",
  },
  "obr-status": {
    taskCode: "obr-status-mapping",
    taskDisplay: "OBR result status mapping",
    targetSystem: "http://hl7.org/fhir/diagnostic-report-status",
    conceptMapSuffix: "-to-diagnostic-report-status",
    sourceField: "OBR-25",
    targetField: "DiagnosticReport.status",
  },
  "obx-status": {
    taskCode: "obx-status-mapping",
    taskDisplay: "OBX observation status mapping",
    targetSystem: "http://hl7.org/fhir/observation-status",
    conceptMapSuffix: "-to-observation-status",
    sourceField: "OBX-11",
    targetField: "Observation.status",
  },
} as const;

/** Valid mapping type names (keys of MAPPING_TYPES) */
export type MappingTypeName = keyof typeof MAPPING_TYPES;

/** Configuration object for a single mapping type */
export type MappingTypeConfig = (typeof MAPPING_TYPES)[MappingTypeName];

/**
 * Aliases for legacy task codes that were renamed.
 * Maps old task code -> current mapping type name.
 * Exported for use in other modules that need to handle legacy codes.
 */
export const LEGACY_TASK_CODE_ALIASES: Record<string, MappingTypeName> = {
  "local-to-loinc-mapping": "loinc",
};

/**
 * Get mapping type configuration by task code.
 * Supports legacy task codes for backward compatibility.
 *
 * @throws Error if task code is not found in the registry
 */
export function getMappingType(taskCode: string): MappingTypeConfig {
  const legacyTypeName = LEGACY_TASK_CODE_ALIASES[taskCode];
  if (legacyTypeName) {
    return MAPPING_TYPES[legacyTypeName];
  }

  const entry = Object.entries(MAPPING_TYPES).find(
    ([, config]) => config.taskCode === taskCode,
  );
  if (!entry) {
    throw new Error(
      `Unknown mapping task code: ${taskCode}. Add it to MAPPING_TYPES registry.`,
    );
  }
  return entry[1];
}

/**
 * Get mapping type configuration by type name.
 *
 * @throws Error if type name is not found in the registry
 */
export function getMappingTypeOrFail(typeName: string): MappingTypeConfig {
  if (!isMappingTypeName(typeName)) {
    throw new Error(
      `Unknown mapping type: ${typeName}. Valid types: ${Object.keys(MAPPING_TYPES).join(", ")}`,
    );
  }
  return MAPPING_TYPES[typeName];
}

/**
 * Type guard to check if a string is a valid mapping type name.
 */
export function isMappingTypeName(value: string): value is MappingTypeName {
  return value in MAPPING_TYPES;
}

/**
 * Get the mapping type name from a task code.
 *
 * @throws Error if task code is not found in the registry
 */
export function getMappingTypeName(taskCode: string): MappingTypeName {
  const legacyTypeName = LEGACY_TASK_CODE_ALIASES[taskCode];
  if (legacyTypeName) {
    return legacyTypeName;
  }

  const entry = Object.entries(MAPPING_TYPES).find(
    ([, config]) => config.taskCode === taskCode,
  );
  if (!entry) {
    throw new Error(
      `Unknown mapping task code: ${taskCode}. Add it to MAPPING_TYPES registry.`,
    );
  }
  return entry[0] as MappingTypeName;
}

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
 * - `sourceFieldLabel`: HL7v2 field reference for display (e.g., "OBX-3", "PV1.2")
 * - `targetFieldLabel`: FHIR field reference for display (e.g., "Observation.code")
 *
 * ConceptMap IDs are generated automatically using the mapping type name as suffix:
 * `hl7v2-{sendingApplication}-{sendingFacility}-{mappingType}`
 *
 * ## How to Add a New Mapping Type
 *
 * 1. Add an entry to MAPPING_TYPES below with all required fields
 * 2. Update the segment converter to detect unmapped codes and return MappingError
 * 3. Add validation logic in src/code-mapping/mapping-type-options.ts
 * 4. The UI filter tabs and type badges update automatically
 *
 * ## Fail-Fast Behavior
 *
 * Functions like `getMappingType()` and `getMappingTypeOrFail()` throw errors
 * immediately if a task code or type name is not found in the registry. This
 * prevents silent failures and ensures new mapping types are properly configured.
 */

export const MAPPING_TYPES = {
  loinc: {
    taskCode: "loinc-mapping",
    taskDisplay: "Local code to LOINC mapping",
    targetSystem: "http://loinc.org",
    sourceFieldLabel: "OBX-3",
    targetFieldLabel: "Observation.code",
  },
  "patient-class": {
    taskCode: "patient-class-mapping",
    taskDisplay: "Patient class mapping",
    targetSystem: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    sourceFieldLabel: "PV1.2",
    targetFieldLabel: "Encounter.class",
  },
  "obr-status": {
    taskCode: "obr-status-mapping",
    taskDisplay: "OBR result status mapping",
    targetSystem: "http://hl7.org/fhir/diagnostic-report-status",
    sourceFieldLabel: "OBR-25",
    targetFieldLabel: "DiagnosticReport.status",
  },
  "obx-status": {
    taskCode: "obx-status-mapping",
    taskDisplay: "OBX observation status mapping",
    targetSystem: "http://hl7.org/fhir/observation-status",
    sourceFieldLabel: "OBX-11",
    targetFieldLabel: "Observation.status",
  },
} as const;

/** Valid mapping type names (keys of MAPPING_TYPES) */
export type MappingTypeName = keyof typeof MAPPING_TYPES;

/** Configuration object for a single mapping type */
export type MappingTypeConfig = (typeof MAPPING_TYPES)[MappingTypeName];

/**
 * Get mapping type configuration by task code.
 *
 * @throws Error if task code is not found in the registry
 */
export function getMappingType(taskCode: string): MappingTypeConfig {
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

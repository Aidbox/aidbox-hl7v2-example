/**
 * Mapping Types Registry
 *
 * Centralized registry for all mapping types that defines:
 * - Task code values for filtering
 * - Target FHIR code systems
 * - ConceptMap ID suffixes
 * - Display names for UI
 *
 * This enables extensibility for new mapping types and fail-fast behavior
 * when a mapping type is not properly configured.
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
    targetField: "Address.type",
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

export type MappingTypeName = keyof typeof MAPPING_TYPES;
export type MappingTypeConfig = (typeof MAPPING_TYPES)[MappingTypeName];

const LEGACY_TASK_CODE_ALIASES: Record<string, MappingTypeName> = {
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

/**
 * Mapping Types Registry
 *
 * Centralized registry for all HL7v2-to-FHIR mapping types. This is the single source
 * of truth for mapping type configuration throughout the system.
 *
 * ## Purpose
 *
 * This registry defines how different HL7v2 fields are mapped to FHIR values when
 * automatic mapping fails. Each mapping type specifies structured metadata:
 *
 * - `source`: HL7v2 source field (`segment` name and `field` position number)
 * - `target`: FHIR target (`resource` type and `field` path)
 * - `targetSystem`: FHIR code system URI for the resolved value
 *
 * Display strings (source labels like "OBX-3", target labels like "Observation.code")
 * are derived from structured metadata via helper functions:
 * `sourceLabel()`, `targetLabel()`.
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
 * Functions like `getMappingTypeOrFail()` throw errors immediately if a type name
 * is not found in the registry. This prevents silent failures and ensures new
 * mapping types are properly configured.
 */

export const MAPPING_TYPES = {
  "observation-code-loinc": {
    source: { segment: "OBX", field: 3 },
    target: { resource: "Observation", field: "code" },
    targetSystem: "http://loinc.org",
  },
  "patient-class": {
    source: { segment: "PV1", field: 2 },
    target: { resource: "Encounter", field: "class" },
    targetSystem: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  },
  "obr-status": {
    source: { segment: "OBR", field: 25 },
    target: { resource: "DiagnosticReport", field: "status" },
    targetSystem: "http://hl7.org/fhir/diagnostic-report-status",
  },
  "obx-status": {
    source: { segment: "OBX", field: 11 },
    target: { resource: "Observation", field: "status" },
    targetSystem: "http://hl7.org/fhir/observation-status",
  },
} as const;

/** Valid mapping type names (keys of MAPPING_TYPES) */
export type MappingTypeName = keyof typeof MAPPING_TYPES;

/** Configuration object for a single mapping type */
export type MappingTypeConfig = (typeof MAPPING_TYPES)[MappingTypeName];

/** "OBX-3", "PV1-2" — HL7v2 dash convention */
export function sourceLabel(config: MappingTypeConfig): string {
  return `${config.source.segment}-${config.source.field}`;
}

/** "Observation.code", "Encounter.class" */
export function targetLabel(config: MappingTypeConfig): string {
  return `${config.target.resource}.${config.target.field}`;
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

/**
 * Generic Mapping Error Types and Builders
 *
 * Provides reusable error types and result builders for any mapping type
 * (LOINC, address type, patient class, OBR/OBX status, etc.)
 */

import type { Bundle, BundleEntry } from "../fhir/hl7-fhir-r4-core";
import type { UnmappedCode } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import type { ConversionResult } from "../v2-to-fhir/converter";
import type { MappingTypeName } from "./mapping-types";
import type { SenderContext } from "./concept-map";
import {
  composeMappingTask,
  composeTaskBundleEntry,
  generateMappingTaskId,
} from "./mapping-task";
import { generateConceptMapId } from "./concept-map";

/**
 * Generic mapping error interface for any field type.
 * Used to collect mapping errors during message conversion.
 */
export interface MappingError {
  localCode: string;
  localDisplay?: string;
  localSystem?: string;
  mappingType: MappingTypeName;
  // DESIGN PROTOTYPE: 2026-02-02-mapping-labels-design-analysis.md
  // Remove per-instance labels and derive from `MAPPING_TYPES[mappingType]`.
  sourceFieldLabel: string;
  targetFieldLabel: string;
}

/**
 * Build a ConversionResult for mapping errors.
 *
 * Creates Tasks for each unique mapping error and returns a result with
 * status "mapping_error" and the list of unmapped codes.
 *
 * Note: Only Tasks are included in the bundle. Draft Patient/Encounter resources
 * are NOT created when a message has mapping errors - they will be created when
 * the message is successfully reprocessed after all mappings are resolved.
 *
 * @param senderContext - The sender context (sendingApplication, sendingFacility)
 * @param mappingErrors - Array of mapping errors from the conversion
 */
export function buildMappingErrorResult(
  senderContext: SenderContext,
  mappingErrors: MappingError[],
): ConversionResult {
  const seenTaskIds = new Set<string>();
  const entries: BundleEntry[] = [];
  const unmappedCodes: UnmappedCode[] = [];

  for (const error of mappingErrors) {
    if (!error.localCode) continue;
    if (!error.localSystem) {
      throw new Error(
        `Cannot create mapping task: localSystem is required. ` +
          `localCode: ${error.localCode}, mappingType: ${error.mappingType}`,
      );
    }

    const conceptMapId = generateConceptMapId(senderContext, error.mappingType);
    const taskId = generateMappingTaskId(
      conceptMapId,
      error.localSystem,
      error.localCode,
    );

    if (seenTaskIds.has(taskId)) continue;
    seenTaskIds.add(taskId);

    const task = composeMappingTask(senderContext, error);
    entries.push(composeTaskBundleEntry(task));

    unmappedCodes.push({
      localCode: error.localCode,
      localDisplay: error.localDisplay,
      localSystem: error.localSystem,
      mappingTask: { reference: `Task/${taskId}` },
    });
  }

  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries.length > 0 ? entries : undefined,
  };

  return {
    bundle,
    messageUpdate: {
      status: "mapping_error",
      unmappedCodes: unmappedCodes.length > 0 ? unmappedCodes : undefined,
    },
  };
}

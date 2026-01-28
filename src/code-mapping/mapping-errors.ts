/**
 * Generic Mapping Error Types and Builders
 *
 * Provides reusable error types and result builders for any mapping type
 * (LOINC, address type, patient class, OBR/OBX status, etc.)
 */

import type { Bundle, BundleEntry, Reference } from "../fhir/hl7-fhir-r4-core";
import type { UnmappedCode } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import type { ConversionResult } from "../v2-to-fhir/converter";
import type { MappingTypeName } from "./mapping-types";
import type { SenderContext } from "./concept-map/lookup";
import {
  createMappingTask,
  createTaskBundleEntry,
  generateMappingTaskId,
} from "./mapping-task-service";
import { generateConceptMapId } from "./concept-map/lookup";

/**
 * Generic mapping error interface for any field type.
 * Used to collect mapping errors during message conversion.
 */
export interface MappingError {
  localCode: string;
  localDisplay?: string;
  localSystem?: string;
  mappingType: MappingTypeName;
}

/**
 * Build a ConversionResult for mapping errors.
 *
 * Creates Tasks for each unique mapping error and returns a result with
 * status "mapping_error" and the list of unmapped codes.
 *
 * @param senderContext - The sender context (sendingApplication, sendingFacility)
 * @param mappingErrors - Array of mapping errors from the conversion
 * @param patientRef - Reference to the patient resource
 * @param patientEntry - Optional patient bundle entry to include
 * @param encounterEntry - Optional encounter bundle entry to include
 */
export function buildMappingErrorResult(
  senderContext: SenderContext,
  mappingErrors: MappingError[],
  patientRef: Reference<"Patient">,
  patientEntry: BundleEntry | null,
  encounterEntry: BundleEntry | null,
): ConversionResult {
  const seenTaskIds = new Set<string>();
  const entries: BundleEntry[] = [];

  if (patientEntry) {
    entries.push(patientEntry);
  }
  if (encounterEntry) {
    entries.push(encounterEntry);
  }

  const unmappedCodes: UnmappedCode[] = [];

  for (const error of mappingErrors) {
    if (!error.localCode) continue;

    const conceptMapId = generateConceptMapId(senderContext, error.mappingType);
    const taskId = generateMappingTaskId(
      conceptMapId,
      error.localSystem || "",
      error.localCode,
    );

    if (seenTaskIds.has(taskId)) continue;
    seenTaskIds.add(taskId);

    const task = createMappingTask(
      senderContext,
      {
        localCode: error.localCode,
        localDisplay: error.localDisplay,
        localSystem: error.localSystem,
      },
      error.mappingType,
    );
    entries.push(createTaskBundleEntry(task));

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
      patient: patientRef,
    },
  };
}

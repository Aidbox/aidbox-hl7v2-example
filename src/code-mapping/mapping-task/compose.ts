/**
 * Mapping Task Composition
 *
 * Creates Task resources for tracking unmapped codes.
 * This is a pure function that composes a Task object without side effects.
 */

import type { Task, TaskInput } from "../../fhir/hl7-fhir-r4-core/Task";
import type { BundleEntry } from "../../fhir/hl7-fhir-r4-core/Bundle";
import { MAPPING_TYPES } from "../mapping-types";
import type { MappingError } from "../mapping-errors";
import { generateConceptMapId, type SenderContext } from "../concept-map";
import { simpleHash } from "../../utils/string";

/**
 * Generate a deterministic Task ID based on sender, mapping type, and code.
 *
 * Format: map-{conceptMapId}-{systemHash}-{codeHash}
 *
 * @throws Error if localSystem or localCode is empty (fail-fast for data quality issues)
 */
export function generateMappingTaskId(
  conceptMapId: string,
  localSystem: string,
  localCode: string,
): string {
  if (!localSystem) {
    throw new Error(
      `Cannot generate mapping task ID: localSystem is required. ` +
        `ConceptMap: ${conceptMapId}, localCode: ${localCode}`,
    );
  }
  if (!localCode) {
    throw new Error(
      `Cannot generate mapping task ID: localCode is required. ` +
        `ConceptMap: ${conceptMapId}`,
    );
  }
  const systemHash = simpleHash(localSystem);
  const codeHash = simpleHash(localCode);
  return `map-${conceptMapId}-${systemHash}-${codeHash}`;
}

/**
 * Compose a mapping task for an unmapped code.
 *
 * This is a pure function - it doesn't persist anything, just creates the Task object.
 *
 * @param sender - The sender context (sendingApplication, sendingFacility)
 * @param error - The mapping error containing code information and field context
 */
export function composeMappingTask(
  sender: SenderContext,
  error: MappingError,
): Task {
  if (!error.localSystem) {
    throw new Error(
      `Cannot compose mapping task: localSystem is required. ` +
        `localCode: ${error.localCode}, mappingType: ${error.mappingType}`,
    );
  }

  const typeConfig = MAPPING_TYPES[error.mappingType];
  const conceptMapId = generateConceptMapId(sender, error.mappingType);
  const taskId = generateMappingTaskId(
    conceptMapId,
    error.localSystem,
    error.localCode,
  );

  const inputs: TaskInput[] = [
    { type: { text: "Sending application" }, valueString: sender.sendingApplication },
    { type: { text: "Sending facility" }, valueString: sender.sendingFacility },
    { type: { text: "Local code" }, valueString: error.localCode },
  ];

  if (error.localDisplay) {
    inputs.push({ type: { text: "Local display" }, valueString: error.localDisplay });
  }

  if (error.localSystem) {
    inputs.push({ type: { text: "Local system" }, valueString: error.localSystem });
  }

  // DESIGN PROTOTYPE: 2026-02-02-mapping-labels-design-analysis.md
  // Stop persisting source/target labels in Task.input.
  // Resolve labels from `MAPPING_TYPES[error.mappingType]` in UI rendering.
  // Source and target field labels for human-readable context
  inputs.push({ type: { text: "Source field" }, valueString: error.sourceFieldLabel });
  inputs.push({ type: { text: "Target field" }, valueString: error.targetFieldLabel });

  const now = new Date().toISOString();

  return {
    resourceType: "Task",
    id: taskId,
    status: "requested",
    intent: "order",
    code: {
      coding: [
        {
          system: "urn:aidbox-hl7v2-converter:mapping-type",
          code: error.mappingType,
          display: typeConfig.taskDisplay,
        },
      ],
      // DESIGN PROTOTYPE: 2026-02-02-mapping-labels-design-analysis.md
      // Build task text from registry labels after removing label fields from MappingError.
      text: `Map ${error.sourceFieldLabel} to ${error.targetFieldLabel}`,
    },
    authoredOn: now,
    lastModified: now,
    requester: { display: "ORU Processor" },
    owner: { display: "Mapping Team" },
    input: inputs,
  };
}

/**
 * Compose a bundle entry for a Task.
 * Uses PUT for upsert - creates new or resets existing (even if completed) to requested.
 */
export function composeTaskBundleEntry(task: Task): BundleEntry {
  return {
    resource: task,
    request: {
      method: "PUT",
      url: `Task/${task.id}`,
    },
  };
}

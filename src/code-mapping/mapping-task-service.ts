/**
 * Mapping Task Service
 *
 * Manages FHIR Task resources for tracking unmapped codes that need mapping.
 * Supports multiple mapping types (LOINC, address type, patient class, etc.)
 */

import type { Task, TaskInput, TaskOutput } from "../fhir/hl7-fhir-r4-core/Task";
import type { BundleEntry } from "../fhir/hl7-fhir-r4-core/Bundle";
import type { IncomingHL7v2Message } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import {
  aidboxFetch,
  putResource,
  getResourceWithETag,
  updateResourceWithETag,
  type Bundle,
} from "../aidbox";
import { simpleHash } from "../utils/string";
import {
  MAPPING_TYPES,
  LEGACY_TASK_CODE_ALIASES,
  type MappingTypeName,
} from "./mapping-types";
import { generateConceptMapId, type SenderContext } from "./concept-map/lookup";
import { getTargetSystemForCode } from "./validation";

/**
 * Input for creating a mapping task.
 * Contains the local code information that needs to be mapped.
 */
export interface MappingTaskInput {
  localCode: string;
  localDisplay?: string;
  localSystem?: string;
}

/**
 * Generate a deterministic Task ID based on sender, mapping type, and code.
 * The mapping type is included in the ID to ensure uniqueness across different
 * mapping types for the same code.
 *
 * Format: map-{conceptMapId}-{systemHash}-{codeHash}
 * The conceptMapId already includes the mapping type suffix (e.g., "-to-loinc", "-to-address-type")
 */
export function generateMappingTaskId(
  conceptMapId: string,
  localSystem: string,
  localCode: string,
): string {
  const systemHash = simpleHash(localSystem);
  const codeHash = simpleHash(localCode);
  return `map-${conceptMapId}-${systemHash}-${codeHash}`;
}

/**
 * Create a mapping task for an unmapped code.
 *
 * The task includes:
 * - Task.code with the mapping type's taskCode and taskDisplay
 * - Input parameters for sender context, local code info, and source/target fields
 *
 * @param sender - The sender context (sendingApplication, sendingFacility)
 * @param input - The local code information that needs to be mapped
 * @param mappingType - The type of mapping (defaults to "loinc" for backward compatibility)
 */
export function createMappingTask(
  sender: SenderContext,
  input: MappingTaskInput,
  mappingType: MappingTypeName = "loinc",
): Task {
  const typeConfig = MAPPING_TYPES[mappingType];
  const conceptMapId = generateConceptMapId(sender, mappingType);
  const taskId = generateMappingTaskId(
    conceptMapId,
    input.localSystem || "",
    input.localCode,
  );

  const inputs: TaskInput[] = [
    { type: { text: "Sending application" }, valueString: sender.sendingApplication },
    { type: { text: "Sending facility" }, valueString: sender.sendingFacility },
    { type: { text: "Local code" }, valueString: input.localCode },
  ];

  if (input.localDisplay) {
    inputs.push({ type: { text: "Local display" }, valueString: input.localDisplay });
  }

  if (input.localSystem) {
    inputs.push({ type: { text: "Local system" }, valueString: input.localSystem });
  }

  // Add source and target field info from mapping type registry
  inputs.push({ type: { text: "Source field" }, valueString: typeConfig.sourceField });
  inputs.push({ type: { text: "Target field" }, valueString: typeConfig.targetField });

  const now = new Date().toISOString();

  return {
    resourceType: "Task",
    id: taskId,
    status: "requested",
    intent: "order",
    code: {
      coding: [
        {
          system: "http://example.org/task-codes",
          code: typeConfig.taskCode,
          display: typeConfig.taskDisplay,
        },
      ],
      text: `Map ${typeConfig.sourceField} to ${typeConfig.targetField}`,
    },
    authoredOn: now,
    lastModified: now,
    requester: { display: "ORU Processor" },
    owner: { display: "Mapping Team" },
    input: inputs,
  };
}

/**
 * Create a bundle entry for a Task.
 * Uses PUT for upsert - creates new or resets existing (even if completed) to requested.
 */
export function createTaskBundleEntry(task: Task): BundleEntry {
  return {
    resource: task,
    request: {
      method: "PUT",
      url: `Task/${task.id}`,
    },
  };
}

/**
 * Extract the mapping type from a Task's code.
 * Returns the MappingTypeName (e.g., "loinc", "address-type", "obr-status").
 */
function extractMappingTypeFromTask(task: Task): MappingTypeName {
  const taskCode = task.code?.coding?.[0]?.code;
  if (!taskCode) {
    throw new Error(`Task ${task.id} has no code`);
  }
  // Check legacy aliases first
  if (LEGACY_TASK_CODE_ALIASES[taskCode]) {
    return LEGACY_TASK_CODE_ALIASES[taskCode];
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

export async function resolveMappingTask(
  taskId: string,
  resolvedCode: string,
  resolvedDisplay: string,
): Promise<void> {
  const task = await aidboxFetch<Task>(`/fhir/Task/${taskId}`);

  const mappingType = extractMappingTypeFromTask(task);
  const typeConfig = MAPPING_TYPES[mappingType];

  // Get the correct target system for this resolved code
  // (for address-type, this depends on whether it's a type or use value)
  const targetSystem = getTargetSystemForCode(
    mappingType,
    resolvedCode,
    typeConfig.targetSystem,
  );

  const output: TaskOutput = {
    type: { text: "Resolved mapping" },
    valueCodeableConcept: {
      coding: [
        {
          system: targetSystem,
          code: resolvedCode,
          display: resolvedDisplay,
        },
      ],
      text: resolvedDisplay,
    },
  };

  const updatedTask: Task = {
    ...task,
    status: "completed",
    lastModified: new Date().toISOString(),
    output: [output],
  };

  await putResource("Task", taskId, updatedTask);
}

export async function removeResolvedTaskFromMessage(
  message: IncomingHL7v2Message,
  taskId: string,
): Promise<void> {
  const { resource: currentMessage, etag } =
    await getResourceWithETag<IncomingHL7v2Message>(
      "IncomingHL7v2Message",
      message.id!,
    );

  const taskReference = `Task/${taskId}`;
  const updatedUnmappedCodes = (currentMessage.unmappedCodes || []).filter(
    (code) => code.mappingTask.reference !== taskReference,
  );

  const updatedMessage: IncomingHL7v2Message = {
    ...currentMessage,
    unmappedCodes:
      updatedUnmappedCodes.length > 0 ? updatedUnmappedCodes : undefined,
    status: updatedUnmappedCodes.length === 0 ? "received" : "mapping_error",
  };

  await updateResourceWithETag(
    "IncomingHL7v2Message",
    message.id!,
    updatedMessage,
    etag,
  );
}

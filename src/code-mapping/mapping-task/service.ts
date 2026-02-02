/**
 * Mapping Task Service
 *
 * Async operations for Task resources (fetch, update, resolve).
 */

import type { Task, TaskOutput } from "../../fhir/hl7-fhir-r4-core/Task";
import type { IncomingHL7v2Message } from "../../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import {
  aidboxFetch,
  putResource,
  getResourceWithETag,
  updateResourceWithETag,
} from "../../aidbox";
import { MAPPING_TYPES, isMappingTypeName, type MappingTypeName } from "../mapping-types";

/**
 * Extract the mapping type from a Task's code.
 * Returns the MappingTypeName (e.g., "observation-code-loinc", "obr-status").
 */
export function extractMappingTypeFromTask(task: Task): MappingTypeName {
  const code = task.code?.coding?.[0]?.code;
  if (!code || !isMappingTypeName(code)) {
    throw new Error(`Task ${task.id} has invalid mapping type: ${code}`);
  }
  return code;
}

/**
 * Resolve a mapping task by setting its status to completed and adding the output.
 */
export async function resolveMappingTask(
  taskId: string,
  resolvedCode: string,
  resolvedDisplay: string,
): Promise<void> {
  const task = await aidboxFetch<Task>(`/fhir/Task/${taskId}`);

  const mappingType = extractMappingTypeFromTask(task);
  const typeConfig = MAPPING_TYPES[mappingType];

  const targetSystem = typeConfig.targetSystem;

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

/**
 * Remove a resolved task reference from a message and update its status.
 * If no unmapped codes remain, status changes to "received" for reprocessing.
 *
 * @param messageId - The ID of the IncomingHL7v2Message
 * @param taskId - The Task ID to remove from unmappedCodes
 */
export async function removeTaskFromMessage(
  messageId: string,
  taskId: string,
): Promise<void> {
  const { resource: currentMessage, etag } =
    await getResourceWithETag<IncomingHL7v2Message>(
      "IncomingHL7v2Message",
      messageId,
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
    messageId,
    updatedMessage,
    etag,
  );
}

/**
 * @deprecated Use removeTaskFromMessage(messageId, taskId) instead
 */
export async function removeResolvedTaskFromMessage(
  message: IncomingHL7v2Message,
  taskId: string,
): Promise<void> {
  await removeTaskFromMessage(message.id!, taskId);
}

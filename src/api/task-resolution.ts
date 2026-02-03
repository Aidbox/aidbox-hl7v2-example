/**
 * Task Resolution API
 *
 * Business logic for resolving mapping tasks.
 * Can be called from any UI or external system.
 */

import type { Task } from "../fhir/hl7-fhir-r4-core/Task";
import type { ConceptMap } from "../fhir/hl7-fhir-r4-core/ConceptMap";
import type { IncomingHL7v2Message } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import {
  aidboxFetch,
  getResourceWithETag,
  NotFoundError,
  type Bundle,
} from "../aidbox";
import {
  generateConceptMapId,
  type SenderContext,
  createEmptyConceptMap,
  addMappingToConceptMap,
  buildCompletedTask,
} from "../code-mapping/concept-map";
import {
  getMappingTypeOrFail,
  isMappingTypeName,
  type MappingTypeName,
} from "../code-mapping/mapping-types";
import { removeTaskFromMessage } from "../code-mapping/mapping-task";

/**
 * Get a value from a Task's input array by type text.
 */
export function getTaskInputValue(
  task: Task,
  typeText: string,
): string | undefined {
  return task.input?.find((i) => i.type?.text === typeText)?.valueString;
}

function extractSenderFromTask(task: Task): SenderContext {
  const sendingApplication =
    getTaskInputValue(task, "Sending application") || "";
  const sendingFacility = getTaskInputValue(task, "Sending facility") || "";
  return { sendingApplication, sendingFacility };
}

/**
 * Extract the mapping type from a Task's code.
 */
function extractMappingTypeFromTask(task: Task): MappingTypeName {
  const code = task.code?.coding?.[0]?.code;
  if (!code || !isMappingTypeName(code)) {
    throw new Error(`Task ${task.id} has invalid mapping type: ${code}`);
  }
  return code;
}

/**
 * Resolve a mapping task with atomic ConceptMap update.
 *
 * This function:
 * 1. Fetches the Task and extracts mapping info
 * 2. Creates or updates the ConceptMap with the new mapping
 * 3. Marks the Task as completed
 *
 * All updates are done in a single transaction for consistency.
 */
export async function resolveTaskWithMapping(
  taskId: string,
  resolvedCode: string,
  resolvedDisplay: string,
): Promise<void> {
  const { resource: task, etag: taskEtag } = await getResourceWithETag<Task>(
    "Task",
    taskId,
  );

  if (task.status === "completed") {
    throw new Error(`Task ${taskId} is already completed`);
  }

  const sender = extractSenderFromTask(task);
  const mappingType = extractMappingTypeFromTask(task);
  const typeConfig = getMappingTypeOrFail(mappingType);
  const localCode = getTaskInputValue(task, "Local code") || "";
  const localDisplay = getTaskInputValue(task, "Local display") || "";
  const localSystem = getTaskInputValue(task, "Local system");
  if (!localSystem) {
    throw new Error(`Task ${taskId} is missing required "Local system" input`);
  }

  const conceptMapId = generateConceptMapId(sender, mappingType);

  let conceptMap: ConceptMap;
  let conceptMapEtag: string;
  let isNewConceptMap = false;

  try {
    const result = await getResourceWithETag<ConceptMap>(
      "ConceptMap",
      conceptMapId,
    );
    conceptMap = result.resource;
    conceptMapEtag = result.etag;
  } catch (error) {
    if (error instanceof NotFoundError) {
      conceptMap = createEmptyConceptMap(sender, mappingType);
      conceptMapEtag = "";
      isNewConceptMap = true;
    } else {
      throw error;
    }
  }

  const targetSystem = typeConfig.targetSystem;

  const updatedConceptMap = addMappingToConceptMap(
    conceptMap,
    localSystem,
    localCode,
    localDisplay,
    resolvedCode,
    resolvedDisplay,
    targetSystem,
  );

  const updatedTask = buildCompletedTask(
    task,
    resolvedCode,
    resolvedDisplay,
    targetSystem,
  );

  // Build conditional update for ConceptMap
  const conceptMapCondition = isNewConceptMap
    ? { ifNoneMatch: "*" }
    : conceptMapEtag
      ? { ifMatch: conceptMapEtag }
      : {};

  const bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      {
        resource: updatedTask,
        request: {
          method: "PUT",
          url: `Task/${taskId}`,
          ...(taskEtag ? { ifMatch: taskEtag } : {}),
        },
      },
      {
        resource: updatedConceptMap,
        request: {
          method: "PUT",
          url: `ConceptMap/${conceptMapId}`,
          ...conceptMapCondition,
        },
      },
    ],
  };

  await aidboxFetch("/fhir", {
    method: "POST",
    body: JSON.stringify(bundle),
  });
}

/**
 * Update all messages affected by a resolved task.
 * Removes the task reference from each message's unmappedCodes.
 */
export async function updateAffectedMessages(taskId: string): Promise<void> {
  const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
    `/fhir/IncomingHL7v2Message?status=mapping_error&unmapped-task=Task/${taskId}`,
  );

  const messages = bundle.entry?.map((e) => e.resource) || [];

  for (const message of messages) {
    await removeTaskFromMessage(message.id!, taskId);
  }
}

/**
 * Resolve a mapping task and update all affected messages.
 *
 * This is the main entry point for task resolution. It:
 * 1. Resolves the task with the provided code
 * 2. Updates all affected messages to remove the task reference
 */
export async function resolveTaskAndUpdateMessages(
  taskId: string,
  resolvedCode: string,
  resolvedDisplay: string,
): Promise<void> {
  await resolveTaskWithMapping(taskId, resolvedCode, resolvedDisplay);
  await updateAffectedMessages(taskId);
}

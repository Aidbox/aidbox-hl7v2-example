/**
 * Mapping Tasks Queue - Task resolution and message updates
 *
 * Handles resolving mapping tasks with atomic ConceptMap updates.
 */

import type { Task, TaskOutput } from "../fhir/hl7-fhir-r4-core/Task";
import type { ConceptMap } from "../fhir/hl7-fhir-r4-core/ConceptMap";
import type { IncomingHL7v2Message } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import {
  aidboxFetch,
  getResourceWithETag,
  updateResourceWithETag,
  NotFoundError,
  type Bundle,
} from "../aidbox";
import {
  generateConceptMapId,
  type SenderContext,
  createEmptyConceptMap,
  addMappingToConceptMap,
} from "../code-mapping/concept-map";
import {
  getMappingType,
  getMappingTypeName,
  type MappingTypeName,
} from "../code-mapping/mapping-types";

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
 * Returns the MappingTypeName (e.g., "loinc", "address-type", "obr-status").
 */
function extractMappingTypeFromTask(task: Task): MappingTypeName {
  const taskCode = task.code?.coding?.[0]?.code;
  if (!taskCode) {
    throw new Error(`Task ${task.id} has no code`);
  }
  return getMappingTypeName(taskCode);
}

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
  const typeConfig = getMappingType(task.code!.coding![0]!.code!);
  const localCode = getTaskInputValue(task, "Local code") || "";
  const localDisplay = getTaskInputValue(task, "Local display") || "";
  const localSystem = getTaskInputValue(task, "Local system")!;

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

  const updatedConceptMap = addMappingToConceptMap(
    conceptMap,
    localSystem,
    localCode,
    localDisplay,
    resolvedCode,
    resolvedDisplay,
    typeConfig.targetSystem,
  );

  const output: TaskOutput = {
    type: { text: "Resolved mapping" },
    valueCodeableConcept: {
      coding: [
        {
          system: typeConfig.targetSystem,
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

  // Build conditional update for ConceptMap:
  // - New ConceptMap: use ifNoneMatch to prevent overwriting if created concurrently
  // - Existing ConceptMap with ETag: use ifMatch for optimistic locking
  // - Existing ConceptMap without ETag: skip conditional update (some resources may not have versioning)
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

export async function updateAffectedMessages(taskId: string): Promise<void> {
  const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
    `/fhir/IncomingHL7v2Message?status=mapping_error&unmapped-task=Task/${taskId}`,
  );

  const messages = bundle.entry?.map((e) => e.resource) || [];

  if (messages.length === 0) {
    return;
  }

  const taskReference = `Task/${taskId}`;

  for (const message of messages) {
    const { resource: currentMessage, etag } =
      await getResourceWithETag<IncomingHL7v2Message>(
        "IncomingHL7v2Message",
        message.id!,
      );

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
}

export async function resolveTaskAndUpdateMessages(
  taskId: string,
  resolvedCode: string,
  resolvedDisplay: string,
): Promise<void> {
  await resolveTaskWithMapping(taskId, resolvedCode, resolvedDisplay);
  await updateAffectedMessages(taskId);
}

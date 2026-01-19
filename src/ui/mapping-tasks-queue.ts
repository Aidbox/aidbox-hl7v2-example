/**
 * Mapping Tasks Queue - Task resolution and message updates
 *
 * Handles resolving mapping tasks with atomic ConceptMap updates.
 */

import type { Task, TaskOutput } from "../fhir/hl7-fhir-r4-core/Task";
import type {
  ConceptMap,
  ConceptMapGroupElement,
} from "../fhir/hl7-fhir-r4-core/ConceptMap";
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
  formatSenderAsPublisher,
  type SenderContext,
} from "../code-mapping/concept-map";

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

function createEmptyConceptMap(sender: SenderContext): ConceptMap {
  const id = generateConceptMapId(sender);
  return {
    resourceType: "ConceptMap",
    id,
    name: `HL7v2 ${sender.sendingApplication}/${sender.sendingFacility} to LOINC`,
    status: "active",
    publisher: formatSenderAsPublisher(sender),
    sourceUri: `http://example.org/fhir/CodeSystem/hl7v2-${id.replace("-to-loinc", "")}`,
    targetUri: "http://loinc.org",
    group: [],
  };
}

function addMappingToConceptMap(
  conceptMap: ConceptMap,
  localSystem: string,
  localCode: string,
  localDisplay: string,
  loincCode: string,
  loincDisplay: string,
): ConceptMap {
  const updated = { ...conceptMap };

  if (!updated.group) {
    updated.group = [];
  }

  let group = updated.group.find((g) => g.source === localSystem);

  if (!group) {
    group = {
      source: localSystem,
      target: "http://loinc.org",
      element: [],
    };
    updated.group.push(group);
  }

  if (!group.element) {
    group.element = [];
  }

  const newElement: ConceptMapGroupElement = {
    code: localCode,
    display: localDisplay,
    target: [
      {
        code: loincCode,
        display: loincDisplay,
        equivalence: "equivalent",
      },
    ],
  };

  const existingIndex = group.element.findIndex((e) => e.code === localCode);
  if (existingIndex >= 0) {
    group.element[existingIndex] = newElement;
  } else {
    group.element.push(newElement);
  }

  return updated;
}

export async function resolveTaskWithMapping(
  taskId: string,
  loincCode: string,
  loincDisplay: string,
): Promise<void> {
  const { resource: task, etag: taskEtag } = await getResourceWithETag<Task>(
    "Task",
    taskId,
  );

  if (task.status === "completed") {
    throw new Error(`Task ${taskId} is already completed`);
  }

  const sender = extractSenderFromTask(task);
  const localCode = getTaskInputValue(task, "Local code") || "";
  const localDisplay = getTaskInputValue(task, "Local display") || "";
  const localSystem = getTaskInputValue(task, "Local system") || "";

  const conceptMapId = generateConceptMapId(sender);

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
      conceptMap = createEmptyConceptMap(sender);
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
    loincCode,
    loincDisplay,
  );

  const output: TaskOutput = {
    type: { text: "Resolved LOINC" },
    valueCodeableConcept: {
      coding: [
        {
          system: "http://loinc.org",
          code: loincCode,
          display: loincDisplay,
        },
      ],
      text: loincDisplay,
    },
  };

  const updatedTask: Task = {
    ...task,
    status: "completed",
    lastModified: new Date().toISOString(),
    output: [output],
  };

  const bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      {
        resource: updatedTask,
        request: {
          method: "PUT",
          url: `Task/${taskId}`,
          ifMatch: taskEtag,
        },
      },
      {
        resource: updatedConceptMap,
        request: {
          method: "PUT",
          url: `ConceptMap/${conceptMapId}`,
          ...(isNewConceptMap
            ? { ifNoneMatch: "*" }
            : { ifMatch: conceptMapEtag }),
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
  loincCode: string,
  loincDisplay: string,
): Promise<void> {
  await resolveTaskWithMapping(taskId, loincCode, loincDisplay);
  await updateAffectedMessages(taskId);
}

/**
 * Mapping Task Service
 *
 * Manages FHIR Task resources for tracking unmapped local codes that need LOINC mapping.
 */

import type { Task, TaskInput, TaskOutput } from "../fhir/hl7-fhir-r4-core/Task";
import type { IncomingHL7v2Message } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import {
  aidboxFetch,
  putResource,
  getResourceWithETag,
  updateResourceWithETag,
  type Bundle,
} from "../aidbox";
import { generateConceptMapId, type SenderContext } from "../v2-to-fhir/code-mapping/conceptmap-lookup";

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

export function generateMappingTaskId(
  sender: SenderContext,
  localSystem: string,
  localCode: string
): string {
  const conceptMapId = generateConceptMapId(sender);
  const systemHash = simpleHash(localSystem);
  const codeHash = simpleHash(localCode);
  return `map-${conceptMapId}-${systemHash}-${codeHash}`;
}

export interface CreateMappingTaskParams {
  sender: SenderContext;
  localCode: string;
  localDisplay: string;
  localSystem: string;
  sampleValue?: string;
  sampleUnits?: string;
  sampleReferenceRange?: string;
}

export async function createOrUpdateMappingTask(
  params: CreateMappingTaskParams
): Promise<Task> {
  const taskId = generateMappingTaskId(
    params.sender,
    params.localSystem,
    params.localCode
  );

  const inputs: TaskInput[] = [
    { type: { text: "Sending application" }, valueString: params.sender.sendingApplication },
    { type: { text: "Sending facility" }, valueString: params.sender.sendingFacility },
    { type: { text: "Local code" }, valueString: params.localCode },
    { type: { text: "Local display" }, valueString: params.localDisplay },
    { type: { text: "Local system" }, valueString: params.localSystem },
  ];

  if (params.sampleValue) {
    inputs.push({ type: { text: "Sample value" }, valueString: params.sampleValue });
  }
  if (params.sampleUnits) {
    inputs.push({ type: { text: "Sample units" }, valueString: params.sampleUnits });
  }
  if (params.sampleReferenceRange) {
    inputs.push({ type: { text: "Sample reference range" }, valueString: params.sampleReferenceRange });
  }

  const now = new Date().toISOString();

  const task: Task = {
    resourceType: "Task",
    id: taskId,
    status: "requested",
    intent: "order",
    code: {
      coding: [
        {
          system: "http://example.org/task-codes",
          code: "local-to-loinc-mapping",
          display: "Local code to LOINC mapping",
        },
      ],
      text: "Map local lab code to LOINC",
    },
    authoredOn: now,
    lastModified: now,
    requester: { display: "ORU Processor" },
    owner: { display: "Mapping Team" },
    input: inputs,
  };

  return putResource("Task", taskId, task);
}

export async function resolveMappingTask(
  taskId: string,
  loincCode: string,
  loincDisplay: string
): Promise<void> {
  const task = await aidboxFetch<Task>(`/fhir/Task/${taskId}`);

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

  await putResource("Task", taskId, updatedTask);
}

export async function findAffectedMessages(
  taskId: string
): Promise<IncomingHL7v2Message[]> {
  const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
    `/fhir/IncomingHL7v2Message?status=mapping_error&unmapped-task=Task/${taskId}`
  );

  return bundle.entry?.map((e) => e.resource) || [];
}

export async function removeResolvedTaskFromMessage(
  message: IncomingHL7v2Message,
  taskId: string
): Promise<void> {
  const { resource: currentMessage, etag } = await getResourceWithETag<IncomingHL7v2Message>(
    "IncomingHL7v2Message",
    message.id!
  );

  const taskReference = `Task/${taskId}`;
  const updatedUnmappedCodes = (currentMessage.unmappedCodes || []).filter(
    (code) => code.mappingTask.reference !== taskReference
  );

  const updatedMessage: IncomingHL7v2Message = {
    ...currentMessage,
    unmappedCodes: updatedUnmappedCodes,
    status: updatedUnmappedCodes.length === 0 ? "received" : "mapping_error",
  };

  await updateResourceWithETag(
    "IncomingHL7v2Message",
    message.id!,
    updatedMessage,
    etag
  );
}

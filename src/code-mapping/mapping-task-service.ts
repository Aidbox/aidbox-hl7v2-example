/**
 * Mapping Task Service
 *
 * Manages FHIR Task resources for tracking unmapped local codes that need LOINC mapping.
 */

import type { Task, TaskOutput } from "../fhir/hl7-fhir-r4-core/Task";
import type { IncomingHL7v2Message } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import {
  aidboxFetch,
  putResource,
  getResourceWithETag,
  updateResourceWithETag,
  type Bundle,
} from "../aidbox";
import { simpleHash } from "../utils/string";

export function generateMappingTaskId(
  conceptMapId: string,
  localSystem: string,
  localCode: string,
): string {
  const systemHash = simpleHash(localSystem);
  const codeHash = simpleHash(localCode);
  return `map-${conceptMapId}-${systemHash}-${codeHash}`;
}

export async function resolveMappingTask(
  taskId: string,
  loincCode: string,
  loincDisplay: string,
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
  taskId: string,
): Promise<IncomingHL7v2Message[]> {
  const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
    `/fhir/IncomingHL7v2Message?status=mapping_error&unmapped-task=Task/${taskId}`,
  );

  return bundle.entry?.map((e) => e.resource) || [];
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

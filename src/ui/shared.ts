/**
 * Shared utilities for UI route handlers
 */

import type { Task } from "../fhir/hl7-fhir-r4-core/Task";
import { aidboxFetch, type Bundle } from "../aidbox";
import { MAPPING_TYPES } from "../code-mapping/mapping-types";

export interface NavData {
  pendingMappingTasksCount: number;
  incomingTotal: number;
}

export function htmlResponse(html: string): Response {
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

export function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

async function getPendingTasksCount(): Promise<number> {
  const mappingTypes = Object.keys(MAPPING_TYPES);
  const codeParam = mappingTypes.join(",");
  const bundle = await aidboxFetch<Bundle<Task>>(
    `/fhir/Task?code=${codeParam}&status=requested&_count=0&_total=accurate`,
  );
  return bundle.total || 0;
}

async function getIncomingMessagesTotal(): Promise<number> {
  const bundle = await aidboxFetch<Bundle<{ id?: string }>>(
    "/fhir/IncomingHL7v2Message?_count=0&_total=accurate",
  );
  return bundle.total || 0;
}

export async function getNavData(): Promise<NavData> {
  const [pendingMappingTasksCount, incomingTotal] = await Promise.all([
    getPendingTasksCount(),
    getIncomingMessagesTotal(),
  ]);
  return { pendingMappingTasksCount, incomingTotal };
}

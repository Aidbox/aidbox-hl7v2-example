/**
 * Shared utilities for UI route handlers
 */

import type { Task } from "../fhir/hl7-fhir-r4-core/Task";
import { aidboxFetch, type Bundle } from "../aidbox";
import type { NavData } from "./shared-layout";

export function htmlResponse(html: string): Response {
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

export function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

export async function getPendingTasksCount(): Promise<number> {
  const bundle = await aidboxFetch<Bundle<Task>>(
    "/fhir/Task?code=local-to-loinc-mapping&status=requested&_count=0&_total=accurate",
  );
  return bundle.total || 0;
}

export async function getNavData(): Promise<NavData> {
  const pendingMappingTasksCount = await getPendingTasksCount();
  return { pendingMappingTasksCount };
}

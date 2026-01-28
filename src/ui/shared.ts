/**
 * Shared utilities for UI route handlers
 */

import type { Task } from "../fhir/hl7-fhir-r4-core/Task";
import { aidboxFetch, type Bundle } from "../aidbox";
import type { NavData } from "./shared-layout";
import { MAPPING_TYPES, LEGACY_TASK_CODE_ALIASES } from "../code-mapping/mapping-types";

export function htmlResponse(html: string): Response {
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

export function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

/**
 * Get all mapping task codes (current + legacy) for querying pending tasks.
 */
function getAllMappingTaskCodes(): string[] {
  const currentCodes = Object.values(MAPPING_TYPES).map((t) => t.taskCode);
  const legacyCodes = Object.keys(LEGACY_TASK_CODE_ALIASES);
  return [...currentCodes, ...legacyCodes];
}

export async function getPendingTasksCount(): Promise<number> {
  // Query all mapping task types (both current and legacy codes)
  const taskCodes = getAllMappingTaskCodes();
  const codeParam = taskCodes.join(",");
  const bundle = await aidboxFetch<Bundle<Task>>(
    `/fhir/Task?code=${codeParam}&status=requested&_count=0&_total=accurate`,
  );
  return bundle.total || 0;
}

export async function getNavData(): Promise<NavData> {
  const pendingMappingTasksCount = await getPendingTasksCount();
  return { pendingMappingTasksCount };
}

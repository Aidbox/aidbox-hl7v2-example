/**
 * Mapping Tasks UI Module
 *
 * Displays the Mapping Tasks page.
 */

import type { Task } from "../../fhir/hl7-fhir-r4-core/Task";
import { aidboxFetch, type Bundle } from "../../aidbox";
import { escapeHtml } from "../../utils/html";
import { parsePageParam, createPagination, PAGE_SIZE, renderPaginationControls, type PaginationData } from "../pagination";
import { renderNav, renderLayout, type NavData } from "../shared-layout";
import { htmlResponse, getNavData } from "../shared";
import { MAPPING_TYPES, type MappingTypeName, getMappingTypeName } from "../../code-mapping/mapping-types";
import { getValidValuesWithDisplay } from "../../code-mapping/validation";
import { getMappingTypeShortLabel } from "../mapping-type-ui";

/**
 * UI filter types - "status" is a special category that groups OBR and OBX status mappings
 */
export type MappingTypeFilter = MappingTypeName | "all" | "status";

/**
 * Get display name for a mapping type filter
 */
export function getMappingTypeFilterDisplay(filter: MappingTypeFilter): string {
  if (filter === "all") return "All";
  if (filter === "status") return "Status";
  return MAPPING_TYPES[filter].taskDisplay.replace(" mapping", "");
}

/**
 * Get task codes for a filter
 */
function getTaskCodesForFilter(filter: MappingTypeFilter): string[] {
  if (filter === "all") {
    // Include legacy code for backward compatibility
    return ["local-to-loinc-mapping", ...Object.values(MAPPING_TYPES).map(t => t.taskCode)];
  }
  if (filter === "status") {
    return [MAPPING_TYPES["obr-status"].taskCode, MAPPING_TYPES["obx-status"].taskCode];
  }
  // Legacy LOINC code support
  if (filter === "loinc") {
    return ["local-to-loinc-mapping", MAPPING_TYPES.loinc.taskCode];
  }
  return [MAPPING_TYPES[filter].taskCode];
}

/**
 * Parse type filter from URL parameter
 */
export function parseTypeFilter(typeParam: string | null): MappingTypeFilter {
  if (!typeParam) return "all";
  if (typeParam === "all" || typeParam === "status") return typeParam;
  if (typeParam in MAPPING_TYPES) return typeParam as MappingTypeName;
  return "all";
}

// ============================================================================
// Handler Functions (exported)
// ============================================================================

export async function handleMappingTasksPage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const typeParam = url.searchParams.get("type");
  const errorParam = url.searchParams.get("error");
  const statusFilter: "requested" | "completed" =
    status === "completed" ? "completed" : "requested";
  const typeFilter = parseTypeFilter(typeParam);
  const requestedPage = parsePageParam(url.searchParams);

  const [tasksResult, navData] = await Promise.all([
    getMappingTasks(statusFilter, requestedPage, typeFilter),
    getNavData(),
  ]);

  const pagination = createPagination(requestedPage, tasksResult.total);

  return htmlResponse(
    renderMappingTasksPage(navData, tasksResult.tasks, statusFilter, typeFilter, pagination, errorParam),
  );
}

// ============================================================================
// Helper Functions (internal)
// ============================================================================

export function getTaskInputValue(
  task: Task,
  typeText: string,
): string | undefined {
  return task.input?.find((i) => i.type?.text === typeText)?.valueString;
}

/**
 * Get the mapping type from a task's code
 */
export function getTaskMappingType(task: Task): MappingTypeName | undefined {
  const taskCode = task.code?.coding?.[0]?.code;
  if (!taskCode) return undefined;
  try {
    return getMappingTypeName(taskCode);
  } catch {
    return undefined;
  }
}

/**
 * Get the resolved mapping output from a task.
 * Supports both "Resolved LOINC" (legacy) and "Resolved mapping" (new) output types.
 */
export function getTaskOutputMapping(
  task: Task,
): { code: string; display: string } | undefined {
  // Support both legacy "Resolved LOINC" and new "Resolved mapping" output types
  const output = task.output?.find(
    (o) => o.type?.text === "Resolved mapping" || o.type?.text === "Resolved LOINC"
  );
  const coding = output?.valueCodeableConcept?.coding?.[0];
  if (coding?.code) {
    return { code: coding.code, display: coding.display || "" };
  }
  return undefined;
}

// ============================================================================
// Service Functions (internal)
// ============================================================================

/**
 * Get mapping tasks with optional type filtering.
 * Exported for testing.
 */
export async function getMappingTasks(
  status: "requested" | "completed",
  page = 1,
  typeFilter: MappingTypeFilter = "all",
): Promise<{ tasks: Task[]; total: number }> {
  // Sort pending tasks by oldest first, completed by newest first
  const sortOrder =
    status === "requested" ? "_sort=_lastUpdated" : "_sort=-_lastUpdated";

  // Build code filter - multiple codes use comma-separated values
  const taskCodes = getTaskCodesForFilter(typeFilter);
  const codeParam = taskCodes.join(",");

  const bundle = await aidboxFetch<Bundle<Task>>(
    `/fhir/Task?code=${encodeURIComponent(codeParam)}&status=${status}&${sortOrder}&_count=${PAGE_SIZE}&_page=${page}`,
  );
  return {
    tasks: bundle.entry?.map((e) => e.resource) || [],
    total: bundle.total ?? 0,
  };
}

// ============================================================================
// Rendering Functions (internal)
// ============================================================================

/**
 * Available type filter options for the UI
 */
const TYPE_FILTER_OPTIONS: MappingTypeFilter[] = ["all", "loinc", "patient-class", "status"];

/**
 * Build URL for a filter combination
 */
function buildFilterUrl(status: "requested" | "completed", typeFilter: MappingTypeFilter): string {
  const params = new URLSearchParams();
  params.set("status", status);
  if (typeFilter !== "all") {
    params.set("type", typeFilter);
  }
  return `/mapping/tasks?${params.toString()}`;
}

/**
 * Render the mapping tasks page.
 * Exported for testing.
 */
export function renderMappingTasksPage(
  navData: NavData,
  tasks: Task[],
  statusFilter: "requested" | "completed",
  typeFilter: MappingTypeFilter,
  pagination: PaginationData,
  errorMessage: string | null,
): string {
  const isPending = statusFilter === "requested";
  const pendingCount = navData.pendingMappingTasksCount;

  const content = `
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Mapping Tasks</h1>

    ${
      errorMessage
        ? `
      <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        ${escapeHtml(errorMessage)}
      </div>
    `
        : ""
    }

    <div class="mb-4 flex gap-2">
      <a href="${buildFilterUrl("requested", typeFilter)}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${isPending ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
        Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}
      </a>
      <a href="${buildFilterUrl("completed", typeFilter)}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${!isPending ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
        History
      </a>
    </div>

    <div class="mb-4 flex gap-2 flex-wrap">
      ${TYPE_FILTER_OPTIONS.map(filter => {
        const isActive = filter === typeFilter;
        const href = buildFilterUrl(statusFilter, filter);
        return `<a href="${href}" class="px-2 py-1 rounded text-xs font-medium ${isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}">${escapeHtml(getMappingTypeFilterDisplay(filter))}</a>`;
      }).join("\n      ")}
    </div>

    <ul class="space-y-2">
      ${
        tasks.length === 0
          ? '<li class="bg-white rounded-lg shadow p-8 text-center text-gray-500">No tasks found</li>'
          : tasks
              .map((task) => renderMappingTaskPanel(task, isPending))
              .join("")
      }
    </ul>
    <div class="mt-4 flex items-center justify-between">
      <p class="text-sm text-gray-500">Total: ${pagination.total} tasks</p>
      ${renderPaginationControls({
        pagination,
        baseUrl: "/mapping/tasks",
        filterParams: { status: statusFilter, ...(typeFilter !== "all" ? { type: typeFilter } : {}) },
      })}
    </div>`;

  return renderLayout(
    "Mapping Tasks",
    renderNav("mapping-tasks", navData),
    content,
  );
}

/**
 * Render the resolution form based on task type.
 * LOINC tasks use autocomplete, others use a simple dropdown of valid values.
 */
function renderResolutionForm(task: Task, mappingType: MappingTypeName): string {
  const taskId = task.id;

  if (mappingType === "loinc") {
    return `
      <div class="mt-3 pt-3 border-t border-gray-100">
        <form method="POST" action="/api/mapping/tasks/${taskId}/resolve" class="flex items-end gap-3">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-1">Map to LOINC Code</label>
            <input type="text" name="loincCode" required placeholder="Search LOINC codes..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-loinc-autocomplete>
            <input type="hidden" name="loincDisplay">
          </div>
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Save Mapping
          </button>
        </form>
      </div>`;
  }

  // For non-LOINC types, render a dropdown with allowed values
  const typeConfig = MAPPING_TYPES[mappingType];
  const options = getValidValuesWithDisplay(mappingType);
  const targetLabel = typeConfig.targetFieldLabel.split(".").pop() || "value";

  return `
    <div class="mt-3 pt-3 border-t border-gray-100">
      <form method="POST" action="/api/mapping/tasks/${taskId}/resolve" class="flex items-end gap-3">
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-1">Map to ${escapeHtml(targetLabel)}</label>
          <select name="resolvedCode" required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onchange="this.form.resolvedDisplay.value = this.selectedOptions[0]?.dataset.display || ''">
            <option value="">Select a value...</option>
            ${options.map(opt => `<option value="${escapeHtml(opt.code)}" data-display="${escapeHtml(opt.display)}">${escapeHtml(opt.code)} - ${escapeHtml(opt.display)}</option>`).join("\n            ")}
          </select>
          <input type="hidden" name="resolvedDisplay" value="">
        </div>
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Save Mapping
        </button>
      </form>
    </div>`;
}


/**
 * Render a single mapping task panel.
 * Exported for testing.
 */
export function renderMappingTaskPanel(task: Task, isPending: boolean): string {
  const sender = `${getTaskInputValue(task, "Sending application") || "?"} | ${getTaskInputValue(task, "Sending facility") || "?"}`;
  const localCode = getTaskInputValue(task, "Local code") || "-";
  const localDisplay = getTaskInputValue(task, "Local display") || "";
  const localSystem = getTaskInputValue(task, "Local system") || "-";
  const sourceField = getTaskInputValue(task, "Source field");
  const targetField = getTaskInputValue(task, "Target field");
  const sampleValue = getTaskInputValue(task, "Sample value");
  const sampleUnits = getTaskInputValue(task, "Sample units");
  const sampleRange = getTaskInputValue(task, "Sample range");
  const resolvedMapping = getTaskOutputMapping(task);
  const mappingType = getTaskMappingType(task);

  const dateStr = task.authoredOn
    ? new Date(task.authoredOn).toLocaleString()
    : "-";

  const statusBadge = isPending
    ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>'
    : '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Completed</span>';

  const typeBadge = mappingType
    ? `<span class="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">${escapeHtml(getMappingTypeShortLabel(mappingType))}</span>`
    : "";

  return `
    <li class="bg-white rounded-lg shadow">
      <details class="group">
        <summary class="cursor-pointer list-none p-4 flex items-center justify-between hover:bg-gray-50 rounded-lg">
          <div class="flex items-center gap-3">
            <svg class="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
            ${typeBadge}
            <span class="text-sm text-gray-600">${escapeHtml(sender)}</span>
            <span class="font-mono text-sm font-medium">${escapeHtml(localCode)}</span>
            ${localDisplay ? `<span class="text-sm text-gray-500">${escapeHtml(localDisplay)}</span>` : ""}
            ${statusBadge}
          </div>
          <div class="text-sm text-gray-500">${dateStr}</div>
        </summary>
        <div class="px-4 pb-4 border-t border-gray-100">
          <div class="grid grid-cols-2 gap-4 py-3 text-sm">
            <div>
              <span class="text-gray-500">Sender:</span>
              <span class="ml-2 font-medium">${escapeHtml(sender)}</span>
            </div>
            <div>
              <span class="text-gray-500">Local System:</span>
              <span class="ml-2 font-mono">${escapeHtml(localSystem)}</span>
            </div>
            <div>
              <span class="text-gray-500">Local Code:</span>
              <span class="ml-2 font-mono font-medium">${escapeHtml(localCode)}</span>
            </div>
            <div>
              <span class="text-gray-500">Local Display:</span>
              <span class="ml-2">${escapeHtml(localDisplay || "-")}</span>
            </div>
            ${sourceField ? `
            <div>
              <span class="text-gray-500">Source Field:</span>
              <span class="ml-2 font-mono">${escapeHtml(sourceField)}</span>
            </div>
            ` : ""}
            ${targetField ? `
            <div>
              <span class="text-gray-500">Target Field:</span>
              <span class="ml-2 font-mono">${escapeHtml(targetField)}</span>
            </div>
            ` : ""}
            ${
              sampleValue
                ? `
            <div>
              <span class="text-gray-500">Sample Value:</span>
              <span class="ml-2 font-mono">${escapeHtml(sampleValue)}${sampleUnits ? ` ${escapeHtml(sampleUnits)}` : ""}</span>
            </div>
            `
                : ""
            }
            ${
              sampleRange
                ? `
            <div>
              <span class="text-gray-500">Reference Range:</span>
              <span class="ml-2 font-mono">${escapeHtml(sampleRange)}</span>
            </div>
            `
                : ""
            }
          </div>
          ${
            isPending && mappingType
              ? renderResolutionForm(task, mappingType)
              : isPending
                ? `
          <div class="mt-3 pt-3 border-t border-gray-100">
            <form method="POST" action="/api/mapping/tasks/${task.id}/resolve" class="flex items-end gap-3">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">Map to Code</label>
                <input type="text" name="loincCode" required placeholder="Enter code..."
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <input type="hidden" name="loincDisplay">
              </div>
              <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Save Mapping
              </button>
            </form>
          </div>
          `
                : `
          <div class="mt-3 pt-3 border-t border-gray-100">
            <span class="text-gray-500 text-sm">Resolved to:</span>
            <span class="ml-2 font-mono text-sm font-medium text-green-700">${resolvedMapping ? escapeHtml(resolvedMapping.code) : "-"}</span>
            ${resolvedMapping?.display ? `<span class="ml-2 text-sm text-gray-600">${escapeHtml(resolvedMapping.display)}</span>` : ""}
          </div>
          `
          }
        </div>
      </details>
    </li>
  `;
}

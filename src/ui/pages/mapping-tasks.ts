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

// ============================================================================
// Handler Functions (exported)
// ============================================================================

export async function handleMappingTasksPage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const errorParam = url.searchParams.get("error");
  const statusFilter: "requested" | "completed" =
    status === "completed" ? "completed" : "requested";
  const requestedPage = parsePageParam(url.searchParams);

  const [tasksResult, navData] = await Promise.all([
    getMappingTasks(statusFilter, requestedPage),
    getNavData(),
  ]);

  const pagination = createPagination(requestedPage, tasksResult.total);

  return htmlResponse(
    renderMappingTasksPage(navData, tasksResult.tasks, statusFilter, pagination, errorParam),
  );
}

// ============================================================================
// Helper Functions (internal)
// ============================================================================

function getTaskInputValue(
  task: Task,
  typeText: string,
): string | undefined {
  return task.input?.find((i) => i.type?.text === typeText)?.valueString;
}

function getTaskOutputLoinc(
  task: Task,
): { code: string; display: string } | undefined {
  const output = task.output?.find((o) => o.type?.text === "Resolved LOINC");
  const coding = output?.valueCodeableConcept?.coding?.[0];
  if (coding?.code) {
    return { code: coding.code, display: coding.display || "" };
  }
  return undefined;
}

// ============================================================================
// Service Functions (internal)
// ============================================================================

async function getMappingTasks(
  status: "requested" | "completed",
  page = 1,
): Promise<{ tasks: Task[]; total: number }> {
  // Sort pending tasks by oldest first, completed by newest first
  const sortOrder =
    status === "requested" ? "_sort=_lastUpdated" : "_sort=-_lastUpdated";
  const bundle = await aidboxFetch<Bundle<Task>>(
    `/fhir/Task?code=local-to-loinc-mapping&status=${status}&${sortOrder}&_count=${PAGE_SIZE}&_page=${page}`,
  );
  return {
    tasks: bundle.entry?.map((e) => e.resource) || [],
    total: bundle.total ?? 0,
  };
}

// ============================================================================
// Rendering Functions (internal)
// ============================================================================

function renderMappingTasksPage(
  navData: NavData,
  tasks: Task[],
  statusFilter: "requested" | "completed",
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
      <a href="/mapping/tasks?status=requested" class="px-3 py-1.5 rounded-lg text-sm font-medium ${isPending ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
        Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}
      </a>
      <a href="/mapping/tasks?status=completed" class="px-3 py-1.5 rounded-lg text-sm font-medium ${!isPending ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
        History
      </a>
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
        filterParams: { status: statusFilter },
      })}
    </div>`;

  return renderLayout(
    "Mapping Tasks",
    renderNav("mapping-tasks", navData),
    content,
  );
}

function renderMappingTaskPanel(task: Task, isPending: boolean): string {
  const sender = `${getTaskInputValue(task, "Sending application") || "?"} | ${getTaskInputValue(task, "Sending facility") || "?"}`;
  const localCode = getTaskInputValue(task, "Local code") || "-";
  const localDisplay = getTaskInputValue(task, "Local display") || "";
  const localSystem = getTaskInputValue(task, "Local system") || "-";
  const sampleValue = getTaskInputValue(task, "Sample value");
  const sampleUnits = getTaskInputValue(task, "Sample units");
  const sampleRange = getTaskInputValue(task, "Sample range");
  const resolvedLoinc = getTaskOutputLoinc(task);

  const dateStr = task.authoredOn
    ? new Date(task.authoredOn).toLocaleString()
    : "-";

  const statusBadge = isPending
    ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>'
    : '<span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Completed</span>';

  return `
    <li class="bg-white rounded-lg shadow">
      <details class="group">
        <summary class="cursor-pointer list-none p-4 flex items-center justify-between hover:bg-gray-50 rounded-lg">
          <div class="flex items-center gap-3">
            <svg class="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
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
            isPending
              ? `
          <div class="mt-3 pt-3 border-t border-gray-100">
            <form method="POST" action="/api/mapping/tasks/${task.id}/resolve" class="flex items-end gap-3">
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
          </div>
          `
              : `
          <div class="mt-3 pt-3 border-t border-gray-100">
            <span class="text-gray-500 text-sm">Resolved to:</span>
            <span class="ml-2 font-mono text-sm font-medium text-green-700">${resolvedLoinc ? escapeHtml(resolvedLoinc.code) : "-"}</span>
            ${resolvedLoinc?.display ? `<span class="ml-2 text-sm text-gray-600">${escapeHtml(resolvedLoinc.display)}</span>` : ""}
          </div>
          `
          }
        </div>
      </details>
    </li>
  `;
}

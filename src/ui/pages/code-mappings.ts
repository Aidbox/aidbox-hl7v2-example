/**
 * Code Mappings Page
 *
 * Displays and manages ConceptMap entries for local-to-LOINC mappings.
 */

import type { ConceptMap } from "../../fhir/hl7-fhir-r4-core/ConceptMap";
import type { Task, TaskOutput } from "../../fhir/hl7-fhir-r4-core/Task";
import {
  aidboxFetch,
  getResourceWithETag,
  updateResourceWithETag,
  NotFoundError,
  type Bundle,
} from "../../aidbox";
import { escapeHtml } from "../../utils/html";
import { generateMappingTaskId } from "../../code-mapping/mapping-task-service";
import { addMappingToConceptMap } from "../../code-mapping/concept-map";
import {
  parsePageParam,
  createPagination,
  PAGE_SIZE,
  renderPaginationControls,
  type PaginationData,
} from "../pagination";
import { updateAffectedMessages } from "../mapping-tasks-queue";
import { renderNav, renderLayout, type NavData } from "../shared-layout";
import { htmlResponse, getNavData } from "../shared";

// ============================================================================
// Types (exported for testing)
// ============================================================================

export interface ConceptMapSummary {
  id: string;
  displayName: string;
}

export interface MappingEntry {
  localCode: string;
  localDisplay: string;
  localSystem: string;
  loincCode: string;
  loincDisplay: string;
}

// ============================================================================
// Handler Functions (exported)
// ============================================================================

export async function handleCodeMappingsPage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const conceptMapId = url.searchParams.get("conceptMapId");
  const showAdd = url.searchParams.get("add") === "true";
  const errorParam = url.searchParams.get("error");
  const requestedPage = parsePageParam(url.searchParams);

  const [conceptMaps, navData] = await Promise.all([
    listConceptMaps(),
    getNavData(),
  ]);

  let entries: MappingEntry[] = [];
  let total = 0;
  let loadError: string | null = errorParam;

  if (conceptMapId) {
    try {
      const result = await getMappingsFromConceptMap(conceptMapId, requestedPage);
      entries = result.entries;
      total = result.total;
    } catch (error) {
      console.error("Error loading ConceptMap:", error);
      loadError = "Failed to load ConceptMap";
    }
  }

  const pagination = createPagination(requestedPage, total);

  return htmlResponse(
    renderCodeMappingsPage(navData, conceptMaps, conceptMapId, entries, pagination, showAdd, loadError),
  );
}

// ============================================================================
// Service Functions (exported for testing and API operations)
// ============================================================================

/**
 * List all ConceptMaps for sender dropdown
 */
export async function listConceptMaps(): Promise<ConceptMapSummary[]> {
  const bundle = await aidboxFetch<Bundle<ConceptMap>>(
    "/fhir/ConceptMap?_count=100",
  );

  const conceptMaps = bundle.entry?.map((e) => e.resource) || [];

  return conceptMaps
    .filter((cm) => cm.targetUri === "http://loinc.org")
    .map((cm) => ({
      id: cm.id!,
      displayName: cm.title || cm.id!,
    }));
}

/**
 * Get paginated mapping entries from a ConceptMap
 */
export async function getMappingsFromConceptMap(
  conceptMapId: string,
  page: number,
): Promise<{ entries: MappingEntry[]; total: number }> {
  const conceptMap = await aidboxFetch<ConceptMap>(
    `/fhir/ConceptMap/${conceptMapId}`,
  );

  const allEntries: MappingEntry[] = [];

  for (const group of conceptMap.group || []) {
    for (const element of group.element || []) {
      const target = element.target?.[0];
      allEntries.push({
        localCode: element.code || "",
        localDisplay: element.display || "",
        localSystem: group.source || "",
        loincCode: target?.code || "",
        loincDisplay: target?.display || "",
      });
    }
  }

  const total = allEntries.length;
  const startIndex = (page - 1) * PAGE_SIZE;
  const entries = allEntries.slice(startIndex, startIndex + PAGE_SIZE);

  return { entries, total };
}

/**
 * Check if a mapping entry already exists
 */
function checkDuplicateEntry(
  conceptMap: ConceptMap,
  localSystem: string,
  localCode: string,
): boolean {
  for (const group of conceptMap.group || []) {
    if (group.source !== localSystem) continue;
    for (const element of group.element || []) {
      if (element.code === localCode) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Build a completed Task with LOINC resolution output
 */
function buildCompletedTask(
  task: Task,
  loincCode: string,
  loincDisplay: string,
): Task {
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

  return {
    ...task,
    status: "completed",
    lastModified: new Date().toISOString(),
    output: [output],
  };
}

/**
 * Add a new entry to a ConceptMap.
 * Uses atomic transaction when a matching Task exists.
 */
export async function addConceptMapEntry(
  conceptMapId: string,
  localCode: string,
  localDisplay: string,
  localSystem: string,
  loincCode: string,
  loincDisplay: string,
): Promise<{ success: boolean; error?: string }> {
  const { resource: conceptMap, etag: conceptMapEtag } =
    await getResourceWithETag<ConceptMap>("ConceptMap", conceptMapId);

  // Check for duplicate
  if (checkDuplicateEntry(conceptMap, localSystem, localCode)) {
    return {
      success: false,
      error: `Mapping already exists for code "${localCode}" in system "${localSystem}"`,
    };
  }

  // Prepare updated ConceptMap
  const updatedConceptMap = addMappingToConceptMap(
    conceptMap,
    localSystem,
    localCode,
    localDisplay,
    loincCode,
    loincDisplay,
  );

  // Check if a matching Task exists
  const taskId = generateMappingTaskId(conceptMapId, localSystem, localCode);
  let task: Task | null = null;
  let taskEtag: string = "";

  try {
    const result = await getResourceWithETag<Task>("Task", taskId);
    if (result.resource.status === "requested") {
      task = result.resource;
      taskEtag = result.etag;
    }
  } catch (error) {
    if (!(error instanceof NotFoundError)) {
      throw error;
    }
    // Task doesn't exist - that's fine
  }

  if (task) {
    // Atomic transaction: update ConceptMap AND complete Task together
    const completedTask = buildCompletedTask(task, loincCode, loincDisplay);

    const bundle = {
      resourceType: "Bundle",
      type: "transaction",
      entry: [
        {
          resource: updatedConceptMap,
          request: {
            method: "PUT",
            url: `ConceptMap/${conceptMapId}`,
            ifMatch: conceptMapEtag,
          },
        },
        {
          resource: completedTask,
          request: {
            method: "PUT",
            url: `Task/${taskId}`,
            ifMatch: taskEtag,
          },
        },
      ],
    };

    await aidboxFetch("/fhir", {
      method: "POST",
      body: JSON.stringify(bundle),
    });

    // Update affected messages (non-critical, log warning if fails)
    try {
      await updateAffectedMessages(taskId);
    } catch (updateError) {
      console.warn(
        `Failed to update affected messages for task ${taskId}:`,
        updateError,
      );
    }
  } else {
    // No matching Task - just update ConceptMap
    await updateResourceWithETag(
      "ConceptMap",
      conceptMapId,
      updatedConceptMap,
      conceptMapEtag,
    );
  }

  return { success: true };
}

/**
 * Update an existing entry in a ConceptMap
 */
export async function updateConceptMapEntry(
  conceptMapId: string,
  localCode: string,
  localSystem: string,
  newLoincCode: string,
  newLoincDisplay: string,
): Promise<{ success: boolean; error?: string }> {
  const { resource: conceptMap, etag } = await getResourceWithETag<ConceptMap>(
    "ConceptMap",
    conceptMapId,
  );

  // Find the element
  let found = false;
  for (const group of conceptMap.group || []) {
    if (group.source !== localSystem) continue;
    for (const element of group.element || []) {
      if (element.code === localCode) {
        // Update the target
        element.target = [
          {
            code: newLoincCode,
            display: newLoincDisplay,
            equivalence: "equivalent",
          },
        ];
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    return {
      success: false,
      error: `Mapping not found for code "${localCode}" in system "${localSystem}"`,
    };
  }

  // Save
  await updateResourceWithETag("ConceptMap", conceptMapId, conceptMap, etag);

  return { success: true };
}

/**
 * Delete an entry from a ConceptMap
 */
export async function deleteConceptMapEntry(
  conceptMapId: string,
  localCode: string,
  localSystem: string,
): Promise<void> {
  const { resource: conceptMap, etag } = await getResourceWithETag<ConceptMap>(
    "ConceptMap",
    conceptMapId,
  );

  // Find and remove the element
  for (const group of conceptMap.group || []) {
    if (group.source !== localSystem) continue;
    if (group.element) {
      group.element = group.element.filter((e) => e.code !== localCode);
    }
  }

  // Remove empty groups
  if (conceptMap.group) {
    conceptMap.group = conceptMap.group.filter(
      (g) => g.element && g.element.length > 0,
    );
  }

  // Save
  await updateResourceWithETag("ConceptMap", conceptMapId, conceptMap, etag);
}

// ============================================================================
// Rendering Functions (internal)
// ============================================================================

function renderCodeMappingsPage(
  navData: NavData,
  conceptMaps: ConceptMapSummary[],
  selectedConceptMapId: string | null,
  entries: MappingEntry[],
  pagination: PaginationData,
  showAddForm: boolean,
  errorMessage: string | null,
): string {
  const content = `
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Code Mappings</h1>

    ${
      errorMessage
        ? `
      <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        ${escapeHtml(errorMessage)}
      </div>
    `
        : ""
    }

    <div class="mb-6 flex items-center gap-4">
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">Filter by Sender</label>
        <select onchange="window.location.href = this.value ? '/mapping/table?conceptMapId=' + this.value : '/mapping/table'"
          class="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">Select a sender...</option>
          ${conceptMaps
            .map(
              (cm) =>
                `<option value="${cm.id}" ${cm.id === selectedConceptMapId ? "selected" : ""}>${escapeHtml(cm.displayName)}</option>`,
            )
            .join("")}
        </select>
      </div>
      ${
        selectedConceptMapId
          ? `
        <div class="pt-6">
          <a href="/mapping/table?conceptMapId=${selectedConceptMapId}&add=true"
            class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Add Mapping
          </a>
        </div>
      `
          : ""
      }
    </div>

    ${
      showAddForm && selectedConceptMapId
        ? renderAddMappingForm(selectedConceptMapId)
        : ""
    }

    ${
      selectedConceptMapId
        ? `
      <ul class="space-y-2">
        ${
          entries.length === 0
            ? '<li class="bg-white rounded-lg shadow p-8 text-center text-gray-500">No mappings found</li>'
            : entries
                .map((entry) =>
                  renderMappingEntryPanel(entry, selectedConceptMapId),
                )
                .join("")
        }
      </ul>
      <div class="mt-4 flex items-center justify-between">
        <p class="text-sm text-gray-500">Total: ${pagination.total} mappings</p>
        ${renderPaginationControls({
          pagination,
          baseUrl: "/mapping/table",
          filterParams: { conceptMapId: selectedConceptMapId },
        })}
      </div>
    `
        : `
      <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        ${
          conceptMaps.length === 0
            ? "No ConceptMaps found. Create mappings by resolving tasks in the Mapping Tasks page."
            : "Select a sender to view and manage code mappings."
        }
      </div>
    `
    }
  `;

  return renderLayout(
    "Code Mappings",
    renderNav("code-mappings", navData),
    content,
  );
}

function renderAddMappingForm(conceptMapId: string): string {
  return `
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Add New Mapping</h2>
      <form method="POST" action="/api/concept-maps/${conceptMapId}/entries" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Local System</label>
            <input type="text" name="localSystem" required placeholder="e.g., ACME-LAB-CODES"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Local Code</label>
            <input type="text" name="localCode" required placeholder="e.g., K_SERUM"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Local Display</label>
          <input type="text" name="localDisplay" placeholder="e.g., Potassium [Serum/Plasma]"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Map to LOINC Code</label>
          <input type="text" name="loincCode" required placeholder="Search LOINC codes..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-loinc-autocomplete>
          <input type="hidden" name="loincDisplay">
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
            Create Mapping
          </button>
          <a href="/mapping/table?conceptMapId=${conceptMapId}" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300">
            Cancel
          </a>
        </div>
      </form>
    </div>
  `;
}

function renderMappingEntryPanel(
  entry: MappingEntry,
  conceptMapId: string,
): string {
  const encodedLocalCode = encodeURIComponent(entry.localCode);
  const encodedLocalSystem = encodeURIComponent(entry.localSystem);

  return `
    <li class="bg-white rounded-lg shadow">
      <details class="group">
        <summary class="cursor-pointer list-none p-4 flex items-center justify-between hover:bg-gray-50 rounded-lg">
          <div class="flex items-center gap-3">
            <svg class="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
            <span class="font-mono text-sm font-medium">${escapeHtml(entry.localCode)}</span>
            ${entry.localDisplay ? `<span class="text-sm text-gray-500">${escapeHtml(entry.localDisplay)}</span>` : ""}
            <span class="text-gray-400">→</span>
            <span class="font-mono text-sm font-medium text-green-700">${escapeHtml(entry.loincCode)}</span>
            ${entry.loincDisplay ? `<span class="text-sm text-gray-600">${escapeHtml(entry.loincDisplay)}</span>` : ""}
          </div>
          <span class="text-xs text-gray-400">${escapeHtml(entry.localSystem)}</span>
        </summary>
        <div class="px-4 pb-4 border-t border-gray-100">
          <div class="grid grid-cols-2 gap-4 py-3 text-sm">
            <div>
              <span class="text-gray-500">Local System:</span>
              <span class="ml-2 font-mono">${escapeHtml(entry.localSystem)}</span>
            </div>
            <div>
              <span class="text-gray-500">Local Code:</span>
              <span class="ml-2 font-mono font-medium">${escapeHtml(entry.localCode)}</span>
            </div>
            <div>
              <span class="text-gray-500">Local Display:</span>
              <span class="ml-2">${escapeHtml(entry.localDisplay || "-")}</span>
            </div>
            <div>
              <span class="text-gray-500">LOINC Code:</span>
              <span class="ml-2 font-mono font-medium text-green-700">${escapeHtml(entry.loincCode)}</span>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-100">
            <form method="POST" action="/api/concept-maps/${conceptMapId}/entries/${encodedLocalCode}" class="flex items-end gap-3">
              <input type="hidden" name="localSystem" value="${escapeHtml(entry.localSystem)}">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">Update LOINC Code</label>
                <input type="text" name="loincCode" value="${escapeHtml(entry.loincCode)}" required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-loinc-autocomplete>
                <input type="hidden" name="loincDisplay" value="${escapeHtml(entry.loincDisplay)}">
              </div>
              <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Save
              </button>
            </form>
            <form method="POST" action="/api/concept-maps/${conceptMapId}/entries/${encodedLocalCode}/delete"
              class="mt-3" onsubmit="return confirm('Delete this mapping?')">
              <input type="hidden" name="localSystem" value="${escapeHtml(entry.localSystem)}">
              <button type="submit" class="text-sm text-red-600 hover:text-red-800">
                Delete Mapping
              </button>
            </form>
          </div>
        </div>
      </details>
    </li>
  `;
}

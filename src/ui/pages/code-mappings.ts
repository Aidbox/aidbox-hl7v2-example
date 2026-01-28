/**
 * Code Mappings Page
 *
 * Displays and manages ConceptMap entries for code mappings.
 * Supports multiple mapping types: LOINC, address type, patient class, OBR/OBX status.
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
  MAPPING_TYPES,
  type MappingTypeName,
  isMappingTypeName,
} from "../../code-mapping/mapping-types";
import { getValidValuesWithDisplay } from "../../code-mapping/validation";
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

/**
 * Mapping type filter options for the UI.
 * "all" shows all mapping types.
 */
export type MappingTypeFilter = MappingTypeName | "all";

export interface ConceptMapSummary {
  id: string;
  displayName: string;
  mappingType: MappingTypeName;
  targetSystem: string;
}

export interface MappingEntry {
  localCode: string;
  localDisplay: string;
  localSystem: string;
  targetCode: string;
  targetDisplay: string;
  targetSystem: string;
}

// ============================================================================
// Helper Functions (exported for testing)
// ============================================================================

/**
 * Parse mapping type filter from URL parameter
 */
export function parseTypeFilter(typeParam: string | null): MappingTypeFilter {
  if (!typeParam) return "all";
  if (typeParam === "all") return "all";
  if (isMappingTypeName(typeParam)) return typeParam;
  return "all";
}

/**
 * Get display name for a mapping type filter
 */
export function getMappingTypeFilterDisplay(filter: MappingTypeFilter): string {
  if (filter === "all") return "All Types";
  return MAPPING_TYPES[filter].taskDisplay.replace(" mapping", "");
}

/**
 * Get short label for a mapping type (used in badges)
 */
export function getMappingTypeShortLabel(typeName: MappingTypeName): string {
  switch (typeName) {
    case "loinc": return "LOINC";
    case "address-type": return "Address";
    case "patient-class": return "Patient Class";
    case "obr-status": return "OBR Status";
    case "obx-status": return "OBX Status";
  }
}

/**
 * Get badge color classes for a mapping type
 */
export function getMappingTypeBadgeClasses(typeName: MappingTypeName): string {
  switch (typeName) {
    case "loinc": return "bg-purple-100 text-purple-800";
    case "address-type": return "bg-blue-100 text-blue-800";
    case "patient-class": return "bg-green-100 text-green-800";
    case "obr-status": return "bg-orange-100 text-orange-800";
    case "obx-status": return "bg-amber-100 text-amber-800";
  }
}

/**
 * Detect mapping type from ConceptMap targetUri
 */
export function detectMappingTypeFromConceptMap(conceptMap: ConceptMap): MappingTypeName | null {
  const targetUri = conceptMap.targetUri;
  if (!targetUri) return null;

  for (const [name, config] of Object.entries(MAPPING_TYPES)) {
    if (config.targetSystem === targetUri) {
      return name as MappingTypeName;
    }
  }
  return null;
}

// ============================================================================
// Handler Functions (exported)
// ============================================================================

export async function handleCodeMappingsPage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const conceptMapId = url.searchParams.get("conceptMapId");
  const showAdd = url.searchParams.get("add") === "true";
  const errorParam = url.searchParams.get("error");
  const search = url.searchParams.get("search") || undefined;
  const typeParam = url.searchParams.get("type");
  const typeFilter = parseTypeFilter(typeParam);
  const requestedPage = parsePageParam(url.searchParams);

  const [conceptMaps, navData] = await Promise.all([
    listConceptMaps(typeFilter),
    getNavData(),
  ]);

  let entries: MappingEntry[] = [];
  let total = 0;
  let loadError: string | null = errorParam;
  let selectedMappingType: MappingTypeName | null = null;

  if (conceptMapId) {
    try {
      const result = await getMappingsFromConceptMap(conceptMapId, requestedPage, search);
      entries = result.entries;
      total = result.total;
      selectedMappingType = result.mappingType;
    } catch (error) {
      console.error("Error loading ConceptMap:", error);
      loadError = "Failed to load ConceptMap";
    }
  }

  const pagination = createPagination(requestedPage, total);

  return htmlResponse(
    renderCodeMappingsPage(navData, conceptMaps, conceptMapId, entries, pagination, showAdd, loadError, search, typeFilter, selectedMappingType),
  );
}

// ============================================================================
// Service Functions (exported for testing and API operations)
// ============================================================================

/**
 * Get all target systems from the mapping types registry.
 * Used to filter ConceptMaps to only those managed by our system.
 */
function getKnownTargetSystems(): Set<string> {
  return new Set(Object.values(MAPPING_TYPES).map(t => t.targetSystem));
}

/**
 * List all ConceptMaps for sender dropdown.
 * Optionally filter by mapping type.
 */
export async function listConceptMaps(typeFilter: MappingTypeFilter = "all"): Promise<ConceptMapSummary[]> {
  const bundle = await aidboxFetch<Bundle<ConceptMap>>(
    "/fhir/ConceptMap?_count=100",
  );

  const conceptMaps = bundle.entry?.map((e) => e.resource) || [];
  const knownTargetSystems = getKnownTargetSystems();

  return conceptMaps
    .filter((cm) => {
      // Only include ConceptMaps targeting systems we know about
      if (!cm.targetUri || !knownTargetSystems.has(cm.targetUri)) {
        return false;
      }
      // Apply type filter if specified
      if (typeFilter !== "all") {
        return cm.targetUri === MAPPING_TYPES[typeFilter].targetSystem;
      }
      return true;
    })
    .map((cm) => {
      const mappingType = detectMappingTypeFromConceptMap(cm)!;
      return {
        id: cm.id!,
        displayName: cm.title || cm.id!,
        mappingType,
        targetSystem: cm.targetUri!,
      };
    });
}

function matchesSearch(entry: MappingEntry, search: string): boolean {
  const query = search.toLowerCase();
  return (
    entry.localCode.toLowerCase().includes(query) ||
    entry.localDisplay.toLowerCase().includes(query) ||
    entry.targetCode.toLowerCase().includes(query) ||
    entry.targetDisplay.toLowerCase().includes(query)
  );
}

/**
 * Get paginated mapping entries from a ConceptMap
 */
export async function getMappingsFromConceptMap(
  conceptMapId: string,
  page: number,
  search?: string,
): Promise<{ entries: MappingEntry[]; total: number; mappingType: MappingTypeName | null }> {
  const conceptMap = await aidboxFetch<ConceptMap>(
    `/fhir/ConceptMap/${conceptMapId}`,
  );

  const mappingType = detectMappingTypeFromConceptMap(conceptMap);
  const targetSystem = conceptMap.targetUri || "";
  const allEntries: MappingEntry[] = [];

  for (const group of conceptMap.group || []) {
    for (const element of group.element || []) {
      const target = element.target?.[0];
      allEntries.push({
        localCode: element.code || "",
        localDisplay: element.display || "",
        localSystem: group.source || "",
        targetCode: target?.code || "",
        targetDisplay: target?.display || "",
        targetSystem,
      });
    }
  }

  const filteredEntries = search
    ? allEntries.filter((entry) => matchesSearch(entry, search))
    : allEntries;

  const total = filteredEntries.length;
  const startIndex = (page - 1) * PAGE_SIZE;
  const entries = filteredEntries.slice(startIndex, startIndex + PAGE_SIZE);

  return { entries, total, mappingType };
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
 * Build a completed Task with resolved mapping output
 */
function buildCompletedTask(
  task: Task,
  targetCode: string,
  targetDisplay: string,
  targetSystem: string,
): Task {
  const output: TaskOutput = {
    type: { text: "Resolved mapping" },
    valueCodeableConcept: {
      coding: [
        {
          system: targetSystem,
          code: targetCode,
          display: targetDisplay,
        },
      ],
      text: targetDisplay,
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
  targetCode: string,
  targetDisplay: string,
): Promise<{ success: boolean; error?: string }> {
  const { resource: conceptMap, etag: conceptMapEtag } =
    await getResourceWithETag<ConceptMap>("ConceptMap", conceptMapId);

  const targetSystem = conceptMap.targetUri || "http://loinc.org";

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
    targetCode,
    targetDisplay,
    targetSystem,
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
    const completedTask = buildCompletedTask(task, targetCode, targetDisplay, targetSystem);

    const bundle = {
      resourceType: "Bundle",
      type: "transaction",
      entry: [
        {
          resource: updatedConceptMap,
          request: {
            method: "PUT",
            url: `ConceptMap/${conceptMapId}`,
            ...(conceptMapEtag && { ifMatch: conceptMapEtag }),
          },
        },
        {
          resource: completedTask,
          request: {
            method: "PUT",
            url: `Task/${taskId}`,
            ...(taskEtag && { ifMatch: taskEtag }),
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
  newTargetCode: string,
  newTargetDisplay: string,
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
            code: newTargetCode,
            display: newTargetDisplay,
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

  // Remove empty groups (set to undefined if all groups removed to avoid FHIR validation error)
  if (conceptMap.group) {
    const nonEmptyGroups = conceptMap.group.filter(
      (g) => g.element && g.element.length > 0,
    );
    conceptMap.group = nonEmptyGroups.length > 0 ? nonEmptyGroups : undefined;
  }

  // Save
  await updateResourceWithETag("ConceptMap", conceptMapId, conceptMap, etag);
}

// ============================================================================
// Rendering Functions (exported for testing)
// ============================================================================

/**
 * Available type filter options for the UI
 */
const TYPE_FILTER_OPTIONS: MappingTypeFilter[] = ["all", "loinc", "address-type", "patient-class", "obr-status", "obx-status"];

/**
 * Build URL for a filter combination
 */
function buildFilterUrl(typeFilter: MappingTypeFilter, conceptMapId?: string | null): string {
  const params = new URLSearchParams();
  if (typeFilter !== "all") {
    params.set("type", typeFilter);
  }
  if (conceptMapId) {
    params.set("conceptMapId", conceptMapId);
  }
  const paramStr = params.toString();
  return `/mapping/table${paramStr ? `?${paramStr}` : ""}`;
}

/**
 * Render the code mappings page.
 * Exported for testing.
 */
export function renderCodeMappingsPage(
  navData: NavData,
  conceptMaps: ConceptMapSummary[],
  selectedConceptMapId: string | null,
  entries: MappingEntry[],
  pagination: PaginationData,
  showAddForm: boolean,
  errorMessage: string | null,
  search: string | undefined,
  typeFilter: MappingTypeFilter,
  selectedMappingType: MappingTypeName | null,
): string {
  const searchUrlBase = selectedConceptMapId
    ? `/mapping/table?conceptMapId=${selectedConceptMapId}${typeFilter !== "all" ? `&type=${typeFilter}` : ""}`
    : "";

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

    <div class="mb-4 flex gap-2 flex-wrap">
      ${TYPE_FILTER_OPTIONS.map(filter => {
        const isActive = filter === typeFilter;
        const href = buildFilterUrl(filter);
        return `<a href="${href}" class="px-2 py-1 rounded text-xs font-medium ${isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}">${escapeHtml(getMappingTypeFilterDisplay(filter))}</a>`;
      }).join("\n      ")}
    </div>

    <div class="mb-6 flex items-center gap-4">
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-1">Filter by Sender</label>
        <select onchange="window.location.href = this.value ? '${buildFilterUrl(typeFilter)}&conceptMapId=' + this.value : '${buildFilterUrl(typeFilter)}'"
          class="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">Select a sender...</option>
          ${conceptMaps
            .map(
              (cm) => {
                const badge = getMappingTypeShortLabel(cm.mappingType);
                return `<option value="${cm.id}" ${cm.id === selectedConceptMapId ? "selected" : ""}>[${badge}] ${escapeHtml(cm.displayName)}</option>`;
              },
            )
            .join("")}
        </select>
      </div>
      ${
        selectedConceptMapId
          ? `
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-1">Search codes</label>
          <div class="flex gap-2 max-w-md">
            <input type="text" id="searchInput" value="${escapeHtml(search || "")}" placeholder="Search by code or display..."
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onkeydown="if(event.key==='Enter'){const v=this.value;window.location.href='${searchUrlBase}'+(v?'&search='+encodeURIComponent(v):'');}">
            <button type="button"
              onclick="const v=document.getElementById('searchInput').value;window.location.href='${searchUrlBase}'+(v?'&search='+encodeURIComponent(v):'');"
              class="px-3 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              Search
            </button>
          </div>
        </div>
        <div class="pt-6">
          <a href="${searchUrlBase}&add=true"
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
      showAddForm && selectedConceptMapId && selectedMappingType
        ? renderAddMappingForm(selectedConceptMapId, selectedMappingType, typeFilter)
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
                  renderMappingEntryPanel(entry, selectedConceptMapId, selectedMappingType, typeFilter),
                )
                .join("")
        }
      </ul>
      <div class="mt-4 flex items-center justify-between">
        <p class="text-sm text-gray-500">Total: ${pagination.total} mappings</p>
        ${renderPaginationControls({
          pagination,
          baseUrl: "/mapping/table",
          filterParams: { conceptMapId: selectedConceptMapId, search, ...(typeFilter !== "all" ? { type: typeFilter } : {}) },
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

/**
 * Get valid target values for a mapping type (for non-LOINC types).
 * Re-exported from validation module for backward compatibility with tests.
 */
export { getValidValuesWithDisplay as getValidValuesForType } from "../../code-mapping/validation";

/**
 * Render the target code input field based on mapping type.
 * LOINC uses autocomplete, others use a dropdown.
 */
function renderTargetCodeInput(
  mappingType: MappingTypeName,
  currentValue?: string,
  currentDisplay?: string,
): string {
  if (mappingType === "loinc") {
    return `
      <input type="text" name="targetCode" ${currentValue ? `value="${escapeHtml(currentValue)}"` : ""} required placeholder="Search LOINC codes..."
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        data-loinc-autocomplete>
      <input type="hidden" name="targetDisplay" ${currentDisplay ? `value="${escapeHtml(currentDisplay)}"` : ""}>
    `;
  }

  // For non-LOINC types, render a dropdown
  const options = getValidValuesWithDisplay(mappingType);
  return `
    <select name="targetCode" required
      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      onchange="this.form.targetDisplay.value = this.options[this.selectedIndex].dataset.display || ''">
      <option value="">Select a value...</option>
      ${options.map(opt => `<option value="${escapeHtml(opt.code)}" data-display="${escapeHtml(opt.display)}" ${opt.code === currentValue ? "selected" : ""}>${escapeHtml(opt.code)} - ${escapeHtml(opt.display)}</option>`).join("\n      ")}
    </select>
    <input type="hidden" name="targetDisplay" value="${currentDisplay ? escapeHtml(currentDisplay) : ""}">
  `;
}

/**
 * Get the label for the target code field based on mapping type.
 */
function getTargetFieldLabel(mappingType: MappingTypeName): string {
  const config = MAPPING_TYPES[mappingType];
  const fieldName = config.targetField.split(".").pop() || "code";
  return `Map to ${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`;
}

function renderAddMappingForm(conceptMapId: string, mappingType: MappingTypeName, typeFilter: MappingTypeFilter): string {
  const cancelUrl = buildFilterUrl(typeFilter, conceptMapId);
  const targetLabel = getTargetFieldLabel(mappingType);

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
          <label class="block text-sm font-medium text-gray-700 mb-1">${escapeHtml(targetLabel)}</label>
          ${renderTargetCodeInput(mappingType)}
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
            Create Mapping
          </button>
          <a href="${cancelUrl}" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300">
            Cancel
          </a>
        </div>
      </form>
    </div>
  `;
}

/**
 * Render a single mapping entry panel.
 * Exported for testing.
 */
export function renderMappingEntryPanel(
  entry: MappingEntry,
  conceptMapId: string,
  mappingType: MappingTypeName | null,
  typeFilter: MappingTypeFilter,
): string {
  const encodedLocalCode = encodeURIComponent(entry.localCode);
  const targetLabel = mappingType ? getTargetFieldLabel(mappingType) : "Map to Target Code";
  const updateLabel = `Update ${mappingType ? MAPPING_TYPES[mappingType].targetField.split(".").pop() : "target"}`;

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
            <span class="font-mono text-sm font-medium text-green-700">${escapeHtml(entry.targetCode)}</span>
            ${entry.targetDisplay ? `<span class="text-sm text-gray-600">${escapeHtml(entry.targetDisplay)}</span>` : ""}
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
              <span class="text-gray-500">Target Code:</span>
              <span class="ml-2 font-mono font-medium text-green-700">${escapeHtml(entry.targetCode)}</span>
            </div>
            <div class="col-span-2">
              <span class="text-gray-500">Target System:</span>
              <span class="ml-2 font-mono text-xs">${escapeHtml(entry.targetSystem)}</span>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-100">
            <form method="POST" action="/api/concept-maps/${conceptMapId}/entries/${encodedLocalCode}" class="flex items-end gap-3">
              <input type="hidden" name="localSystem" value="${escapeHtml(entry.localSystem)}">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">${escapeHtml(updateLabel)}</label>
                ${mappingType ? renderTargetCodeInput(mappingType, entry.targetCode, entry.targetDisplay) : `
                <input type="text" name="targetCode" value="${escapeHtml(entry.targetCode)}" required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <input type="hidden" name="targetDisplay" value="${escapeHtml(entry.targetDisplay)}">
                `}
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

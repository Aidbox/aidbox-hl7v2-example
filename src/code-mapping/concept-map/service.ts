/**
 * ConceptMap Service
 *
 * Manages sender-specific ConceptMaps for code mappings.
 * Supports multiple target systems (LOINC, address types, status codes, etc.).
 *
 * Provides:
 * - Generic ID generation utilities (generateConceptMapId, formatSenderAsTitle)
 * - $translate operation (translateCode)
 * - CRUD operations (listConceptMaps, getMappingsFromConceptMap, add/update/deleteConceptMapEntry)
 * - Types (MappingTypeFilter, ConceptMapSummary, MappingEntry, TranslateResult)
 */

import type {
  ConceptMap,
  ConceptMapGroup,
  ConceptMapGroupElement,
} from "../../fhir/hl7-fhir-r4-core/ConceptMap";
import type { Coding } from "../../fhir/hl7-fhir-r4-core";
import type { Task, TaskOutput } from "../../fhir/hl7-fhir-r4-core/Task";
import {
  aidboxFetch,
  putResource,
  HttpError,
  getResourceWithETag,
  updateResourceWithETag,
  NotFoundError,
  type Bundle,
} from "../../aidbox";
import { toKebabCase } from "../../utils/string";
import { MAPPING_TYPES, type MappingTypeName } from "../mapping-types";
import { generateMappingTaskId, updateAffectedMessages } from "../mapping-task";
import { PAGE_SIZE } from "../../ui/pagination";

// SenderContext is defined here as the canonical location
export interface SenderContext {
  sendingApplication: string;
  sendingFacility: string;
}

// ============================================================================
// Types for CRUD operations (moved from ui/pages/code-mappings.ts)
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
// Types for $translate operation (moved from observation-code-resolver.ts)
// ============================================================================

interface TranslateResponseParameter {
  name: string;
  valueBoolean?: boolean;
  valueCoding?: Coding;
  part?: TranslateResponseParameter[];
}

interface TranslateResponse {
  resourceType: "Parameters";
  parameter?: TranslateResponseParameter[];
}

export type TranslateResult =
  | { status: "found"; coding: Coding }
  | { status: "no_mapping" }
  | { status: "not_found" };

// ============================================================================
// Generic ID generation utilities (moved from observation-code-resolver.ts)
// ============================================================================

/**
 * Generate the base ConceptMap ID from sender context (without mapping type).
 * Format: hl7v2-{sendingApplication}-{sendingFacility}
 */
export function generateBaseConceptMapId(sender: SenderContext): string {
  const app = toKebabCase(sender.sendingApplication);
  const facility = toKebabCase(sender.sendingFacility);
  return `hl7v2-${app}-${facility}`;
}

/**
 * Generate ConceptMap ID from sender context
 * Format: hl7v2-{sendingApplication}-{sendingFacility}-{mappingType}
 *
 * @param sender - The sender context with sendingApplication and sendingFacility
 * @param mappingType - The mapping type name (e.g., "loinc", "obr-status")
 */
export function generateConceptMapId(
  sender: SenderContext,
  mappingType: MappingTypeName,
): string {
  return `${generateBaseConceptMapId(sender)}-${mappingType}`;
}

/**
 * Format sender context as title string (format: "APP | FACILITY")
 * Used for ConceptMap.title field
 */
export function formatSenderAsTitle(sender: SenderContext): string {
  return `${sender.sendingApplication} | ${sender.sendingFacility}`;
}

// ============================================================================
// $translate operation (moved from observation-code-resolver.ts)
// ============================================================================

function extractCodingFromTranslateResponse(
  response: TranslateResponse,
): Coding | null {
  const resultParam = response.parameter?.find((p) => p.name === "result");
  if (!resultParam?.valueBoolean) {
    return null;
  }

  const matchParam = response.parameter?.find((p) => p.name === "match");
  if (!matchParam?.part) {
    return null;
  }

  const conceptPart = matchParam.part.find((p) => p.name === "concept");
  if (!conceptPart?.valueCoding?.code) {
    return null;
  }

  return {
    code: conceptPart.valueCoding.code,
    display: conceptPart.valueCoding.display,
    system: conceptPart.valueCoding.system,
  };
}

/**
 * Translate a local code using Aidbox $translate operation.
 *
 * @param conceptMapId - The ConceptMap resource ID
 * @param localCode - The local code to translate
 * @param localSystem - The local coding system URI
 * @returns Discriminated result: "found" with coding, "no_mapping", or "not_found"
 */
export async function translateCode(
  conceptMapId: string,
  localCode: string,
  localSystem: string | undefined,
): Promise<TranslateResult> {
  const requestBody = {
    resourceType: "Parameters",
    parameter: [
      { name: "code", valueCode: localCode },
      ...(localSystem ? [{ name: "system", valueUri: localSystem }] : []),
    ],
  };

  let response: TranslateResponse;
  try {
    response = await aidboxFetch<TranslateResponse>(
      `/fhir/ConceptMap/${conceptMapId}/$translate`,
      {
        method: "POST",
        body: JSON.stringify(requestBody),
      },
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return { status: "not_found" };
    }
    throw error;
  }

  const coding = extractCodingFromTranslateResponse(response);
  if (!coding) {
    return { status: "no_mapping" };
  }

  return { status: "found", coding };
}

// ============================================================================
// ConceptMap CRUD operations
// ============================================================================

export async function fetchConceptMap(
  conceptMapId: string,
): Promise<ConceptMap | null> {
  try {
    return await aidboxFetch<ConceptMap>(`/fhir/ConceptMap/${conceptMapId}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

export function createEmptyConceptMap(
  sender: SenderContext,
  mappingType: MappingTypeName,
): ConceptMap {
  const type = MAPPING_TYPES[mappingType];
  const id = generateConceptMapId(sender, mappingType);
  const baseId = generateBaseConceptMapId(sender);
  return {
    resourceType: "ConceptMap",
    id,
    name: `HL7v2 ${sender.sendingApplication}/${sender.sendingFacility} to ${type.targetFieldLabel}`,
    status: "active",
    title: formatSenderAsTitle(sender),
    sourceUri: `http://example.org/fhir/CodeSystem/hl7v2-${baseId}`,
    targetUri: type.targetSystem,
    group: [],
  };
}

/**
 * Add or update a mapping in a ConceptMap (pure function, non-mutating).
 * If an element with the same localCode exists in the group, it will be replaced.
 */
export function addMappingToConceptMap(
  conceptMap: ConceptMap,
  localSystem: string,
  localCode: string,
  localDisplay: string,
  targetCode: string,
  targetDisplay: string,
  targetSystem: string,
): ConceptMap {
  const updated: ConceptMap = {
    ...conceptMap,
    group: conceptMap.group ? [...conceptMap.group] : [],
  };

  // Find group by both source AND target system to correctly handle
  // different target systems for the same source (e.g., address-type vs address-use)
  let groupIndex = updated.group!.findIndex(
    (g) => g.source === localSystem && g.target === targetSystem,
  );

  if (groupIndex === -1) {
    updated.group!.push({
      source: localSystem,
      target: targetSystem,
      element: [],
    });
    groupIndex = updated.group!.length - 1;
  }

  const group = { ...updated.group![groupIndex] } as ConceptMapGroup;
  group.element = group.element ? [...group.element] : [];
  updated.group![groupIndex] = group;

  const newElement: ConceptMapGroupElement = {
    code: localCode,
    ...(localDisplay && { display: localDisplay }),
    target: [
      {
        code: targetCode,
        ...(targetDisplay && { display: targetDisplay }),
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


// ============================================================================
// Helper functions for CRUD operations (moved from ui/pages/code-mappings.ts)
// ============================================================================

/**
 * Get all target systems from the mapping types registry.
 * Used to filter ConceptMaps to only those managed by our system.
 */
export function getKnownTargetSystems(): Set<string> {
  return new Set(Object.values(MAPPING_TYPES).map((t) => t.targetSystem));
}

/**
 * Detect mapping type from ConceptMap targetUri
 */
export function detectMappingTypeFromConceptMap(
  conceptMap: ConceptMap,
): MappingTypeName | null {
  const targetUri = conceptMap.targetUri;
  if (!targetUri) return null;

  for (const [name, config] of Object.entries(MAPPING_TYPES)) {
    if (config.targetSystem === targetUri) {
      return name as MappingTypeName;
    }
  }
  return null;
}

/**
 * Check if a mapping entry matches a search query
 */
export function matchesSearch(entry: MappingEntry, search: string): boolean {
  const query = search.toLowerCase();
  return (
    entry.localCode.toLowerCase().includes(query) ||
    entry.localDisplay.toLowerCase().includes(query) ||
    entry.targetCode.toLowerCase().includes(query) ||
    entry.targetDisplay.toLowerCase().includes(query)
  );
}

/**
 * Check if a mapping entry already exists
 */
export function checkDuplicateEntry(
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
export function buildCompletedTask(
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

// ============================================================================
// CRUD operations (moved from ui/pages/code-mappings.ts)
// ============================================================================

/**
 * List all ConceptMaps for sender dropdown.
 * Optionally filter by mapping type.
 */
export async function listConceptMaps(
  typeFilter: MappingTypeFilter = "all",
): Promise<ConceptMapSummary[]> {
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

/**
 * Get paginated mapping entries from a ConceptMap
 */
export async function getMappingsFromConceptMap(
  conceptMapId: string,
  page: number,
  search?: string,
): Promise<{
  entries: MappingEntry[];
  total: number;
  mappingType: MappingTypeName | null;
}> {
  const conceptMap = await aidboxFetch<ConceptMap>(
    `/fhir/ConceptMap/${conceptMapId}`,
  );

  const mappingType = detectMappingTypeFromConceptMap(conceptMap);
  const defaultTargetSystem = conceptMap.targetUri || "";
  const allEntries: MappingEntry[] = [];

  for (const group of conceptMap.group || []) {
    // Use group.target if available, otherwise fall back to conceptMap.targetUri
    // This is important for ConceptMaps with multiple target systems (e.g., address-type vs address-use)
    const groupTargetSystem = group.target ?? defaultTargetSystem;
    for (const element of group.element || []) {
      const target = element.target?.[0];
      allEntries.push({
        localCode: element.code || "",
        localDisplay: element.display || "",
        localSystem: group.source || "",
        targetCode: target?.code || "",
        targetDisplay: target?.display || "",
        targetSystem: groupTargetSystem,
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

  // Target system comes from the ConceptMap's targetUri
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
    const completedTask = buildCompletedTask(
      task,
      targetCode,
      targetDisplay,
      targetSystem,
    );

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
 * Update an existing entry in a ConceptMap.
 * Handles target system changes (e.g., address-type vs address-use) by moving
 * the entry to the correct group when necessary.
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

  // Target system comes from the ConceptMap's targetUri
  const newTargetSystem = conceptMap.targetUri || "http://loinc.org";

  // Find the element and its current group
  let foundGroup: ConceptMapGroup | null = null;
  let foundElementIndex = -1;
  let foundElement: ConceptMapGroupElement | null = null;

  for (const group of conceptMap.group || []) {
    if (group.source !== localSystem) continue;
    const elements = group.element || [];
    const elementIndex = elements.findIndex((e) => e.code === localCode);
    if (elementIndex >= 0 && elements[elementIndex]) {
      foundGroup = group;
      foundElementIndex = elementIndex;
      foundElement = elements[elementIndex];
      break;
    }
  }

  if (!foundGroup || !foundElement || foundElementIndex < 0) {
    return {
      success: false,
      error: `Mapping not found for code "${localCode}" in system "${localSystem}"`,
    };
  }

  // Check if the target system changed
  const currentTargetSystem = foundGroup.target || conceptMap.targetUri;
  const targetSystemChanged = currentTargetSystem !== newTargetSystem;

  if (targetSystemChanged) {
    // Remove from current group
    foundGroup.element = foundGroup.element.filter(
      (_, i) => i !== foundElementIndex,
    );

    // Find or create the new target group
    let newGroup = (conceptMap.group || []).find(
      (g) => g.source === localSystem && g.target === newTargetSystem,
    );

    if (!newGroup) {
      newGroup = {
        source: localSystem,
        target: newTargetSystem,
        element: [],
      };
      conceptMap.group = conceptMap.group || [];
      conceptMap.group.push(newGroup);
    }

    // Add the updated element to the new group
    newGroup.element = newGroup.element || [];
    newGroup.element.push({
      code: localCode,
      ...(foundElement.display && { display: foundElement.display }),
      target: [
        {
          code: newTargetCode,
          display: newTargetDisplay,
          equivalence: "equivalent",
        },
      ],
    });

    // Clean up empty groups
    if (conceptMap.group) {
      conceptMap.group = conceptMap.group.filter(
        (g) => g.element && g.element.length > 0,
      );
      if (conceptMap.group.length === 0) {
        conceptMap.group = undefined;
      }
    }
  } else {
    // Same target system - update in place
    foundElement.target = [
      {
        code: newTargetCode,
        display: newTargetDisplay,
        equivalence: "equivalent",
      },
    ];
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

/**
 * ConceptMap Service
 *
 * Manages sender-specific ConceptMaps for code mappings.
 * Supports multiple target systems (LOINC, address types, status codes, etc.).
 *
 * DESIGN PROTOTYPE: concept-map-refactoring.md
 *
 * This file will be expanded to include:
 * 1. Generic utilities moved from lookup.ts:
 *    - generateBaseConceptMapId() - DONE
 *    - generateConceptMapId() - DONE
 *    - formatSenderAsTitle() - DONE
 *    - translateCode() and related types (TranslateResult, TranslateResponse) - DONE
 *
 * 2. CRUD operations moved from ui/pages/code-mappings.ts:
 *    - listConceptMaps()
 *    - getMappingsFromConceptMap()
 *    - addConceptMapEntry()
 *    - updateConceptMapEntry()
 *    - deleteConceptMapEntry()
 *
 * 3. Types moved from ui/pages/code-mappings.ts:
 *    - MappingTypeFilter
 *    - ConceptMapSummary
 *    - MappingEntry
 */

import type {
  ConceptMap,
  ConceptMapGroup,
  ConceptMapGroupElement,
} from "../../fhir/hl7-fhir-r4-core/ConceptMap";
import type { Coding } from "../../fhir/hl7-fhir-r4-core";
import { aidboxFetch, putResource, HttpError } from "../../aidbox";
import { toKebabCase } from "../../utils/string";
import { MAPPING_TYPES, type MappingTypeName } from "../mapping-types";

// SenderContext is defined here as the canonical location
// observation-code-resolver.ts re-exports it for backward compatibility
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
    system: "http://loinc.org",
  };
}

/**
 * Translate a local code to LOINC using Aidbox $translate operation.
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


// DESIGN PROTOTYPE: Add CRUD functions here (moved from ui/pages/code-mappings.ts)
//
// export async function listConceptMaps(typeFilter: MappingTypeFilter = "all"): Promise<ConceptMapSummary[]> { ... }
// export async function getMappingsFromConceptMap(conceptMapId: string, page: number, search?: string): Promise<{ entries: MappingEntry[]; total: number; mappingType: MappingTypeName | null }> { ... }
// export async function addConceptMapEntry(conceptMapId: string, localCode: string, localDisplay: string, localSystem: string, targetCode: string, targetDisplay: string): Promise<{ success: boolean; error?: string }> { ... }
// export async function updateConceptMapEntry(conceptMapId: string, localCode: string, localSystem: string, newTargetCode: string, newTargetDisplay: string): Promise<{ success: boolean; error?: string }> { ... }
// export async function deleteConceptMapEntry(conceptMapId: string, localCode: string, localSystem: string): Promise<void> { ... }
//
// Helper functions to move:
// - detectMappingTypeFromConceptMap()
// - checkDuplicateEntry()
// - buildCompletedTask()
// - matchesSearch()

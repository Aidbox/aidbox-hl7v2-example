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
 *    - generateBaseConceptMapId()
 *    - generateConceptMapId()
 *    - formatSenderAsTitle()
 *    - translateCode() and related types (TranslateResult, TranslateResponse)
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
// DESIGN PROTOTYPE: Will also import getResourceWithETag, updateResourceWithETag, NotFoundError, HttpError, Bundle
import { aidboxFetch, putResource } from "../../aidbox";
// DESIGN PROTOTYPE: These imports will be removed - functions moved here from observation-code-resolver.ts
import {
  generateConceptMapId,
  generateBaseConceptMapId,
  formatSenderAsTitle,
  type SenderContext,
} from "./observation-code-resolver";
import { MAPPING_TYPES, type MappingTypeName } from "../mapping-types";

// DESIGN PROTOTYPE: Types to be added (moved from ui/pages/code-mappings.ts)
//
// export type MappingTypeFilter = MappingTypeName | "all";
//
// export interface ConceptMapSummary {
//   id: string;
//   displayName: string;
//   mappingType: MappingTypeName;
//   targetSystem: string;
// }
//
// export interface MappingEntry {
//   localCode: string;
//   localDisplay: string;
//   localSystem: string;
//   targetCode: string;
//   targetDisplay: string;
//   targetSystem: string;
// }
//
// // TranslateResult and related types from lookup.ts
// export type TranslateResult =
//   | { status: "found"; coding: Coding }
//   | { status: "no_mapping" }
//   | { status: "not_found" };

// DESIGN PROTOTYPE: Re-export SenderContext for backward compatibility
// export type { SenderContext } from "./observation-code-resolver";

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

/**
 * ConceptMap Service
 *
 * Manages sender-specific ConceptMaps for local code to LOINC mappings.
 */

import type {
  ConceptMap,
  ConceptMapGroup,
  ConceptMapGroupElement,
} from "../../fhir/hl7-fhir-r4-core/ConceptMap";
import { aidboxFetch, putResource } from "../../aidbox";
import {
  generateConceptMapId,
  formatSenderAsTitle,
  type SenderContext,
} from "./lookup";

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

export function createEmptyConceptMap(sender: SenderContext): ConceptMap {
  const id = generateConceptMapId(sender);
  return {
    resourceType: "ConceptMap",
    id,
    name: `HL7v2 ${sender.sendingApplication}/${sender.sendingFacility} to LOINC`,
    status: "active",
    title: formatSenderAsTitle(sender),
    sourceUri: `http://example.org/fhir/CodeSystem/hl7v2-${id.replace("-to-loinc", "")}`,
    targetUri: "http://loinc.org",
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
  loincCode: string,
  loincDisplay: string,
): ConceptMap {
  const updated: ConceptMap = {
    ...conceptMap,
    group: conceptMap.group ? [...conceptMap.group] : [],
  };

  let groupIndex = updated.group!.findIndex((g) => g.source === localSystem);

  if (groupIndex === -1) {
    updated.group!.push({
      source: localSystem,
      target: "http://loinc.org",
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
        code: loincCode,
        ...(loincDisplay && { display: loincDisplay }),
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

export async function getOrCreateConceptMap(
  sender: SenderContext,
): Promise<ConceptMap> {
  const conceptMapId = generateConceptMapId(sender);
  const existing = await fetchConceptMap(conceptMapId);

  if (existing) {
    return existing;
  }

  const newConceptMap = createEmptyConceptMap(sender);
  return putResource("ConceptMap", conceptMapId, newConceptMap);
}

export async function addMapping(
  sender: SenderContext,
  localCode: string,
  localSystem: string,
  localDisplay: string,
  loincCode: string,
  loincDisplay: string,
): Promise<void> {
  const conceptMap = await getOrCreateConceptMap(sender);

  const updatedConceptMap = addMappingToConceptMap(
    conceptMap,
    localSystem,
    localCode,
    localDisplay,
    loincCode,
    loincDisplay,
  );

  await putResource("ConceptMap", updatedConceptMap.id!, updatedConceptMap);
}

export async function deleteMapping(
  sender: SenderContext,
  localCode: string,
  localSystem: string,
): Promise<void> {
  const conceptMapId = generateConceptMapId(sender);
  const conceptMap = await fetchConceptMap(conceptMapId);

  if (!conceptMap) {
    return;
  }

  const group = conceptMap.group?.find((g) => g.source === localSystem);

  if (!group?.element) {
    return;
  }

  group.element = group.element.filter((e) => e.code !== localCode);

  await putResource("ConceptMap", conceptMapId, conceptMap);
}

export async function searchMappings(
  sender: SenderContext,
  query?: { localCode?: string; loincCode?: string },
): Promise<ConceptMapGroupElement[]> {
  const conceptMapId = generateConceptMapId(sender);
  const conceptMap = await fetchConceptMap(conceptMapId);

  if (!conceptMap?.group) {
    return [];
  }

  const allElements: ConceptMapGroupElement[] = [];

  for (const group of conceptMap.group) {
    if (!group.element) continue;

    for (const element of group.element) {
      allElements.push(element);
    }
  }

  if (!query) {
    return allElements;
  }

  return allElements.filter((element) => {
    if (query.localCode && element.code !== query.localCode) {
      return false;
    }

    if (query.loincCode) {
      const hasMatchingTarget = element.target?.some(
        (t) => t.code === query.loincCode,
      );
      if (!hasMatchingTarget) {
        return false;
      }
    }

    return true;
  });
}

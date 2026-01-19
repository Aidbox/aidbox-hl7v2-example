/**
 * ConceptMap Service
 *
 * Manages sender-specific ConceptMaps for local code to LOINC mappings.
 */

import type {
  ConceptMap,
  ConceptMapGroupElement,
} from "../../fhir/hl7-fhir-r4-core/ConceptMap";
import { aidboxFetch, putResource } from "../../aidbox";
import {
  generateConceptMapId,
  formatSenderAsPublisher,
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

function createEmptyConceptMap(sender: SenderContext): ConceptMap {
  const id = generateConceptMapId(sender);
  return {
    resourceType: "ConceptMap",
    id,
    name: `HL7v2 ${sender.sendingApplication}/${sender.sendingFacility} to LOINC`,
    status: "active",
    publisher: formatSenderAsPublisher(sender),
    sourceUri: `http://example.org/fhir/CodeSystem/hl7v2-${id.replace("-to-loinc", "")}`,
    targetUri: "http://loinc.org",
    group: [],
  };
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

  if (!conceptMap.group) {
    conceptMap.group = [];
  }

  let group = conceptMap.group.find((g) => g.source === localSystem);

  if (!group) {
    group = {
      source: localSystem,
      target: "http://loinc.org",
      element: [],
    };
    conceptMap.group.push(group);
  }

  if (!group.element) {
    group.element = [];
  }

  const existingElementIndex = group.element.findIndex(
    (e) => e.code === localCode,
  );

  const newElement: ConceptMapGroupElement = {
    code: localCode,
    display: localDisplay,
    target: [
      {
        code: loincCode,
        display: loincDisplay,
        equivalence: "equivalent",
      },
    ],
  };

  if (existingElementIndex >= 0) {
    group.element[existingElementIndex] = newElement;
  } else {
    group.element.push(newElement);
  }

  await putResource("ConceptMap", conceptMap.id!, conceptMap);
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

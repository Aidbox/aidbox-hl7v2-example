/**
 * HL7v2 ST (String) to FHIR Type Converters
 * Based on: HL7 Data Type - FHIR R4_ ST[CodeableConcept] and ST[Identifier]
 */

import type { CodeableConcept, Identifier } from "../../fhir/hl7-fhir-r4-core";

/**
 * Convert HL7v2 ST (String) to FHIR CodeableConcept
 * Mapping:
 * - ST.1 (String) -> text
 */
export function convertSTToCodeableConcept(
  st: string | undefined
): CodeableConcept | undefined {
  if (!st) return undefined;

  return {
    text: st,
  };
}

/**
 * Convert HL7v2 ST (String) to FHIR Identifier
 * Mapping:
 * - ST.1 (String) -> value
 */
export function convertSTToIdentifier(
  st: string | undefined
): Identifier | undefined {
  if (!st) return undefined;

  return {
    value: st,
  };
}

/**
 * Convert array of ST to array of CodeableConcept
 */
export function convertSTArrayToCodeableConcepts(
  sts: string[] | undefined
): CodeableConcept[] | undefined {
  if (!sts || sts.length === 0) return undefined;

  const concepts: CodeableConcept[] = [];

  for (const st of sts) {
    const concept = convertSTToCodeableConcept(st);
    if (concept) concepts.push(concept);
  }

  return concepts.length > 0 ? concepts : undefined;
}

/**
 * Convert array of ST to array of Identifier
 */
export function convertSTArrayToIdentifiers(
  sts: string[] | undefined
): Identifier[] | undefined {
  if (!sts || sts.length === 0) return undefined;

  const identifiers: Identifier[] = [];

  for (const st of sts) {
    const identifier = convertSTToIdentifier(st);
    if (identifier) identifiers.push(identifier);
  }

  return identifiers.length > 0 ? identifiers : undefined;
}

export default convertSTToCodeableConcept;

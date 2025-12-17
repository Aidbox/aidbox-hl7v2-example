import type { CodeableConcept } from "../../fhir/hl7-fhir-r4-core";

/**
 * Converts IS (Coded Value for User-Defined Tables) to FHIR code.
 *
 * Mapping:
 * - IS value -> $value (code)
 *
 * Note: IS is similar to ID but references user-defined tables.
 * Vocabulary mapping is typically done at the segment's field level.
 */
export function convertISToCode(is: string | undefined): string | undefined {
  if (!is) return undefined;
  return is;
}

/**
 * Converts IS (Coded Value for User-Defined Tables) to CodeableConcept.
 *
 * Mapping:
 * - IS value -> coding[0].code
 */
export function convertISToCodeableConcept(is: string | undefined): CodeableConcept | undefined {
  if (!is) return undefined;

  return {
    coding: [{ code: is }],
  };
}

/**
 * Converts IS (Coded Value for User-Defined Tables) to string.
 *
 * Mapping:
 * - IS value -> $value (string)
 */
export function convertISToString(is: string | undefined): string | undefined {
  if (!is) return undefined;
  return is;
}

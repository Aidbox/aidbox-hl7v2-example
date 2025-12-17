import type { Annotation } from "../../fhir/hl7-fhir-r4-core";

/**
 * Converts FT (Formatted Text) to FHIR Annotation comment.
 *
 * Mapping:
 * - FT (Formatted Text) -> text (markdown)
 *
 * Note: FT is a primitive string type in HL7v2 that may contain
 * formatting escape sequences. This converter preserves the text as-is.
 */
export function convertFTToAnnotation(ft: string | undefined): Annotation | undefined {
  if (!ft) return undefined;

  return {
    text: ft,
  };
}

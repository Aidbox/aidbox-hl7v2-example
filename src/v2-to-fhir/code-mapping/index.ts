/**
 * Code Mapping Module
 *
 * Utilities for mapping HL7v2 codes to standard terminologies (LOINC, SNOMED).
 */

export * from "./coding-systems";

// Re-export from consolidated concept-map module
export {
  generateConceptMapId,
  translateCode,
  resolveToLoinc,
  buildCodeableConcept,
  LoincResolutionError,
  type SenderContext,
  type CodeResolutionResult,
  type TranslateResult,
} from "../../code-mapping/concept-map";

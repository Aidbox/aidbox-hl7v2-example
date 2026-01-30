/**
 * Code Mapping Module
 *
 * Provides services for managing local code to LOINC mappings and
 * tracking unmapped codes via FHIR Task resources.
 */

export {
  getOrCreateConceptMap,
  addMapping,
  deleteMapping,
  searchMappings,
  fetchConceptMap,
  generateConceptMapId,
  translateCode,
  resolveToLoinc,
  buildCodeableConcept,
  LoincResolutionError,
  type SenderContext,
  type CodeResolutionResult,
  type TranslateResult,
} from "./concept-map";

export {
  generateMappingTaskId,
  composeMappingTask,
  composeTaskBundleEntry,
  resolveMappingTask,
  removeTaskFromMessage,
  removeResolvedTaskFromMessage,
} from "./mapping-task";

export {
  searchLoincCodes,
  validateLoincCode,
  type LoincSearchResult,
  type LoincValidationResult,
} from "./terminology-api";

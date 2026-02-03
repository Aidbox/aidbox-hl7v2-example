/**
 * Code Mapping Module
 *
 * Provides services for managing code mappings and
 * tracking unmapped codes via FHIR Task resources.
 */

export {
  fetchConceptMap,
  generateConceptMapId,
  translateCode,
  resolveToLoinc,
  buildCodeableConcept,
  LoincResolutionError,
  listConceptMaps,
  getMappingsFromConceptMap,
  addConceptMapEntry,
  updateConceptMapEntry,
  deleteConceptMapEntry,
  type SenderContext,
  type CodeResolutionResult,
  type TranslateResult,
  type MappingTypeFilter,
  type ConceptMapSummary,
  type MappingEntry,
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

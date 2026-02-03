/**
 * Code Mapping Module
 *
 * Provides services for managing code mappings and
 * tracking unmapped codes via FHIR Task resources.
 *
 * DESIGN PROTOTYPE: concept-map-refactoring.md
 *
 * New exports will be added:
 * - listConceptMaps
 * - getMappingsFromConceptMap
 * - addConceptMapEntry
 * - updateConceptMapEntry
 * - deleteConceptMapEntry
 * - MappingTypeFilter, ConceptMapSummary, MappingEntry types
 */

export {
  fetchConceptMap,
  generateConceptMapId,
  translateCode,
  resolveToLoinc,
  buildCodeableConcept,
  LoincResolutionError,
  type SenderContext,
  type CodeResolutionResult,
  type TranslateResult,
  type MappingTypeFilter,
  type ConceptMapSummary,
  type MappingEntry,
} from "./concept-map";
// DESIGN PROTOTYPE: Add new exports after refactoring:
// export {
//   listConceptMaps,
//   getMappingsFromConceptMap,
//   addConceptMapEntry,
//   updateConceptMapEntry,
//   deleteConceptMapEntry,
// } from "./concept-map";

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

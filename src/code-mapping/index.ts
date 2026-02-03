/**
 * Code Mapping Module
 *
 * Provides services for managing code mappings and
 * tracking unmapped codes via FHIR Task resources.
 *
 * DESIGN PROTOTYPE: concept-map-refactoring.md
 *
 * After refactoring, dead exports will be removed:
 * - getOrCreateConceptMap (dead)
 * - addMapping (dead)
 * - deleteMapping (dead)
 * - searchMappings (dead)
 *
 * New exports will be added:
 * - listConceptMaps
 * - getMappingsFromConceptMap
 * - addConceptMapEntry
 * - updateConceptMapEntry
 * - deleteConceptMapEntry
 * - MappingTypeFilter, ConceptMapSummary, MappingEntry types
 */

// DESIGN PROTOTYPE: Remove dead function exports
export {
  getOrCreateConceptMap, // DESIGN PROTOTYPE: DELETE - dead
  addMapping, // DESIGN PROTOTYPE: DELETE - dead
  deleteMapping, // DESIGN PROTOTYPE: DELETE - dead
  searchMappings, // DESIGN PROTOTYPE: DELETE - dead
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
// DESIGN PROTOTYPE: Add new exports after refactoring:
// export {
//   listConceptMaps,
//   getMappingsFromConceptMap,
//   addConceptMapEntry,
//   updateConceptMapEntry,
//   deleteConceptMapEntry,
//   type MappingTypeFilter,
//   type ConceptMapSummary,
//   type MappingEntry,
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

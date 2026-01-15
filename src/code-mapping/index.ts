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
  lookupInConceptMap,
  resolveToLoinc,
  buildCodeableConcept,
  LoincResolutionError,
  type SenderContext,
  type CodeResolutionResult,
} from "./concept-map";

export {
  generateMappingTaskId,
  createOrUpdateMappingTask,
  resolveMappingTask,
  findAffectedMessages,
  removeResolvedTaskFromMessage,
  type CreateMappingTaskParams,
} from "./mapping-task-service";

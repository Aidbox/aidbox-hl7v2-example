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
} from "./concept-map-service";

export {
  generateMappingTaskId,
  createOrUpdateMappingTask,
  resolveMappingTask,
  findAffectedMessages,
  removeResolvedTaskFromMessage,
  type CreateMappingTaskParams,
} from "./mapping-task-service";

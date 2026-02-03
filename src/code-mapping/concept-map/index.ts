/**
 * ConceptMap Module
 *
 * Provides ConceptMap management and code resolution services.
 *
 * From service.ts (core ConceptMap operations + generic utilities + CRUD):
 * - fetchConceptMap, createEmptyConceptMap, addMappingToConceptMap
 * - generateBaseConceptMapId, generateConceptMapId, formatSenderAsTitle
 * - translateCode, TranslateResult
 * - listConceptMaps, getMappingsFromConceptMap, addConceptMapEntry, updateConceptMapEntry, deleteConceptMapEntry
 * - MappingTypeFilter, ConceptMapSummary, MappingEntry types
 * - SenderContext type
 *
 * From observation-code-resolver.ts (observation-specific):
 * - resolveToLoinc, buildCodeableConcept
 * - CodeResolutionResult, LoincResolutionError, MissingLocalSystemError
 */

// Export service functions first (service.ts defines SenderContext)
export * from "./service";
// Then observation-specific exports (observation-code-resolver.ts re-exports SenderContext)
export * from "./observation-code-resolver";

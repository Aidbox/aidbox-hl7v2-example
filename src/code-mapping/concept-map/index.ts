/**
 * ConceptMap Module
 *
 * Provides ConceptMap management and code resolution services.
 *
 * From service.ts (core ConceptMap operations + generic utilities):
 * - fetchConceptMap, createEmptyConceptMap, addMappingToConceptMap
 * - generateBaseConceptMapId, generateConceptMapId, formatSenderAsTitle
 * - translateCode, TranslateResult
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

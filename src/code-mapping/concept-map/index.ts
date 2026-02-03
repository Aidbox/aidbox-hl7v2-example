/**
 * ConceptMap Module
 *
 * Provides ConceptMap management and code resolution services.
 *
 * DESIGN PROTOTYPE: concept-map-refactoring.md
 *
 * After refactoring, this file will export:
 *
 * From service.ts (core ConceptMap operations + generic utilities):
 * - fetchConceptMap
 * - createEmptyConceptMap
 * - addMappingToConceptMap
 * - generateBaseConceptMapId
 * - generateConceptMapId
 * - formatSenderAsTitle
 * - translateCode, TranslateResult
 * - listConceptMaps
 * - getMappingsFromConceptMap
 * - addConceptMapEntry
 * - updateConceptMapEntry
 * - deleteConceptMapEntry
 * - MappingTypeFilter, ConceptMapSummary, MappingEntry types
 * - SenderContext type (re-exported)
 *
 * From observation-code-resolver.ts (observation-specific):
 * - resolveToLoinc
 * - buildCodeableConcept
 * - CodeResolutionResult
 * - LoincResolutionError
 * - MissingLocalSystemError
 */

export * from "./lookup"; // DESIGN PROTOTYPE: Will change to "./observation-code-resolver"
export * from "./service";

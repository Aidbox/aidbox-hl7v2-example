# ConceptMap Module Refactoring

## Problem Statement

The ConceptMap-related code has several architectural issues:

1. **Dead code in `service.ts`**: Functions `getOrCreateConceptMap`, `addMapping`, `deleteMapping`, `searchMappings` hardcode `"observation-code-loinc"` mapping type but are never used. The system actually uses generic parameterized functions for all mapping types.

2. **Business logic in UI layer**: `src/ui/pages/code-mappings.ts` contains CRUD operations (`addConceptMapEntry`, `updateConceptMapEntry`, `deleteConceptMapEntry`, `listConceptMaps`, `getMappingsFromConceptMap`) that should be in a service layer. These are currently imported by `src/index.ts` for API routes.

3. **Misleading naming in `lookup.ts`**: `resolveFromConceptMap` sounds generic but only handles observation codes (OBX-3 → LOINC). The file mixes observation-specific resolution with generic translation utilities.

4. **Inverted dependency**: API routes in `index.ts` import from `ui/pages/` instead of the proper pattern where UI calls services.

## Current Architecture

```
src/
├── index.ts                          # Routes import from ui/pages (wrong direction)
├── api/
│   ├── mapping-tasks.ts              # HTTP handler (good)
│   └── task-resolution.ts            # Business logic (good)
├── code-mapping/
│   ├── concept-map/
│   │   ├── service.ts                # Dead code + building blocks (mixed)
│   │   ├── lookup.ts                 # Generic translate + observation-specific (mixed)
│   │   └── index.ts                  # Re-exports
│   └── index.ts                      # Re-exports dead functions
└── ui/pages/
    └── code-mappings.ts              # UI rendering + business logic (mixed)
```

## Proposed Architecture

```
src/
├── index.ts                          # Routes call API handlers
├── api/
│   ├── mapping-tasks.ts              # HTTP handler for task resolution (existing)
│   ├── task-resolution.ts            # Task resolution logic (existing)
│   └── concept-map-entries.ts        # NEW: HTTP handlers for ConceptMap entry CRUD
├── code-mapping/
│   ├── concept-map/
│   │   ├── service.ts                # ConceptMap CRUD service (refactored)
│   │   ├── lookup.ts                 # Observation code resolution (renamed internals)
│   │   └── index.ts                  # Clean exports
│   └── index.ts                      # Clean exports (no dead functions)
└── ui/pages/
    └── code-mappings.ts              # UI rendering only
```

## Design Decisions

### 1. Where to put ConceptMap CRUD operations

**Options considered:**

A. **`src/api/concept-map-entries.ts`** - New file for HTTP handlers + move business logic there
   - Pros: Follows existing pattern (`api/mapping-tasks.ts` + `api/task-resolution.ts`)
   - Cons: Mixes HTTP handling with business logic if we put both there

B. **`src/code-mapping/concept-map/service.ts`** - Extend existing service with CRUD
   - Pros: Service layer is the right place for business logic
   - Cons: service.ts already exists with different purpose (building blocks)

C. **Split approach**: HTTP handlers in `api/`, business logic in `code-mapping/`
   - `src/api/concept-map-entries.ts` - HTTP handlers only
   - `src/code-mapping/concept-map/service.ts` - Business logic (CRUD operations)

**Decision: Option C (Split approach)**

This follows the existing pattern where `api/mapping-tasks.ts` handles HTTP and `api/task-resolution.ts` contains business logic. For ConceptMap entries:
- `src/api/concept-map-entries.ts` - HTTP handlers (parse request, call service, format response)
- `src/code-mapping/concept-map/service.ts` - Business logic (CRUD operations that can be reused)

### 2. What to do with dead functions in service.ts

**Decision: Delete them**

The functions `getOrCreateConceptMap`, `addMapping`, `deleteMapping`, `searchMappings` are:
- Never imported by any production code
- Only referenced in docs as examples
- Hardcoded to LOINC while the system supports 4 mapping types

They should be deleted. The docs example can be updated to show the generic approach.

### 3. Naming in lookup.ts

**Decision: Rename for clarity**

- `resolveFromConceptMap` → `resolveObservationCodeViaConceptMap` (as TODO suggests)
- Consider adding a file-level comment clarifying that this file handles observation code resolution specifically
- `translateCode` stays as-is (it's genuinely generic and used by other resolvers)

### 4. What stays generic vs observation-specific

**Generic (used by all mapping types):**
- `translateCode()` - Calls Aidbox $translate operation
- `generateConceptMapId(sender, mappingType)` - ID generation
- `createEmptyConceptMap(sender, mappingType)` - Factory function
- `addMappingToConceptMap(..., targetSystem)` - Pure function to add entry
- `fetchConceptMap(id)` - Fetch by ID

**Observation-specific:**
- `resolveToLoinc()` - Public API for OBX-3 resolution
- `resolveObservationCodeViaConceptMap()` - Internal ConceptMap lookup (renamed)
- `tryResolveFromInlineLoinc()` - Checks for inline LOINC in CE field
- `LoincResolutionError`, `MissingLocalSystemError` - Error types
- `CodeResolutionResult` with `loinc` property - Return type

## Implementation Plan

### Phase 1: Extract business logic from UI

1. Create `src/api/concept-map-entries.ts` with HTTP handlers
2. Move business logic functions from `code-mappings.ts` to `service.ts`:
   - `addConceptMapEntry` → service function
   - `updateConceptMapEntry` → service function
   - `deleteConceptMapEntry` → service function
   - `listConceptMaps` → service function
   - `getMappingsFromConceptMap` → service function
3. Update `code-mappings.ts` to call service functions
4. Update `index.ts` routes to use new API handlers

### Phase 2: Clean up dead code

1. Delete from `service.ts`:
   - `getOrCreateConceptMap` (hardcoded to observation-code-loinc)
   - `addMapping` (hardcoded to LOINC)
   - `deleteMapping` (hardcoded to LOINC)
   - `searchMappings` (hardcoded to LOINC)
2. Update `src/code-mapping/index.ts` to remove re-exports of deleted functions
3. Update `src/code-mapping/concept-map/index.ts` if needed
4. Update docs example to use generic approach

### Phase 3: Naming improvements

1. Rename `resolveFromConceptMap` → `resolveObservationCodeViaConceptMap`
2. Update file header comment in `lookup.ts` to clarify scope
3. Consider renaming `lookup.ts` → `observation-code-resolver.ts` (optional, discuss)

## Files Changed

### New files
- `src/api/concept-map-entries.ts` - HTTP handlers for ConceptMap entry CRUD

### Modified files
- `src/code-mapping/concept-map/service.ts` - Add CRUD service functions, delete dead code
- `src/code-mapping/concept-map/lookup.ts` - Rename internal function
- `src/code-mapping/concept-map/index.ts` - Update exports
- `src/code-mapping/index.ts` - Remove dead function exports
- `src/ui/pages/code-mappings.ts` - Remove business logic, keep rendering
- `src/index.ts` - Update route imports
- `docs/developer-guide/code-mapping.md` - Update example (if needed)

## Testing Strategy

- All existing tests should pass (they test behavior, not internal structure)
- May need to update import paths in tests that directly import moved functions
- Run `bun test:all` after each phase
- Run `bun run typecheck` to catch import issues

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking imports | TypeScript will catch at compile time |
| Missing function moves | Grep for old import paths before finalizing |
| Behavioral changes | Existing integration tests cover the flows |

## Questions to Resolve Before Implementation

1. Should `lookup.ts` be renamed to `observation-code-resolver.ts`? This would make the file's purpose crystal clear but requires more import updates.

2. Should we keep the dead functions but mark them `@deprecated` instead of deleting? (I recommend deleting - they're never used and misleading.)

3. The helper types in `code-mappings.ts` (`ConceptMapSummary`, `MappingEntry`, `MappingTypeFilter`) - should they move to a shared types file or stay with the service?

---
status: planned
reviewer-iterations: 1
prototype-files:
  - src/api/concept-map-entries.ts
  - src/code-mapping/concept-map/service.ts
  - src/code-mapping/concept-map/observation-code-resolver.ts
  - src/code-mapping/concept-map/index.ts
  - src/code-mapping/index.ts
  - src/ui/pages/code-mappings.ts
  - src/index.ts
  - test/unit/code-mapping/concept-map-service.test.ts
  - test/unit/code-mapping/conceptmap-lookup.test.ts
  - test/unit/ui/code-mappings.test.ts
---

# Design: ConceptMap Module Refactoring

## Problem Statement

The ConceptMap module has architectural issues that impede maintainability and violate separation of concerns:
1. **Dead code in service.ts**: Functions `getOrCreateConceptMap()`, `addMapping()`, `deleteMapping()`, and `searchMappings()` are hardcoded for LOINC and only used by tests, not production code.
2. **Business logic in UI layer**: CRUD operations (`addConceptMapEntry`, `updateConceptMapEntry`, `deleteConceptMapEntry`, `listConceptMaps`, `getMappingsFromConceptMap`) live in `src/ui/pages/code-mappings.ts` instead of a service layer.
3. **Inverted dependency**: `src/index.ts` imports business logic from `src/ui/pages/code-mappings.ts`, violating the dependency rule that UI should depend on core logic, not vice versa.
4. **Misleading naming**: `lookup.ts` contains generic utilities (ID generation, translateCode) mixed with observation-specific logic (resolveToLoinc).

## Proposed Approach

Restructure the module to establish clear separation of concerns:

1. **Delete dead code**: Remove unused LOINC-hardcoded functions and their tests.
2. **Move CRUD to service.ts**: Relocate UI CRUD operations to the service layer with proper types co-located.
3. **Create API handler**: New `src/api/concept-map-entries.ts` for HTTP request handling (similar to `api/mapping-tasks.ts` pattern).
4. **Rename lookup.ts**: Rename to `observation-code-resolver.ts` to reflect its actual purpose.
5. **Move generic utilities**: Move `translateCode`, `generateConceptMapId`, `generateBaseConceptMapId`, `formatSenderAsTitle` to service.ts.
6. **Fix imports**: Update `src/index.ts` to import from API layer instead of UI layer.

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Where to put CRUD operations | A) Keep in UI, B) New dedicated file, C) Expand service.ts | C) Expand service.ts | Service.ts already handles ConceptMap operations; CRUD is a natural extension. Avoids proliferation of small files. |
| What to do with dead functions | A) Keep for future use, B) Mark deprecated, C) Delete | C) Delete | Code style guide mandates no dead code. Functions are LOINC-hardcoded anyway and don't support multi-type mappings. |
| Where to put helper types | A) Separate types.ts, B) Co-located with service.ts | B) Co-located | Types are tightly coupled to service functions; co-location improves discoverability per code style. |
| How to handle HTTP handlers | A) Inline in index.ts, B) New API handler file | B) New API handler file | Follows established `api/mapping-tasks.ts` pattern; keeps index.ts focused on routing. |
| translateCode location | A) Keep in lookup.ts, B) Move to service.ts | B) Move to service.ts | It's generic infrastructure for $translate, not observation-specific. Service.ts is the right home. |

## Trade-offs

**Pros:**
- Clear separation: UI renders, API handles requests, service owns business logic
- No dead code reduces maintenance burden
- Accurate file naming improves code discoverability
- Consistent with existing patterns (api/mapping-tasks.ts, api/task-resolution.ts)

**Cons:**
- Migration effort: Multiple file changes, import updates across codebase
- Test updates: Tests importing from old locations need updates
- Temporary code duplication during migration if done incrementally

**Mitigations:**
- Prototype files mark exact change locations
- Batch all changes in single commit for atomic migration
- Run full test suite to verify no regressions

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|
| `src/code-mapping/concept-map/service.ts` | Modify | Add CRUD functions, types, and generic utilities from lookup.ts; remove dead functions |
| `src/code-mapping/concept-map/lookup.ts` | Delete | Rename to observation-code-resolver.ts |
| `src/code-mapping/concept-map/observation-code-resolver.ts` | Create | Contains only observation-specific resolution logic |
| `src/code-mapping/concept-map/index.ts` | Modify | Update exports for new structure |
| `src/code-mapping/index.ts` | Modify | Update exports, remove dead function exports |
| `src/api/concept-map-entries.ts` | Create | HTTP handlers for ConceptMap entry CRUD |
| `src/ui/pages/code-mappings.ts` | Modify | Remove CRUD functions and types, keep only rendering |
| `src/index.ts` | Modify | Import from api/concept-map-entries.ts instead of ui/pages |
| `test/unit/code-mapping/concept-map-service.test.ts` | Modify | Delete tests for dead functions, update imports |
| `test/unit/code-mapping/conceptmap-lookup.test.ts` | Modify | Rename to observation-code-resolver.test.ts, update imports |
| `test/unit/ui/code-mappings.test.ts` | Modify | Update imports, remove CRUD tests (moved to service tests) |

## Technical Details

### New File: src/api/concept-map-entries.ts

```typescript
/**
 * ConceptMap Entries API
 *
 * HTTP handlers for ConceptMap entry CRUD operations.
 * Parses requests and delegates to service layer.
 */

import {
  addConceptMapEntry,
  updateConceptMapEntry,
  deleteConceptMapEntry,
} from "../code-mapping/concept-map/service";

export async function handleAddEntry(req: Request): Promise<Response> {
  const conceptMapId = req.params.id;
  const formData = await req.formData();
  // ... parse and validate
  const result = await addConceptMapEntry(conceptMapId, localCode, localDisplay, localSystem, targetCode, targetDisplay);
  // ... return redirect response
}

export async function handleUpdateEntry(req: Request): Promise<Response> { ... }
export async function handleDeleteEntry(req: Request): Promise<Response> { ... }
```

### Expanded service.ts exports

```typescript
// Types (moved from ui/pages/code-mappings.ts)
export type MappingTypeFilter = MappingTypeName | "all";
export interface ConceptMapSummary { id: string; displayName: string; mappingType: MappingTypeName; targetSystem: string; }
export interface MappingEntry { localCode: string; localDisplay: string; localSystem: string; targetCode: string; targetDisplay: string; targetSystem: string; }

// Generic utilities (moved from lookup.ts)
export function generateBaseConceptMapId(sender: SenderContext): string;
export function generateConceptMapId(sender: SenderContext, mappingType: MappingTypeName): string;
export function formatSenderAsTitle(sender: SenderContext): string;
export async function translateCode(conceptMapId: string, localCode: string, localSystem: string | undefined): Promise<TranslateResult>;

// CRUD operations (moved from ui/pages/code-mappings.ts)
export async function listConceptMaps(typeFilter?: MappingTypeFilter): Promise<ConceptMapSummary[]>;
export async function getMappingsFromConceptMap(conceptMapId: string, page: number, search?: string): Promise<{ entries: MappingEntry[]; total: number; mappingType: MappingTypeName | null }>;
export async function addConceptMapEntry(conceptMapId: string, localCode: string, localDisplay: string, localSystem: string, targetCode: string, targetDisplay: string): Promise<{ success: boolean; error?: string }>;
export async function updateConceptMapEntry(conceptMapId: string, localCode: string, localSystem: string, newTargetCode: string, newTargetDisplay: string): Promise<{ success: boolean; error?: string }>;
export async function deleteConceptMapEntry(conceptMapId: string, localCode: string, localSystem: string): Promise<void>;
```

### observation-code-resolver.ts exports

```typescript
// Error classes
export class LoincResolutionError extends Error { ... }
export class MissingLocalSystemError extends Error { ... }

// Types
export interface CodeResolutionResult { loinc: Coding; local?: Coding; }
export interface SenderContext { sendingApplication: string; sendingFacility: string; }

// Public API
export async function resolveToLoinc(observationIdentifier: CE, sender: SenderContext): Promise<CodeResolutionResult>;
export function buildCodeableConcept(result: CodeResolutionResult): CodeableConcept;
```

### Updated index.ts imports

```typescript
// Before (wrong direction)
import { addConceptMapEntry, updateConceptMapEntry, deleteConceptMapEntry } from "./ui/pages/code-mappings";

// After (correct direction)
import { handleAddEntry, handleUpdateEntry, handleDeleteEntry } from "./api/concept-map-entries";
```

## Edge Cases and Error Handling

| Edge Case | Handling |
|-----------|----------|
| Concurrent ConceptMap updates | ETag-based optimistic concurrency preserved (already implemented) |
| Missing Task during add | Non-critical; logs warning and continues (already implemented) |
| Empty ConceptMap groups | Cleaned up on delete to avoid FHIR validation errors (already implemented) |
| Unknown mapping type in ConceptMap | Returns null from detectMappingTypeFromConceptMap; UI handles gracefully |
| translateCode 404 | Returns `{ status: "not_found" }` discriminated union (already implemented) |

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|
| generateConceptMapId formats correctly | Unit | Verify kebab-case ID generation with mapping type suffix |
| translateCode returns discriminated results | Unit | Test "found", "no_mapping", "not_found" statuses |
| resolveToLoinc detects inline LOINC | Unit | Primary and alternate coding detection |
| resolveToLoinc falls back to ConceptMap | Unit | Calls $translate when no inline LOINC |
| listConceptMaps filters by type | Unit | Verify type filter applies correctly |
| addConceptMapEntry detects duplicates | Unit | Returns error for existing code |
| addConceptMapEntry completes Task atomically | Unit | Transaction includes both ConceptMap and Task |
| updateConceptMapEntry preserves ETag | Unit | Verify optimistic concurrency |
| deleteConceptMapEntry cleans up empty groups | Unit | Groups removed when last element deleted |
| HTTP handlers parse form data correctly | Unit | Verify API layer extracts parameters |

---

# Context

## Exploration Findings

### service.ts Function Status

| Function | Status | Usage |
|----------|--------|-------|
| `fetchConceptMap()` | **USED** | Building block for other functions |
| `createEmptyConceptMap()` | **USED** | Called by task-resolution.ts and internally |
| `addMappingToConceptMap()` | **USED** | Pure function; called by task-resolution.ts, code-mappings.ts |
| `getOrCreateConceptMap()` | **DEAD** | Only used internally by `addMapping()`, hardcoded for LOINC |
| `addMapping()` | **DEAD** | Only called by tests, hardcoded for LOINC |
| `deleteMapping()` | **DEAD** | Only called by tests, hardcoded for LOINC |
| `searchMappings()` | **DEAD** | Only called by tests, hardcoded for LOINC |

### lookup.ts Function Classification

**Generic utilities (should move to service.ts):**
- `generateBaseConceptMapId()` - ID generation utility
- `generateConceptMapId()` - ID generation (widely used)
- `formatSenderAsTitle()` - Used by service.ts
- `translateCode()` - Calls Aidbox $translate, generic
- `buildCodeableConcept()` - Generic FHIR builder
- `extractCodingFromTranslateResponse()` - Response parsing

**Observation-specific (stays in renamed file):**
- `resolveToLoinc()` - Public API for OBX-3 resolution
- `resolveFromConceptMap()` - Internal lookup (rename to `resolveObservationCodeViaConceptMap`)
- `tryResolveFromInlineLoinc()` - Inline LOINC detection
- `hasLoincInPrimaryCoding()`, `hasLoincInAlternateCoding()` - Detection helpers
- `extractLoincFromPrimary()`, `extractLoincFromAlternate()` - Extraction helpers
- `extractLocalFromPrimary()` - Local code extraction
- `LoincResolutionError`, `MissingLocalSystemError` - Error classes
- `CodeResolutionResult` - Return type

### UI Layer CRUD Functions (to move)

| Function | Lines | Purpose |
|----------|-------|---------|
| `listConceptMaps()` | 160-189 | List all ConceptMaps with optional type filter |
| `getMappingsFromConceptMap()` | 204-243 | Get paginated entries |
| `addConceptMapEntry()` | 299-403 | Add entry (uses atomic bundle for Task completion) |
| `updateConceptMapEntry()` | 410-509 | Update existing entry |
| `deleteConceptMapEntry()` | 514-542 | Delete entry |

**Types in UI layer (move with functions):**
- `MappingTypeFilter` - Filter type
- `ConceptMapSummary` - DTO for list
- `MappingEntry` - DTO for entries

### Inverted Dependency

```
src/index.ts (lines 19-24) imports:
  - addConceptMapEntry
  - updateConceptMapEntry
  - deleteConceptMapEntry
FROM src/ui/pages/code-mappings.ts  ← WRONG DIRECTION
```

### Reference Pattern (api/mapping-tasks.ts)

Correct pattern:
```
HTTP handler (api/mapping-tasks.ts)
  ↓ parses request, validates input
Business logic (api/task-resolution.ts)
  ↓ orchestrates operations
Data access (aidbox.ts, code-mapping/concept-map/service.ts)
```

### Key Constraints to Preserve

1. **Multi-target-system support** - ConceptMaps can have multiple target systems (e.g., address-type vs address-use)
2. **Deterministic task IDs** - `generateMappingTaskId()` creates consistent IDs for idempotent reprocessing
3. **ETag-based concurrency** - All CRUD functions use `getResourceWithETag()` and `updateResourceWithETag()`
4. **Atomic transactions** - `addConceptMapEntry()` uses bundle for ConceptMap update + Task completion

### Test Files Affected

- `/test/unit/code-mapping/concept-map-service.test.ts` - Tests dead functions (DELETE)
- `/test/unit/ui/code-mappings.test.ts` - Tests UI CRUD (UPDATE imports)
- `/test/unit/code-mapping/conceptmap-lookup.test.ts` - Tests lookup functions (UPDATE imports)

## User Requirements & Answers

### Original Problem

The ConceptMap-related code has architectural issues:
1. Dead code in service.ts hardcoded for LOINC
2. Business logic in UI layer (CRUD operations)
3. Misleading naming in lookup.ts
4. Inverted dependency (index.ts imports from ui/pages/)

### User Decisions

**Q: Should lookup.ts be renamed to observation-code-resolver.ts?**
A: Yes, rename to observation-code-resolver.ts

**Q: What should happen to dead functions?**
A: Delete them (along with their tests)

**Q: Where should helper types live?**
A: Co-located with service.ts

**Q: What should happen to tests for dead functions?**
A: Delete tests with functions

**Q: Where should translateCode() live?**
A: Move to service.ts (it's generic infrastructure)

### Agreed Architecture

```
src/
├── index.ts                          # Routes call API handlers (no ui/pages imports)
├── api/
│   ├── mapping-tasks.ts              # Existing HTTP handler
│   ├── task-resolution.ts            # Existing business logic
│   └── concept-map-entries.ts        # NEW: HTTP handlers for CRUD
├── code-mapping/
│   ├── concept-map/
│   │   ├── service.ts                # CRUD service + generic utilities (refactored)
│   │   ├── observation-code-resolver.ts  # RENAMED from lookup.ts
│   │   └── index.ts                  # Clean exports
│   └── index.ts                      # Clean exports (no dead functions)
└── ui/pages/
    └── code-mappings.ts              # UI rendering only
```

## AI Review Notes

### Review Summary: APPROVED

The design is well-structured and addresses all stated problems. No blockers found.

### 1. Completeness - PASS

All four problem areas are addressed:
- Dead code removal: Clear identification of functions to delete
- Business logic relocation: CRUD moves from UI to service layer
- Inverted dependency fix: API handler pattern mirrors mapping-tasks.ts
- File renaming: lookup.ts -> observation-code-resolver.ts

### 2. Consistency with Codebase - PASS

- Follows established `api/mapping-tasks.ts` pattern for HTTP handlers
- Uses existing conventions: ETag concurrency, atomic bundles, discriminated unions
- Import structure matches existing modules

### 3. Clean Architecture - PASS

- Clear separation: UI (rendering) -> API (HTTP handling) -> Service (business logic)
- Dependencies flow correctly: index.ts -> api -> service
- Service functions remain testable (pure functions + mocked aidbox calls)

### 4. Best Practices - PASS

- Adheres to code style: no dead code, co-located types, minimal public interface
- Error handling preserved (ETag conflicts, not-found cases)
- Edge cases documented with existing solutions

### 5. Feasibility - PASS

- Atomic migration (single commit) avoids partial breakage
- Prototype files clearly mark all change locations
- Test file mapping is comprehensive

### 6. Simpler Alternatives - PASS

Considered but correctly rejected:
- Keeping CRUD in UI: violates separation of concerns
- Separate types.ts: over-engineering for tightly coupled types
- Inline handlers in index.ts: inconsistent with mapping-tasks.ts pattern

### 7. Test Coverage - PASS

- Dead function tests marked for deletion
- CRUD tests move with functions (service.test.ts)
- Lookup tests renamed to observation-code-resolver.test.ts
- Import path updates documented

### Minor Notes (non-blocking)

1. **buildCodeableConcept location**: The design shows it staying in observation-code-resolver.ts, but in the lookup.ts classification it's listed under "generic utilities". Since it's only used by resolveToLoinc result processing, keeping it in observation-code-resolver.ts is correct.

2. **SenderContext type**: Exported from observation-code-resolver.ts but used by service.ts for generateConceptMapId. The re-export strategy mentioned in the prototype (service.ts re-exports from observation-code-resolver.ts) handles this cleanly.

3. **Test file in prototype list mismatch**: The frontmatter lists `src/code-mapping/concept-map/observation-code-resolver.ts` but the affected components table says "Create" for this file when it's actually a rename of lookup.ts. This is just a documentation detail.

## User Feedback

**User Questions:**
1. Is it possible to have a generic CodeResolutionResult across the system instead of LOINC-specific?
2. Can buildCodeableConcept be generalized for different codes?

**Resolution:**
Analyzed current mapping type implementations. Non-LOINC mappings (patient-class, obr-status, obx-status) return simple enum values, not Coding objects. Only observation-code-loinc produces CodeableConcept. Generalizing is **not needed** for current use cases - other mappings use MappingError + direct string values.

**Decision:** Keep design as-is. CodeResolutionResult and buildCodeableConcept remain observation-specific. If future mapping types need Coding resolution (e.g., procedure codes → SNOMED), we'll introduce a generic interface then with a concrete use case.

**Status:** Approved by user to proceed.

---

# Implementation Plan

## Overview

Refactor the ConceptMap module to fix architectural issues: remove dead code from service.ts, move CRUD business logic from UI layer to service layer, create API handlers for HTTP requests, rename lookup.ts to reflect its observation-specific purpose, and fix the inverted dependency where index.ts imports from ui/pages/.

## Development Approach

- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan when scope changes**

## Validation Commands

- `bun test:all` - Run all tests (unit + integration)
- `bun run typecheck` - TypeScript type checking

---

## Task 1: Delete dead functions from service.ts and their tests

Remove the dead LOINC-hardcoded functions that are only called by tests, not production code.

- [x] Delete `getOrCreateConceptMap()` function from `src/code-mapping/concept-map/service.ts` (lines 173-185)
- [x] Delete `addMapping()` function from `src/code-mapping/concept-map/service.ts` (lines 189-210)
- [x] Delete `deleteMapping()` function from `src/code-mapping/concept-map/service.ts` (lines 214-236)
- [x] Delete `searchMappings()` function from `src/code-mapping/concept-map/service.ts` (lines 240-281)
- [x] Delete `describe("getOrCreateConceptMap")` test block from `test/unit/code-mapping/concept-map-service.test.ts`
- [x] Delete `describe("addMapping")` test block from `test/unit/code-mapping/concept-map-service.test.ts`
- [x] Delete `describe("deleteMapping")` test block from `test/unit/code-mapping/concept-map-service.test.ts`
- [x] Delete `describe("searchMappings")` test block from `test/unit/code-mapping/concept-map-service.test.ts`
- [x] Remove DESIGN PROTOTYPE comments from `src/code-mapping/concept-map/service.ts` related to deleted functions
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 2: Rename lookup.ts to observation-code-resolver.ts

Rename the file and update all imports throughout the codebase.

- [x] Create `src/code-mapping/concept-map/observation-code-resolver.ts` as a copy of `lookup.ts`
- [x] Update `src/code-mapping/concept-map/index.ts` to export from `./observation-code-resolver` instead of `./lookup`
- [x] Delete `src/code-mapping/concept-map/lookup.ts`
- [x] Rename `test/unit/code-mapping/conceptmap-lookup.test.ts` to `test/unit/code-mapping/observation-code-resolver.test.ts`
- [x] Update imports in the renamed test file to reference `observation-code-resolver`
- [x] Search for any other imports of `lookup` and update them (use grep to verify)
- [x] Remove DESIGN PROTOTYPE comments about renaming from the new observation-code-resolver.ts
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 3: Move generic utilities from observation-code-resolver.ts to service.ts

Move ID generation functions, translateCode, and related types to service.ts as they are generic utilities.

- [x] Move `generateBaseConceptMapId()` function to service.ts
- [x] Move `generateConceptMapId()` function to service.ts
- [x] Move `formatSenderAsTitle()` function to service.ts
- [x] Move `TranslateResult` type to service.ts
- [x] Move `TranslateResponseParameter` and `TranslateResponse` interfaces to service.ts
- [x] Move `extractCodingFromTranslateResponse()` function to service.ts
- [x] Move `translateCode()` function to service.ts
- [x] Add required imports to service.ts: `toKebabCase`, `aidboxFetch`, `HttpError`
- [x] Update service.ts to export: `generateBaseConceptMapId`, `generateConceptMapId`, `formatSenderAsTitle`, `translateCode`, `TranslateResult`
- [x] Re-export `SenderContext` type from observation-code-resolver.ts in service.ts for backward compatibility
- [x] Update observation-code-resolver.ts to import these functions from `./service` instead of defining them
- [x] Remove the moved functions and types from observation-code-resolver.ts
- [x] Update `src/code-mapping/concept-map/index.ts` exports to reflect new locations
- [x] Update test imports in `observation-code-resolver.test.ts` for `generateConceptMapId` and `translateCode` tests
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 4: Move CRUD types from UI to service.ts

Move the data types that are used by CRUD operations from the UI layer to the service layer.

- [x] Move `MappingTypeFilter` type from `src/ui/pages/code-mappings.ts` to service.ts
- [x] Move `ConceptMapSummary` interface from `src/ui/pages/code-mappings.ts` to service.ts
- [x] Move `MappingEntry` interface from `src/ui/pages/code-mappings.ts` to service.ts
- [x] Export these types from service.ts
- [x] Update `src/code-mapping/concept-map/index.ts` to export the new types
- [x] Update `src/code-mapping/index.ts` to export the new types
- [x] Update `src/ui/pages/code-mappings.ts` to import these types from `../../code-mapping/concept-map/service`
- [x] Update test imports in `test/unit/ui/code-mappings.test.ts` if needed
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 5: Move helper functions from UI to service.ts

Move the internal helper functions used by CRUD operations.

- [x] Move `getKnownTargetSystems()` function from code-mappings.ts to service.ts
- [x] Move `detectMappingTypeFromConceptMap()` function from code-mappings.ts to service.ts (keep export in UI for rendering)
- [x] Move `matchesSearch()` function from code-mappings.ts to service.ts
- [x] Move `checkDuplicateEntry()` function from code-mappings.ts to service.ts
- [x] Move `buildCompletedTask()` function from code-mappings.ts to service.ts
- [x] Add required imports to service.ts: `Task`, `TaskOutput`, `getResourceWithETag`, `updateResourceWithETag`, `NotFoundError`, `Bundle`
- [x] Update code-mappings.ts to import `detectMappingTypeFromConceptMap` from service
- [x] Export `detectMappingTypeFromConceptMap` from service.ts (used by UI for rendering)
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 6: Move CRUD functions from UI to service.ts

Move the main CRUD operations that handle business logic.

- [x] Move `listConceptMaps()` function from code-mappings.ts to service.ts
- [x] Move `getMappingsFromConceptMap()` function from code-mappings.ts to service.ts
- [x] Move `addConceptMapEntry()` function from code-mappings.ts to service.ts
- [x] Move `updateConceptMapEntry()` function from code-mappings.ts to service.ts
- [x] Move `deleteConceptMapEntry()` function from code-mappings.ts to service.ts
- [x] Add import for `generateMappingTaskId` from mapping-task.ts in service.ts
- [x] Add import for `updateAffectedMessages` from `../../ui/mapping-tasks-queue` in service.ts
- [x] Add import for `PAGE_SIZE` from `../../ui/pagination` in service.ts
- [x] Export all CRUD functions from service.ts
- [x] Update `src/code-mapping/concept-map/index.ts` to export CRUD functions
- [x] Update `src/code-mapping/index.ts` to export CRUD functions
- [x] Update code-mappings.ts to import CRUD functions from `../../code-mapping/concept-map/service`
- [x] Remove moved functions from code-mappings.ts
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 7: Implement API handlers in concept-map-entries.ts

Replace the prototype placeholders with actual implementation by moving the inline handlers from index.ts.

- [x] Implement `handleAddEntry()` - move logic from `/api/concept-maps/:id/entries` inline handler in index.ts
- [x] Implement `handleUpdateEntry()` - move logic from `/api/concept-maps/:id/entries/:code` inline handler in index.ts
- [x] Implement `handleDeleteEntry()` - move logic from `/api/concept-maps/:id/entries/:code/delete` inline handler in index.ts
- [x] Import CRUD functions from `../code-mapping/concept-map/service`
- [x] Remove the `throw new Error("DESIGN PROTOTYPE - not implemented")` placeholders
- [x] Remove DESIGN PROTOTYPE comments from the file
- [x] Export the three handler functions
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 8: Update index.ts to use API handlers

Fix the inverted dependency by importing from API layer instead of UI layer.

- [x] Remove imports of `addConceptMapEntry`, `updateConceptMapEntry`, `deleteConceptMapEntry` from `./ui/pages/code-mappings`
- [x] Add import for `handleAddEntry`, `handleUpdateEntry`, `handleDeleteEntry` from `./api/concept-map-entries`
- [x] Replace inline handler for `/api/concept-maps/:id/entries` with `{ POST: handleAddEntry }`
- [x] Replace inline handler for `/api/concept-maps/:id/entries/:code` with `{ POST: handleUpdateEntry }`
- [x] Replace inline handler for `/api/concept-maps/:id/entries/:code/delete` with `{ POST: handleDeleteEntry }`
- [x] Remove DESIGN PROTOTYPE comments from index.ts
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 9: Update module index files and clean up exports

Update the barrel exports to reflect the new structure and remove dead exports.

- [x] Update `src/code-mapping/concept-map/index.ts`:
  - Remove `export * from "./lookup"`
  - Add `export * from "./observation-code-resolver"`
  - Ensure service.ts exports are included
  - Remove DESIGN PROTOTYPE comments
- [x] Update `src/code-mapping/index.ts`:
  - Remove dead function exports: `getOrCreateConceptMap`, `addMapping`, `deleteMapping`, `searchMappings`
  - Add new CRUD exports: `listConceptMaps`, `getMappingsFromConceptMap`, `addConceptMapEntry`, `updateConceptMapEntry`, `deleteConceptMapEntry`
  - Add type exports: `MappingTypeFilter`, `ConceptMapSummary`, `MappingEntry`
  - Remove DESIGN PROTOTYPE comments
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 10: Clean up UI file and remove business logic

Ensure code-mappings.ts contains only UI rendering logic.

- [x] Verify all CRUD functions are removed from code-mappings.ts
- [x] Verify all data types are imported from service layer
- [x] Remove unused aidbox imports (aidboxFetch, getResourceWithETag, updateResourceWithETag, NotFoundError, Bundle)
- [x] Remove unused Task, ConceptMapGroup, ConceptMapGroupElement type imports
- [x] Remove DESIGN PROTOTYPE comments from code-mappings.ts
- [x] Keep only UI rendering functions: `handleCodeMappingsPage`, `parseTypeFilter`, `getMappingTypeFilterDisplay`, `renderCodeMappingsPage`, `renderAddMappingForm`, `renderMappingEntryPanel`, `renderTargetCodeInput`, `buildFilterUrl`
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 11: Update and reorganize tests

Move CRUD tests to service test file and update imports.

- [ ] Move CRUD test describes from `test/unit/ui/code-mappings.test.ts` to `test/unit/code-mapping/concept-map-service.test.ts`:
  - `describe("listConceptMaps")`
  - `describe("getMappingsFromConceptMap")`
  - `describe("addConceptMapEntry")`
  - `describe("updateConceptMapEntry")`
  - `describe("deleteConceptMapEntry")`
  - `describe("getMappingsFromConceptMap - search")`
  - `describe("integration: add mapping flow")`
  - `describe("listConceptMaps - type filtering")`
  - `describe("detectMappingTypeFromConceptMap")`
- [ ] Update imports in moved tests to reference service.ts
- [ ] Keep UI rendering tests in code-mappings.test.ts:
  - `describe("parseTypeFilter")`
  - `describe("getMappingTypeFilterDisplay")`
  - `describe("getMappingTypeShortLabel")`
  - `describe("getValidValuesForType")`
  - `describe("renderMappingEntryPanel")`
  - `describe("renderCodeMappingsPage")`
- [ ] Remove DESIGN PROTOTYPE comments from all test files
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 12: Update documentation

Update documentation files that reference renamed files or deleted functions.

- [ ] Update `docs/developer-guide/code-mapping.md`:
  - Line 49: Change `lookup.ts` to `observation-code-resolver.ts` in code organization tree
  - Lines 109-122: Remove or replace `addMapping()` example - this function is deleted. Replace with `addConceptMapEntry()` from service layer or remove the "Adding a mapping programmatically" section
  - Update any import paths if needed
- [ ] Update `docs/developer-guide/oru-processing.md`:
  - Line 127: Change `code-mapping/concept-map/lookup.ts` to `code-mapping/concept-map/observation-code-resolver.ts`
- [ ] Update `docs/developer-guide/how-to/extracting-modules.md`:
  - Lines 193-196: Change `lookup.ts` to `observation-code-resolver.ts` in file tree
- [ ] Verify no other docs reference `lookup.ts`: `grep -r "lookup\.ts" docs/`
- [ ] Verify no docs reference dead functions: `grep -r "addMapping\|deleteMapping\|searchMappings\|getOrCreateConceptMap" docs/`

---

## Task 13: Final cleanup - remove all DESIGN PROTOTYPE markers

Verify all prototype markers are removed and the refactoring is complete.

- [ ] Run `grep -r "DESIGN PROTOTYPE: concept-map-refactoring" src/` - should return no results
- [ ] Run `grep -r "DESIGN PROTOTYPE: concept-map-refactoring" test/` - should return no results
- [ ] Verify `src/code-mapping/concept-map/lookup.ts` no longer exists
- [ ] Verify `src/code-mapping/concept-map/observation-code-resolver.ts` exists and has no prototype markers
- [ ] Verify `test/unit/code-mapping/conceptmap-lookup.test.ts` no longer exists
- [ ] Verify `test/unit/code-mapping/observation-code-resolver.test.ts` exists
- [ ] Update design document status from `planned` to `implemented` in frontmatter
- [ ] Run `bun test:all` and `bun run typecheck` - final verification

---

## Post-Completion Verification

1. **Functional test**: Navigate to `/mapping/table` in browser, select a ConceptMap, verify entries display correctly
2. **CRUD test**: Add a new mapping entry, update it, then delete it - verify all operations work
3. **Architecture test**: Run `grep -r "from.*ui/pages/code-mappings" src/index.ts` - should return only `handleCodeMappingsPage`
4. **No regressions**: All existing tests pass (`bun test:all`)
5. **Cleanup verified**: No DESIGN PROTOTYPE comments remain in codebase
6. **Documentation verified**: No docs reference `lookup.ts` or deleted functions


---
status: ready-for-review
reviewer-iterations: 0
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
[To be filled by Review agent]

## User Feedback
[To be filled after user review]

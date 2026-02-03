---
status: explored
reviewer-iterations: 0
prototype-files: []
---

# Design: ConceptMap Module Refactoring

## Problem Statement
[To be filled by Design agent]

## Proposed Approach
[To be filled by Design agent]

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|

## Trade-offs
[To be filled by Design agent]

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|

## Technical Details
[To be filled by Design agent]

## Edge Cases and Error Handling
[To be filled by Design agent]

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|

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

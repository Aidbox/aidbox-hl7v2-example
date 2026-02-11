---
status: planned
reviewer-iterations: 0
prototype-files:
  - src/code-mapping/mapping-errors.ts
  - src/code-mapping/mapping-task/compose.ts
  - src/ui/pages/mapping-tasks.ts
  - src/v2-to-fhir/messages/oru-r01.ts
  - src/v2-to-fhir/segments/obx-observation.ts
  - src/v2-to-fhir/segments/obr-diagnosticreport.ts
  - src/v2-to-fhir/segments/pv1-encounter.ts
---

# Design: Mapping Labels in Code Mapping Registry

## Problem Statement
The mapping system stores `sourceFieldLabel` and `targetFieldLabel` in three places, which creates duplication, inconsistency risk, and unclear ownership. The labels are effectively fixed by mapping type, yet are redundantly hardcoded in converters and persisted in Task input. We need a single source of truth for labels without sacrificing maintainability.

## Proposed Approach
Replace string labels in the mapping registry with structured metadata (`source: { segment, field }`, `target: { resource, field }`). Remove per-instance labels from `MappingError` and Task input. All display strings — source labels, target labels, task display text — are derived from structured data via helper functions in `mapping-types.ts`. Converters only specify `mappingType`; UI and task composition use derivation helpers.

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Label source of truth | A) Registry only, B) Task only, C) Registry + Task override | A | Mapping type already defines source/target; registry prevents drift and removes duplication. |
| Keep labels in Task input | Keep vs remove | Remove | No backward compatibility requirement; Task should not duplicate canonical labels. |
| Structured metadata | Add now vs defer | Now | Project is a public foundation; avoid every adopter having to refactor from strings to structured data at scale. Eliminates notation drift (dash vs dot) by construction. |
| `taskDisplay` field | Explicit string vs derived | Derived | Current hand-written values are inconsistent in style. Derivation from `targetLabel` guarantees consistency. No scenario where custom display would differ from derived. |

Rejected options (why):
- Option B (Task only): Keeps duplication and inconsistency risk; registry becomes less meaningful.
- Option C (dual source): Adds complexity and precedence rules without a real need (YAGNI).

## Trade-offs
- **Pro**: Single source of truth reduces drift and simplifies converters and UI.
- **Con**: Tasks are no longer self-describing if registry changes later.
- **Mitigated by**: Labels are derived from mapping type; changes are intentional and tracked in registry.

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|
| `src/code-mapping/mapping-types.ts` | Rewrite | Replace string labels with structured metadata (`source`, `target`). Remove `taskDisplay`, `sourceFieldLabel`, `targetFieldLabel`. Add derivation helpers (`sourceLabel`, `targetLabel`, `taskDisplay`). |
| `src/code-mapping/mapping-errors.ts` | Modify | Remove `sourceFieldLabel`/`targetFieldLabel` from `MappingError`. |
| `src/code-mapping/mapping-task/compose.ts` | Modify | Stop persisting labels to Task.input. Build `Task.code.text` and `Task.code.coding[0].display` using derivation helpers. |
| `src/code-mapping/concept-map/service.ts` | Modify | Replace `type.targetFieldLabel` with `targetLabel(type)` for ConceptMap naming. |
| `src/ui/pages/mapping-tasks.ts` | Modify | Replace Task.input label reads with derivation helpers via `getTaskMappingType()`. Replace `typeConfig.targetFieldLabel` with `targetLabel(typeConfig)`. Replace `taskDisplay` usage in `getMappingTypeFilterDisplay()`. |
| `src/ui/pages/code-mappings.ts` | Modify | Replace `MAPPING_TYPES[mappingType].targetFieldLabel` with `targetLabel(...)` in form labels. |
| `src/v2-to-fhir/messages/oru-r01.ts` | Modify | Emit mapping errors with `mappingType` only. |
| `src/v2-to-fhir/segments/obx-observation.ts` | Modify | Emit mapping errors with `mappingType` only. |
| `src/v2-to-fhir/segments/obr-diagnosticreport.ts` | Modify | Emit mapping errors with `mappingType` only. |
| `src/v2-to-fhir/segments/pv1-encounter.ts` | Modify | Emit mapping errors with `mappingType` only. |
| `docs/developer-guide/how-to/adding-mapping-type.md` | Modify | Document new structured metadata format. |

**Test files requiring updates** (remove `sourceFieldLabel`/`targetFieldLabel` from `MappingError` construction, update Task.input assertions, update registry shape assertions):
- `test/unit/code-mapping/mapping-errors.test.ts`
- `test/unit/code-mapping/mapping-task-service.test.ts`
- `test/unit/code-mapping/mapping-types.test.ts`
- `test/integration/helpers.ts`
- `test/integration/api/mapping-tasks-resolution.integration.test.ts`
- `test/integration/ui/mapping-tasks-queue.integration.test.ts`

## Technical Details

### Registry Shape

Replace string labels with structured metadata. Remove `taskDisplay`, `sourceFieldLabel`, `targetFieldLabel`:

```typescript
export const MAPPING_TYPES = {
  "observation-code-loinc": {
    source: { segment: "OBX", field: 3 },
    target: { resource: "Observation", field: "code" },
    targetSystem: "http://loinc.org",
  },
  "patient-class": {
    source: { segment: "PV1", field: 2 },
    target: { resource: "Encounter", field: "class" },
    targetSystem: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  },
  "obr-status": {
    source: { segment: "OBR", field: 25 },
    target: { resource: "DiagnosticReport", field: "status" },
    targetSystem: "http://hl7.org/fhir/diagnostic-report-status",
  },
  "obx-status": {
    source: { segment: "OBX", field: 11 },
    target: { resource: "Observation", field: "status" },
    targetSystem: "http://hl7.org/fhir/observation-status",
  },
} as const;
```

### Derivation Helpers

Exported from `mapping-types.ts`. All display strings are computed, never stored:

```typescript
/** "OBX-3", "PV1-2" — HL7v2 dash convention */
export function sourceLabel(config: MappingTypeConfig): string {
  return `${config.source.segment}-${config.source.field}`;
}

/** "Observation.code", "Encounter.hospitalization.admitSource" */
export function targetLabel(config: MappingTypeConfig): string {
  return `${config.target.resource}.${config.target.field}`;
}

/** "Observation.code mapping" */
export function taskDisplay(config: MappingTypeConfig): string {
  return `${targetLabel(config)} mapping`;
}
```

### Target Field Path

`target.field` is a dotted FHIR element path from the resource root. For current mapping types it is a single element (`"code"`, `"status"`, `"class"`). For future nested targets it supports dotted paths (`"hospitalization.admitSource"`). This covers all real HL7v2-to-FHIR cases — FHIR element names are the natural granularity for code mapping labels; the nesting into `.coding[0].code` is implementation detail.

### Source Field

`source.field` is always a number (HL7v2 field position). All code mapping sources are field-level (OBX-3, PV1-2, etc.). Component-level references (e.g., PID-11.7) are not needed for code mapping — the mapping always operates on the whole coded field.

### Other Changes

- `MappingError` retains only `mappingType` (plus `localCode`, `localDisplay`, `localSystem`).
- Task.input no longer includes "Source field" / "Target field" entries.
- `compose.ts` uses `sourceLabel()` and `targetLabel()` for `Task.code.text`.
- `compose.ts` uses `taskDisplay()` for `Task.code.coding[0].display`.
- `getMappingTypeOrFail()` continues to work unchanged — returns the config, callers use derivation helpers on the result.
- All consumers that previously accessed `.sourceFieldLabel` / `.targetFieldLabel` / `.taskDisplay` switch to calling the corresponding helper function.

## Edge Cases and Error Handling
- Existing Task data that still includes labels will be ignored; UI should prioritize registry labels.
- If a mapping type is missing from registry, UI should display a safe fallback (e.g., `Unknown mapping type`) rather than crashing.

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|
| Derivation helpers produce correct labels | Unit | `sourceLabel()` → `"OBX-3"`, `targetLabel()` → `"Observation.code"`, `taskDisplay()` → `"Observation.code mapping"` for each mapping type. |
| Structured metadata shape | Unit | Each mapping type has `source.segment`, `source.field`, `target.resource`, `target.field`, `targetSystem`. |
| Mapping error has no label fields | Unit | `MappingError` only contains `mappingType`, `localCode`, `localDisplay`, `localSystem`. |
| Task composition uses derived labels | Unit | `composeMappingTask()` produces Task with `code.text` from `sourceLabel`/`targetLabel` and no "Source field"/"Target field" in `input`. |
| End-to-end mapping task creation | Integration | New Task is created without labels and UI still shows correct labels. |

# Context

## Exploration Findings

# Design Analysis: sourceFieldLabel and targetFieldLabel in Mapping Registry

## Problem Statement

The mapping system stores `sourceFieldLabel` and `targetFieldLabel` in **three places**:

1. **MAPPING_TYPES registry** (`src/code-mapping/mapping-types.ts`)
2. **MappingError interface** (`src/code-mapping/mapping-errors.ts`)
3. **Task.input** (persisted FHIR resource)

This raises questions about:
- Is the duplication intentional or accidental?
- Are the registry labels serving their intended purpose?
- What was the original design assumption, and is it valid?

## Original Design Assumption

The design assumed that the **same mapping type** could be encountered in **different HL7v2 message contexts**, and therefore the labels might need to vary per instance.

For example: `patient-class` mapping could theoretically appear in:
- ADT messages (PV1 segment)
- ORU messages (PV1 segment)
- Future message types

And the labels might differ based on context (e.g., "PV1-2 (from ADT)" vs "PV1-2 (from ORU)").

## Research Findings

### HL7v2-to-FHIR Spec Evidence

The [HL7 v2-to-FHIR Implementation Guide](https://build.fhir.org/ig/HL7/v2-to-fhir/mapping_guidelines.html) confirms that the **same HL7v2 segment CAN map to different FHIR resources**:

From `docs/v2-to-fhir-spec/spec.md`:
```
- [ ] OBR[DiagnosticReport]
- [ ] OBR[ServiceRequest]
- [ ] OBR[Specimen]

- [ ] PV1[Basic-EncounterHistory]
- [ ] PV1[Coverage]
- [x] PV1[Encounter]
- [ ] PV1[Patient]
```

The spec uses "flavors" notation (e.g., `PV1[Encounter]` vs `PV1[Coverage]`) to indicate that the same segment maps to different target resources.

### Critical Analysis

**However, different FHIR targets would constitute different mapping types.**

If PV1-2 maps to:
- `Encounter.class` in `PV1[Encounter]` context
- Something else in `PV1[Coverage]` context (if applicable)

These would be **separate mapping types** with different:
- `targetSystem` (different code system URIs)
- `targetFieldLabel` (different FHIR field paths)

**Within a single mapping type, the source and target fields are fixed by definition.**

The mapping type IS the unique identifier for the source→target relationship:
- `obx-status` = OBX-11 → Observation.status (always)
- `patient-class` = PV1.2 → Encounter.class (always)

If the target field were different, it would be a different mapping type.

### Current Implementation Evidence

All converters hardcode identical values to what the registry defines:

```typescript
// obx-observation.ts:82-90
return {
  error: {
    mappingType: "obx-status",
    sourceFieldLabel: "OBX-11",           // Matches registry
    targetFieldLabel: "Observation.status", // Matches registry
  },
};

// pv1-encounter.ts:98-105
return {
  error: {
    mappingType: "patient-class",
    sourceFieldLabel: "PV1.2",            // Matches registry
    targetFieldLabel: "Encounter.class",  // Matches registry
  },
};
```

**The "flexibility" for per-instance labels is never used in practice.**

## Identified Issues

### 1. Unused Flexibility (YAGNI)
The per-instance label capability was designed for a use case that doesn't exist. The same mapping type always has the same source/target fields.

### 2. Duplication Violates DRY
Same information stored in 3 places creates maintenance burden and confusion about which is authoritative.

### 3. Inconsistency Risk
Minor notation differences already exist:
- `"OBX-3"` (dash notation)
- `"PV1.2"` (dot notation)

Without a single source of truth, such inconsistencies can accumulate.

### 4. Registry Labels Are Barely Used
Current usage of registry labels:
- `code-mappings.ts:743`: Form label `Map to ${targetFieldLabel}`
- `code-mappings.ts:795`: Update label
- `mapping-tasks.ts:268`: Dropdown label extraction

Meanwhile, Task display reads labels from Task.input (which came from MappingError), not from registry.

### 5. Confused Responsibilities
- Should UI read from Task (preserves context) or registry (single source)?
- What's the purpose of registry labels if Tasks store their own?

## Possible Solutions

Consider these solutions, but don't exclude other alternative.

### Option A: Registry as Single Source of Truth

**Remove** `sourceFieldLabel` and `targetFieldLabel` from `MappingError` interface.

- Converters only specify `mappingType`
- Task stores `mappingType` in `code.coding` (already does)
- UI derives labels: `MAPPING_TYPES[mappingType].sourceFieldLabel`
- Registry becomes authoritative

**Pros:**
- Eliminates duplication
- Guarantees consistency
- Simplifies converter code
- Clear single source of truth

**Cons:**
- Cannot have instance-specific labels if ever needed
- Breaking change to MappingError interface
- Task.input structure changes

### Option B: Remove Registry Labels

**Remove** `sourceFieldLabel` and `targetFieldLabel` from `MAPPING_TYPES`.

- Labels exist only in MappingError → Task.input
- Registry has only `taskDisplay` and `targetSystem`
- UI reads from Task.input (current behavior)

**Pros:**
- Preserves captured context at error time
- No breaking change to Task structure

**Cons:**
- Still requires converters to hardcode labels
- No single source of truth
- Inconsistency risk remains
- Registry fields purpose becomes unclear

### Option C: Keep Both with Clear Semantics

**Formalize** the separation:
- Registry labels = canonical/default for the type
- MappingError labels = instance labels (optional override)
- If MappingError labels are undefined, fall back to registry

**Pros:**
- Maximum flexibility
- Backward compatible

**Cons:**
- Added complexity
- Unclear when to use which
- Likely YAGNI

## Open Questions

1. **Is there ANY scenario where the same mapping type would genuinely need different labels?**
   - Different HL7v2 versions? (Unlikely - field positions are stable)
   - Display customization? (Could be handled differently)

2. **Would removing labels from Task.input break existing data?**
   - Need to assess migration impact
   - Could keep Task.input for display but derive from registry going forward

3. **Should registry store more semantic info?**
   - Currently stores string labels
   - Could store structured data (segment, field number, FHIR resource, FHIR field)

## Sources

- [HL7 v2-to-FHIR Mapping Guidelines](https://build.fhir.org/ig/HL7/v2-to-fhir/mapping_guidelines.html)
- [HL7 v2-to-FHIR Segment Maps](https://build.fhir.org/ig/HL7/v2-to-fhir/segment_maps.html)
- [PV1 Segment Definition](http://v2plus.hl7.org/2021Jan/segment-definition/PV1.html)
- [HL7 PV1 Segment - Rhapsody](https://rhapsody.health/resources/hl7-pv1-patient-visit-information-segment/)
- Project spec: `docs/v2-to-fhir-spec/spec.md`

## User Requirements & Answers
- User wants a recommendation on whether labels belong in registry or Task input.
- Backward compatibility is not required; migration instructions are optional if needed.
- User agreed to document Option A (registry as source of truth) and mark other options rejected with reasons.
- User decided structured metadata should be part of this change (not deferred). Rationale: project is a public foundation; avoid every adopter refactoring from strings to structured data later.
- User decided `taskDisplay` should be derived always, not an explicit field. Hand-written values are inconsistently styled; derivation guarantees consistency.
- Source notation: normalize to dash (`PV1-2`) — enforced by construction via `sourceLabel()` helper.

## AI Review Notes

**Review outcome: approved with minor issues.**

### Design Review

The core analysis is thorough and well-reasoned. The research correctly establishes that `sourceFieldLabel`/`targetFieldLabel` are always fixed per mapping type — within a single mapping type the source→target relationship is invariant by definition. The decision to choose Option A (registry as single source of truth) over Options B and C is well-justified: it eliminates duplication without adding complexity, and the YAGNI argument against per-instance label overrides holds because different targets would constitute different mapping types.

The DESIGN PROTOTYPE comments placed throughout the codebase (`mapping-errors.ts`, `compose.ts`, `mapping-tasks.ts`, and all four converters) correctly mark every change point, showing the author traced the full data flow.

The existing `getMappingTypeOrFail()` function already provides the exact lookup mechanism needed — no new helper is required. The proposed design integrates cleanly with the existing fail-fast pattern.

### Issues (sorted by severity)

**1. Medium — Affected components table is incomplete**

The table lists 8 files but misses:
- `src/code-mapping/concept-map/service.ts:225` — uses `type.targetFieldLabel` for ConceptMap naming. Already reads from registry (no change needed), but should be documented to give implementers the full picture of label consumers.
- `src/ui/pages/code-mappings.ts:294,346` — uses `MAPPING_TYPES[mappingType].targetFieldLabel` for form labels. Also already reads from registry, but omitting it makes the affected components list look incomplete.
- `docs/developer-guide/how-to/adding-mapping-type.md:24-25` — documents `sourceFieldLabel`/`targetFieldLabel` as fields to add when creating a new mapping type. Needs updating.

These files already use the registry pattern (which is the design's goal), so they don't need code changes — but listing them confirms the audit is exhaustive.

**2. Medium — Test impact not quantified**

The design proposes 4 test cases but doesn't acknowledge the ~70+ existing test references to `sourceFieldLabel`/`targetFieldLabel` across 6 test files:
- `test/unit/code-mapping/mapping-errors.test.ts` (~30 occurrences)
- `test/unit/code-mapping/mapping-task-service.test.ts` (~20 occurrences)
- `test/unit/code-mapping/mapping-types.test.ts`
- `test/integration/api/mapping-tasks-resolution.integration.test.ts`
- `test/integration/ui/mapping-tasks-queue.integration.test.ts`
- `test/integration/helpers.ts`

All of these construct `MappingError` objects with explicit label fields or assert on Task.input containing "Source field"/"Target field" entries. Removing labels from `MappingError` and Task.input will require updating all of them. This is mechanical work but should be called out so the implementer doesn't discover it mid-implementation.

**3. Low — Notation inconsistency deferred but could be fixed now**

The design correctly identifies the notation inconsistency (`"OBX-3"` dash vs `"PV1.2"` dot) in the research section but doesn't propose fixing it. Since the registry becomes the sole source of truth and all converter-level duplicates are removed, this is the ideal moment to normalize notation at minimal cost. Suggest either: normalize to dash (`PV1-2`) matching HL7v2 convention, or leave as-is and add a brief note explaining why (e.g., the dot notation follows FHIR's segment.field convention). Either way, make the decision explicit.

**4. Low — Task.code.text derivation deserves explicit mention**

`compose.ts:109` builds `text: \`Map ${error.sourceFieldLabel} to ${error.targetFieldLabel}\``. After removing labels from `MappingError`, this must read from the registry instead. The prototype comment at line 107 notes this, but the Affected Components table description for `compose.ts` says "compose text from registry labels" — it would be clearer to explicitly state that `Task.code.text` will change from using `error.*` to `MAPPING_TYPES[error.mappingType].*`.

### Recommendation

Approve for implementation. The core decision and scope are correct. Before implementation planning, update the affected components table to include the missing files and test files, and decide on notation normalization (dash vs dot).

## User Feedback
[TBD]

# Implementation Plan

## Overview
Replace string labels (`sourceFieldLabel`, `targetFieldLabel`, `taskDisplay`) in the mapping registry with structured metadata (`source: { segment, field }`, `target: { resource, field }`). Remove per-instance labels from `MappingError` and `Task.input`. All display strings are derived from structured data via helper functions. This eliminates duplication across three storage locations, prevents notation drift (dash vs dot), and simplifies converters.

## Development Approach
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: `bun run typecheck` and `bun test:unit` must pass before starting next task**
- **CRITICAL: update this plan when scope changes**

## Validation Commands
- `bun test:unit` — Run unit tests
- `bun test:integration` — Run integration tests
- `bun test:all` — Run all tests (unit + integration)
- `bun run typecheck` — TypeScript type checking

---

## Task 1: Rewrite registry with structured metadata + update all src/ consumers

Rewrite `MAPPING_TYPES` with structured metadata and derivation helpers. Update all source files that access the old string fields (`.taskDisplay`, `.sourceFieldLabel`, `.targetFieldLabel`) on the config object.

- [x] **mapping-types.ts**: Replace `MAPPING_TYPES` entries — remove `taskDisplay`, `sourceFieldLabel`, `targetFieldLabel`; add `source: { segment, field }` and `target: { resource, field }` per the design's Registry Shape section
- [x] **mapping-types.ts**: Add exported derivation helpers: `sourceLabel(config)`, `targetLabel(config)`, `taskDisplay(config)` per the design's Derivation Helpers section
- [x] **mapping-types.ts**: Update module docstring to reflect new structured fields and helpers
- [x] **compose.ts:104**: Change `display: typeConfig.taskDisplay` → `display: taskDisplay(typeConfig)` (import `taskDisplay` from mapping-types)
- [x] **concept-map/service.ts:225**: Change `type.targetFieldLabel` → `targetLabel(type)` in `createEmptyConceptMap()` (import `targetLabel` from mapping-types)
- [x] **mapping-tasks.ts:28**: Change `MAPPING_TYPES[filter].taskDisplay.replace(...)` → `taskDisplay(MAPPING_TYPES[filter]).replace(...)` in `getMappingTypeFilterDisplay()`
- [x] **mapping-tasks.ts:266**: Change `typeConfig.targetFieldLabel.split(".").pop()` → `targetLabel(typeConfig).split(".").pop()` in `renderResolutionForm()` (import `targetLabel`)
- [x] **mapping-tasks.ts:300-301**: Replace Task.input reads for "Source field"/"Target field" with registry derivation: use `getTaskMappingType(task)` → `MAPPING_TYPES[mappingType]` → `sourceLabel(config)` / `targetLabel(config)`
- [x] **code-mappings.ts:55**: Change `MAPPING_TYPES[filter].taskDisplay.replace(...)` → `taskDisplay(MAPPING_TYPES[filter]).replace(...)` in `getMappingTypeFilterDisplay()` (import `taskDisplay`)
- [x] **code-mappings.ts:294**: Change `MAPPING_TYPES[mappingType].targetFieldLabel` → `targetLabel(MAPPING_TYPES[mappingType])` in `renderAddMappingForm()` (import `targetLabel`)
- [x] **code-mappings.ts:346**: Change `MAPPING_TYPES[mappingType].targetFieldLabel` → `targetLabel(MAPPING_TYPES[mappingType])` in `renderMappingEntryPanel()`
- [x] **mapping-types.test.ts**: Rewrite "each type has all required fields" test to check `source.segment`, `source.field`, `target.resource`, `target.field`, `targetSystem`
- [x] **mapping-types.test.ts**: Rewrite "observation-code-loinc type has correct configuration" to assert structured shape
- [x] **mapping-types.test.ts**: Add tests for `sourceLabel()`, `targetLabel()`, `taskDisplay()` for each mapping type
- [x] Run `bun run typecheck` and `bun test:unit` — must pass before next task

---

## Task 2: Remove labels from MappingError + update converters + compose.ts Task.input

Remove `sourceFieldLabel` and `targetFieldLabel` from the `MappingError` interface. Update all converters that construct `MappingError` objects. Update `compose.ts` to stop persisting labels in Task.input and derive `code.text` from registry.

- [x] **mapping-errors.ts:31-32**: Remove `sourceFieldLabel: string` and `targetFieldLabel: string` from `MappingError` interface
- [x] **obx-observation.ts** (3 locations: `mapOBXStatusToFHIRWithResult` ~line 90, `resolveOBXStatus` ~lines 542 and 570): Remove `sourceFieldLabel` and `targetFieldLabel` from all `MappingError` object literals
- [x] **obr-diagnosticreport.ts** (3 locations: `mapOBRStatusToFHIRWithResult` ~line 81, `resolveOBRStatus` ~lines 291 and 320): Remove `sourceFieldLabel` and `targetFieldLabel` from all `MappingError` object literals
- [x] **pv1-encounter.ts** (2 locations: `mapPatientClassToFHIRWithResult` ~line 105, `resolvePatientClass` ~line 250): Remove `sourceFieldLabel` and `targetFieldLabel` from all `MappingError` object literals
- [x] **oru-r01.ts:192-193**: Remove `sourceFieldLabel` and `targetFieldLabel` from the LOINC `MappingError` in `convertOBXToObservationResolving()`
- [x] **compose.ts:89-90**: Remove the two lines that push "Source field" and "Target field" to Task.input
- [x] **compose.ts:109**: Change `text: \`Map ${error.sourceFieldLabel} to ${error.targetFieldLabel}\`` → `text: \`Map ${sourceLabel(typeConfig)} to ${targetLabel(typeConfig)}\`` (import `sourceLabel`, `targetLabel`)
- [x] **mapping-errors.test.ts**: Remove `sourceFieldLabel` and `targetFieldLabel` from ALL `MappingError` constructions (~10 occurrences across all test cases)
- [x] **mapping-task-service.test.ts**: Remove `sourceFieldLabel` and `targetFieldLabel` from ALL `MappingError` constructions (~8 occurrences)
- [x] **mapping-task-service.test.ts**: Remove assertions on `inputMap.get("Source field")` and `inputMap.get("Target field")` from composeMappingTask tests (~4 test cases)
- [x] **mapping-task-service.test.ts**: Update Task.code.coding[0].display assertions to match new derived values (e.g., `"Observation.code mapping"` instead of `"Observation code to LOINC mapping"`)
- [x] **mapping-task-service.test.ts**: Remove `sampleTask.input` entries for "Source field" and "Target field"
- [x] Run `bun run typecheck` and `bun test:unit` — must pass before next task

---

## Task 3: Update integration tests

Update all integration test files to match the new Task structure (no Source/Target field in input, derived display values).

- [ ] **test/integration/helpers.ts:123**: Change `typeConfig.targetFieldLabel` → `targetLabel(typeConfig)` in `createTestConceptMapForType()` (import `targetLabel` from mapping-types)
- [ ] **test/integration/api/mapping-tasks-resolution.integration.test.ts**: Update Task creation helpers — change `typeConfig.taskDisplay` to `taskDisplay(typeConfig)`, change `typeConfig.sourceFieldLabel`/`targetFieldLabel` to `sourceLabel(typeConfig)`/`targetLabel(typeConfig)`, remove "Source field"/"Target field" from Task.input
- [ ] **test/integration/ui/mapping-tasks-queue.integration.test.ts**: Same updates as above — derived display, derived labels, no Source/Target field in input
- [ ] **test/integration/ui/mapping-tasks-filtering.integration.test.ts**: Update `createTask()` helper to use `taskDisplay(config)` instead of `config.taskDisplay`
- [ ] **test/integration/v2-to-fhir/oru-r01.integration.test.ts**: Remove assertions on Task.input containing "Source field" / "Target field" entries (lines ~336-341, ~407-412)
- [ ] Run `bun run typecheck` and `bun test:all` — must pass before next task

---

## Task 4: Update documentation

- [ ] **docs/developer-guide/how-to/adding-mapping-type.md**: Replace the MAPPING_TYPES example to show the new structured format (`source: { segment, field }`, `target: { resource, field }`, `targetSystem`)
- [ ] **adding-mapping-type.md**: Remove references to `taskCode`, `taskDisplay`, `sourceFieldLabel`, `targetFieldLabel` as fields to add
- [ ] **adding-mapping-type.md**: Update the converter example to show `MappingError` without label fields
- [ ] **adding-mapping-type.md**: Mention that display labels are derived automatically from structured metadata
- [ ] Run `bun run typecheck` — must pass before next task

---

## Task 5: Cleanup design artifacts

- [ ] Remove all `DESIGN PROTOTYPE: 2026-02-02-mapping-labels-design-analysis.md` comments from codebase (files: `mapping-errors.ts`, `compose.ts`, `mapping-tasks.ts`, `oru-r01.ts`, `obx-observation.ts`, `obr-diagnosticreport.ts`, `pv1-encounter.ts`)
- [ ] Update design document frontmatter status to `implemented`
- [ ] Verify no prototype markers remain: `grep -r "DESIGN PROTOTYPE: 2026-02-02-mapping-labels-design-analysis" src/`
- [ ] Run `bun test:all` and `bun run typecheck` — final verification

---

## Post-Completion Verification
1. **Functional test**: Start server (`bun run dev`), navigate to `/mapping/tasks` and `/mapping/table` — verify labels display correctly for all mapping types
2. **Edge case test**: Verify that existing Tasks (with old Source/Target field inputs) still render correctly in the UI (labels come from registry now, old input fields are simply ignored)
3. **Integration check**: Submit a test HL7v2 message with an unmapped code, verify Task is created without Source/Target field in input, and UI shows correct labels
4. **No regressions**: All existing tests pass (`bun test:all`)
5. **Cleanup verified**: No `DESIGN PROTOTYPE` comments remain in `src/`

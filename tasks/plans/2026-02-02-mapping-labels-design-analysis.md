---
status: explored
reviewer-iterations: 0
prototype-files: []
---

# Design: Mapping Labels in Code Mapping Registry

## Problem Statement
The mapping system stores `sourceFieldLabel` and `targetFieldLabel` in three places, which creates duplication, inconsistency risk, and unclear ownership. The labels are effectively fixed by mapping type, yet are redundantly hardcoded in converters and persisted in Task input. We need a single source of truth for labels without sacrificing maintainability.

## Proposed Approach
Make the mapping registry authoritative for labels and remove per-instance labels from `MappingError` and Task input. Converters will only specify `mappingType`, and UI surfaces will derive labels from `MAPPING_TYPES`. Document a future improvement to replace string labels with structured metadata (segment/field and resource/field) for safer formatting and consistency.

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Label source of truth | A) Registry only, B) Task only, C) Registry + Task override | A | Mapping type already defines source/target; registry prevents drift and removes duplication. |
| Keep labels in Task input | Keep vs remove | Remove | No backward compatibility requirement; Task should not duplicate canonical labels. |
| Structured metadata | Add now vs defer | Defer | Keep change minimal; note as future enhancement if label formatting needs grow. |

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
| `src/code-mapping/mapping-types.ts` | Modify | Ensure labels are defined here as canonical. |
| `src/code-mapping/mapping-errors.ts` | Modify | Remove `sourceFieldLabel`/`targetFieldLabel` from `MappingError`. |
| `src/code-mapping/mapping-task-service.ts` | Modify | Stop persisting labels to Task input; rely on mapping type. |
| `src/ui/code-mappings.ts` | Modify | Derive labels from registry instead of Task input. |
| `src/ui/mapping-tasks.ts` | Modify | Derive labels from registry instead of Task input. |

## Technical Details
- `MappingError` should include only `mappingType` for label derivation.
- Task input should not include `sourceFieldLabel`/`targetFieldLabel`; UI will look up labels from `MAPPING_TYPES[mappingType]`.
- Add a small helper (if needed) to resolve labels from mapping type and provide display defaults.
- Future option: replace string labels with structured metadata in `MAPPING_TYPES`, such as:
  - `sourceSegment: "PV1"`, `sourceField: "2"`
  - `targetResource: "Encounter"`, `targetField: "class"`
  This would allow consistent formatting (`PV1-2`, `Encounter.class`) without hand-maintained strings.

## Edge Cases and Error Handling
- Existing Task data that still includes labels will be ignored; UI should prioritize registry labels.
- If a mapping type is missing from registry, UI should display a safe fallback (e.g., `Unknown mapping type`) rather than crashing.

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|
| Resolve labels from mapping type | Unit | Registry lookup returns expected source/target labels for known types. |
| Task UI label rendering | Unit | Task list renders labels from registry when Task input lacks labels. |
| Mapping error creation | Unit | Converters emit mapping errors without label fields. |
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
- User requested a mention of structured metadata as a future consideration.

## AI Review Notes
[TBD]

## User Feedback
[TBD]

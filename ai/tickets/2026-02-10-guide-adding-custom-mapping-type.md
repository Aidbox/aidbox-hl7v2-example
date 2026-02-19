# Task: Developer guide for adding a new custom mapping type to a converter

## Problem

Adding a new mapping type (e.g., for a new HL7v2 field that needs ConceptMap-based resolution) requires touching multiple files across the code-mapping and converter layers. There's no step-by-step guide — a developer must reverse-engineer the pattern from existing types like `patient-class` or `obx-status`.

The existing `docs/developer-guide/code-mapping.md` documents the four current mapping types and the resolution flow, but doesn't explain how to add a new one.

## Scope

Write a how-to guide covering the end-to-end process of adding a new mapping type. Should cover:

1. **Register the mapping type** in `src/code-mapping/mapping-types.ts` (the `MAPPING_TYPES` registry — CLAUDE.md marks this as CRITICAL)
2. **Define validation rules** for the target value set (e.g., `src/code-mapping/validation.ts`)
3. **Build the MappingError** in the segment converter using `mapping-errors.ts` builders
4. **Return the error to the caller** via the segment converter's result type (e.g., `PV1ConversionResult.mappingError`)
5. **Handle the error in the message converter** — collect errors, call `buildMappingErrorResult`, create Tasks via `composeMappingTask`
6. **Wire up UI** — ensure the mapping task queue and resolution UI work for the new type (mostly automatic if `mapping-types.ts` is correct)
7. **Test** — what to cover in unit and integration tests

## Format

Add as a new section or a separate how-to page in `docs/developer-guide/`. Should include concrete code snippets referencing the existing patterns (e.g., how `patient-class` was added to PV1/ADT).

## Files to reference

- `src/code-mapping/mapping-types.ts` — type registry
- `src/code-mapping/mapping-errors.ts` — MappingError type and builders
- `src/code-mapping/mapping-task/compose.ts` — Task creation
- `src/code-mapping/validation.ts` — target value validation
- `src/v2-to-fhir/segments/pv1-encounter.ts` — example: `mapPatientClassToFHIRWithResult` returning `PatientClassResult`
- `src/v2-to-fhir/messages/adt-a01.ts` — example: collecting mapping errors, calling `buildMappingErrorResult`
- `docs/developer-guide/code-mapping.md` — existing mapping docs to extend

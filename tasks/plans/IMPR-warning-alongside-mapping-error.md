---
status: pending
priority: low
related: tasks/completed/2026-02-03-unified-encounter-id-generation.md
---

# Improvement: Show warning alongside mapping_error status

## Problem

When a PV1 segment has both a patient-class mapping error AND an identifier error (with `converter.PV1.required=false`), the mapping error path takes precedence and returns `mapping_error` status. The identifier warning is silently discarded.

On reprocessing after mapping resolution, the identifier warning surfaces — so this is self-healing — but the user never sees both issues at once.

**User Note**: probably, we want to record preprocessor failures as warnings as well. So a message may have several warnings. 

## Affected Files

- `src/v2-to-fhir/messages/adt-a01.ts` (lines ~382-405)
- `src/v2-to-fhir/messages/oru-r01.ts` (lines ~985-987)

## Current Behavior

1. PV1 conversion returns both `mappingError` and `identifierError`
2. Mapping errors are collected → early return with `status=mapping_error`
3. Identifier warning is never checked because `mapping_error` path returns first

## Desired Behavior

When both mapping errors and identifier warnings co-exist, the `mapping_error` result should include the identifier warning text so the user sees all issues at once. The exact UX (e.g., appending warning to error field, or a separate field) is TBD.

## Severity

Low. Only manifests with `required=false` config AND concurrent mapping + identifier failures.

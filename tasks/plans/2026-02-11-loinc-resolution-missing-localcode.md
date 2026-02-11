---
status: created
---

# Handle missing localCode in LoincResolutionError

## Problem Statement

When OBX-3 has no code value (component 1 is empty), `resolveFromConceptMap()` in `observation-code-resolver.ts` throws a `LoincResolutionError` with `localCode: undefined`. The caller in `oru-r01.ts` catches this and creates a `MappingError` with `localCode: ""` (via `error.localCode || ""`).

Downstream in `buildMappingErrorResult()`, `localCode: ""` is silently skipped (`if (!error.localCode) continue`). So we:
1. Throw a `LoincResolutionError`
2. Catch it and build a `MappingError`
3. The `MappingError` is immediately discarded

This means no Task is created for this case, and the message processing continues without surfacing the issue properly. The empty-code OBX segment is silently dropped.

## Questions to Investigate

1. **Is an OBX segment without OBX-3 code valid per HL7v2 spec?** OBX-3 (Observation Identifier) is required (R) in HL7v2. An empty OBX-3 is a malformed segment. Should we treat this as a hard error rather than a mapping error?

2. **What should happen to the message?** Options:
   - **Error the message** — a missing OBX-3 code is a data quality problem, not a mapping problem. The message should get `status: error` with a clear error description.
   - **Skip the OBX with a warning** — process the rest of the message but flag the bad segment.
   - **Create a mapping task anyway** — but what would the user resolve? There's no local code to map from.

3. **Should `LoincResolutionError` require `localCode`?** If the "no code" case is handled differently (e.g., as a hard error), the remaining `LoincResolutionError` throws all have `localCode` defined, and the field could become required.

## Current Code Path

```
observation-code-resolver.ts:134  — if (!localCode) throw LoincResolutionError(localCode=undefined)
oru-r01.ts:187                    — catch → MappingError { localCode: "" }
mapping-errors.ts:53              — if (!error.localCode) continue; // silently skipped
```

## Affected Files

- `src/code-mapping/concept-map/observation-code-resolver.ts` — the throw site
- `src/v2-to-fhir/messages/oru-r01.ts` — the catch site with `|| ""` fallback
- `src/code-mapping/mapping-errors.ts` — the silent skip

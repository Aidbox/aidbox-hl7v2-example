---
status: created
reviewer-iterations: 0
prototype-files: []
---

# Refactor Preprocessors to Immutable (Return New Segment)

## Problem

All preprocessors currently mutate segments in place:

- `fixAuthorityWithMsh` sets `(pv1_19 as Record<number, FieldValue>)[4] = { 1: namespace }`
- `movePid2IntoPid3` does `delete segment.fields[2]`, mutates `segment.fields[3]`
- `injectAuthorityFromMsh` sets `(fv as Record<number, FieldValue>)[4] = { 1: namespace }`

The `SegmentPreprocessorFn` signature is `(context, segment) => void`, enforcing mutation as the only mechanism.

This causes:
1. **Shared state bugs** — if a segment reference is held elsewhere (e.g., by a `fromPID()` call before preprocessing), mutations silently affect the already-read data
2. **Hard to debug** — no way to compare before/after without manually snapshotting
3. **No dry-run/diff support** — cannot preview what preprocessing would do without actually doing it
4. **Inconsistent with `preprocessMessage`** — the top-level function returns `HL7v2Message` (suggesting immutability), but the returned value is the same mutated reference

## Proposed Change

Change `SegmentPreprocessorFn` from:
```typescript
type SegmentPreprocessorFn = (context: PreprocessorContext, segment: HL7v2Segment) => void;
```

To:
```typescript
type SegmentPreprocessorFn = (context: PreprocessorContext, segment: HL7v2Segment) => HL7v2Segment;
```

Each preprocessor returns a new `HL7v2Segment` (or the same reference if no changes were made). `applyPreprocessors` replaces the segment in the message array with the returned value.

## Scope

- `src/v2-to-fhir/preprocessor-registry.ts` — change all preprocessor signatures and implementations
- `src/v2-to-fhir/preprocessor.ts` — update `applyPreprocessors` to use returned segments
- All preprocessor tests — update expectations (returned vs mutated)

## Notes

- This is a pure internal refactoring — no config changes, no behavior changes
- Consider whether `PreprocessorContext.parsedMessage` should also be immutable (it currently allows cross-segment reads; if a preprocessor modifies a segment, the context's message reference sees the mutation)

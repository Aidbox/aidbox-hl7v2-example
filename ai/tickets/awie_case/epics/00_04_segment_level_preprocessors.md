# Ticket: Segment-Level Preprocessors Framework Extension

## Problem

The preprocessor framework (`src/v2-to-fhir/preprocessor.ts`) only supports field-level
preprocessors: each registered preprocessor fires when a specific field (e.g., `PID."2"`) is
present and non-empty in a segment. This makes it impossible to register preprocessors that
operate across multiple fields of a segment — without coupling the trigger to a specific source
field.

The `move-pid2-into-pid3` preprocessor (introduced in `00_01_identification_system.md`) is a
cross-field operation: it reads PID-2 and writes to PID-3. Currently it is registered under PID
field `"2"` (correct gate: only fires if PID-2 is non-empty), but semantically it belongs at the
segment level. The field-2 registration is a workaround, not a correct model.

## Proposed Solution

Extend `MessageTypeConfig.preprocess` to support a `"$"` (or `"$segment"`) sentinel key alongside
field keys:

```json
{
  "preprocess": {
    "PID": {
      "$": ["move-pid2-into-pid3"],
      "3": ["inject-authority-from-msh"]
    }
  }
}
```

Semantics: a preprocessor registered under `"$"` fires once for every matching segment instance,
with no field-presence guard. The preprocessor receives the full segment and is responsible for
its own internal guards.

Implementation in `preprocessor.ts`:
- In `applyPreprocessors()`, handle the `"$"` key before iterating field keys: call the listed
  preprocessors unconditionally for each matching segment (no `isFieldPresentInSegment` check).

## Sub-Tasks

1. **Extend `applyPreprocessors`** to fire `"$"` registrations unconditionally.
2. **Update `MessageTypeConfig.preprocess` type** to allow `"$"` as a field key (currently typed
   to segment-specific field names).
3. **Migrate `move-pid2-into-pid3`** from `PID."2"` to `PID."$"` registration in
   `config/hl7v2-to-fhir.json` and in its prototype documentation.
4. **Update unit tests** in `preprocessor.test.ts` to cover `"$"` key behavior.

## Context

- Related: `00_01_identification_system.md` (introduces `move-pid2-into-pid3`)
- The `"$"` sentinel is the minimal change; no existing preprocessors are affected
- `inject-authority-from-msh` stays on field `"3"` — its gate (PID-3 must be present) is correct

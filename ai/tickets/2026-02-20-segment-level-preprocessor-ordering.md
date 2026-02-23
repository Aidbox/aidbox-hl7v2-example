---
status: created
reviewer-iterations: 0
prototype-files: []
---

# Segment-Level Preprocessor Ordering

## Problem

The preprocessor framework currently organizes preprocessors by **segment + field number**: each preprocessor is registered against a specific field (e.g., PID field "2", PID field "3", PV1 field "19"). The framework iterates fields via `Object.entries(segmentConfig)`, which for integer-keyed objects returns keys in ascending numeric order in JavaScript.

This creates a fragile implicit ordering dependency. For example, `move-pid2-into-pid3` (field "2") must run before `inject-authority-from-msh` (field "3") because the latter needs to see the CX entries that the former moved into PID-3. Today this works because "2" < "3" in numeric order, but:

1. **The ordering guarantee is implicit** — there's no declaration that preprocessor A must run before preprocessor B. A developer adding a new field-level preprocessor has no way to express "run after X".
2. **Field numbers don't always align with logical ordering** — a future preprocessor on field "5" (Patient Name) might need to run before a preprocessor on field "3" (Patient Identifier).
3. **Some preprocessors are conceptually segment-level** — `move-pid2-into-pid3` reads from field 2 and writes to field 3, spanning two fields. Registering it on field "2" is a workaround because the framework only supports field-level registration. The field-presence gate (`isFieldPresentInSegment`) gates invocation on the registered field, which is correct here (PID-2 must be present), but the gate semantics don't match the preprocessor's actual scope (it modifies PID-3).

## Proposed Solution

Add a segment-level preprocessor list to the config schema, executed in declared order before any field-level preprocessors:

```json
{
  "preprocess": {
    "PID": {
      "_order": ["move-pid2-into-pid3", "inject-authority-from-msh"],
      "2": ["move-pid2-into-pid3"],
      "3": ["inject-authority-from-msh"]
    }
  }
}
```

Or, alternatively, replace the field-keyed structure with an ordered list:

```json
{
  "preprocess": {
    "PID": [
      { "id": "move-pid2-into-pid3", "field": "2" },
      { "id": "inject-authority-from-msh", "field": "3" }
    ]
  }
}
```

The second option makes ordering explicit and allows preprocessors to optionally omit the `field` gate (segment-level preprocessors that fire unconditionally).

## Sub-tasks

1. Decide on config schema (ordered list vs `_order` key)
2. Update `MessageTypeConfig.preprocess` type and `applyPreprocessors` in `preprocessor.ts`
3. Migrate `move-pid2-into-pid3` to segment-level (no field-presence gate needed if PID-2 absence is handled by the preprocessor itself — which it already does)
4. Update config validation in `config.ts`
5. Migrate existing tests

## Context

- Created as a follow-up from the patient-encounter-identity design (`ai/tickets/awie_case/2026-02-19-patient-encounter-identity.md`, line 95)
- Related: `ai/tickets/2026-02-04-global-preprocessors.md` (global per-segment preprocessing config)
- Current field-ordering behavior validated in `test/unit/v2-to-fhir/preprocessor-pid.test.ts` (combined test)

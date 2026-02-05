---
status: draft
---

# Draft: Preprocessors For Missing PV1-19

## Problem
Current preprocessor rules only apply when PV1-19 is present. There is no way to run a preprocessor when PV1-19 is missing entirely (e.g., add authority or synthesize a visit number before conversion).

## Proposed Direction
- Add a configuration option to run segment preprocessors when a configured field is missing.
- Keep this opt-in per message type and per segment/field to avoid unintended behavior.
- Ensure explicit ordering with existing preprocessors and consistent behavior for multi-segment messages.

## Open Questions
- Should the trigger be per-field (e.g., `PV1.19.whenMissing`) or per-segment (e.g., `PV1.whenMissing`)?
- Should "missing" include empty/whitespace values or only absent fields?
- How should conflicts be handled if a "whenMissing" preprocessor creates PV1-19 that other preprocessors also modify?

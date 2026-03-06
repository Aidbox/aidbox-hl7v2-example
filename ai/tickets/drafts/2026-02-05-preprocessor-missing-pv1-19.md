---
status: draft
---

# Draft: Preprocessor for Missing PV1-19

## Problem Statement
The current `fix-pv1-authority-with-msh` preprocessor only handles the case where PV1-19 exists but is missing authority components (CX.4/9/10). It does not handle the case where PV1-19 is missing entirely.

Some HL7v2 senders may not include PV1-19 at all, requiring a preprocessor to generate a visit number from other available data.

## Potential Approaches

1. **Generate from MSH context**: Create a deterministic visit number from MSH-10 (Message Control ID) or MSH-7 (Date/Time) combined with MSH-3/4.

2. **Generate from PID context**: Create a visit number from patient identifier (PID-3) combined with message date.

3. **Generate from encounter context**: Create from PV1-44 (Admit Date/Time) or PV1-45 (Discharge Date/Time) if available.

## Considerations

- Should this be a separate preprocessor ID (e.g., `generate-visit-number-from-msh`)?
- How to handle idempotency? The generated visit number should be deterministic.
- What if the message is reprocessed? Should the same visit number be generated?
- Should this be configurable per sender?

## Status
This is a placeholder for future implementation. The current preprocessor pipeline supports this use case, but the specific preprocessor implementation is deferred.

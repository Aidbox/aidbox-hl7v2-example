---
status: draft
---

# Feature Draft: Message Profile Support for Authority Precedence

## Problem Statement

HL7 v2.8.2 allows CX.4 (Assigning Authority), CX.9 (Assigning Jurisdiction), and CX.10 (Assigning Agency/Department) to all be valued simultaneously. When these values conflict, the spec states:

> "If, in so doing, it is discovered that the values in [CX.9] and/or [CX.10] conflict with [CX.4], the user would look to the **Message Profile** or other implementation agreement for a statement as to which takes precedence."
>
> — HL7 v2.8.2, Section 2.A.56.9

Currently, the unified encounter ID generation (2026-02-03) treats conflicting authority values as errors because we have no message profile support. This feature would add configurable precedence rules.

## Spec Reference

From HL7 v2.8.2 Section 2.A.56.9 (Assigning Authority):

```
By site agreement, implementors may continue to use User-defined Table 0300 -
Namespace ID for the first sub-component.

Attention: As of v 2.7, the Assigning Authority is conditional. It is required
if [identifier] is populated and neither [Jurisdiction] nor [Agency] are populated.
All 3 components may be populated. No assumptions can be safely made based on
position or sequence. Best practice is to send an OID in this component when populated.

The reader is referred to [Jurisdiction] and [Agency] if there is a need to transmit
values with semantic meaning for an assigning jurisdiction or assigning department
or agency in addition to, or instead of, an assigning authority. However, all 3
components may be valued. If, in so doing, it is discovered that the values conflict,
the user would look to the Message Profile or other implementation agreement for a
statement as to which takes precedence.
```

## Proposed Approach

Extend `config/hl7v2-to-fhir.json` to support authority precedence rules per message type:

```json
{
  "ORU-R01": {
    "preprocess": { ... },
    "converter": {
      "PV1": {
        "required": false,
        "authorityPrecedence": ["CX.4", "CX.9", "CX.10"]
      }
    }
  }
}
```

When multiple authority components are present:
1. If `authorityPrecedence` is configured, use the first populated component in the list
2. If not configured, treat conflicts as errors (current behavior)

## Open Questions

1. Should precedence be global or per-message-type?
2. Should we support per-sender precedence rules?
3. Should we validate that the chosen authority component has a valid OID format?
4. How should we handle partial conflicts (e.g., CX.4 and CX.9 have same namespace but different universal IDs)?

## Dependencies

- Requires unified encounter ID generation (2026-02-03) to be implemented first
- This feature extends the config schema and id-generation module

## Notes

This is a future enhancement. The current implementation (2026-02-03) treats conflicts as errors, which is safe but may reject valid messages from systems that populate multiple authority components.

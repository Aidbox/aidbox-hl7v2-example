# Known Gap: ASTRA Non-Standard PV1-51 Usage

**Discovered during:** Epic 0.1 (Cross-EHR Patient & Encounter Identity) design

---

## Problem

In ASTRA ADT-A04 messages, PV1-51 contains data that looks like a CX identifier (e.g., `^^^^ST01W^TN`). Per HL7v2 spec (both v2.5 and v2.8.2), **PV1-51 is Visit Indicator** — a single-character flag from Table 0326 (`A` = account-level, `V` = visit-level). It is definitively NOT a visit/encounter identifier field.

ASTRA is populating a spec-defined IS/CWE flag field with what appears to be an encounter identifier. This is a sender-specific, non-standard extension.

## Observed Data

```
# ASTRA ADT-A04 sample (data/local/awie_case/awie_case_data/ASTRA-ADT-A04-01/)
PV1 field 51: ^^^^ST01W^TN
```

This resembles a CX structure (authority `ST01W`, type `TN`), but occupies the spec-defined Visit Indicator position.

## Spec Reference

| Field | Name | Type | Table | Notes |
|-------|------|------|-------|-------|
| PV1-19 | Visit Number | CX | — | Standard encounter identifier |
| PV1-50 | Alternate Visit ID | CX | 0203 | Already captured as `Encounter.identifier` |
| PV1-51 | Visit Indicator | IS (v2.5) / CWE (v2.8.2) | 0326 | `A`=account-level, `V`=visit-level. NOT an identifier |

## Impact

- Current processing: PV1-51 is unused in the converter (correctly ignored per spec).
- Risk: If ASTRA sends a meaningful encounter identifier only in PV1-51 (not in PV1-19), those encounters may get wrong IDs or fail ID generation.
- This has NOT been confirmed as a real data issue — the sample shows the value exists, but it's unknown whether PV1-19 is also populated in these messages.

## Recommended Solution (when prioritized)

Add a sender-specific preprocessor rule `promote-pv1-51-to-pv1-19`:
- Fires on ASTRA messages only (configured per-sender in `config/hl7v2-to-fhir.json`)
- Condition: PV1-19 is empty AND PV1-51 contains something that parses as a valid CX
- Action: Copy the CX data from PV1-51 into PV1-19

This keeps the core converter spec-compliant (PV1-19 is always the source) and isolates the ASTRA workaround to a preprocessor rule.

## Prerequisites

- Per-sender config (planned — config shape migration needed first)
- Verify with ASTRA data: is PV1-19 always empty when PV1-51 has a CX value?
- Confirm whether PV1-51 data represents a duplicate of PV1-19 or a distinct identifier

---
status: description
parent-ticket: 2026-02-23-vxu-design-final.md
scope: PRT segment type generation, parsing, and converter support
---

# PRT Segment Support

## Origin

During V2-to-FHIR IG comparison for the VXU design, PRT (Participation) segment support was identified as a gap. The V2-to-FHIR IG maps PRT extensively in VXU messages — for ORDER-level performers, OBSERVATION-level device/location/performer, and PERSON_OBSERVATION-level participants. Currently, our codebase has no PRT infrastructure at all.

The core VXU design (`2026-02-23-vxu-design-final.md`, Decision #17) explicitly defers PRT to this separate ticket, using XCN fields (RXA-10, ORC-12) as the v2.5 backward-compatible approach for the initial implementation.

## Problem Statement

HL7 v2.7+ messages use the PRT (Participation) segment as the primary mechanism for communicating provider/device/location participation in clinical events. PRT replaces deprecated inline fields like ORC-12 (Ordering Provider), RXA-10 (Administering Provider), and OBR-16 (Ordering Provider). While v2.5 senders still use inline XCN fields, modern v2.7+ and v2.8+ senders send PRT segments instead of (or alongside) the deprecated fields.

Without PRT support, our converter cannot correctly handle:
- v2.8+ senders that omit deprecated XCN fields and use PRT exclusively
- Messages that send both PRT and XCN (need deduplication)
- PRT-based device and location references in observations

## Scope

### In Scope
1. **PRT type generation** — Add PRT segment to the HL7v2 type system and generated code
2. **PRT parser support** — Ensure the parser can extract PRT segments from messages
3. **PRT segment converter** — `PRT → PractitionerRole`, `PRT → Device`, `PRT → Location`
4. **Dual PRT/XCN resolution** — Logic to handle both PRT and deprecated XCN fields, with PRT taking precedence when both are present
5. **VXU integration** — Wire PRT into VXU ORDER groups and PERSON_OBSERVATION groups
6. **ORU/ADT consideration** — Design the converter generically enough to support PRT in other message types

### Out of Scope
- Full PRT support for ORU and ADT converters (separate tickets, but the infrastructure should be reusable)
- PRT in outgoing BAR messages (we build HL7v2, not parse it)

## Key PRT Fields (from V2-to-FHIR IG)

Based on the VXU_V04 message mapping CSV:

| PRT Field | Purpose | FHIR Target |
|-----------|---------|-------------|
| PRT-4 | Participation (role code: AP, OP, etc.) | Determines function coding |
| PRT-5 | Participation Person | PractitionerRole (when valued) |
| PRT-9 | Participation Location | Location (when valued) |
| PRT-10 | Participation Device | Device (when valued) |
| PRT-14 | Participation Address | Location address (when valued) |

### PRT Placement in VXU_V04

From the IG message mapping:

```
VXU_V04.PERSON_OBSERVATION.PRT — patient-level observation participation
  IF PRT-10 VALUED → Device
  IF PRT-9 OR PRT-14 VALUED → Location
  IF PRT-5 VALUED → PractitionerRole → Observation.performer

VXU_V04.ORDER.PRT — order-level participation (performer)
  IF PRT-4.1="OP" AND PRT-4.3="HL70443" → PractitionerRole → Immunization.performer (function=OP)
  IF PRT-4.1="AP" AND PRT-4.3="HL70443" → PractitionerRole → Immunization.performer (function=AP)

VXU_V04.ORDER.OBSERVATION.PRT — order observation participation
  IF PRT-10 VALUED → Device → Observation.device
  IF PRT-9 OR PRT-14 VALUED → Location
  IF PRT-5 VALUED → PractitionerRole → Observation.performer
```

## Cross-Cutting Concerns

PRT is not VXU-specific. The same segment appears in:

| Message Type | PRT Location | Current Approach | PRT Replacement For |
|-------------|-------------|-----------------|-------------------|
| VXU_V04 | ORDER, OBSERVATION, PERSON_OBSERVATION | XCN via RXA-10, ORC-12 | RXA-10, ORC-12 |
| ORU_R01 | ORDER_OBSERVATION, OBSERVATION | XCN via OBR-16, OBX inline | OBR-16, OBX practitioner |
| ADT_A01 | Various | XCN via PV1 fields | PV1 attending/referring/etc. |

The PRT converter and resolution logic should be built as shared infrastructure in `src/v2-to-fhir/segments/` or `src/v2-to-fhir/datatypes/`, not embedded in VXU-specific code.

## Dual PRT/XCN Resolution Rules

When both PRT and deprecated XCN fields are present for the same participation role:

1. **PRT takes precedence** — if a PRT with matching role code (e.g., AP for administering) is present, use it instead of the XCN field (e.g., RXA-10)
2. **Match by function code** — PRT-4.1 contains the role code (AP, OP) which maps to `performer.function` coding
3. **Deduplicate by identity** — if both PRT and XCN resolve to the same practitioner (same ID/name), produce one resource, not two
4. **Fallback to XCN** — if no PRT is present for a given role, use the deprecated field

This logic should be encapsulated in a shared utility that both VXU and future ORU/ADT converters can use.

## Implementation Dependencies

1. **HL7v2 type generation** — PRT must be added to the generated types in `src/hl7v2/generated/`. This requires:
   - PRT segment definition in the XSD reference data
   - Running `bun run regenerate-hl7v2` after adding PRT

2. **Parser support** — The HL7v2 parser must recognize PRT segments. Check whether the parser handles unknown segments gracefully or needs explicit registration.

3. **Existing XCN converters** — `xcn-practitioner.ts` and `xcn-practitioner-role.ts` already exist and should be reused. The PRT converter extracts XCN from PRT-5 and delegates to these.

## Relationship to Core VXU Ticket

The core VXU ticket can be implemented without PRT. It uses RXA-10 and ORC-12 (XCN) directly, which is correct for v2.5 senders and v2.8 senders using backward-compatible fields. PRT support is an enhancement for full v2.7+ compliance.

After PRT is implemented, the VXU converter should be updated to check for PRT segments first, falling back to XCN fields.

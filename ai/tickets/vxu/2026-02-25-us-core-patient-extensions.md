---
status: explored
reviewer-iterations: 0
prototype-files: []
---

# Design: US Core Patient Extensions — Race & Ethnicity

## Problem Statement
[To be filled in Phase 4]

## Proposed Approach
[To be filled in Phase 4]

## Key Decisions
[To be filled in Phase 4]

## Trade-offs
[To be filled in Phase 4]

## Affected Components
[To be filled in Phase 4]

## Technical Details
[To be filled in Phase 4]

## Edge Cases and Error Handling
[To be filled in Phase 4]

## Test Cases
[To be filled in Phase 4]

# Context

## Exploration Findings
- `src/v2-to-fhir/segments/pid-patient.ts` is the single conversion point for PID -> Patient fields and extensions.
- `convertPIDToPatient()` is used directly by `ADT_A01` and `ADT_A08`, and indirectly by ORU/VXU/ORM draft patient creation via `handlePatient()`.
- Existing extension mapping pattern in PID is "best effort":
  - Convert if source field is present and parseable.
  - Omit extension when source is absent/unparseable.
  - Do not fail the whole message for extension-only issues.
- Existing tests (`test/unit/v2-to-fhir/segments/pid-patient.test.ts`) are field-focused unit tests, one block per mapped field/extension.
- V2-to-FHIR IG CSV confirms local-implementation mapping requirement:
  - PID-10 should use local realm extension (US -> US Core race extension).
  - PID-22 should use local realm extension (US -> US Core ethnicity extension).
- HL7 reference lookup (`hl7v2-info`) confirms:
  - PID-10 and PID-22 are optional repeating coded fields.
  - v2.8.2 datatype is `CWE`; v2.5 datatype is `CE`; both are semantically coded repeats.
  - Table 0005 contains CDC race codes (1002-5, 2028-9, 2054-5, 2076-8, 2106-3, 2131-1).
  - Table 0189 contains administrative codes (H/N/U), not OMB numeric codes directly.
- Dependency note: ticket text references `2026-02-24-profiles-support.md`, but current repo has `ai/tickets/vxu/2026-02-24-profiles-validation.md` and prototype file markers for that ticket.

## User Requirements & Answers

**Original requirement:** PID-10 (Race) and PID-22 (Ethnic Group) are silently dropped by the PID converter across all message types (ADT, ORU, VXU). These fields have no standard FHIR Patient element — in the US context they require US Core extensions.

### Scope

- **PID-10 → `us-core-race`** extension on Patient (complex: ombCategory 0..6, detailed 0..*, text 1..1)
- **PID-22 → `us-core-ethnicity`** extension on Patient (complex: ombCategory 0..1, detailed 0..*, text 1..1)
- Cross-cutting: affects all message types that use PID (ADT_A01, ADT_A08, ORU_R01, VXU_V04)
- PID-8 (Sex) already maps to `Patient.gender` — no extension needed

### HL7v2 Code Systems

- HL7 Table 0005 (Race) uses CDC Race & Ethnicity codes (e.g., `2106-3` = White) — same system as US Core's ombCategory
- HL7 Table 0189 (Ethnic Group) uses administrative codes (`H`, `N`, `U`) in base table definitions; mapping to US Core OMB codes is implementation logic

### Dependencies

- Should be done **before** the profiles-support ticket (`2026-02-24-profiles-support.md`)
- Manual extension building is acceptable for 2 extensions; can be refactored to use `codegen` typed helpers after profiles-support lands
- The project already uses `@atomic-ehr/codegen` for FHIR type generation (`scripts/regenerate-fhir.ts`)

### Clarifications / Assumptions (no user reply yet)

- Assumption: scope includes all paths that currently call `convertPIDToPatient`, including ORM draft patient creation.
- Assumption: this ticket remains best-effort conversion and does not introduce new `mapping_error` flows for PID-10/PID-22.
- Assumption: PID-22 code `H`/`N` maps to US Core ethnicity OMB category codes via deterministic mapping; `U` is kept as detailed/text without forcing an OMB category.
- Assumption: explicit terminology normalization for these new extensions is included in this ticket, not deferred to profile-validation work.

### V2-to-FHIR IG References

- PID-10: "PID-10 may map different based on local requirements and should use the local extension, e.g., US = US Core Race Extension"
- PID-22: "If PID-22 is for administrative purposes use, then use your local extension, e.g., for US = US Core Ethnicity"
- Source: https://build.fhir.org/ig/HL7/v2-to-fhir/ConceptMap-segment-pid-to-patient.html

## AI Review Notes
[To be filled in Phase 5]

## User Feedback
[To be filled in Phase 6]

---
status: created
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
[To be filled in Phase 2]

## User Requirements & Answers

**Original requirement:** PID-10 (Race) and PID-22 (Ethnic Group) are silently dropped by the PID converter across all message types (ADT, ORU, VXU). These fields have no standard FHIR Patient element — in the US context they require US Core extensions.

### Scope

- **PID-10 → `us-core-race`** extension on Patient (complex: ombCategory 0..6, detailed 0..*, text 1..1)
- **PID-22 → `us-core-ethnicity`** extension on Patient (complex: ombCategory 0..1, detailed 0..*, text 1..1)
- Cross-cutting: affects all message types that use PID (ADT_A01, ADT_A08, ORU_R01, VXU_V04)
- PID-8 (Sex) already maps to `Patient.gender` — no extension needed

### HL7v2 Code Systems

- HL7 Table 0005 (Race) uses CDC Race & Ethnicity codes (e.g., `2106-3` = White) — same system as US Core's ombCategory
- HL7 Table 0189 (Ethnic Group) uses CDC codes (e.g., `2135-2` = Hispanic or Latino)

### Dependencies

- Should be done **before** the profiles-support ticket (`2026-02-24-profiles-support.md`)
- Manual extension building is acceptable for 2 extensions; can be refactored to use `codegen` typed helpers after profiles-support lands
- The project already uses `@atomic-ehr/codegen` for FHIR type generation (`scripts/regenerate-fhir.ts`)

### V2-to-FHIR IG References

- PID-10: "PID-10 may map different based on local requirements and should use the local extension, e.g., US = US Core Race Extension"
- PID-22: "If PID-22 is for administrative purposes use, then use your local extension, e.g., for US = US Core Ethnicity"
- Source: https://build.fhir.org/ig/HL7/v2-to-fhir/ConceptMap-segment-pid-to-patient.html

## AI Review Notes
[To be filled in Phase 5]

## User Feedback
[To be filled in Phase 6]

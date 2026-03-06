---
status: ai-reviewed
reviewer-iterations: 0
prototype-files:
  - src/v2-to-fhir/segments/pid-patient.ts
  - src/v2-to-fhir/segments/us-core-patient-extensions.ts
  - test/unit/v2-to-fhir/segments/pid-patient.test.ts
---

# Design: US Core Patient Extensions — Race & Ethnicity

## Problem Statement
`PID-10` (Race) and `PID-22` (Ethnic Group) are currently dropped during PID -> Patient conversion, so produced Patient resources miss US Core demographic extensions. This creates a conformance gap for US Core Patient and loses clinically relevant demographic context used by downstream US systems. The gap is cross-cutting because all message flows that produce or draft Patient resources depend on `convertPIDToPatient()`.

We need a deterministic, reusable mapping for `us-core-race` and `us-core-ethnicity` that fits existing converter behavior (best-effort conversion without introducing new hard message failures).

## Proposed Approach
Add a focused helper module for US Core demographic extension construction and call it from `convertPIDToPatient()`. The helper will parse PID-10/PID-22 coded repeats, normalize coding systems where needed, build canonical US Core complex extensions (`ombCategory`, `detailed`, `text`), and return zero-to-two Patient extensions.

Keep behavior aligned with current PID converter patterns: if values are absent or unusable, omit only the affected extension and continue processing. Add targeted unit tests for extension shape and code mapping logic (especially PID-22 `H/N/U`) while keeping integration tests centered on existing message converters that already consume `convertPIDToPatient()`.

## Key Decisions
| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Where to implement mapping logic | A) Inline in `pid-patient.ts`, B) Dedicated helper module | B | Keeps `pid-patient.ts` readable and isolates a US-specific concern that may evolve independently. |
| Scope of impact | A) VXU-only wiring, B) `convertPIDToPatient()` shared path | B | Existing architecture already centralizes PID conversion; single integration point covers ADT/ORU/VXU and draft flows consistently. |
| Error behavior for unmappable values | A) Hard error / mapping_error, B) Best-effort omission with preserved text/detail | B | Matches existing PID extension handling and avoids introducing a new failure mode in a demographic enhancement ticket. |
| PID-22 normalization | A) Preserve `H/N/U` only, B) Map to US Core OMB categories where possible | B | US Core ethnicity expects OMB-category semantics; deterministic map `H -> 2135-2`, `N -> 2186-5` improves conformance. |
| Dependency strategy | A) Wait for profile-validation ticket, B) Deliver standalone conversion now | B | Requirement explicitly positions this as a prerequisite; implementation can be validated now and tightened later by profile checks. |

## Trade-offs
- **Pro**: Centralized helper yields consistent behavior across all converters that rely on PID conversion.
- **Con**: Adds US-specific logic inside a general HL7v2 -> FHIR converter layer.
- **Mitigated by**: Keep the new logic in a dedicated module with explicit naming (`us-core-*`) and narrow API surface.
- **Pro**: Deterministic PID-22 mapping improves US Core readiness immediately.
- **Con**: `U`/local variants can still be ambiguous relative to strict profile expectations.
- **Mitigated by**: Preserve values in `detailed`/`text` and defer strict enforcement to profile validation workflow.

## Affected Components
| File | Change Type | Description |
|------|-------------|-------------|
| `src/v2-to-fhir/segments/us-core-patient-extensions.ts` | Create | New helper module for building `us-core-race` / `us-core-ethnicity` extensions. |
| `src/v2-to-fhir/segments/pid-patient.ts` | Modify | Wire helper output into existing Patient extension assembly flow. |
| `test/unit/v2-to-fhir/segments/pid-patient.test.ts` | Modify | Add tests for PID-10/PID-22 extension mapping and edge behavior. |

## Technical Details
Canonical extension URLs:

- `http://hl7.org/fhir/us/core/StructureDefinition/us-core-race`
- `http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity`

Complex extension shape:

- sub-extensions:
  - `ombCategory` (0..6 for race, 0..1 for ethnicity)
  - `detailed` (0..*)
  - `text` (1..1, human-readable summary)

Proposed helper API (prototype-level):

```ts
buildUsCorePatientExtensionsFromPid(pid: PID): Extension[]
buildUsCoreRaceExtension(raceRepeats: Array<CWE | CE> | undefined): Extension | undefined
buildUsCoreEthnicityExtension(ethnicityRepeats: Array<CWE | CE> | undefined): Extension | undefined
```

PID-22 OMB mapping strategy:

| PID-22 code | OMB category code | Display |
|-------------|-------------------|---------|
| `H` | `2135-2` | Hispanic or Latino |
| `N` | `2186-5` | Not Hispanic or Latino |
| `U` | none | no ombCategory; preserve via `detailed`/`text` when possible |

Coding normalization rules (for extension codings):

- Prefer canonical CDC race/ethnicity system URI when source indicates CDC race & ethnicity coding.
- Preserve original code/text when normalization is uncertain.
- De-duplicate identical codings across repeats before writing `detailed`.

Integration point in PID converter:

```ts
const extensions: Extension[] = [];
extensions.push(...buildUsCorePatientExtensionsFromPid(pid));
// existing PID extension mapping follows
```

## Edge Cases and Error Handling
- PID-10/PID-22 absent: no US Core demographic extension added.
- Repeats present but all entries empty/unusable: extension omitted.
- PID-22 includes `U`: omit `ombCategory`; still populate `text` and optionally `detailed` from available coding/text.
- Incoming coding system identifiers are non-standard (`CDCREC`, table aliases, local): attempt normalization; if unresolved, keep source system value instead of dropping code.
- Mixed valid/invalid repeats: keep valid mapped content; ignore invalid fragments.
- Existing non-US extensions in Patient: preserved unchanged; new US Core extensions are additive.

## Test Cases
| Test Case | Type | Description |
|-----------|------|-------------|
| PID-10 single CDC code maps to `us-core-race.ombCategory` | Unit | Verifies canonical race extension URL and expected coded sub-extension. |
| PID-10 repeated entries map to `detailed` with stable text | Unit | Verifies repeat handling, de-duplication, and required `text` generation. |
| PID-22 `H` maps to OMB `2135-2` | Unit | Verifies deterministic administrative -> OMB mapping for Hispanic value. |
| PID-22 `N` maps to OMB `2186-5` | Unit | Verifies deterministic administrative -> OMB mapping for Not Hispanic value. |
| PID-22 `U` does not force OMB category | Unit | Verifies best-effort behavior and retained `text`/detail without invalid ombCategory. |
| Existing PID extension mappings remain intact | Unit | Ensures religion/citizenship/etc. behavior is unchanged after helper integration. |
| ADT/ORU/VXU/ORM flows still reuse shared PID mapping | Integration | Ensures extension changes propagate through shared conversion path without regressions. |

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
### Review verdict
APPROVED FOR USER REVIEW

### Findings (sorted by severity)
- **Low**: Dependency reference still mentions `2026-02-24-profiles-support.md`, while current ticket present in repo is `2026-02-24-profiles-validation.md`.
  - **Impact**: could cause planning confusion when sequencing follow-up work.
  - **Resolution**: keep this ticket self-contained; clarify dependency naming during user approval phase.
- **Low**: Terminology normalization behavior for non-standard source coding-system labels (e.g., local aliases) is intentionally high-level in this design.
  - **Impact**: implementation may make inconsistent normalization choices without an explicit helper map.
  - **Resolution**: define a small deterministic normalization map during implementation (same pattern as existing coding-system normalization utilities).

### Completeness check
- Requirements coverage: PID-10 and PID-22 extension mapping addressed.
- Cross-message reuse: handled through shared `convertPIDToPatient()` integration.
- Error behavior: aligned with current best-effort conversion strategy.
- Test strategy: unit-focused with integration regression checks.

## User Feedback
[To be filled in Phase 6]

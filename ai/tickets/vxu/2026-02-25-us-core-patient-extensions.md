---
status: implemented
reviewer-iterations: 0
prototype-files:
  - src/v2-to-fhir/config.ts
  - src/v2-to-fhir/converter-context.ts
  - src/v2-to-fhir/policy/patient-conversion-policy.ts
  - src/v2-to-fhir/segments/pid-patient.ts
  - src/v2-to-fhir/segments/us-core-patient-extensions.ts
  - src/v2-to-fhir/messages/adt-a01.ts
  - src/v2-to-fhir/messages/adt-a08.ts
  - src/v2-to-fhir/messages/oru-r01.ts
  - src/v2-to-fhir/messages/vxu-v04.ts
  - src/v2-to-fhir/messages/orm-o01.ts
  - test/unit/v2-to-fhir/segments/pid-patient.test.ts
---

# Design: US Core Patient Extensions — Race & Ethnicity

## Problem Statement
`PID-10` (Race) and `PID-22` (Ethnic Group) are currently dropped during PID -> Patient conversion, so produced Patient resources miss US Core demographic extensions. This creates a conformance gap for US Core Patient and loses clinically relevant demographic context used by downstream US systems. The gap is cross-cutting because all message flows that produce or draft Patient resources depend on `convertPIDToPatient()`.

We need a deterministic, reusable mapping for `us-core-race` and `us-core-ethnicity` that fits existing converter behavior (best-effort conversion without introducing new hard message failures) and can be enabled by deployers through configuration (US Core IG presence).

## Proposed Approach
Add a focused helper module for US Core demographic extension construction and call it from `convertPIDToPatient()` using a focused `PatientConversionPolicy` object. The policy is built once from config in `createConverterContext()` and then reused by all message converters. The helper will parse PID-10/PID-22 coded repeats, normalize coding systems where needed, build canonical US Core complex extensions (`ombCategory`, `detailed`, `text`), and return zero-to-two Patient extensions.

Activation remains config-driven and extensible: if deployer declares US Core IG in profile-conformance config, policy enables race/ethnicity extension mapping; if not declared, policy disables it and converter behavior remains unchanged. Keep behavior aligned with current PID converter patterns: if values are absent or unusable, omit only the affected extension and continue processing. Add targeted unit tests for extension shape, code mapping logic (especially PID-22 `H/N/U`), and policy construction behavior.

## Key Decisions
| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Where to implement mapping logic | A) Inline in `pid-patient.ts`, B) Dedicated helper module | B | Keeps `pid-patient.ts` readable and isolates a US-specific concern that may evolve independently. |
| Scope of impact | A) VXU-only wiring, B) `convertPIDToPatient()` shared path | B | Existing architecture already centralizes PID conversion; single integration point covers ADT/ORU/VXU and draft flows consistently. |
| Error behavior for unmappable values | A) Hard error / mapping_error, B) Best-effort omission with preserved text/detail | B | Matches existing PID extension handling and avoids introducing a new failure mode in a demographic enhancement ticket. |
| PID-22 normalization | A) Preserve `H/N/U` only, B) Map to US Core OMB categories where possible | B | US Core ethnicity expects OMB-category semantics; deterministic map `H -> 2135-2`, `N -> 2186-5` improves conformance. |
| Activation model | A) Always apply US Core extension logic, B) Apply only when US Core IG configured | B | Meets deployer extensibility requirement and prevents US-specific shaping in non-US deployments. |
| IG detection source | A) New dedicated flag, B) Reuse profile-conformance IG config | B | Avoids config duplication and keeps IG-related behavior controlled from one place. |
| Converter input shape | A) Pass booleans through call chain, B) Pass focused policy object | B | Avoids flag proliferation and keeps converter API extensible for future IG-driven patient rules. |

## Trade-offs
- **Pro**: Centralized helper yields consistent behavior across all converters that rely on PID conversion.
- **Con**: Adds US-specific logic inside a general HL7v2 -> FHIR converter layer.
- **Mitigated by**: Keep the new logic in a dedicated module with explicit naming (`us-core-*`) and narrow API surface.
- **Pro**: Deterministic PID-22 mapping improves US Core readiness immediately.
- **Con**: `U`/local variants can still be ambiguous relative to strict profile expectations.
- **Mitigated by**: Preserve values in `detailed`/`text` and defer strict enforcement to profile validation workflow.
- **Pro**: IG-driven activation is deployer-controlled and extensible across environments.
- **Con**: Misconfigured or missing IG entry can silently disable extension mapping.
- **Mitigated by**: Explicit startup validation helper and unit tests for detection semantics (`id`, `package`, `enabled`).
- **Pro**: Focused policy object scales as additional patient-related IG behaviors appear.
- **Con**: Adds one more abstraction layer compared to direct boolean checks.
- **Mitigated by**: Build policy once in context and keep policy shape small and explicit.

## Affected Components
| File | Change Type | Description |
|------|-------------|-------------|
| `src/v2-to-fhir/config.ts` | Modify | Extend config types with stable profile-conformance shape used for IG detection. |
| `src/v2-to-fhir/policy/patient-conversion-policy.ts` | Create | Build `PatientConversionPolicy` from config (including US Core IG detection). |
| `src/v2-to-fhir/converter-context.ts` | Modify | Derive `patientPolicy` once from config and expose in converter context. |
| `src/v2-to-fhir/segments/us-core-patient-extensions.ts` | Create | New helper module for building `us-core-race` / `us-core-ethnicity` extensions. |
| `src/v2-to-fhir/segments/pid-patient.ts` | Modify | Accept `PatientConversionPolicy` and wire helper output conditionally via policy decisions. |
| `src/v2-to-fhir/messages/adt-a01.ts` | Modify | Pass `context.patientPolicy` into PID conversion. |
| `src/v2-to-fhir/messages/adt-a08.ts` | Modify | Pass `context.patientPolicy` into PID conversion. |
| `src/v2-to-fhir/messages/oru-r01.ts` | Modify | Pass `context.patientPolicy` into shared `handlePatient()` flow. |
| `src/v2-to-fhir/messages/vxu-v04.ts` | Modify | Pass `context.patientPolicy` into shared `handlePatient()` flow. |
| `src/v2-to-fhir/messages/orm-o01.ts` | Modify | Pass `context.patientPolicy` into shared `handlePatient()` flow. |
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

Config contract for policy construction (reuse IG config):

```ts
type ImplementationGuidePolicy = {
  id: string;          // e.g. "us-core"
  package: string;     // e.g. "hl7.fhir.us.core"
  version: string;
  enabled?: boolean;   // default true
};

type Hl7v2ToFhirConfig = {
  profileConformance?: {
    implementationGuides?: ImplementationGuidePolicy[];
  };
};
```

Policy model and builder:

```ts
type PatientConversionPolicy = {
  demographicExtensionMode: "none" | "us-core";
};

function buildPatientConversionPolicy(config: Hl7v2ToFhirConfig): PatientConversionPolicy {
  const hasUsCore = (config.profileConformance?.implementationGuides ?? []).some((ig) =>
    ig.enabled !== false &&
    (ig.id.toLowerCase() === "us-core" || ig.package === "hl7.fhir.us.core")
  );

  return {
    demographicExtensionMode: hasUsCore ? "us-core" : "none",
  };
}
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
if (policy.demographicExtensionMode === "us-core") {
  extensions.push(...buildUsCorePatientExtensionsFromPid(pid));
}
// existing PID extension mapping follows
```

## Edge Cases and Error Handling
- US Core IG not configured: patient policy sets `demographicExtensionMode = "none"`; PID-10/PID-22 mapping skipped.
- US Core IG configured with `enabled: false`: policy mode remains `"none"`.
- IG config present but malformed (missing id/package): fail fast in config validation.
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
| Policy builder sets `us-core` mode when US Core IG configured | Unit | Verifies config -> policy derivation. |
| Policy builder sets `none` when US Core IG absent | Unit | Verifies converters preserve old behavior when IG is not declared. |
| Policy builder keeps `none` when US Core IG explicitly disabled | Unit | Verifies `enabled: false` prevents extension mapping. |
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
- Deployer extensibility requirement: apply this mapping only when US Core IG is configured in deploy-time config

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
- Assumption: US Core activation comes from IG configuration in `profileConformance.implementationGuides`, not from a separate feature flag.
- Assumption: patient converters receive one focused policy object (`context.patientPolicy`) rather than multiple booleans.

### V2-to-FHIR IG References

- PID-10: "PID-10 may map different based on local requirements and should use the local extension, e.g., US = US Core Race Extension"
- PID-22: "If PID-22 is for administrative purposes use, then use your local extension, e.g., for US = US Core Ethnicity"
- Source: https://build.fhir.org/ig/HL7/v2-to-fhir/ConceptMap-segment-pid-to-patient.html

## AI Review Notes
### Review verdict
APPROVED FOR USER REVIEW

### Findings (sorted by severity)
- **Low**: Policy type currently models only `demographicExtensionMode`.
  - **Impact**: future patient conversion rules may append fields quickly.
  - **Resolution**: acceptable for now; keep the type focused and extend only when a second policy concern appears.
- **Low**: Activation still depends on profile-conformance schema alignment with the profiles-validation ticket.
  - **Impact**: config key drift could break policy derivation.
  - **Resolution**: enforce exact config typing and add policy-builder unit tests against real config fixtures during implementation.

### Completeness check
- Boolean threading concern addressed via focused policy object.
- Policy is built once in context, not per converter.
- Message converters and `handlePatient` call chain are updated in prototypes to consume `context.patientPolicy`.

## User Feedback
- 2026-03-06: Request to make activation extensible via deploy-time config.
- Specific ask: deployer should be able to specify US Core IG in config, and race/ethnicity extension mapping should be applied based on that config.
- 2026-03-06: Request to avoid boolean threading and use Option 4 (focused policy object built once in context).

# Implementation Plan

## Overview
Implement US Core race/ethnicity Patient extension mapping from PID-10/PID-22 behind deploy-time IG configuration, without adding new hard conversion failures. The work introduces a focused patient conversion policy derived once from config and reused across converters, plus a dedicated US Core extension builder module integrated into shared PID conversion. This keeps current best-effort behavior intact while enabling US-specific conformance when configured.

## Development Approach
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan when scope changes**

## Validation Commands
- `bun test:all` - Run unit and integration tests
- `bun run typecheck` - Type checking

---

## Task 1: Finalize config contract for IG-driven activation
- [ ] Replace prototype in `src/v2-to-fhir/config.ts` with concrete `profileConformance.implementationGuides` types used by this ticket
- [ ] Add config validation for `implementationGuides` entries (required `id`, `package`, `version`; optional `enabled`) with clear startup errors
- [ ] Extend `test/unit/v2-to-fhir/config.test.ts` with valid/invalid IG config cases for this schema
- [ ] Ensure `config/hl7v2-to-fhir.json` and `test/fixtures/config/hl7v2-to-fhir.json` include a US Core IG example entry
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task
- [ ] Stop and request user feedback before proceeding

---

## Task 2: Implement patient policy module
- [ ] Replace scaffold in `src/v2-to-fhir/policy/patient-conversion-policy.ts` with `PatientConversionPolicy` type and `buildPatientConversionPolicy(config)` implementation
- [ ] Implement US Core detection by normalized IG `id` and canonical `package`, respecting `enabled: false`
- [ ] Add dedicated unit tests for policy derivation in `test/unit/v2-to-fhir/policy/patient-conversion-policy.test.ts` (US Core present, absent, disabled)
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task
- [ ] Stop and request user feedback before proceeding

---

## Task 3: Wire policy into converter context
- [ ] Update `src/v2-to-fhir/converter-context.ts` to include `patientPolicy` in `ConverterContext`
- [ ] Build `patientPolicy` once in `createConverterContext()` via `buildPatientConversionPolicy(config)`
- [ ] Update `test/unit/v2-to-fhir/helpers.ts` to populate `patientPolicy` in `makeTestContext()`
- [ ] Add or update unit test coverage for context construction behavior (policy is present and derived from config)
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task
- [ ] Stop and request user feedback before proceeding

---

## Task 4: Implement US Core demographic extension builder
- [ ] Replace scaffold in `src/v2-to-fhir/segments/us-core-patient-extensions.ts` with production implementation for race and ethnicity extension construction
- [ ] Implement `buildUsCoreRaceExtension` and `buildUsCoreEthnicityExtension` with canonical URLs and sub-extensions (`ombCategory`, `detailed`, `text`)
- [ ] Implement deterministic PID-22 `H/N/U` handling (`H -> 2135-2`, `N -> 2186-5`, `U -> no ombCategory`) while preserving useful detailed/text content
- [ ] Add helper-level unit tests in `test/unit/v2-to-fhir/segments/us-core-patient-extensions.test.ts` for extension shape, duplicate handling, and text fallback behavior
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task
- [ ] Stop and request user feedback before proceeding

---

## Task 5: Integrate policy-driven extensions into PID converter
- [ ] Update `src/v2-to-fhir/segments/pid-patient.ts` signatures to accept `PatientConversionPolicy` in `convertPIDToPatient`, `createDraftPatient`, and `handlePatient`
- [ ] Apply policy gate in extension block so US Core extensions are added only when `demographicExtensionMode === "us-core"`
- [ ] Keep existing extension mappings unchanged and additive when US Core mapping is enabled
- [ ] Expand `test/unit/v2-to-fhir/segments/pid-patient.test.ts` with policy-on/off behavior and coexistence checks with existing extensions
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task
- [ ] Stop and request user feedback before proceeding

---

## Task 6: Thread policy through message converters
- [ ] Update `src/v2-to-fhir/messages/adt-a01.ts` and `src/v2-to-fhir/messages/adt-a08.ts` to pass `context.patientPolicy` to `convertPIDToPatient`
- [ ] Update `src/v2-to-fhir/messages/oru-r01.ts`, `src/v2-to-fhir/messages/vxu-v04.ts`, and `src/v2-to-fhir/messages/orm-o01.ts` to pass `context.patientPolicy` into `handlePatient`
- [ ] Update affected unit tests (ADT/ORU/VXU/ORM suites) only where context assumptions need adjustment
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task
- [ ] Stop and request user feedback before proceeding

---

## Task 7: Add regression coverage for shared patient flow
- [ ] Add targeted tests proving draft-patient creation paths (ORU/VXU/ORM) inherit policy-driven PID mapping
- [ ] Add regression checks that behavior remains unchanged when US Core IG is not configured
- [ ] Validate no new `mapping_error` or hard-failure paths are introduced for PID-10/PID-22 data quality issues
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task
- [ ] Stop and request user feedback before proceeding

---

## Task 8: Update documentation
- [ ] Update `CLAUDE.md` project memory with the new patient-policy pattern and IG-driven activation rule (if this becomes a reusable convention)
- [ ] Add succinct inline comments only where logic is non-obvious (policy gating and PID-22 mapping rationale)
- [ ] Document config expectations for US Core IG activation in developer docs if needed
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task
- [ ] Stop and request user feedback before proceeding

---

## Task 9: Cleanup design artifacts
- [ ] Remove all `DESIGN PROTOTYPE: 2026-02-25-us-core-patient-extensions.md` comments from codebase
- [ ] Delete or fully replace scaffold-only files created for this design (`src/v2-to-fhir/policy/patient-conversion-policy.ts`, `src/v2-to-fhir/segments/us-core-patient-extensions.ts`)
- [ ] Update design document status to `implemented`
- [ ] Verify no prototype markers remain: `grep -r "DESIGN PROTOTYPE: 2026-02-25-us-core-patient-extensions" src/ test/`
- [ ] Run `bun test:all` and `bun run typecheck` - final verification
- [ ] Stop and request user feedback before proceeding

---

## Post-Completion Verification
1. **Functional test**: Process one ADT and one VXU fixture containing PID-10/PID-22 with US Core IG enabled and verify `Patient.extension` includes US Core race/ethnicity.
2. **Edge case test**: Process fixture with PID-22=`U` and confirm no `ombCategory` is emitted while `text` (and `detailed` when available) is preserved.
3. **Integration check**: Process ORU/ORM flows that create draft patients and verify identical policy-driven extension behavior.
4. **No regressions**: All existing tests pass.
5. **Cleanup verified**: No `DESIGN PROTOTYPE` markers remain for this ticket.

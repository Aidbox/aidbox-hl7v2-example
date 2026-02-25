---
status: ai-reviewed
reviewer-iterations: 0
prototype-files:
  - src/v2-to-fhir/config.ts
  - src/v2-to-fhir/converter.ts
  - src/v2-to-fhir/processor-service.ts
  - src/v2-to-fhir/profile-conformance/index.ts
  - src/v2-to-fhir/profile-conformance/types.ts
  - src/v2-to-fhir/profile-conformance/us-core.ts
  - src/v2-to-fhir/profile-conformance/validator.ts
---

# User description

Goal: validate VXU fields against us-core.

If you need additional guides for context, check fhir-profiles-guide.md, us-core-ig-guide.md and fhir-implementation-guides.md.

What we have to support:
- Configuration must support profiles and IGs. If the converted fhir resources conform to the respective profiles - meta.profiles will be added
- Add a strict mode: if the converted resourced DON'T conform to the required profiles, it will fail the message with a validation error. Status will be "error".
- Need flexibility to allow supporting some profiles, but enabling strict mode only for a part of them
- Specifically, support us-core IG out of the box

# Design: Profiles and IG Support for HL7v2 -> FHIR Conversion

## Problem Statement
The conversion pipeline currently produces base FHIR resources but does not evaluate profile conformance or declare `meta.profile` based on verified conformance. This prevents reliable downstream use of profile-aware workflows across all conversion flows and makes profile claims non-deterministic. We need a configurable profile-conformance layer that can validate converted resources against any configured IG/profile set, annotate conformant resources, and optionally fail messages when strict conformance is required.

## Proposed Approach
Introduce a post-conversion profile conformance stage in `processor-service.ts`, after HL7v2 parsing/preprocessing/conversion and before transaction bundle submission. The new stage evaluates each converted resource against configured profile rules, adds profile URLs to `resource.meta.profile` for conformant resources, and aggregates validation issues.

Configuration is extended to support arbitrary IGs, profile rules, and per-profile strictness. Strict failures mark `IncomingHL7v2Message.status = "error"` and store a detailed validation summary in `error`. Non-strict failures keep the message processable while skipping `meta.profile` for failing profiles.

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Validation scope | A) Message-specific implementation, B) Cross-message validation stage | B | Message-specific logic would duplicate behavior and drift over time. A shared stage keeps profile behavior uniform and reusable. |
| Strictness model | A) Global strict flag, B) Per-profile strict flag | B | Requirement explicitly needs strict enabled for only a subset of profiles. |
| Profile assignment timing | A) Set `meta.profile` pre-validation, B) Set only after successful profile validation | B | Avoids false conformance claims and keeps profile declarations trustworthy. |
| US Core support | A) Optional manual profile registration only, B) Provide out-of-the-box US Core preset in config + validator registry | B | Meets requirement for immediate US Core support while allowing additional IGs later. |
| Rollout strategy | A) Couple to one message-type ticket, B) Implement message-agnostic conformance layer and enable per message as converters mature | B | Decouples architecture from one use case and lets each message type adopt profiles independently. |

## Trade-offs
- **Pro**: Profile conformance becomes explicit, auditable, and configurable per IG/profile.
- **Con**: Adds another processing stage and more config surface, which increases operational complexity.
- **Mitigated by**: Keep config schema explicit, fail-fast config validation, and provide US Core defaults so most deployments only tune strictness.

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|
| `src/v2-to-fhir/config.ts` | Modify | Extend config types to include IG/profile conformance policies and strictness controls. |
| `src/v2-to-fhir/processor-service.ts` | Modify | Insert planned post-conversion profile validation stage before bundle submit. |
| `src/v2-to-fhir/profile-conformance/types.ts` | Create | Define profile rule types, validation results, and strictness model. |
| `src/v2-to-fhir/profile-conformance/us-core.ts` | Create | Define built-in US Core IG preset container (generic profile policy list, no message-specific mapping logic). |
| `src/v2-to-fhir/profile-conformance/validator.ts` | Create | Define validator contract and orchestration entry point for evaluating a converted bundle. |
| `src/v2-to-fhir/profile-conformance/index.ts` | Create | Re-export profile conformance module public API. |

## Technical Details
Configuration extension (prototype shape):

```ts
type ProfilePolicy = {
  profileUrl: string;
  resourceTypes: string[];
  strict?: boolean;
};

type ImplementationGuidePolicy = {
  id: string;
  package: string;
  version: string;
  enabled?: boolean;
  profiles: ProfilePolicy[];
};

type Hl7v2ToFhirConfig = {
  // existing fields...
  profileConformance?: {
    enabled?: boolean;
    implementationGuides?: ImplementationGuidePolicy[];
    messagePolicies?: Record<
      string,
      { enabled?: boolean; applyGuides?: string[]; strictDefault?: boolean }
    >;
  };
};
```

Validation flow (prototype):

```txt
parse -> preprocess -> convertToFHIR -> validateBundleProfiles
  -> if strict failures: message.status=error, do not submit bundle
  -> else: add meta.profile for passing resources and submit
```

Validator strategy:
- Use Aidbox `POST /fhir/{ResourceType}/$validate?profile={canonical}` for profile checks.
- Treat `OperationOutcome` with validation failures as profile non-conformance.
- Aggregate issues across all resources and profiles into one message-level summary.

US Core out-of-the-box preset:
- Provide a predefined IG entry (`hl7.fhir.us.core` + version) and a generic profile policy container.
- Concrete profile selection for resource types is configuration-driven and out of scope for this ticket.
- Deployment expectation: Aidbox must load the US Core package (`hl7.fhir.us.core`) so `$validate` resolves canonical profiles.

## Edge Cases and Error Handling
- Message converted but no profile policy configured: skip profile stage, preserve existing behavior.
- Profile policy configured for resource type not present in bundle: no failure; report as not-applicable.
- Non-strict profile failure: do not add failing profile URL, keep processing.
- Strict profile failure: set message to `error`, store summarized violations, skip submit.
- Multiple profile policies targeting same resource: evaluate all; strict failure in any strict policy fails message.
- Unknown IG/profile configured: fail fast at startup config validation (not at runtime message handling).
- Aidbox validator/network/terminology dependency errors during validation: treated as validation infrastructure errors; strict policy fails message, non-strict policy records warning and skips profile annotation.

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|
| Config accepts IG/profile policy definitions | Unit | Validate parsing/type guards for new `profileConformance` config blocks. |
| Per-profile strict failure blocks message | Integration | Converted bundle with one strict profile violation results in `IncomingHL7v2Message.status = "error"` and no bundle submit. |
| Non-strict failure does not block message | Integration | Converted bundle with non-strict profile violation submits successfully but omits failing `meta.profile`. |
| Conformant resource gets `meta.profile` | Integration | Resource passing configured profile validation has expected profile URL added. |
| Mixed strict + non-strict profiles | Integration | Strict pass + non-strict fail still processes; strict fail blocks even if others pass. |
| US Core preset loads by default | Unit | Built-in preset can be referenced by config without custom profile definitions. |
| Message policy isolation | Unit | Profile policy selection for one message type does not affect others. |
| Validation stage no-op when disabled | Unit | Existing pipeline behavior unchanged if `profileConformance.enabled` is false/missing. |

# Context

## Exploration Findings
- Current conversion router only supports `ADT_A01`, `ADT_A08`, and `ORU_R01`; `VXU_V04` is not implemented yet (`src/v2-to-fhir/converter.ts`).
- Processing pipeline location for profile validation should be `src/v2-to-fhir/processor-service.ts` between conversion and bundle submit.
- Existing config (`config/hl7v2-to-fhir.json`) currently covers preprocessors/converter flags only; no profile/IG policy model exists.
- Aidbox environment currently boots only `hl7.fhir.r4.core#4.0.1`; US Core package loading must be explicitly configured for runtime conformance validation.
- HL7v2 structure lookup confirms VXU has required immunization blocks (`ORDER -> ORC + RXA`) and optional demographics extensions (PID-10 race, PID-22 ethnicity) that matter for US Core alignment.
- The requested guide set is available under `data/local/guides/` and emphasizes: set `meta.profile` only after validation, and allow per-profile strictness.

## User Requirements & Answers
- Requirement: configuration must support profiles and IGs.
- Requirement: if converted FHIR resources conform, add `meta.profile`.
- Requirement: add strict mode where non-conformance can fail message with `status = "error"`.
- Requirement: strict mode must be selectively enabled for only some profiles.
- Requirement: support US Core IG out of the box.
- Clarification status: no additional Q&A provided in this ticket yet.
- Assumption applied in this design: this ticket defines a shared profile-conformance architecture independent of message type; message-specific converters (including VXU) consume it when available.

## AI Review Notes


## User Feedback

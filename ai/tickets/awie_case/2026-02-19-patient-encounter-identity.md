---
status: planned
reviewer-iterations: 7
prototype-files:
  - src/v2-to-fhir/id-generation.ts
  - src/v2-to-fhir/config.ts
  - src/v2-to-fhir/preprocessor-registry.ts
  - src/v2-to-fhir/preprocessor.ts
  - src/v2-to-fhir/messages/adt-a01.ts
  - src/v2-to-fhir/messages/adt-a08.ts
  - src/v2-to-fhir/messages/oru-r01.ts
  - src/v2-to-fhir/converter.ts
  - config/hl7v2-to-fhir.json
  - src/v2-to-fhir/mpi-client.ts
---

# Design: Cross-EHR Patient & Encounter Identity

## Problem Statement

Patient identity across two EHR systems (ASTRA, MEDTEX) produces inconsistent Patient.id values because the current ad-hoc logic in `adt-a01.ts` and `oru-r01.ts` uses raw CX values without authority prefixes and applies first-identifier-wins with no config control. This causes cross-EHR patient matching failures — the same physical patient receives different FHIR Patient.id values depending on which sender's message arrives first — and prevents deterministic idempotent reprocessing. The root cause is that identifier selection is hardcoded in two places with no understanding of authority semantics, and there is no mechanism to normalize legacy PID-2 usage or bare identifiers before conversion.

## Proposed Approach

**Priority-list algorithm** replaces the ad-hoc logic in both `adt-a01.ts` and `oru-r01.ts`. A single ordered list of `IdentifierPriorityRule` entries is evaluated against the pool of CX identifiers from PID-3. The first rule that matches a CX with a non-empty value wins. Two rule types exist:

- **MatchRule** `{ authority?, type?, any? }` — matches the first CX where the authority matches any of CX.4.1, CX.9.1 (CWE.1), or CX.10.1 (CWE.1) in that order, and/or CX.5 equals the type. A special variant `{ any: true }` matches the first CX with a non-empty CX.1 and a derivable authority prefix (type-only priority chain); bare CX entries with no authority are skipped. At least one of `authority`, `type`, or `any` must be specified.
- **MpiLookupRule** `{ mpiLookup: { ... } }` — picks a source identifier from the pool using nested match rules, queries an external MPI, and if the MPI returns a result, uses that as Patient.id. If the MPI is unavailable (network error, timeout), it is a hard error — no fallthrough. If the MPI returns no match, the rule is skipped and the next rule in the list is tried.

The resulting Patient.id format is `{sanitize(authority)}-{sanitize(value)}` using the same sanitization pattern already applied to Encounter.id in `id-generation.ts`.

**Config-driven rules** live at `identitySystem.patient.rules` in `hl7v2-to-fhir.json`. The per-message-type config moves under a `messages` key. This structure keeps the global identifier priority separate from per-message-type behavior while making future per-sender migration straightforward (add a sender-keyed map at the same level). The `identitySystem` grouping also reserves space for future `encounter` identity rules at the same level.

**PatientIdResolver abstraction** (`type PatientIdResolver = (identifiers: CX[]) => Promise<PatientIdResult>`) follows the same pattern as `PatientLookupFn`/`EncounterLookupFn` already used in `oru-r01.ts`. `converter.ts` creates the resolver as a closure over `config.identitySystem.patient.rules` and `mpiClient`. Each converter (`convertADT_A01`, `convertADT_A08`, `convertORU_R01`) receives `resolvePatientId: PatientIdResolver` instead of `mpiClient: MpiClient` — the converter calls `resolvePatientId(pid.$3_identifier ?? [])` without knowing the algorithm, rule list, or MPI client.

**Preprocessor rules** handle normalization before the converter sees identifiers:
- `"move-pid2-into-pid3"` fires on PID field 2; appends the PID-2 CX into PID-3's repeat list (or creates PID-3 if absent), then clears PID-2.
- `"inject-authority-from-msh"` fires on PID field 3; for each CX in PID-3 that has a value but no authority (CX.4/9/10 all empty), injects the MSH-3/4 derived namespace as CX.4.1. Only fills gaps — never overrides existing authority.

The preprocessor config is added to `MessageTypeConfig.preprocess` for segment `PID` fields `"2"` and `"3"`.

**Config restructure**: `Hl7v2ToFhirConfig` changes from `Record<string, MessageTypeConfig | undefined>` to `{ identitySystem?: { patient?: { rules: IdentifierPriorityRule[] } }; messages?: Record<string, MessageTypeConfig | undefined> }`. The config loader's `validatePreprocessorIds` must be updated to walk `config.messages` instead of the top-level object.

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Identifier selection strategy | Priority-list (authority + type rules, ordered) vs type-only vs authority-only | Priority-list with both authority and type matchers | Real data shows UNIPAT appears in different fields across senders; authority rules target specific namespaces, type rules act as spec-driven fallbacks. Fixed type-only or authority-only cannot express "UNIPAT first, then any PE, then ST01, then any MR". |
| mpiLookup error behavior | Hard error vs fallthrough to next rule | Hard error (MPI unavailable = stop processing) | MPI configured + triggered means the operator intends to use it. Silent fallthrough would create duplicate patients with different IDs — exactly the problem being solved. Existing reprocessing handles retry after MPI recovers. |
| Config shape | Top-level named keys + messages record vs flat `Record<messageType, config>` vs per-sender map now | `identitySystem.patient.rules` + `messages` record | Flat record conflates global and per-message-type config. Per-sender map is premature (single deployment now). `identitySystem` groups identity configuration semantically (patient rules, future encounter rules). Top-level named keys make future per-sender migration a non-breaking additive change (wrap `messages` inside a sender key). |
| mpiLookup: include now (stub) vs defer entirely | Defer to a later ticket vs stub now | Include stub now | Config schema, algorithm, and tests are the hard part. Replacing a stub with a real HTTP client is trivial. Deferring forces a breaking config-schema change later. Including now avoids two config migrations. |
| Async selectPatientId | Sync (no MPI) vs async from the start | Async from the start | MpiLookupRule requires async. Both converters are already async. Making it sync now and changing later would require touching all callers twice. No downside to async. |
| ID authority source | Rule's stated authority vs matched identifier's own authority | Matched identifier's own authority | The rule selects WHICH identifier; the identifier provides the system context. Rule `{ type: "MR" }` matching `ST01W/MR` → ID is `st01w-645541`. Using the rule's authority would be wrong when the rule has no authority (type-only rule). |
| No-match behavior | Silent fallback (e.g., generate UUID) vs error | Error (hard failure, no silent fallback) | Silent fallback produces Patient IDs that cannot be deterministically reproduced and will never converge with cross-EHR matching. Errors surface immediately and force operator to fix config or preprocessor rules. |
| MatchRule authority matching components | CX.4.1 only vs CX.4.1 → CX.9.1 → CX.10.1 (all three HL7 authority components) vs extractHDAuthority semantics (CX.4.2 preferred) | Check CX.4.1 first, then CX.9.1 (CWE.1), then CX.10.1 (CWE.1); first non-empty that equals rule.authority wins. ID prefix split by match type: authority-rule match uses the component that matched (CX.4 hierarchy / CX.9.1 / CX.10.1); type-only match uses priority chain CX.9.1 → CX.4.1 → CX.4.2 → CX.10.1 → raw CX.4 string | HL7 v2.8.2 allows authority in CX.4, CX.9, or CX.10 — all three must be checked for completeness. Config entries remain human namespace strings ("UNIPAT", "ST01") so CX.4.1/CX.9.1/CX.10.1 (the short identifier subcomponents, not OIDs) are the correct matching targets. CX.9 is preferred for type-only match prefix because it is the broadest/most stable authority (geo-political jurisdiction). This deliberately deviates from extractHDAuthority (which prefers CX.4.2 for FHIR system URI selection) — selectPatientId picks the short namespace prefix for a resource ID, not a URI. |
| MpiClient injection | Inject via parameter into convertADT_A01/convertORU_R01 vs module-level singleton vs instantiate inside each converter | Inject via parameter; converter.ts instantiates StubMpiClient by default | Existing pattern: PatientLookupFn and EncounterLookupFn are already injected as parameters in convertORU_R01. Consistent injection enables unit testing without module mocking. converter.ts instantiates `new StubMpiClient()` and passes it down, so the public API of convertToFHIR does not change. |
| PatientIdResolver abstraction | Inject `mpiClient: MpiClient` + rules directly into converters vs inject a pre-composed `resolvePatientId: PatientIdResolver` closure | Inject `PatientIdResolver` closure | Converters must not know the priority-list algorithm or which rules apply. If the algorithm changes (e.g., priority-list replaced by another strategy), all three converter files would need changes. With a resolver closure, only `converter.ts` changes. Pattern matches `PatientLookupFn`/`EncounterLookupFn` already in `oru-r01.ts`. `converter.ts` creates: `const resolvePatientId: PatientIdResolver = (ids) => selectPatientId(ids, config.identitySystem.patient.rules, mpiClient)`. |
| ADT_A08 scope | Exclude ADT_A08 (only fix ADT_A01 and ORU_R01) vs include ADT_A08 in scope | Include ADT_A08 | ADT_A08 (Update Patient Information) has the same ad-hoc Patient.id logic as ADT_A01 (lines 122–129): raw PID-2 value, then PID-3[0] value, no authority prefix. If ASTRA or MEDTEX send ADT_A08 to update a patient that was created with ADT_A01 (using the new authority-prefixed ID), the A08 would reference the same raw value as the ID and overwrite the wrong Patient resource — or fail to find the patient and update nothing. This would silently corrupt patient data. ADT_A08 must use the same `selectPatientId()` logic. It becomes async and gains an `mpiClient` parameter. |
| 'match' strategy demographics source | Include 'match' strategy in selectPatientId signature now (add PatientDemographics parameter) vs defer demographics parameter to MPI implementation ticket vs stub and explicitly defer | Stub 'match' now, explicitly defer demographics parameter to MPI ticket | The stub always returns 'not-found' so the demographics extraction path is not exercised. `selectPatientId`'s current signature `(identifiers: CX[], rules, mpiClient)` is insufficient for a real 'match' implementation — demographics (family name, given name, birth date, gender from PID) are needed. Adding `demographics?: PatientDemographics` now (without a real implementation) would pollute all call sites with a parameter that has no effect. Instead: the current stub signature is correct for this ticket; the MPI implementation ticket must revisit `selectPatientId`'s signature and may add `demographics` as an optional fourth parameter or extract it inside the real MpiClient. This is documented as a known forward-compatibility gap. |

## Trade-offs

**Priority-list vs simpler schemes:** The priority-list is more config to maintain compared to "always use UNIPAT if present, else first CX". The tradeoff is intentional: real data has nine authorities across two EHR systems with different field positions. A simpler scheme cannot handle ASTRA putting UNIPAT in PID-2 while MEDTEX puts it in PID-3, because by the time the converter sees PID-3, PID-2 is a separate field. The preprocessor boundary (move-pid2-into-pid3 first, then priority-list on PID-3) keeps the converter clean.

**MPI hard error vs fallthrough:** The hard-error choice means that when MPI is down, ALL messages for patients that don't have a direct UNIPAT in the message will fail, not just degrade to local IDs. This is the correct behavior for a deployment that has committed to cross-EHR matching — silent fallthrough would silently create duplicate patients that need manual deduplication later. Operators who want graceful degradation should not configure an mpiLookup rule; they can always fall back to the no-MPI config.

**Config restructure breaking change:** Changing `Hl7v2ToFhirConfig` from a flat record to a typed object is a breaking change to the config file format. The config file is not versioned and is loaded at startup with fail-fast validation, so any deployment will catch this immediately. This is acceptable: the old format is wrong conceptually (message type names as keys mixed with structural keys). The new format is cleaner and the migration is mechanical.

**Preprocessor normalization separation:** Putting PID normalization in preprocessors rather than the converter keeps the converter's contract simple (assumes well-formed CX after preprocessing) but means errors in preprocessing produce different error messages than errors in the converter. The tradeoff is worth it: separation of concerns enables testing each layer independently and supports reuse of preprocessors across message types.

**PatientIdResolver as interim step:** The `PatientIdResolver` abstraction (`type PatientIdResolver = (identifiers: CX[]) => Promise<PatientIdResult>`) cleanly decouples converters from the algorithm, but it is one of several injected function-type parameters alongside `PatientLookupFn` and `EncounterLookupFn`. A broader refactoring ticket (`ai/tickets/awie_case/epics/00_03_converter_context_refactor.md`) tracks composing all converter dependencies (`resolvePatientId`, `lookupPatient`, `lookupEncounter`, `config`) into a single `ConverterContext` object. `PatientIdResolver` is the correct interim step — it does not make the multi-parameter problem worse, and its introduction aligns with the existing `PatientLookupFn`/`EncounterLookupFn` pattern already in use.

**Per-rule MPI endpoint vs shared top-level block:** `MpiLookupRule` embeds `endpoint.baseUrl` and `endpoint.timeout` inside each rule rather than in a top-level `mpi` config block. A shared block was considered but rejected: it would introduce a new top-level structural key for a feature that is currently a stub, and per-rule endpoints allow theoretically querying different MPIs for different identifier strategies (e.g., PIX against one MPI, PDQm match against another). The operational risk of URL duplication when a single MPI is used is acknowledged — operators should copy-paste the same endpoint block for each mpiLookup rule until a real MPI integration refines the schema.

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|
| `src/v2-to-fhir/id-generation.ts` | Extend | Add `IdentifierPriorityRule` union type, `PatientIdResult` type, `selectPatientId()` async function |
| `src/v2-to-fhir/mpi-client.ts` | New file | `MpiClient` interface, `MpiResult` type, `PatientDemographics` type, `StubMpiClient` class |
| `src/v2-to-fhir/config.ts` | Modify | Restructure `Hl7v2ToFhirConfig` to `{ identitySystem?: { patient?: { rules: IdentifierPriorityRule[] } }, messages?: Record<string, MessageTypeConfig> }`, extend `MessageTypeConfig.preprocess` with PID fields, update `validatePreprocessorIds` to walk `config.messages` instead of top-level config object; add `validateIdentitySystemRules()` called from `hl7v2ToFhirConfig()` before caching — validates: (1) `identitySystem.patient.rules` is a non-empty array, (2) each MatchRule has at least one of `authority`/`type`/`any`; add runtime guard before caching: `if (!Array.isArray(config.identitySystem?.patient?.rules)) throw new Error('...')`; import `PatientIdResolver` from `./id-generation` if needed (type is defined and exported ONLY from `id-generation.ts`, not re-exported from `config.ts`) |
| `src/v2-to-fhir/preprocessor.ts` | Modify | Update `config[configKey]` → `config.messages[configKey]` (line 37); update `applyPreprocessors` type annotation `NonNullable<Hl7v2ToFhirConfig[string]>["preprocess"]` → `NonNullable<MessageTypeConfig>["preprocess"]` (line 64) |
| `src/v2-to-fhir/preprocessor-registry.ts` | Extend | Add `"move-pid2-into-pid3"` and `"inject-authority-from-msh"` registrations |
| `src/v2-to-fhir/messages/adt-a01.ts` | Modify | Replace ad-hoc Patient.id logic (lines 331–335) with `resolvePatientId()` call; add `resolvePatientId: PatientIdResolver` parameter instead of `mpiClient: MpiClient`; update config access to `config.messages["ADT-A01"]` |
| `src/v2-to-fhir/messages/adt-a08.ts` | Modify | Replace ad-hoc Patient.id logic (lines 122–129) with `resolvePatientId()` call; make function async (currently sync); add `resolvePatientId: PatientIdResolver` parameter instead of `mpiClient: MpiClient`; update `converter.ts` call site to `await convertADT_A08(parsed, resolvePatientId)`. Config access to `config.messages["ADT-A08"]` (entry may be absent — handled by `config.messages["ADT-A08"]?.converter?.PV1?.required ?? false`). Note: ADT_A08 does not use PV1 — only Patient ID logic is affected. |
| `src/v2-to-fhir/messages/oru-r01.ts` | Modify | Remove `extractPatientId()`; replace call site in `handlePatient()` with `resolvePatientId()`; add `resolvePatientId: PatientIdResolver` parameter to `handlePatient()` and `convertORU_R01()` instead of `mpiClient: MpiClient`; update config access to `config.messages["ORU-R01"]`; `resolvePatientId` has a lazy default in `convertORU_R01` that mirrors `converter.ts` wiring: `(ids) => selectPatientId(ids, hl7v2ToFhirConfig().identitySystem!.patient!.rules, new StubMpiClient())` — existing unit tests that omit the fourth argument continue to work without modification |
| `src/v2-to-fhir/converter.ts` | Modify | Instantiate `StubMpiClient` once per `convertToFHIR()` call; load config via `hl7v2ToFhirConfig()`; create `resolvePatientId: PatientIdResolver` closure: `(ids) => selectPatientId(ids, config.identitySystem.patient.rules, mpiClient)`; pass `resolvePatientId` to `convertADT_A01`, `convertADT_A08`, and `convertORU_R01`; converters no longer receive `mpiClient` directly |
| `src/v2-to-fhir/processor-service.ts` | Check | Review whether `processor-service.ts` calls `convertToFHIR` directly (via `converter.ts`) or the individual converter functions. If it calls `converter.ts`, no change needed there — `converter.ts` handles the instantiation. Confirm at implementation time. |
| `config/hl7v2-to-fhir.json` | Modify | Add `identitySystem.patient.rules` array; move message configs under `messages` key |
| `test/unit/v2-to-fhir/config.test.ts` | Modify | Migrate all fixture objects from flat `{ "ORU-R01": {...} }` shape to `{ identitySystem: { patient: { rules: [...] } }, messages: { "ORU-R01": {...} } }` shape. Update type assertions and navigation tests accordingly. The "unknown preprocessor ID throws startup error" test must continue to work after `validatePreprocessorIds` walks `config.messages`. Add test: `identitySystem.patient.rules` missing from JSON throws at startup (not runtime). Add test: MatchRule with neither `authority`, `type`, nor `any` throws at startup. |
| `test/unit/v2-to-fhir/preprocessor.test.ts` | Modify | Migrate `configWithMshFallback` and `configWithoutPreprocess` constants from flat-record shape to new typed shape. All message-config access in test fixtures must change. |
| `test/integration/v2-to-fhir/adt.integration.test.ts` | Extend | Add `describe("patient identity system", ...)` block for ADT_A01 identity tests (ASTRA UNIPAT in PID-2, cross-EHR matching, reprocessing idempotency) |
| `test/integration/v2-to-fhir/oru-r01.integration.test.ts` | Extend | Add `describe("patient identity system", ...)` block for ORU_R01 identity tests (MEDTEX without UNIPAT falls to type-PE, no-match error propagation) |

**Follow-up:** Create a ticket for segment-level preprocessors (framework extension: a preprocessor that fires once per segment with no field-presence gate). Include a sub-task to migrate `move-pid2-into-pid3` to segment-level once the framework supports it. The current PID-2 field registration is correct for now — PID-3 level would have a bug (gate fails if PID-3 is absent, which is exactly the ASTRA case), and PID-level is not supported without framework changes.

## Technical Details

### Types

```typescript
// src/v2-to-fhir/mpi-client.ts

export type MpiResult =
  | { status: 'found'; identifier: { value: string } }
  | { status: 'not-found' }
  | { status: 'unavailable'; error: string };

export interface MpiClient {
  /**
   * IHE PIXm cross-reference: find target-system identifier for a given source identifier.
   * Returns 'unavailable' on network/timeout errors (NOT an exception).
   */
  crossReference(
    source: { system: string; value: string },
    targetSystem: string,
  ): Promise<MpiResult>;

  /**
   * IHE PDQm demographic match: find a patient by demographics.
   * Returns 'unavailable' on network/timeout errors (NOT an exception).
   */
  match(
    demographics: PatientDemographics,
    targetSystem: string,
  ): Promise<MpiResult>;
}

export type PatientDemographics = {
  familyName?: string;
  givenName?: string;
  birthDate?: string;
  gender?: string;
};

/** Stub that always returns not-found. Replace with real client when MPI integration is prioritized. */
export class StubMpiClient implements MpiClient {
  async crossReference(_source: { system: string; value: string }, _targetSystem: string): Promise<MpiResult> {
    return { status: 'not-found' };
  }

  async match(_demographics: PatientDemographics, _targetSystem: string): Promise<MpiResult> {
    return { status: 'not-found' };
  }
}
```

### `PatientIdResolver` type

```typescript
// src/v2-to-fhir/id-generation.ts (additions)

/**
 * PatientIdResolver: opaque resolver function injected into converters.
 *
 * Created by converter.ts as a closure over config.identitySystem.patient.rules and mpiClient:
 *   const resolvePatientId: PatientIdResolver = (ids) =>
 *     selectPatientId(ids, config.identitySystem.patient.rules, mpiClient);
 *
 * Converters receive and call this without knowing the algorithm, rule list, or MPI client.
 * Pattern matches PatientLookupFn / EncounterLookupFn already used in oru-r01.ts.
 */
export type PatientIdResolver = (identifiers: CX[]) => Promise<PatientIdResult>;
```

```typescript
// src/v2-to-fhir/id-generation.ts (additions)

/** Match rule: select first CX where authority and/or type match. At least one of authority, type, or any must be specified. */
export type MatchRule = {
  /**
   * Matches the authority of a CX entry by checking CX.4.1 (HD Namespace ID) first,
   * then CX.9.1 (CWE.1 = Identifier of Assigning Jurisdiction), then CX.10.1 (CWE.1 = Identifier
   * of Assigning Agency or Department). The first non-empty component that equals this string wins.
   *
   * Config entries are human-written namespace strings like "UNIPAT", "ST01" — short identifiers,
   * not OIDs or URNs. The .1 subcomponent of each authority field (HD.1 / CWE.1) carries these
   * short strings. Matching against CX.4.2 (HD.2 Universal ID / OID) is not performed because that
   * would require config entries like "urn:oid:2.16.840.1.113883.1.111" — impractical for operators.
   *
   * ID prefix when this authority matches:
   *   - Matched via CX.4.1 → use CX.4 hierarchy: CX.4.1 → CX.4.2 → raw CX.4 string
   *   - Matched via CX.9.1 → prefix is CX.9.1
   *   - Matched via CX.10.1 → prefix is CX.10.1
   *
   * HL7 v2.8.2 requires at least one of CX.4, CX.9, CX.10 to be populated. All three are valid
   * authority sources and must be checked. CX entries with no authority in any of these three
   * components are only eligible for type-only rules or `{ any: true }` (if a prefix can be derived).
   */
  authority?: string; // matched against CX.4.1, then CX.9.1, then CX.10.1 (case-sensitive)
  type?: string;      // match CX.5 exactly
  /**
   * When true, matches the first CX with a non-empty CX.1 regardless of authority or type.
   * ID prefix uses the type-only priority chain: CX.9.1 → CX.4.1 → CX.4.2 → CX.10.1 → raw CX.4 string.
   * If no prefix can be derived (all authority components empty — bare CX), the CX is skipped
   * and the next CX in the pool is tried. Intended as a last-resort fallback rule.
   */
  any?: true;
  // Constraint: at least one of authority, type, or any must be present (validated at config load time)
};

/** MPI lookup rule: query external MPI using a source identifier from the pool. */
export type MpiLookupRule = {
  mpiLookup: {
    endpoint: {
      baseUrl: string;
      timeout?: number; // ms, default 5000
    };
    strategy: 'pix' | 'match';
    /** For 'pix' strategy: which identifier from pool to use as query source. */
    source?: MatchRule[];
    target: {
      system: string;   // FHIR system URI to query
      authority: string; // HL7v2 authority string for the resulting Patient.id
      type?: string;
    };
    /** For 'match' strategy only: minimum confidence threshold (0-1, default 0.95). */
    matchThreshold?: number;
  };
};

export type IdentifierPriorityRule = MatchRule | MpiLookupRule;

export type PatientIdResult =
  | { id: string }
  | { error: string };

/**
 * Select Patient.id from a pool of CX identifiers using ordered priority rules.
 *
 * Algorithm:
 * 1. Skip CX entries with no CX.1 value.
 * 2. For each rule in order:
 *    a. MatchRule { authority?, type?, any? }:
 *       - If rule.any is true:
 *         Match the first CX with non-empty CX.1 regardless of authority or type.
 *         Derive prefix using the type-only priority chain: CX.9.1 → CX.4.1 → CX.4.2 → CX.10.1 → raw CX.4 string.
 *         If no prefix can be derived (all authority components empty — bare CX), skip this CX
 *         and try the next CX in the pool. If no CX yields a prefix, skip to the next rule.
 *       - authority check (if rule.authority is set): check CX.4.1 → CX.9.1 (CWE.1) → CX.10.1 (CWE.1)
 *         in that order. The first non-empty component that equals rule.authority wins.
 *         Record WHICH component matched (cx4match / cx9match / cx10match) — used for ID prefix.
 *       - type check: CX.5 === rule.type (if rule.type is set)
 *       - Both conditions must pass when both fields are set. Either alone is sufficient.
 *       - On match — derive the ID authority prefix (split by match type):
 *
 *         AUTHORITY-RULE MATCH (rule.authority is set, matched a specific component):
 *           - Matched via CX.4.1 → use CX.4 hierarchy: CX.4.1 if non-empty,
 *                                                        else CX.4.2 if non-empty,
 *                                                        else raw CX.4 string (e.g. "&&ISO" → "--iso")
 *           - Matched via CX.9.1 → prefix = CX.9.1
 *           - Matched via CX.10.1 → prefix = CX.10.1
 *
 *         TYPE-ONLY MATCH (rule has type but no authority):
 *           priority chain: CX.9.1 → CX.4.1 → CX.4.2 → CX.10.1 → raw CX.4 string
 *           (CX.9 preferred: geo-political jurisdiction is broadest/most stable authority)
 *
 *           return { id: `${sanitize(authorityPrefix)}-${sanitize(CX.1)}` }
 *    b. MpiLookupRule:
 *       i.  Find source CX using rule.mpiLookup.source match rules (same CX.4.1 → CX.9.1 → CX.10.1 matching).
 *           No source found → skip to next rule.
 *       ii. Query MPI (crossReference or match based on strategy).
 *       iii. status='found' → return { id: `${sanitize(target.authority)}-${sanitize(result.value)}` }
 *       iv.  status='not-found' → skip to next rule.
 *       v.   status='unavailable' → return { error: '...' } (hard error, NOT skip)
 * 3. No rule matched (including empty identifier pool) → return { error: 'No identifier priority rule matched ...' }
 *
 * Authority component semantics (deliberate deviation from extractHDAuthority):
 *   - MATCHING: checks CX.4.1, then CX.9.1 (CWE.1 = Identifier), then CX.10.1 (CWE.1 = Identifier).
 *     Config entries are human namespace strings ("UNIPAT", "ST01"), not OIDs. The .1 subcomponents
 *     (Namespace ID for HD, Identifier for CWE) carry these short strings. Using CX.4.2 (Universal ID /
 *     OID) for matching would require config entries like "urn:oid:2.16.840.1.113883.1.111" — impractical.
 *   - ID FORMATION: authority prefix source depends on which component matched (authority rules)
 *     or uses a priority chain preferring CX.9.1 (type-only rules).
 *     This differs from extractHDAuthority (used for Encounter.id via buildEncounterIdentifier)
 *     which prefers CX.4.2 and is designed for FHIR system URI selection, not resource ID prefix formation.
 *     buildEncounterIdentifier is NOT changed — its authority extraction and conflict detection
 *     approach will be revisited separately in the future.
 *
 * @param identifiers - CX identifiers from PID-3 (after preprocessing)
 * @param rules - ordered priority rules from config.identitySystem.patient.rules
 * @param mpiClient - injectable MPI client (use StubMpiClient when MPI not configured)
 */
export async function selectPatientId(
  identifiers: CX[],
  rules: IdentifierPriorityRule[],
  mpiClient: MpiClient,
): Promise<PatientIdResult> {
  // DESIGN PROTOTYPE — see 2026-02-19-patient-encounter-identity.md
  throw new Error('Not implemented');
}
```

### Config types

```typescript
// src/v2-to-fhir/config.ts (updated types)

export type MessageTypeConfig = {
  preprocess?: {
    PV1?: {
      "19"?: SegmentPreprocessorId[];
    };
    PID?: {
      "2"?: SegmentPreprocessorId[];  // NEW: move-pid2-into-pid3
      "3"?: SegmentPreprocessorId[];  // NEW: inject-authority-from-msh
    };
  };
  converter?: {
    PV1?: { required?: boolean };
  };
};

export type Hl7v2ToFhirConfig = {
  identitySystem?: {
    patient?: { rules: IdentifierPriorityRule[] };
    // Future: encounter?: { rules: IdentifierPriorityRule[] };
  };
  messages?: Record<string, MessageTypeConfig | undefined>;
};
```

### `validateIdentitySystemRules` specification

Called from `hl7v2ToFhirConfig()` after the cast (`const config = parsed as Hl7v2ToFhirConfig`) and before `validatePreprocessorIds(config)`. Fails fast at startup with a descriptive error.

```typescript
// src/v2-to-fhir/config.ts (new function)

/**
 * Validates the identitySystem.patient.rules array at startup.
 * Called before caching the config. All errors throw immediately.
 */
function validateIdentitySystemRules(config: Hl7v2ToFhirConfig): void {
  const rules = config.identitySystem?.patient?.rules;

  // Guard 1: runtime check for the field being present (the cast above does not validate)
  if (!Array.isArray(rules)) {
    throw new Error(
      `Invalid HL7v2-to-FHIR config: "identitySystem.patient.rules" must be an array. ` +
      `Got: ${typeof rules}. ` +
      `Add an "identitySystem": { "patient": { "rules": [...] } } section to the config file.`
    );
  }

  // Guard 2: array must not be empty (empty list means no rule can ever match)
  if (rules.length === 0) {
    throw new Error(
      `Invalid HL7v2-to-FHIR config: "identitySystem.patient.rules" must not be empty. ` +
      `Add at least one MatchRule or MpiLookupRule.`
    );
  }

  // Guard 3: validate each rule
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if ('mpiLookup' in rule) {
      // MpiLookupRule — no field-level validation here; MPI-specific validation
      // (e.g., pix requires source) deferred to the MPI implementation ticket.
    } else {
      // MatchRule validation: at least one of authority, type, or any must be set
      if (!rule.authority && !rule.type && !rule.any) {
        throw new Error(
          `Invalid identitySystem.patient.rules[${i}]: MatchRule must specify at least one of: ` +
          `"authority" (matched against CX.4.1, CX.9.1, or CX.10.1), "type" (matches CX.5), or "any" (true).`
        );
      }
    }
  }
}
```

**Call site in `hl7v2ToFhirConfig()`** (after cast, before `validatePreprocessorIds`):

```typescript
const config = parsed as Hl7v2ToFhirConfig;
validateIdentitySystemRules(config);   // NEW — validates identitySystem.patient.rules array
validatePreprocessorIds(config);        // existing — validates preprocessor IDs
cachedConfig = config;
return cachedConfig;
```

This ensures any missing, empty, or malformed `identitySystem.patient.rules` is caught at startup (first call to `hl7v2ToFhirConfig()`), not when `selectPatientId` is first invoked during message processing.

### Config JSON example

```json
{
  "identitySystem": {
    "patient": {
      "rules": [
        { "authority": "UNIPAT" },
        { "type": "PE" },
        { "authority": "ST01" },
        { "type": "MR" },
        { "any": true }
      ]
    }
  },
  "messages": {
    "ADT-A01": {
      "preprocess": {
        "PID": {
          "2": ["move-pid2-into-pid3"],
          "3": ["inject-authority-from-msh"]
        },
        "PV1": { "19": ["fix-authority-with-msh"] }
      },
      "converter": { "PV1": { "required": true } }
    },
    "ADT-A08": {
      "preprocess": {
        "PID": {
          "2": ["move-pid2-into-pid3"],
          "3": ["inject-authority-from-msh"]
        }
      }
    },
    "ORU-R01": {
      "preprocess": {
        "PID": {
          "2": ["move-pid2-into-pid3"],
          "3": ["inject-authority-from-msh"]
        },
        "PV1": { "19": ["fix-authority-with-msh"] }
      },
      "converter": { "PV1": { "required": false } }
    }
  }
}
```

### Preprocessor function signatures

```typescript
// src/v2-to-fhir/preprocessor-registry.ts (new additions)

/**
 * move-pid2-into-pid3: Fired on PID field 2.
 * If PID-2 has a non-empty CX.1 value, appends the PID-2 CX as a new repeat in PID-3.
 * Clears PID-2 after migration. Never overwrites existing PID-3 content.
 * No-op if PID-2 is empty (empty CX.1 value).
 *
 * IMPORTANT — field-presence guard interaction:
 * preprocessor.ts calls isFieldPresentInSegment(segment, "2") before invoking this function.
 * isFieldPresentInSegment returns false if PID-2 is absent, null, or an empty string.
 * This means the infrastructure already gates invocation on PID-2 being non-empty.
 * The preprocessor's own "no-op if PID-2 is empty" guard is therefore redundant
 * but harmless — both layers independently enforce the same invariant.
 *
 * The primary ASTRA case (PID-2 populated with UNIPAT) always passes the infrastructure
 * guard and reaches this function. When PID-2 is a populated but whitespace-only string,
 * isFieldPresentInSegment returns false (the field is treated as absent), so this
 * preprocessor is not called — the preprocessor never needs to handle that case.
 *
 * Consequence: if PID-2 is present as a non-empty string but CX.1 is empty
 * (e.g., a complex CX with empty first component), isFieldPresentInSegment would return
 * true (non-empty string), but the preprocessor should still treat it as a no-op
 * because there is no CX.1 value to migrate.
 */
function movePid2IntoPid3(
  context: PreprocessorContext,
  segment: HL7v2Segment,
): void { /* DESIGN PROTOTYPE */ }

/**
 * inject-authority-from-msh: Fired on PID field 3.
 * For each CX repeat in PID-3 where CX.1 has a value but all of CX.4/9/10 are empty:
 * - Derives authority namespace from MSH-3 and MSH-4 (same logic as fix-authority-with-msh)
 * - Injects derived namespace as CX.4.1
 * Never overrides CX entries that already have an authority.
 * No-op if MSH has no usable namespace (only Universal ID with no namespace component).
 *
 * Field-presence guard: PID-3 is almost always present in real messages, so
 * isFieldPresentInSegment returns true and the preprocessor runs normally.
 * The preprocessor iterates CX repeats internally and only injects authority
 * into bare CX entries — CX entries with existing authority are not touched.
 */
function injectAuthorityFromMsh(
  context: PreprocessorContext,
  segment: HL7v2Segment,
): void { /* DESIGN PROTOTYPE */ }
```

## Edge Cases and Error Handling

| Scenario | Behavior |
|----------|----------|
| No rule matches any identifier | Hard error: `{ error: "No identifier priority rule matched for identifiers: [...]" }`. Message processing stops. Operator must fix priority rules or preprocessor config. |
| MPI rule triggered, MPI unavailable (timeout/network) | Hard error: `{ error: "MPI unavailable: ..." }`. Does NOT fall through to next rule. Existing retry mechanism handles reprocessing when MPI recovers. |
| MPI rule triggered, MPI returns no match | Skip to next rule. Patient not yet registered in MPI — expected when MPI coverage is incomplete. |
| MPI rule, no source identifier found in pool | Skip to next rule. Source identifiers (configured via `source` match rules) are absent from this message — rule is not applicable. |
| PID-3 empty after preprocessing | `selectPatientId` receives an empty pool, all rules are exhausted, and returns `{ error: 'No identifier priority rule matched for identifiers: []' }`. No separate guard in converters — `selectPatientId` owns this case via natural rule exhaustion. |
| CX entry with empty CX.1 value | Skipped silently — not counted as a candidate for any rule. A rule matching authority/type on an empty-value CX is not a match. |
| CX entry with value but no authority after preprocessing | Silently skipped by authority rules and `{ any: true }` (no prefix derivable from empty authority components). Eligible for type-only rules only (type check matches CX.5 regardless of authority). No hard error on individual bare CX entries. If all pool identifiers are bare and unresolvable, "no rules matched" fires as the final error. Operators configure `inject-authority-from-msh` to fix bare identifiers before conversion. |
| Authority or value contains characters outside `[a-z0-9-]` | Sanitized via `s.toLowerCase().replace(/[^a-z0-9-]/g, "-")` — same pattern as Encounter.id. Both authority and value are sanitized independently. E.g., `&&ISO` → `--iso`, `ST01W` → `st01w`. |
| CX with only CX.4.2 (Universal ID / OID), no CX.4.1 (namespace), and no CX.9/CX.10 | MatchRule `{ authority: "..." }` will not match — matching checks CX.4.1, CX.9.1, CX.10.1, all of which are empty. The CX is still eligible for type-only rules. For ID formation under a type-only rule, the priority chain (CX.9.1 → CX.4.1 → CX.4.2 → CX.10.1 → raw CX.4 string) falls through to CX.4.2 as the first non-empty value. Config entries must use the .1 identifier subcomponents, not OIDs. If a sender provides identifiers only via OID in CX.4.2, use a type-only rule and accept the OID as the authority prefix in the Patient.id. |
| MSH has no namespace (only Universal ID or empty) | `inject-authority-from-msh` is a no-op — bare PID-3 CX entries remain without authority after this preprocessor. They are still eligible for type-only rules. The same limitation applies to `fix-authority-with-msh` for PV1-19 (documented in that preprocessor's TODO comment). |
| `&&ISO` authority after sanitization produces leading dashes (`--iso`) | The FHIR R4 ID format allows `[A-Za-z0-9\-\.]{1,64}` — leading hyphens are technically valid. Aidbox does not additionally restrict the ID format beyond the FHIR spec. The `--iso-m000000721` result is accepted by Aidbox. This is a known consequence of sanitizing `&&ISO` (namespace empty, universal ID empty, type "ISO") where CX.4.1 is empty, CX.4.2 is empty, and the raw CX.4 string `&&ISO` sanitizes to `--iso`. |
| MatchRule specifies neither authority, type, nor any | Validated at config load time via `validateIdentitySystemRules()`: throws `Error("MatchRule must specify at least one of: authority, type, or any")`. |
| `{ any: true }` rule matches first CX with derivable prefix | `{ any: true }` iterates CX pool; first CX with non-empty CX.1 AND a derivable authority prefix (via type-only priority chain) wins. Returns `{ id: "{sanitize(prefix)}-{sanitize(CX.1)}" }`. |
| `{ any: true }` rule skips bare CX (no prefix derivable) | CX with non-empty CX.1 but CX.4/CX.9/CX.10 all empty — no prefix can be derived. `{ any: true }` skips this CX and tries the next CX in the pool. |
| `{ any: true }` rule: all CX entries are bare — falls through to next rule | All CX entries have CX.1 values but no authority components. `{ any: true }` cannot derive a prefix for any, skips to the next rule. If no further rules exist, "no rules matched" fires. |
| `identitySystem.patient.rules` key missing entirely from config JSON | `validateIdentitySystemRules()` detects `!Array.isArray(config.identitySystem?.patient?.rules)` at startup and throws a descriptive error. The loader does not crash with a cryptic `TypeError` at runtime — the failure is caught at startup before the cache is populated. |
| Two CX entries both match a rule | First matching CX in the pool order wins. Pool order is the order of PID-3 repeats after preprocessing. |
| Rule list is empty | `validateIdentitySystemRules()` detects empty array at config load time and throws `Error("identitySystem.patient.rules must not be empty")`. `selectPatientId` is never called with an empty rule list. |
| CX with only CX.9 or CX.10 populated (no CX.4) | `inject-authority-from-msh` checks all of CX.4/9/10 — if CX.9 or CX.10 is non-empty, the CX is treated as already having an authority and is not modified. `MatchRule.authority` matching checks CX.4.1 (empty), then CX.9.1, then CX.10.1 — so an authority rule like `{ authority: "STATEX" }` WILL match if CX.9.1 or CX.10.1 equals "STATEX". The ID prefix is then derived from CX.9.1 or CX.10.1 respectively (not from the empty CX.4). This is correct: CX.9 (jurisdiction) and CX.10 (department) are valid HL7 authority sources and must be first-class matching targets. |
| CX with authority in CX.9.1 matched by authority rule | MatchRule `{ authority: "STATEX" }` matches CX where CX.4.1 is empty but CX.9.1 = "STATEX". Prefix = "STATEX" (from CX.9.1). Returns `{ id: "statex-{sanitize(CX.1)}" }`. |
| CX with authority in CX.10.1 matched by authority rule | MatchRule `{ authority: "DEPT01" }` matches CX where CX.4.1 and CX.9.1 are empty but CX.10.1 = "DEPT01". Prefix = "DEPT01" (from CX.10.1). Returns `{ id: "dept01-{sanitize(CX.1)}" }`. |
| Type-only rule with CX that has CX.9.1 populated | Rule `{ type: "MR" }` matches CX with CX.5="MR" and CX.9.1="STATEX". Type-only prefix chain: CX.9.1 wins first. Returns `{ id: "statex-{sanitize(CX.1)}" }`. |

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|
| ASTRA message: UNIPAT in PID-2, ST01W/MR + ST01/PI in PID-3 — after move-pid2-into-pid3, rule `{authority: "UNIPAT"}` matches via CX.4.1 | Unit | CX has CX.4.1="UNIPAT"; matching checks CX.4.1 first, finds match; prefix = "UNIPAT" (CX.4 hierarchy). selectPatientId returns `unipat-11195429` |
| MEDTEX message: UNIPAT directly in PID-3 — rule `{authority: "UNIPAT"}` matches via CX.4.1 without preprocessing | Unit | CX has CX.4.1="UNIPAT"; CX.4.1 check matches immediately. selectPatientId returns `unipat-11216032` |
| MEDTEX without UNIPAT: BMH/PE in PID-3, rule `{type: "PE"}` matches as second rule — type-only prefix uses CX.4.1 | Unit | CX has CX.5="PE", CX.4.1="BMH", CX.9.1 empty. Type-only prefix chain: CX.9.1 empty → CX.4.1="BMH" wins. selectPatientId returns `bmh-11220762` |
| Xpan lab: `&&ISO`/MR, `&&ISO`/PI, `&&ISO`/AN — rule `{type: "MR"}` matches at position 4, type-only prefix falls to raw CX.4 string | Unit | CX has CX.5="MR", CX.9.1 empty, CX.4.1 empty, CX.4.2 empty, CX.10.1 empty. Type-only prefix chain exhausts CX.9.1/CX.4.1/CX.4.2/CX.10.1, falls back to raw CX.4 string `&&ISO` → sanitized to `--iso`. selectPatientId returns `--iso-m000000721`. |
| Authority rule matches via CX.9.1 — CX.4.1 is empty but CX.9.1 equals rule.authority | Unit | rule `{authority: "STATEX"}`, CX has CX.4.1="" and CX.9.1="STATEX". Matching: CX.4.1 empty → check CX.9.1 = "STATEX" — matches. Prefix = CX.9.1 = "STATEX". Returns `statex-{sanitize(CX.1)}`. |
| Authority rule matches via CX.10.1 — CX.4.1 and CX.9.1 are empty but CX.10.1 equals rule.authority | Unit | rule `{authority: "DEPT01"}`, CX has CX.4.1="" and CX.9.1="" and CX.10.1="DEPT01". Matching: CX.4.1 empty → CX.9.1 empty → CX.10.1 = "DEPT01" — matches. Prefix = CX.10.1 = "DEPT01". Returns `dept01-{sanitize(CX.1)}`. |
| Authority rule does NOT match when authority string is only in CX.4.2 (Universal ID), not in CX.4.1/CX.9.1/CX.10.1 | Unit | rule `{authority: "UNIPAT"}` does not match CX with CX.4.2="UNIPAT", CX.4.1="" (CX.9 and CX.10 empty). CX.4.1, CX.9.1, CX.10.1 all empty — no match. CX eligible for type-only rules only. |
| Type-only rule with CX that has CX.9.1 populated — prefix comes from CX.9.1 (preferred over CX.4.1) | Unit | rule `{type: "MR"}`, CX has CX.5="MR", CX.9.1="STATEX", CX.4.1="ST01". Type-only prefix chain: CX.9.1="STATEX" wins first (CX.9 is preferred as broadest/most stable authority). Returns `statex-{sanitize(CX.1)}`. |
| Type-only rule with CX that has CX.9.1 empty and CX.4.1 populated — prefix comes from CX.4.1 | Unit | rule `{type: "MR"}`, CX has CX.5="MR", CX.9.1="", CX.4.1="ST01". Type-only prefix chain: CX.9.1 empty → CX.4.1="ST01" wins. Returns `st01-{sanitize(CX.1)}`. |
| Type-only rule with CX that has CX.10.1 only (CX.9.1 and CX.4.1/CX.4.2 empty) | Unit | rule `{type: "AN"}`, CX has CX.5="AN", CX.9.1="", CX.4.1="", CX.4.2="", CX.10.1="DEPT01". Type-only prefix chain: CX.9.1→CX.4.1→CX.4.2 all empty → CX.10.1="DEPT01" wins. Returns `dept01-{sanitize(CX.1)}`. |
| MatchRule ID formation: CX with empty CX.4.1/CX.9.1/CX.10.1 and non-empty CX.4.2 matched by type-only rule produces CX.4.2-based prefix | Unit | rule `{type: "MR"}` matching CX with CX.9.1="", CX.4.1="", CX.4.2="urn:oid:2.16.840.1.113883.1.111", CX.10.1="", CX.1="12345". Type-only chain: CX.9.1→CX.4.1 empty → CX.4.2="urn:oid:..." wins. Returns `urn:oid:2-16-840-1-113883-1-111-12345`. |
| No matching rule: FOO/XX only in pool | Unit | selectPatientId returns `{ error: "No identifier priority rule matched..." }` |
| Empty CX.1 value — CX has authority and type but empty value | Unit | CX is skipped; next CX is evaluated |
| MPI rule (pix strategy): MPI returns found — `{ status: 'found', identifier: { value: '19624139' } }` | Unit | selectPatientId returns `unipat-19624139` |
| MPI rule (pix strategy): MPI returns not-found — falls through to next rule | Unit | selectPatientId continues to next rule, returns result from next match |
| MPI rule (pix strategy): MPI unavailable — hard error | Unit | selectPatientId returns `{ error: "MPI unavailable: ..." }` |
| MPI rule (pix strategy): no source identifier in pool — skip | Unit | selectPatientId skips MPI rule, evaluates next rule |
| MpiLookupRule (pix strategy): source identifier selected via CX.9.1 — MPI finds result | Unit | Rule has `source: [{ authority: "STATEX" }]`; pool has CX with CX.4.1="" and CX.9.1="STATEX"; MPI crossReference called with correct source; returns `unipat-19624139` |
| **Note — 'match' strategy tests:** Tests for `strategy='match'` in `selectPatientId` are deferred to the MPI implementation ticket. The stub always returns 'not-found' for `match()`, which means the 'match' flow cannot be meaningfully exercised until a real MpiClient is available. The current signature `(identifiers: CX[], rules, mpiClient)` does not provide demographics — this is a known limitation documented in Key Decisions. The MPI implementation ticket will determine whether `selectPatientId` gains a `demographics?: PatientDemographics` parameter or whether demographics extraction is done inside the real MpiClient via a different mechanism. | — | Deferred |
| `{ any: true }` matches first CX with derivable prefix | Unit | Pool has CX1 (CX.4.1="BMH", CX.1="123") and CX2 (CX.4.1="ST01", CX.1="456"). `{ any: true }` matches CX1 first; type-only prefix chain: CX.9.1 empty → CX.4.1="BMH" wins. Returns `bmh-123`. |
| `{ any: true }` skips bare CX, matches CX with authority | Unit | Pool has bare CX (CX.1="999", no CX.4/9/10) then CX with CX.4.1="FOO" and CX.1="888". `{ any: true }` skips bare CX (no prefix), matches second CX. Returns `foo-888`. |
| `{ any: true }` with all bare CX — falls through to next rule | Unit | Pool has only bare CX entries. `{ any: true }` cannot derive prefix for any. If next rule is `{ type: "MR" }` and a bare CX has CX.5="MR", that rule catches it (type-only rules are eligible for bare CX). |
| Rule list empty | Unit | Config load throws validation error via `validateIdentitySystemRules()` (does not reach selectPatientId) |
| MatchRule with neither authority, type, nor any | Unit | Config load throws validation error via `validateIdentitySystemRules()` |
| `identitySystem.patient.rules` key absent from JSON | Unit | Config load throws descriptive error at startup (not a runtime crash in selectPatientId) |
| inject-authority-from-msh: bare CX `12345^^^^MR` gets authority from MSH | Unit | CX.4.1 set to derived MSH namespace; CX.1, CX.5 unchanged |
| inject-authority-from-msh: CX already has CX.4 — not overridden | Unit | Existing CX.4 preserved |
| move-pid2-into-pid3: PID-2 CX moved to PID-3, PID-2 cleared | Unit | PID-3 gains new repeat with PID-2 CX data; PID-2 is empty after |
| move-pid2-into-pid3: PID-2 empty — no-op | Unit | PID-3 unchanged |
| Config load: new JSON shape with `identitySystem.patient.rules` + `messages` | Unit | Config loads without error; `config.identitySystem.patient.rules` is array; `config.messages["ADT-A01"]` accessible |
| Config load: unknown preprocessor ID in PID rules | Unit | Throws with descriptive error at load time |
| **Migrated: config.test.ts** — valid config returns typed object with new shape | Unit | `configWithMshFallback` fixture updated to `{ identitySystem: { patient: { rules: [{authority: "UNIPAT"}] } }, messages: { "ORU-R01": {...}, "ADT-A01": {...} } }`; `config["ORU-R01"]` access changes to `config.messages["ORU-R01"]`; matching semantics in rule description updated to reflect CX.4.1 → CX.9.1 → CX.10.1 check order |
| **Migrated: config.test.ts** — unknown preprocessor ID in messages[...] throws startup error | Unit | Validates that `validatePreprocessorIds` now walks `config.messages` (not `Object.entries(config)`) |
| **Migrated: preprocessor.test.ts** — `configWithMshFallback` and `configWithoutPreprocess` constants use new shape | Unit | All `preprocessMessage(parsed, config)` calls in existing tests pass with restructured config |
| ADT-A01 end-to-end: ASTRA message with UNIPAT in PID-2 produces `unipat-{value}` Patient.id | Integration | In `test/integration/v2-to-fhir/adt.integration.test.ts` inside `describe("patient identity system", ...)`. Full message through converter produces Patient with correct id |
| ORU-R01 end-to-end: MEDTEX without UNIPAT falls back to type-PE rule | Integration | In `test/integration/v2-to-fhir/oru-r01.integration.test.ts` inside `describe("patient identity system", ...)`. Full message produces Patient with `bmh-{value}` id |
| Reprocessing idempotency: same message processed twice produces same Patient.id | Integration | In existing integration test file. Second processing upserts, not duplicates |
| No-match error propagates to IncomingHL7v2Message status | Integration | In existing integration test file. Message gets status=error with appropriate error message |

# Context

## Exploration Findings

### Current state

**Patient.id assignment is ad-hoc in both converters:**

- `adt-a01.ts` lines 331–335: tries raw PID-2 value, falls back to PID-3[0] value. No authority prefix, no type filtering, no config.
- `oru-r01.ts` `extractPatientId()` lines 121–129: identical logic, throws on missing. Neither produces the `{authority}-{value}` format required.

**Encounter.id is already correct:** `pv1-encounter.ts` uses `buildEncounterIdentifier()` from `id-generation.ts` which validates CX.4/9/10, extracts authority, and produces `{sanitize(authority)}-{sanitize(value)}`. No change needed to encounter ID logic.

**PV1-51 (NEW FINDINGS note in epic):** Per spec, PV1-51 is Visit Indicator — a 1-char flag (`A`/`V`), NOT an identifier. ASTRA non-standard usage moved to separate ticket `00_02_pv1_51_astra_nonstandard.md`. Out of scope for this design.

### Config structure

Current `config/hl7v2-to-fhir.json`:
```json
{
  "ORU-R01": { "preprocess": { "PV1": { "19": ["fix-authority-with-msh"] } }, "converter": { "PV1": { "required": false } } },
  "ADT-A01": { "preprocess": { "PV1": { "19": ["fix-authority-with-msh"] } }, "converter": { "PV1": { "required": true } } }
}
```

`Hl7v2ToFhirConfig` type is currently `Record<string, MessageTypeConfig | undefined>`.

**New shape** (agreed with user — `identitySystem.patient.rules` + messages record):
```json
{
  "identitySystem": {
    "patient": {
      "rules": [
        { "authority": "UNIPAT" },
        { "type": "PE" },
        { "authority": "ST01" },
        { "type": "MR" },
        { "any": true }
      ]
    }
  },
  "messages": {
    "ADT-A01": { "preprocess": { "PV1": { "19": ["fix-authority-with-msh"] } }, "converter": { "PV1": { "required": true } } },
    "ADT-A08": { "preprocess": { "PID": { "2": ["move-pid2-into-pid3"], "3": ["inject-authority-from-msh"] } } },
    "ORU-R01": { "preprocess": { "PV1": { "19": ["fix-authority-with-msh"] } }, "converter": { "PV1": { "required": false } } }
  }
}
```

### Preprocessor infrastructure

Registry at `src/v2-to-fhir/preprocessor-registry.ts`:
- Rules registered by kebab-case ID in `SEGMENT_PREPROCESSORS`
- Each receives `(context: PreprocessorContext, segment: HL7v2Segment) => void`
- Modify segment in place on `HL7v2Segment.fields`
- Config key is segment+field: `{ "PID": { "2": ["move-pid2-into-pid3"] } }`
- `SegmentPreprocessorId` is strictly typed to registered IDs

New preprocessors needed:
- `"move-pid2-into-pid3"`: fired on PID field 2; moves PID-2 CX into PID-3 repeats
- `"inject-authority-from-msh"`: fired on PID field 3; injects MSH authority into bare CX entries

`MessageTypeConfig.preprocess` type currently only has `PV1."19"` — needs `PID."2"` and `PID."3"` added.

### ID sanitization pattern (existing, to reuse)

```typescript
const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "-");
encounter.id = `${sanitize(authority)}-${sanitize(value)}`;
```

Patient ID must use the same sanitization: `${sanitize(matchedAuthority)}-${sanitize(cxValue)}`.

### Async impact

`selectPatientId()` will be async (mpiLookup rules make async calls). The converters (`adt-a01.ts`, `oru-r01.ts`) are already async overall — no structural issue.

### Test patterns

- `bun:test` with `describe`/`test`/`expect`
- Pure function tests receive typed objects directly (no raw HL7 parsing needed)
- Config tests: use `clearConfigCache()` + `process.env.HL7V2_TO_FHIR_CONFIG` override
- Config validated at startup; unknown preprocessor IDs throw at load time

---

## User Requirements & Answers

**Source epic:** `ai/tickets/awie_case/epics/00_01_identification_system.md`

**Q: PV1-51 handling (ASTRA ADT-A04 data in non-standard field)?**
A: Create separate ticket `ai/tickets/awie_case/epics/00_02_pv1_51_astra_nonstandard.md`. Remove from this design. PV1-51 handling out of scope.

**Q: Config scope — global or per-sender?**
A: Per-deployment now (single `identitySystem.patient.rules`), but structure must support future per-sender migration. Use `identitySystem.patient.rules` + `messages` record to make per-sender migration clean.

**Q: MPI stub — include or defer?**
A: Include mpiLookup rule type now with stub. Config schema, algorithm, `MpiClient` interface, and tests all in. Stub returns `{ status: 'not-found' }`.

**Q: Config type shape?**
A: `identitySystem.patient.rules` + messages record:
```json
{ "identitySystem": { "patient": { "rules": [...] } }, "messages": { "ADT-A01": {...}, "ORU-R01": {...} } }
```

## AI Review Notes

### AI Review — iteration 7 (2026-02-19)

**Summary:** All 7 blockers from iteration 6 have been fully addressed. The design body sections (Proposed Approach, Key Decisions, Technical Details, Edge Cases, Test Cases, Affected Components) are now internally consistent and aligned with all user feedback from round 3. Prototype files have been cleaned up. No new issues introduced.

---

#### Blocker verification:

1. **BLOCKER 1 (rename to move-pid2-into-pid3):** FIXED. Zero occurrences of `merge-pid2-into-pid3` remain anywhere in design or prototypes. All references use `move-pid2-into-pid3`. Follow-up note for segment-level preprocessor ticket present in Affected Components (line 95).

2. **BLOCKER 2 ({ any: true }):** FIXED. All six required locations updated:
   - MatchRule type has `any?: true` field (line 198)
   - selectPatientId algorithm handles `{ any: true }` (lines 234-239)
   - validateIdentitySystemRules accepts `{ any: true }` via `!rule.authority && !rule.type && !rule.any` (line 362)
   - Edge cases cover `{ any: true }` matching (line 501), bare CX skip (line 502), and all-bare fallthrough (line 503)
   - Test cases cover all three scenarios (lines 535-537)
   - Config JSON example includes `{ "any": true }` as last rule (line 396)

3. **BLOCKER 3 (no pre-call guard):** FIXED. Edge case "PID-3 empty after preprocessing" (line 493) now says `selectPatientId` handles it via natural rule exhaustion. No converter guard references in the design body.

4. **BLOCKER 4 (bare CX):** FIXED. Edge case (line 495) explicitly states: silently skipped by authority rules and `{ any: true }`, eligible for type-only rules only, no hard error on individual bare CX, "no rules matched" as final error.

5. **BLOCKER 5 (prototype comments):** FIXED. All prototype files now contain only behavioral documentation and brief DESIGN PROTOTYPE blocks with implementation-direction notes. Design rationale, options considered, migration instructions, and pattern justifications have been stripped from all files.

6. **BLOCKER 6 (no pix-source validation):** FIXED. Removed from validateIdentitySystemRules (line 357-359 now has a comment deferring to MPI ticket, no validation throws). Removed from edge cases, test cases, and Affected Components description.

7. **BLOCKER 7 (integration tests):** FIXED. Affected Components table includes `test/integration/v2-to-fhir/adt.integration.test.ts` (line 92) and `test/integration/v2-to-fhir/oru-r01.integration.test.ts` (line 93). Test cases specify file placement and `describe("patient identity system", ...)` blocks (lines 550-553).

---

#### Non-blocker observations (carried forward from iteration 6, all resolved or not actionable):

**A. ADT-A08 preprocessor config:** Now included in the config JSON example (lines 411-418) with PID preprocessors. Resolved.

**B. Config type `encounter` placeholder:** The current design uses a comment `// Future: encounter?: { rules: IdentifierPriorityRule[] };` (line 317) rather than a typed placeholder. This is clean. Resolved.

**C. Config JSON prototype file comment keys:** `config/hl7v2-to-fhir.json` still has `_DESIGN_PROTOTYPE` and `_DESIGN_PROTOTYPE_new_shape` keys alongside actual config. This is expected for a prototype file and will be cleaned at implementation time. Not actionable now.

**D. Prototype files use old config accessors in non-prototype code:** E.g., `adt-a01.ts` line 371 still has `config["ADT-A01"]`. This is expected: prototypes show intent via DESIGN PROTOTYPE comment blocks, not actual code changes. Consistent with prototype conventions.

---

### Recommendation

Design is approved for user review. All 7 blockers from iteration 6 are verified fixed. Design body sections are internally consistent. Prototype files align with the design. No new issues introduced by the fixes.

## User Feedback

### User review — 2026-02-19 (round 3)

**1. Rename `move-pid2-into-pid3` → `move-pid2-into-pid3`**
The preprocessor removes the identifier from PID-2 (not just copies), so "move" is accurate. Name must be updated in all locations: preprocessor-registry.ts, design doc, config/hl7v2-to-fhir.json prototype, and all references.
Create a new ticket for segment-level preprocessors (framework extension: a preprocessor that fires once per segment with no field-presence gate). Include a sub-task to migrate `move-pid2-into-pid3` to segment-level once the framework supports it.
The current PID-2 field registration is confirmed correct for now — PID-3 level would have a bug (gate fails if PID-3 is absent, which is exactly the ASTRA case), and PID-level is not supported without framework changes.

**2. Add `{ any: true }` fallback MatchRule variant**
Add `any?: true` to `MatchRule`. A rule of `{ any: true }` matches the first CX with a non-empty CX.1 regardless of authority or type. ID prefix derivation uses the type-only priority chain (CX.9.1 → CX.4.1 → CX.4.2 → CX.10.1 → raw CX.4 string). If no authority prefix can be derived (all components empty — bare CX), `{ any: true }` skips that CX and moves to the next. Update `validateIdentitySystemRules` to accept `{ any: true }` as a valid rule (no authority or type required for this variant). Rules array must still be non-empty (empty array = always-failing config = startup error).

**3. "PID-3 empty after preprocessing" edge case: remove pre-call guard from converters**
The current design has an early guard in each converter throwing before calling `resolvePatientId`. Remove it. When PID-3 is empty, `selectPatientId` receives an empty pool, all rules are exhausted, and `{ error: 'No identifier priority rule matched...' }` is returned naturally. If the guard is in each converter, every future converter must also remember to add it. Let `selectPatientId` own this case entirely.

**4. Bare CX (no authority): silently skipped, not hard-errored**
A CX with non-empty CX.1 but CX.4/CX.9/CX.10 all empty is a spec violation (CX.4/9/10 are [C] — at least one required). However, `selectPatientId` handles these silently: they are skipped by all authority-based rules (no authority to match) and also skipped by `{ any: true }` (no prefix derivable). No hard error on individual bare CX. If all identifiers in the pool are bare and unresolvable, "no rules matched" fires as the final error. Operators configure `inject-authority-from-msh` to fix bare identifiers before conversion.
Update the edge case note for "CX entry with value but no authority after preprocessing" to reflect this behavior.

**5. Prototype comments: behavioral docs only — no design rationale in code**
Strip all design rationale, options considered, and decision justifications from prototype comments in ALL files. Code comments must only document: what the function does, parameter semantics, and what errors it returns/throws. Design rationale belongs exclusively in the design document. Applies to: id-generation.ts, mpi-client.ts, config.ts, preprocessor-registry.ts, adt-a01.ts, adt-a08.ts, oru-r01.ts, converter.ts.

**6. Remove `mpiLookup pix requires source` validation from `validateIdentitySystemRules`**
Not in scope. Remove from spec. The MPI implementation ticket will define validation for MPI-specific fields.

**7. Integration tests: extend existing files, not new files**
Add `describe("patient identity system", ...)` blocks inside existing `test/integration/v2-to-fhir/adt.integration.test.ts` and `oru-r01.integration.test.ts`. Do not create new integration test files.

# Implementation Plan

## Overview

Replace ad-hoc Patient.id assignment across three converters (ADT_A01, ADT_A08, ORU_R01) with a config-driven priority-list algorithm (`selectPatientId`). Restructure `Hl7v2ToFhirConfig` from a flat record to a typed object with `identitySystem.patient.rules` + `messages` keys. Add two PID preprocessors (`move-pid2-into-pid3`, `inject-authority-from-msh`) and an MPI client stub to support cross-EHR patient matching.

## Development Approach
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: run `bun test:all` after every task — all tests must pass before starting next task**
- **CRITICAL: update this plan when scope changes**

## Validation Commands
- `bun test:all` — Run all tests (unit + integration)
- `bun run typecheck` — TypeScript type checking

---

## Task 1: Create MPI client stub (`mpi-client.ts`)

Foundation types used by `selectPatientId` and `converter.ts`. No existing code depends on this file yet.

- [x] Replace the design prototype scaffold in `src/v2-to-fhir/mpi-client.ts` with the real implementation: `MpiResult` union type, `PatientDemographics` type, `MpiClient` interface with `crossReference()` and `match()`, `StubMpiClient` class
- [x] Keep comments behavioral-only (what, params, errors) — no design rationale
- [x] Write unit tests in `test/unit/v2-to-fhir/mpi-client.test.ts`: StubMpiClient.crossReference returns `{ status: 'not-found' }`, StubMpiClient.match returns `{ status: 'not-found' }`
- [x] Run `bun test:all` and `bun run typecheck` — must pass before next task

---

## Task 2: Add types and `selectPatientId()` to `id-generation.ts`

Core algorithm. Depends on `MpiClient` from Task 1.

- [x] Replace commented-out prototype types in `src/v2-to-fhir/id-generation.ts` with real exports: `MatchRule`, `MpiLookupRule`, `IdentifierPriorityRule`, `PatientIdResult`, `PatientIdResolver`
- [x] Implement `selectPatientId(identifiers, rules, mpiClient)` following the algorithm in design Technical Details:
  - Skip CX entries with empty CX.1
  - For each rule in order: handle `{ any: true }` (match first CX with derivable prefix, skip bare CX), authority matching (CX.4.1 → CX.9.1 → CX.10.1), type matching (CX.5), combined authority+type
  - Authority-rule prefix: matched via CX.4.1 → CX.4 hierarchy, CX.9.1 → CX.9.1, CX.10.1 → CX.10.1
  - Type-only / `{ any: true }` prefix chain: CX.9.1 → CX.4.1 → CX.4.2 → CX.10.1 → raw CX.4 string
  - MpiLookupRule: find source CX, query MPI, handle found/not-found/unavailable
  - No rule matched → `{ error: "No identifier priority rule matched..." }`
- [x] Use same sanitization pattern as `buildEncounterIdentifier`: `s.toLowerCase().replace(/[^a-z0-9-]/g, "-")`
- [x] Write unit tests in `test/unit/v2-to-fhir/select-patient-id.test.ts` covering ALL test cases from design:
  - ASTRA UNIPAT via CX.4.1 → `unipat-11195429`
  - MEDTEX UNIPAT directly in PID-3 → `unipat-11216032`
  - MEDTEX BMH/PE type-only → `bmh-11220762`
  - Xpan `&&ISO`/MR type-only → `--iso-m000000721`
  - Authority via CX.9.1, CX.10.1
  - Authority NOT matching CX.4.2
  - Type-only prefix chain: CX.9.1 preferred over CX.4.1
  - Type-only with CX.10.1 only
  - CX.4.2-based prefix for type-only
  - No matching rule → error
  - Empty CX.1 → skipped
  - MPI pix: found, not-found (falls through), unavailable (hard error), no source (skip)
  - MPI pix source via CX.9.1
  - `{ any: true }`: matches first CX with derivable prefix
  - `{ any: true }`: skips bare CX, matches next CX with authority
  - `{ any: true }`: all bare CX → falls through to next rule
- [x] Run `bun test:all` and `bun run typecheck` — must pass before next task

---

## Task 3: Restructure config types and JSON

Config foundation. All existing config consumers and tests must be migrated.

- [ ] Update `src/v2-to-fhir/config.ts`:
  - Add `PID` key to `MessageTypeConfig.preprocess` type: `PID?: { "2"?: SegmentPreprocessorId[]; "3"?: SegmentPreprocessorId[] }`
  - Change `Hl7v2ToFhirConfig` from `Record<string, MessageTypeConfig | undefined>` to `{ identitySystem?: { patient?: { rules: IdentifierPriorityRule[] } }; messages?: Record<string, MessageTypeConfig | undefined> }`
  - Import `IdentifierPriorityRule` from `./id-generation`
  - Add `validateIdentitySystemRules(config)` function (Guards 1-3 from design: array present, non-empty, each MatchRule has authority/type/any)
  - Call `validateIdentitySystemRules` before `validatePreprocessorIds` in `hl7v2ToFhirConfig()`
  - Update `validatePreprocessorIds` to iterate `config.messages` instead of top-level `Object.entries(config)`. Must skip `identitySystem` and other non-message keys
- [ ] Update `config/hl7v2-to-fhir.json`: replace flat format with new shape (`identitySystem.patient.rules` + `messages` record). Remove `_DESIGN_PROTOTYPE` and `_DESIGN_PROTOTYPE_new_shape` comment keys
- [ ] Update `src/v2-to-fhir/preprocessor.ts`:
  - Change `config[configKey]` → `config.messages?.[configKey]` (line 43)
  - Change `applyPreprocessors` type annotation from `NonNullable<Hl7v2ToFhirConfig[string]>["preprocess"]` to `NonNullable<MessageTypeConfig>["preprocess"]` (import `MessageTypeConfig`)
- [ ] Migrate `test/unit/v2-to-fhir/config.test.ts`:
  - All fixture objects: flat `{ "ORU-R01": {...} }` → `{ identitySystem: { patient: { rules: [{ authority: "UNIPAT" }] } }, messages: { "ORU-R01": {...} } }`
  - All `config["ORU-R01"]` access → `config.messages?.["ORU-R01"]`
  - "unknown preprocessor ID" test: still works after `validatePreprocessorIds` walks `config.messages`
  - Add test: `identitySystem.patient.rules` missing from JSON → throws at startup
  - Add test: MatchRule with neither authority, type, nor any → throws at startup
  - Add test: empty rules array → throws at startup
- [ ] Migrate `test/unit/v2-to-fhir/preprocessor.test.ts`:
  - `configWithMshFallback` → `{ identitySystem: { patient: { rules: [{ authority: "UNIPAT" }] } }, messages: { "ORU-R01": {...}, "ADT-A01": {...} } }`
  - `configWithoutPreprocess` → same structure without `preprocess` keys
  - Inline `config` objects in tests: same migration
- [ ] Run `bun test:all` and `bun run typecheck` — must pass before next task

---

## Task 4: Implement PID preprocessors

Two new preprocessors in the registry. Depends on config supporting PID fields (Task 3).

- [ ] In `src/v2-to-fhir/preprocessor-registry.ts`:
  - Remove all DESIGN PROTOTYPE comments
  - Register `"move-pid2-into-pid3": movePid2IntoPid3` and `"inject-authority-from-msh": injectAuthorityFromMsh` in `SEGMENT_PREPROCESSORS`
  - Implement `movePid2IntoPid3(context, segment)`:
    - Guard: segment must be PID
    - Read PID-2 (field index 2); if CX.1 is empty → no-op
    - Read PID-3 (field index 3); append PID-2 CX as new repeat (handle array/non-array/absent)
    - Clear PID-2 (set `segment.fields[2] = undefined` or empty)
  - Implement `injectAuthorityFromMsh(context, segment)`:
    - Guard: segment must be PID
    - Derive namespace from MSH-3/MSH-4 (reuse `parseHdNamespace` pattern from `fixAuthorityWithMsh`)
    - For each CX repeat in PID-3: if CX.1 has value AND CX.4/9/10 all empty → inject derived namespace as CX.4.1
    - Never override existing authority. No-op if MSH has no usable namespace
- [ ] Update `SegmentPreprocessorId` type: it's derived from `keyof typeof SEGMENT_PREPROCESSORS`, so registering new entries auto-updates it
- [ ] Write unit tests in `test/unit/v2-to-fhir/preprocessor-pid.test.ts`:
  - `move-pid2-into-pid3`: PID-2 CX moved to PID-3, PID-2 cleared
  - `move-pid2-into-pid3`: PID-2 empty → no-op
  - `move-pid2-into-pid3`: PID-3 already has repeats → PID-2 appended as additional repeat
  - `inject-authority-from-msh`: bare CX `12345^^^^MR` gets authority from MSH
  - `inject-authority-from-msh`: CX already has CX.4 → not overridden
  - `inject-authority-from-msh`: CX with CX.9 populated → not overridden
  - `inject-authority-from-msh`: MSH has no namespace → no-op
- [ ] Add preprocessor tests to `test/unit/v2-to-fhir/preprocessor.test.ts`:
  - Config with PID.2/PID.3 preprocessors and full message → verify both fire in order
  - Config with unknown PID preprocessor ID → throws at load time
- [ ] Run `bun test:all` and `bun run typecheck` — must pass before next task

---

## Task 5: Wire `PatientIdResolver` into converters

Replace ad-hoc Patient.id logic in all three converters. Depends on Tasks 2-3.

- [ ] Update `src/v2-to-fhir/converter.ts`:
  - Remove DESIGN PROTOTYPE comments
  - Import `selectPatientId`, `type PatientIdResolver` from `./id-generation`
  - Import `StubMpiClient` from `./mpi-client`
  - Import `hl7v2ToFhirConfig` from `./config`
  - In `convertToFHIR()`: instantiate `StubMpiClient`, load config, create closure `const resolvePatientId: PatientIdResolver = (ids) => selectPatientId(ids, config.identitySystem!.patient!.rules, mpiClient)`
  - Pass `resolvePatientId` to `convertADT_A01`, `convertADT_A08`, `convertORU_R01`
  - `convertADT_A08` call becomes `await convertADT_A08(parsed, resolvePatientId)`
- [ ] Update `src/v2-to-fhir/messages/adt-a01.ts`:
  - Remove DESIGN PROTOTYPE comments
  - Import `type PatientIdResolver` from `../id-generation`
  - Add `resolvePatientId: PatientIdResolver` parameter to `convertADT_A01`
  - Replace ad-hoc Patient.id block (lines 333-338) with: `const result = await resolvePatientId(pid.$3_identifier ?? []); if ('error' in result) { return { messageUpdate: { status: 'error', error: result.error } }; }; patient.id = result.id;`
  - Update config access: `config["ADT-A01"]` → `config.messages?.["ADT-A01"]`
- [ ] Update `src/v2-to-fhir/messages/adt-a08.ts`:
  - Remove DESIGN PROTOTYPE comments
  - Import `type PatientIdResolver` from `../id-generation`
  - Make `convertADT_A08` async: `export async function convertADT_A08(parsed, resolvePatientId: PatientIdResolver)`
  - Replace ad-hoc Patient.id block (lines 127-134) with `resolvePatientId()` call and error handling
- [ ] Update `src/v2-to-fhir/messages/oru-r01.ts`:
  - Remove DESIGN PROTOTYPE comments and `extractPatientId()` function
  - Import `selectPatientId`, `type PatientIdResolver` from `../id-generation`
  - Import `StubMpiClient` from `../mpi-client`
  - Add `resolvePatientId: PatientIdResolver` parameter to `handlePatient()` and `convertORU_R01()`
  - Add lazy default in `convertORU_R01`: `resolvePatientId = (ids) => selectPatientId(ids, hl7v2ToFhirConfig().identitySystem!.patient!.rules, new StubMpiClient())` — so existing unit tests that omit the parameter continue to work
  - Replace `extractPatientId(pid)` in `handlePatient()` with `const result = await resolvePatientId(pid.$3_identifier ?? [])` and handle `{ error }` case
  - Update config access in `handleEncounter`: `config["ORU-R01"]` → `config.messages?.["ORU-R01"]`
- [ ] Remove `src/v2-to-fhir/preprocessor.ts` DESIGN PROTOTYPE comments
- [ ] Run `bun test:all` and `bun run typecheck` — must pass before next task

---

## Task 6: Integration tests

Depends on all implementation tasks (1-5). Tests full message flow through converter.

- [ ] Add `describe("patient identity system", ...)` block in `test/integration/v2-to-fhir/adt.integration.test.ts`:
  - ADT-A01 end-to-end: ASTRA message with UNIPAT in PID-2 produces `unipat-{value}` Patient.id
  - Reprocessing idempotency: same message processed twice produces same Patient.id (upsert, not duplicate)
- [ ] Add `describe("patient identity system", ...)` block in `test/integration/v2-to-fhir/oru-r01.integration.test.ts`:
  - ORU-R01 end-to-end: MEDTEX without UNIPAT falls back to type-PE rule
  - No-match error: message with unrecognized identifiers → IncomingHL7v2Message gets status=error
- [ ] Run `bun test:all` and `bun run typecheck` — must pass before next task

---

## Task 7: Cleanup design artifacts

- [ ] Remove all `DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity.md` comments from all source files
- [ ] Verify no prototype markers remain: `grep -r "DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity" src/ config/`
- [ ] Update design document status to `implemented`
- [ ] Run `bun test:all` and `bun run typecheck` — final verification

---

## Post-Completion Verification

1. **Functional test**: Send an ASTRA ADT_A01 message with UNIPAT in PID-2 through the full pipeline — Patient.id should be `unipat-{value}`
2. **Edge case test**: Send a message with only `&&ISO`/MR identifiers — Patient.id should be `--iso-{value}`
3. **Cross-EHR test**: Send ASTRA and MEDTEX messages for the same physical patient (both with UNIPAT) — both produce the same `unipat-{value}` Patient.id
4. **Config validation**: Start server with missing `identitySystem.patient.rules` — should fail fast at startup with descriptive error
5. **No regressions**: All existing tests pass (`bun test:all`)
6. **Cleanup verified**: No `DESIGN PROTOTYPE` comments remain in source

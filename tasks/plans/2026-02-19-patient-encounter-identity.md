---
status: ai-reviewed
reviewer-iterations: 5
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

- **MatchRule** `{ authority?, type? }` — matches the first CX where the authority matches any of CX.4.1, CX.9.1 (CWE.1), or CX.10.1 (CWE.1) in that order, and/or CX.5 equals the type. At least one of the two must be specified.
- **MpiLookupRule** `{ mpiLookup: { ... } }` — picks a source identifier from the pool using nested match rules, queries an external MPI, and if the MPI returns a result, uses that as Patient.id. If the MPI is unavailable (network error, timeout), it is a hard error — no fallthrough. If the MPI returns no match, the rule is skipped and the next rule in the list is tried.

The resulting Patient.id format is `{sanitize(authority)}-{sanitize(value)}` using the same sanitization pattern already applied to Encounter.id in `id-generation.ts`.

**Config-driven rules** live at `identitySystem.patient.rules` in `hl7v2-to-fhir.json`. The per-message-type config moves under a `messages` key. This structure keeps the global identifier priority separate from per-message-type behavior while making future per-sender migration straightforward (add a sender-keyed map at the same level). The `identitySystem` grouping also reserves space for future `encounter` identity rules at the same level.

**PatientIdResolver abstraction** (`type PatientIdResolver = (identifiers: CX[]) => Promise<PatientIdResult>`) follows the same pattern as `PatientLookupFn`/`EncounterLookupFn` already used in `oru-r01.ts`. `converter.ts` creates the resolver as a closure over `config.identitySystem.patient.rules` and `mpiClient`. Each converter (`convertADT_A01`, `convertADT_A08`, `convertORU_R01`) receives `resolvePatientId: PatientIdResolver` instead of `mpiClient: MpiClient` — the converter calls `resolvePatientId(pid.$3_identifier ?? [])` without knowing the algorithm, rule list, or MPI client.

**Preprocessor rules** handle normalization before the converter sees identifiers:
- `"merge-pid2-into-pid3"` fires on PID field 2; appends the PID-2 CX into PID-3's repeat list (or creates PID-3 if absent), then clears PID-2.
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

**Priority-list vs simpler schemes:** The priority-list is more config to maintain compared to "always use UNIPAT if present, else first CX". The tradeoff is intentional: real data has nine authorities across two EHR systems with different field positions. A simpler scheme cannot handle ASTRA putting UNIPAT in PID-2 while MEDTEX puts it in PID-3, because by the time the converter sees PID-3, PID-2 is a separate field. The preprocessor boundary (merge-pid2-into-pid3 first, then priority-list on PID-3) keeps the converter clean.

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
| `src/v2-to-fhir/config.ts` | Modify | Restructure `Hl7v2ToFhirConfig` to `{ identitySystem?: { patient?: { rules: IdentifierPriorityRule[] } }, messages?: Record<string, MessageTypeConfig> }`, extend `MessageTypeConfig.preprocess` with PID fields, update `validatePreprocessorIds` to walk `config.messages` instead of top-level config object; add `validateIdentitySystemRules()` called from `hl7v2ToFhirConfig()` before caching — validates: (1) `identitySystem.patient.rules` is a non-empty array, (2) each MatchRule has at least one of `authority`/`type`, (3) each MpiLookupRule with `strategy='pix'` has `source` defined; add runtime guard before caching: `if (!Array.isArray(config.identitySystem?.patient?.rules)) throw new Error('...')`; import `PatientIdResolver` from `./id-generation` if needed (type is defined and exported ONLY from `id-generation.ts`, not re-exported from `config.ts`) |
| `src/v2-to-fhir/preprocessor.ts` | Modify | Update `config[configKey]` → `config.messages[configKey]` (line 37); update `applyPreprocessors` type annotation `NonNullable<Hl7v2ToFhirConfig[string]>["preprocess"]` → `NonNullable<MessageTypeConfig>["preprocess"]` (line 64) |
| `src/v2-to-fhir/preprocessor-registry.ts` | Extend | Add `"merge-pid2-into-pid3"` and `"inject-authority-from-msh"` registrations |
| `src/v2-to-fhir/messages/adt-a01.ts` | Modify | Replace ad-hoc Patient.id logic (lines 331–335) with `resolvePatientId()` call; add `resolvePatientId: PatientIdResolver` parameter instead of `mpiClient: MpiClient`; update config access to `config.messages["ADT-A01"]` |
| `src/v2-to-fhir/messages/adt-a08.ts` | Modify | Replace ad-hoc Patient.id logic (lines 122–129) with `resolvePatientId()` call; make function async (currently sync); add `resolvePatientId: PatientIdResolver` parameter instead of `mpiClient: MpiClient`; update `converter.ts` call site to `await convertADT_A08(parsed, resolvePatientId)`. Config access to `config.messages["ADT-A08"]` (entry may be absent — handled by `config.messages["ADT-A08"]?.converter?.PV1?.required ?? false`). Note: ADT_A08 does not use PV1 — only Patient ID logic is affected. |
| `src/v2-to-fhir/messages/oru-r01.ts` | Modify | Remove `extractPatientId()`; replace call site in `handlePatient()` with `resolvePatientId()`; add `resolvePatientId: PatientIdResolver` parameter to `handlePatient()` and `convertORU_R01()` instead of `mpiClient: MpiClient`; update config access to `config.messages["ORU-R01"]`; `resolvePatientId` has a lazy default in `convertORU_R01` that mirrors `converter.ts` wiring: `(ids) => selectPatientId(ids, hl7v2ToFhirConfig().identitySystem!.patient!.rules, new StubMpiClient())` — existing unit tests that omit the fourth argument continue to work without modification |
| `src/v2-to-fhir/converter.ts` | Modify | Instantiate `StubMpiClient` once per `convertToFHIR()` call; load config via `hl7v2ToFhirConfig()`; create `resolvePatientId: PatientIdResolver` closure: `(ids) => selectPatientId(ids, config.identitySystem.patient.rules, mpiClient)`; pass `resolvePatientId` to `convertADT_A01`, `convertADT_A08`, and `convertORU_R01`; converters no longer receive `mpiClient` directly |
| `src/v2-to-fhir/processor-service.ts` | Check | Review whether `processor-service.ts` calls `convertToFHIR` directly (via `converter.ts`) or the individual converter functions. If it calls `converter.ts`, no change needed there — `converter.ts` handles the instantiation. Confirm at implementation time. |
| `config/hl7v2-to-fhir.json` | Modify | Add `identitySystem.patient.rules` array; move message configs under `messages` key |
| `test/unit/v2-to-fhir/config.test.ts` | Modify | Migrate all fixture objects from flat `{ "ORU-R01": {...} }` shape to `{ identitySystem: { patient: { rules: [...] } }, messages: { "ORU-R01": {...} } }` shape. Update type assertions and navigation tests accordingly. The "unknown preprocessor ID throws startup error" test must continue to work after `validatePreprocessorIds` walks `config.messages`. Add test: `identitySystem.patient.rules` missing from JSON throws at startup (not runtime). Add test: MatchRule with neither authority nor type throws at startup. Add test: MpiLookupRule pix with no source throws at startup. |
| `test/unit/v2-to-fhir/preprocessor.test.ts` | Modify | Migrate `configWithMshFallback` and `configWithoutPreprocess` constants from flat-record shape to new typed shape. All message-config access in test fixtures must change. |

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

/** Match rule: select first CX where authority and/or type match. At least one must be specified. */
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
   * components are only eligible for type-only rules.
   */
  authority?: string; // matched against CX.4.1, then CX.9.1, then CX.10.1 (case-sensitive)
  type?: string;      // match CX.5 exactly
  // Constraint: at least one of authority or type must be present (validated at config load time)
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
 *    a. MatchRule { authority?, type? }:
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
 * 3. No rule matched → return { error: 'No identifier priority rule matched ...' }
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
      "2"?: SegmentPreprocessorId[];  // NEW: merge-pid2-into-pid3
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
    encounter?: { rules: never[] }; // placeholder for future encounter identity rules
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
      // MpiLookupRule validation
      if (rule.mpiLookup.strategy === 'pix' && !rule.mpiLookup.source) {
        throw new Error(
          `Invalid identitySystem.patient.rules[${i}]: MpiLookupRule with strategy='pix' ` +
          `must have a "source" array to select the source identifier.`
        );
      }
    } else {
      // MatchRule validation
      if (!rule.authority && !rule.type) {
        throw new Error(
          `Invalid identitySystem.patient.rules[${i}]: MatchRule must specify at least one of: ` +
          `"authority" (matched against CX.4.1, CX.9.1, or CX.10.1) or "type" (matches CX.5).`
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
        { "type": "MR" }
      ]
    }
  },
  "messages": {
    "ADT-A01": {
      "preprocess": {
        "PID": {
          "2": ["merge-pid2-into-pid3"],
          "3": ["inject-authority-from-msh"]
        },
        "PV1": { "19": ["fix-authority-with-msh"] }
      },
      "converter": { "PV1": { "required": true } }
    },
    "ORU-R01": {
      "preprocess": {
        "PID": {
          "2": ["merge-pid2-into-pid3"],
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
 * merge-pid2-into-pid3: Fired on PID field 2.
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
function mergePid2IntoPid3(
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
| PID-3 empty after preprocessing | Error before selectPatientId is called: "PID-3 is required but missing after preprocessing". |
| CX entry with empty CX.1 value | Skipped silently — not counted as a candidate for any rule. A rule matching authority/type on an empty-value CX is not a match. |
| CX entry with value but no authority after preprocessing | Eligible for type-only rules. Not eligible for authority rules or MPI source selection (no authority to map to MPI system). |
| Authority or value contains characters outside `[a-z0-9-]` | Sanitized via `s.toLowerCase().replace(/[^a-z0-9-]/g, "-")` — same pattern as Encounter.id. Both authority and value are sanitized independently. E.g., `&&ISO` → `--iso`, `ST01W` → `st01w`. |
| CX with only CX.4.2 (Universal ID / OID), no CX.4.1 (namespace), and no CX.9/CX.10 | MatchRule `{ authority: "..." }` will not match — matching checks CX.4.1, CX.9.1, CX.10.1, all of which are empty. The CX is still eligible for type-only rules. For ID formation under a type-only rule, the priority chain (CX.9.1 → CX.4.1 → CX.4.2 → CX.10.1 → raw CX.4 string) falls through to CX.4.2 as the first non-empty value. Config entries must use the .1 identifier subcomponents, not OIDs. If a sender provides identifiers only via OID in CX.4.2, use a type-only rule and accept the OID as the authority prefix in the Patient.id. |
| MSH has no namespace (only Universal ID or empty) | `inject-authority-from-msh` is a no-op — bare PID-3 CX entries remain without authority after this preprocessor. They are still eligible for type-only rules. The same limitation applies to `fix-authority-with-msh` for PV1-19 (documented in that preprocessor's TODO comment). |
| `&&ISO` authority after sanitization produces leading dashes (`--iso`) | The FHIR R4 ID format allows `[A-Za-z0-9\-\.]{1,64}` — leading hyphens are technically valid. Aidbox does not additionally restrict the ID format beyond the FHIR spec. The `--iso-m000000721` result is accepted by Aidbox. This is a known consequence of sanitizing `&&ISO` (namespace empty, universal ID empty, type "ISO") where CX.4.1 is empty, CX.4.2 is empty, and the raw CX.4 string `&&ISO` sanitizes to `--iso`. |
| MatchRule specifies neither authority nor type | Validated at config load time via `validateIdentitySystemRules()`: throws `Error("MatchRule must specify at least one of: authority, type")`. |
| MpiLookupRule with strategy='pix' but no `source` rules | Config validation error at load time via `validateIdentitySystemRules()`: `source` is required for pix strategy. |
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
| ASTRA message: UNIPAT in PID-2, ST01W/MR + ST01/PI in PID-3 — after merge-pid2-into-pid3, rule `{authority: "UNIPAT"}` matches via CX.4.1 | Unit | CX has CX.4.1="UNIPAT"; matching checks CX.4.1 first, finds match; prefix = "UNIPAT" (CX.4 hierarchy). selectPatientId returns `unipat-11195429` |
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
| Rule list empty | Unit | Config load throws validation error via `validateIdentitySystemRules()` (does not reach selectPatientId) |
| MatchRule with neither authority nor type | Unit | Config load throws validation error via `validateIdentitySystemRules()` |
| MpiLookupRule with strategy='pix' and no source array | Unit | Config load throws validation error via `validateIdentitySystemRules()` |
| `identitySystem.patient.rules` key absent from JSON | Unit | Config load throws descriptive error at startup (not a runtime crash in selectPatientId) |
| inject-authority-from-msh: bare CX `12345^^^^MR` gets authority from MSH | Unit | CX.4.1 set to derived MSH namespace; CX.1, CX.5 unchanged |
| inject-authority-from-msh: CX already has CX.4 — not overridden | Unit | Existing CX.4 preserved |
| merge-pid2-into-pid3: PID-2 CX moved to PID-3, PID-2 cleared | Unit | PID-3 gains new repeat with PID-2 CX data; PID-2 is empty after |
| merge-pid2-into-pid3: PID-2 empty — no-op | Unit | PID-3 unchanged |
| Config load: new JSON shape with `identitySystem.patient.rules` + `messages` | Unit | Config loads without error; `config.identitySystem.patient.rules` is array; `config.messages["ADT-A01"]` accessible |
| Config load: unknown preprocessor ID in PID rules | Unit | Throws with descriptive error at load time |
| **Migrated: config.test.ts** — valid config returns typed object with new shape | Unit | `configWithMshFallback` fixture updated to `{ identitySystem: { patient: { rules: [{authority: "UNIPAT"}] } }, messages: { "ORU-R01": {...}, "ADT-A01": {...} } }`; `config["ORU-R01"]` access changes to `config.messages["ORU-R01"]`; matching semantics in rule description updated to reflect CX.4.1 → CX.9.1 → CX.10.1 check order |
| **Migrated: config.test.ts** — unknown preprocessor ID in messages[...] throws startup error | Unit | Validates that `validatePreprocessorIds` now walks `config.messages` (not `Object.entries(config)`) |
| **Migrated: preprocessor.test.ts** — `configWithMshFallback` and `configWithoutPreprocess` constants use new shape | Unit | All `preprocessMessage(parsed, config)` calls in existing tests pass with restructured config |
| ADT-A01 end-to-end: ASTRA message with UNIPAT in PID-2 produces `unipat-{value}` Patient.id | Integration | Full message through converter produces Patient with correct id |
| ORU-R01 end-to-end: MEDTEX without UNIPAT falls back to type-PE rule | Integration | Full message produces Patient with `bmh-{value}` id |
| Reprocessing idempotency: same message processed twice produces same Patient.id | Integration | Second processing upserts, not duplicates |
| No-match error propagates to IncomingHL7v2Message status | Integration | Message gets status=error with appropriate error message |

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
        { "type": "MR" }
      ]
    }
  },
  "messages": {
    "ADT-A01": { "preprocess": { "PV1": { "19": ["fix-authority-with-msh"] } }, "converter": { "PV1": { "required": true } } },
    "ORU-R01": { "preprocess": { "PV1": { "19": ["fix-authority-with-msh"] } }, "converter": { "PV1": { "required": false } } }
  }
}
```

### Preprocessor infrastructure

Registry at `src/v2-to-fhir/preprocessor-registry.ts`:
- Rules registered by kebab-case ID in `SEGMENT_PREPROCESSORS`
- Each receives `(context: PreprocessorContext, segment: HL7v2Segment) => void`
- Modify segment in place on `HL7v2Segment.fields`
- Config key is segment+field: `{ "PID": { "2": ["merge-pid2-into-pid3"] } }`
- `SegmentPreprocessorId` is strictly typed to registered IDs

New preprocessors needed:
- `"merge-pid2-into-pid3"`: fired on PID field 2; moves PID-2 CX into PID-3 repeats
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

### Overall Assessment

The design is architecturally sound and well-reasoned. The priority-list algorithm, preprocessor separation, and MPI stub are all good choices. The key decisions table shows careful deliberation. However, there are **three blockers** and several non-blocking issues that must be addressed before implementation.

---

### BLOCKER 1: `preprocessor.ts` is not updated to work with the new config shape

**Severity: Blocker**

`preprocessor.ts` accesses message config via `config[configKey]` (line 37), treating `Hl7v2ToFhirConfig` as a flat record. After the config restructure, the correct access is `config.messages[configKey]`. This file is not listed in **Affected Components** and has no prototype markers — it will be broken silently after implementation.

The TypeScript type change alone will not catch this if the old code path still compiles (the old flat-record type is replaced entirely, so the compiler will catch it — but the design document does not call out this file as requiring changes, which means an implementor could miss it).

**Affected Components table must include `src/v2-to-fhir/preprocessor.ts` with:**
- Change type: Modify
- Description: Update `config[configKey]` → `config.messages[configKey]` to match the restructured `Hl7v2ToFhirConfig` type

The `applyPreprocessors` call also uses `NonNullable<Hl7v2ToFhirConfig[string]>["preprocess"]` as a type annotation — that type reference will break and must be updated to `NonNullable<MessageTypeConfig>["preprocess"]` or equivalent.

---

### BLOCKER 2: The `preprocessor.ts` field-presence guard breaks `merge-pid2-into-pid3`

**Severity: Blocker**

`preprocessor.ts` line 88–91 checks `isFieldPresentInSegment(segment, field)` before invoking any preprocessor. `isFieldPresentInSegment` returns false if the field value is `undefined`, `null`, or an empty string.

`merge-pid2-into-pid3` is registered on `PID.2`. When PID-2 is absent (the field is missing entirely), the preprocessor correctly does nothing — that is fine. But when PID-2 is empty in the message as a placeholder (e.g., `PID|1||...`), the raw parsed value is an empty string and `isFieldPresentInSegment` returns false, preventing the preprocessor from running. Since ASTRA sends PID-2 populated (that is the whole point), this should still work for the primary case.

However, the design says "No-op if PID-2 is empty" as a behavior of the preprocessor itself. The current infrastructure already enforces the field-present guard. This creates a subtle layering issue: if PID-2 is present but has only whitespace, the infrastructure skips the preprocessor entirely, but the preprocessor's own "no-op if empty CX.1" guard would have handled it differently (it still receives the segment and clears PID-2). The outcome is the same but the responsibility is split across two layers without documentation.

More critically: `inject-authority-from-msh` is registered on `PID.3`. PID-3 is almost always present in a real message, so the field-presence guard passes — this is correct. But the design document does not call out the field-presence guard behavior or how it interacts with the new preprocessors. This must be explicitly documented in the design to avoid surprises during implementation.

**Required resolution:** Add a note to the design document (Technical Details > Preprocessor function signatures section) explaining that `merge-pid2-into-pid3` is only invoked by the infrastructure when PID-2 is present and non-empty. The preprocessor's own empty-value guard is redundant but harmless. Confirm the behavior is intentional.

---

### BLOCKER 3: `MatchRule` authority matching uses `CX.4.1` (HD namespace) only — but existing `buildEncounterIdentifier` prefers `CX.4.2` (HD universal ID)

**Severity: Blocker — semantic inconsistency breaks the stated ID format guarantee**

The design states: `selectPatientId` uses `${sanitize(cx4Authority)}-${sanitize(cx1Value)}` where `cx4Authority` is `CX.4.1`. But `id-generation.ts`'s `extractHDAuthority()` (already in the file) prefers `CX.4.2` (HD.2 Universal ID) over `CX.4.1` (HD.1 Namespace ID). The same function is used for Encounter.id authority extraction.

The `MatchRule` spec says: `match CX.4.1`. But if a CX carries authority as `&&ISO` (Universal ID only, no namespace), then `CX.4.1` is empty, the MatchRule `{ authority: "&&ISO" }` makes no sense as a config entry (you can't write `&&` in a config meaningfully), and the rule fails to match — silently, because empty CX.4.1 simply does not equal any authority string.

The test case in the design for Xpan lab (`&&ISO`/MR) expects `selectPatientId` to match via `{ type: "MR" }` not via authority. That is fine for that case. But the ID produced is `--iso-m000000721` — which uses the sanitized CX.4.1 value of `&&ISO`. If the implementor follows `extractHDAuthority` precedence (preferring CX.4.2), they would use a different value than what the test case expects.

The design must explicitly specify: for **matching** purposes in `MatchRule`, which HD subcomponent is compared (CX.4.1 only? CX.4.2 only? Either?). And for **ID generation**, which HD subcomponent provides the authority string placed in the Patient.id (CX.4.1 only, consistent with the `sanitize(cx4Authority)` example? Or CX.4.2 with fallback to CX.4.1, consistent with `extractHDAuthority`?).

This is not just a documentation issue — if the implementation of `selectPatientId` uses `extractHDAuthority` for consistency with existing code, the test case expectation `--iso-m000000721` is correct because `&&ISO` has no CX.4.2, so the fallback is CX.4.1 (`&&ISO` → sanitized `--iso`). But if a sender provides `urn:oid:1.2.3.4&ISO` in CX.4, `extractHDAuthority` returns `urn:oid:1.2.3.4` (CX.4.2), while the MatchRule `{ authority: "urn:oid:1.2.3.4" }` would need to compare against CX.4.2, not CX.4.1.

**Required resolution:** The design must specify precisely which HD subcomponent(s) `MatchRule.authority` is compared against, and which subcomponent `selectPatientId` uses to form the Patient.id prefix. Recommend aligning with `extractHDAuthority` semantics (prefer CX.4.2, fallback to CX.4.1) for consistency with Encounter.id. If `CX.4.1` only is chosen deliberately, explain why.

---

### Issue 4: All existing config tests will break after the config restructure (non-blocking, but high effort if missed)

**Severity: High — implementation risk**

`test/unit/v2-to-fhir/config.test.ts` and `test/unit/v2-to-fhir/preprocessor.test.ts` both construct `Hl7v2ToFhirConfig` objects using the flat `Record<string, MessageTypeConfig>` shape. After the restructure, these will fail to compile. The design document does not mention updating existing tests.

The test cases in the design's Test Cases section are all new tests. The migration of existing tests must also be listed as required work. Specifically:
- `config.test.ts`: All fixtures using `{ "ORU-R01": {...} }` must change to `{ identitySystem: { patient: { rules: [...] } }, messages: { "ORU-R01": {...} } }`.
- `preprocessor.test.ts`: Same — `configWithMshFallback` and `configWithoutPreprocess` constants must be updated.
- `validatePreprocessorIds` in `config.ts` iterates `Object.entries(config)` — after restructure it must iterate `Object.entries(config.messages)`. The existing test for "unknown preprocessor ID throws startup error" must still pass after this change.

**Required resolution:** Add migration of existing tests to the Affected Components table. This is not optional — the tests exist and will break.

---

### Issue 5: `MpiLookupRule.endpoint` is per-rule, not shared — potential config duplication and inconsistency

**Severity: Medium — design concern, not a blocker**

The `MpiLookupRule` embeds `endpoint.baseUrl` and `endpoint.timeout` inside each rule. In the likely real-world case where a deployment has exactly one MPI, every `mpiLookup` rule in the list repeats the same base URL. If the MPI URL changes, every rule must be updated.

The alternative (a top-level `mpi` config block) was not discussed in the Key Decisions table. This is worth one sentence in the design's trade-offs. The current design is not wrong — per-rule endpoints allow theoretically querying different MPIs for different strategies — but the operational hazard of duplicated URLs should be acknowledged.

**Required resolution:** Add a sentence in Trade-offs acknowledging this, or add it to Key Decisions as a considered-and-rejected option.

---

### Issue 6: `handlePatient()` in `oru-r01.ts` signature change requires updating the call site in `convertORU_R01`

**Severity: Medium — implementation completeness**

The design prototype comment in `oru-r01.ts` shows that `handlePatient()` gains an `mpiClient: MpiClient` parameter. However, `convertORU_R01` calls `handlePatient(pid, baseMeta, lookupPatient)` — after the change, the call site must pass `mpiClient` as well. The design document does not mention where `mpiClient` is instantiated and passed into `convertORU_R01` and `convertADT_A01`.

The question of how `MpiClient` (defaulting to `StubMpiClient`) gets wired into the converter functions is not addressed. Options:
1. Inject via parameter into `convertADT_A01` and `convertORU_R01` (changes public API, requires caller updates in `converter.ts`)
2. Instantiate `StubMpiClient` inside each converter (simpler but not injectable for tests without parameter changes)
3. Module-level singleton (bad — not testable without module mocking)

Given that `PatientLookupFn` and `EncounterLookupFn` are already injected as parameters in `convertORU_R01`, option 1 is consistent with existing patterns and is the right choice. But this is currently unspecified in the design, and the Affected Components table does not list `converter.ts` (which may also need changes) or the call sites in `processor-service.ts`.

**Required resolution:** Specify how `MpiClient` is wired into the converters. Add affected call sites to the Affected Components table if the public API changes.

---

### Issue 7: `inject-authority-from-msh` is a no-op when MSH has no usable namespace — this silently leaves CX without authority, which then falls through to type-only rules

**Severity: Low — behavior concern, already partially addressed**

The design states "No-op if MSH has no usable namespace." This means that if both MSH-3 and MSH-4 have no namespace component (only Universal ID / OID), bare CX entries in PID-3 remain without authority after preprocessing. They will then match only type-only rules. This is correct by design — the `fix-authority-with-msh` preprocessor for PV1-19 has the same limitation and has a TODO comment about HD universal ID fallback.

The design should note this explicitly in the Edge Cases table: "MSH has no namespace (only Universal ID) — bare PID-3 CX entries remain without authority after inject-authority-from-msh; they are only eligible for type-only rules." This prevents confusion during implementation.

---

### Issue 8: Sanitization of `&&ISO` produces `--iso` — two leading dashes is a valid but ugly ID prefix

**Severity: Low — cosmetic**

The test case explicitly expects `--iso-m000000721`. The sanitizer turns `&&ISO` → `--iso`. While this is consistent and deterministic, leading hyphens in FHIR resource IDs are technically allowed but may cause issues with some FHIR servers that validate ID format. The FHIR R4 spec requires IDs match `[A-Za-z0-9\-\.]{1,64}`. Leading hyphens are valid but unusual.

This is not a blocker — it is a known consequence of the sanitizer applied to `&&ISO` authority values. The design and test case explicitly acknowledge this. Just ensure the target FHIR server (Aidbox) accepts IDs like `--iso-m000000721`.

---

### Summary of Issues

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | **Blocker** | `preprocessor.ts` not listed in Affected Components; will break at compile time after config restructure | **RESOLVED** |
| 2 | **Blocker** | Field-presence guard interaction with `merge-pid2-into-pid3` not documented; layering responsibility unclear | **RESOLVED** |
| 3 | **Blocker** | `MatchRule` authority matching against CX.4.1 vs `extractHDAuthority` semantics (CX.4.2 preferred) — inconsistency with existing ID generation | **RESOLVED** |
| 4 | High | Existing config and preprocessor tests not listed as requiring migration | **RESOLVED** |
| 5 | Medium | Per-rule MPI endpoint duplication risk not acknowledged in trade-offs | **RESOLVED** |
| 6 | Medium | `MpiClient` wiring into converters and `converter.ts`/`processor-service.ts` call sites unspecified | **RESOLVED** |
| 7 | Low | MSH-has-no-namespace edge case for `inject-authority-from-msh` not in Edge Cases table | **RESOLVED** |
| 8 | Low | Leading hyphens in IDs from `&&ISO` — verify Aidbox accepts them | **RESOLVED** |

### Resolution Notes

**BLOCKER 1 — RESOLVED:** Added `src/v2-to-fhir/preprocessor.ts` to Affected Components with the two required changes: `config[configKey]` → `config.messages[configKey]` and `NonNullable<Hl7v2ToFhirConfig[string]>["preprocess"]` → `NonNullable<MessageTypeConfig>["preprocess"]`. Added DESIGN PROTOTYPE marker in `preprocessor.ts` pointing to both change locations. TypeScript will catch both at compile time once the type changes.

**BLOCKER 2 — RESOLVED:** Added detailed `isFieldPresentInSegment` guard interaction documentation to `merge-pid2-into-pid3` in both the Technical Details section of the design doc and the prototype comment in `preprocessor-registry.ts`. The design now explicitly states: infrastructure gates the call on PID-2 being non-empty (as string), the preprocessor handles the residual case where the string is non-empty but CX.1 component is empty. Both layers independently enforce the same invariant without conflict.

**BLOCKER 3 — RESOLVED:** Explicitly specified the HD subcomponent semantics in `selectPatientId` (Key Decisions table, Technical Details algorithm, `MatchRule` type comment, `id-generation.ts` prototype). Decision: **matching uses CX.4.1 only** (config entries are human namespace strings, not OIDs); **ID formation uses CX.4.1 → CX.4.2 → raw CX.4 string** (ensures non-empty prefix for `&&ISO` which has empty CX.4.1 and CX.4.2). This deliberately deviates from `extractHDAuthority` (which prefers CX.4.2) — the deviation is now documented and justified. Encounter.id formation is unaffected.

**Issue 4 — RESOLVED:** Added `test/unit/v2-to-fhir/config.test.ts` and `test/unit/v2-to-fhir/preprocessor.test.ts` to Affected Components table with specific migration instructions. Added three "Migrated:" test cases to the Test Cases table covering the config fixture shape change and the `validatePreprocessorIds` walk change.

**Issue 5 — RESOLVED:** Added a paragraph in Trade-offs acknowledging per-rule endpoint duplication risk and explaining why a shared top-level `mpi` block was rejected (premature for a stub feature; per-rule allows different MPIs per strategy). Also added to Key Decisions table as a considered-and-rejected option.

**Issue 6 — RESOLVED:** Added `MpiClient` injection strategy to Key Decisions table. Added `converter.ts` and `processor-service.ts` to Affected Components. Added DESIGN PROTOTYPE marker in `converter.ts` showing exactly where `StubMpiClient` is instantiated and passed. Added DESIGN PROTOTYPE comment in `oru-r01.ts` showing full `convertORU_R01` new signature with `mpiClient` as last optional parameter with default `new StubMpiClient()`. Same pattern in `adt-a01.ts`. Added DESIGN PROTOTYPE marker in `adt-a01.ts` for the `convertADT_A01` signature.

**Issue 7 — RESOLVED:** Added "MSH has no namespace (only Universal ID or empty)" row to Edge Cases table documenting that `inject-authority-from-msh` is a no-op in this case and bare PID-3 CX entries remain without authority, eligible only for type-only rules.

**Issue 8 — RESOLVED:** Added "`&&ISO` authority after sanitization produces leading dashes" row to Edge Cases table. Confirmed Aidbox accepts IDs matching `[A-Za-z0-9\-\.]{1,64}` without additional restrictions — `--iso-m000000721` is valid. Updated the Xpan test case description to explain the raw CX.4 string fallback mechanism that produces `--iso`.

## User Feedback

### User review — 2026-02-19 (round 2)

**Algorithm fix: CX authority completeness**

The `selectPatientId` algorithm only checks CX.4.1 for matching and CX.4.x for ID prefix — it ignores CX.9 and CX.10, violating HL7 v2.8.2 which allows authority in any of CX.4, CX.9, or CX.10. `buildEncounterIdentifier` stays unchanged.

**Matching** (MatchRule `{ authority: "X" }`): check CX.4.1 → CX.9.1 (CWE.1) → CX.10.1 (CWE.1) in order; first non-empty match wins.

**ID prefix formation — split by match type:**
- *Authority-rule match*: use the component that matched (`{ authority: "X" }` matched CX.4.1 → prefix from CX.4 hierarchy; matched CX.9.1 → prefix is CX.9.1; matched CX.10.1 → prefix is CX.10.1)
- *Type-only match* (`{ type: "MR" }`, no authority in rule): priority chain — **CX.9.1 → CX.4.1 → CX.4.2 → CX.10.1 → raw CX.4 string fallback**

CX.9 is preferred for type-only matches because it represents the broadest/most stable authority (geo-political jurisdiction).

`buildEncounterIdentifier` is NOT changed — its authority extraction and conflict detection approach will be revisited separately in the future.

**CLAUDE.md fix (applied):** Added spec completeness rule: never skip spec fields just because example data doesn't use them. Deliberate deviations must be documented.

**hl7v2-info skill fix (applied):** Clarified that parallel lookups must use separate Bash tool calls, not shell `&`, to avoid triggering the permissions system.

---

### User review — 2026-02-19

Three changes requested before approval:

**1. PatientIdResolver abstraction (identity system abstraction concern)**
The design directly couples converters to `selectPatientId(identifiers, config.identitySystem.patient.rules, mpiClient)`. This means converters know the algorithm. If the priority-list approach is replaced entirely, all three converter files need changes.

Required fix: Define a `PatientIdResolver` type (like `PatientLookupFn`/`EncounterLookupFn` — existing pattern in oru-r01.ts). `converter.ts` creates the resolver as a closure over `rules` and `mpiClient`. Converters receive and call it without knowing the algorithm. Type: `type PatientIdResolver = (identifiers: CX[]) => Promise<PatientIdResult>`.

**2. Rename `identifierPriority` → `identitySystem.patient.rules`**
`identifierPriority` is too ad-hoc. It belongs under a proper identity system section. Agreed name: `identitySystem.patient.rules`.

Full config shape:
```json
{
  "identitySystem": {
    "patient": { "rules": [...] },
    "encounter": { "rules": [] }  // future
  },
  "messages": {
    "ADT-A01": { "preprocess": ..., "converter": ... }
  }
}
```

TypeScript type: `{ identitySystem?: { patient?: { rules: IdentifierPriorityRule[] }; encounter?: { rules: never[] } }; messages?: Record<string, MessageTypeConfig> }`

**3. Create refactoring ticket**
Create `ai/tickets/awie_case/epics/00_03_converter_context_refactor.md` documenting the "too many parameters" problem: `PatientLookupFn`, `EncounterLookupFn`, `PatientIdResolver`, and config are all separate parameters into each converter. Future solution: compose into a `ConverterContext` object. (Ticket already created.)

## AI Review Notes — Pass 2 (2026-02-19)

### Scope

Second review pass. All 3 blockers and 5 non-blocking issues from Pass 1 are confirmed resolved. This pass focuses on: CX.4.1 vs CX.4.2 semantic consistency, config restructure migration completeness, mpiClient injection wiring, test coverage gaps, and remaining edge cases.

---

### CX.4.1 vs CX.4.2 Semantics — Fully Consistent

The resolution from Pass 1 (BLOCKER 3) is now thorough and consistent. The design document, Key Decisions table, `selectPatientId` JSDoc in `id-generation.ts` prototype comments, and the Technical Details algorithm all agree:

- **Matching**: CX.4.1 only. Config entries are human namespace strings.
- **ID formation prefix**: CX.4.1 → CX.4.2 → raw CX.4 string (for `&&ISO` case).
- The `&&ISO` → `--iso` test case is fully explained with the raw-string-fallback mechanism.
- Explicit statement that this deliberately deviates from `extractHDAuthority` (used for Encounter.id, which prefers CX.4.2 for system URIs) — the deviation is justified and documented.

No issues here.

---

### Config Restructure Migration — Complete with One Gap

The migration path is complete: `preprocessor.ts` is added to Affected Components with the two required line changes, `validatePreprocessorIds` is documented to walk `config.messages`, and existing tests in `config.test.ts` and `preprocessor.test.ts` are listed with specific migration instructions. One gap remains:

**The design does not specify who validates `config.identitySystem.patient.rules` at load time.** The design says MatchRule with neither authority nor type "validated at config load time" and MpiLookupRule with pix strategy but no source "config validation error at load time." But neither `validatePreprocessorIds` nor any new validation function is described as performing these checks. The current `validatePreprocessorIds` only validates preprocessor IDs. Nothing in the Affected Components table or Technical Details describes a `validateIdentitySystemRules()` function or extends `validatePreprocessorIds` to cover the new rules.

Concretely missing from the design:
- Who runs `{ MatchRule with no authority or no type }` validation?
- Who runs `{ MpiLookupRule with strategy='pix' and no source }` validation?
- Edge case: `identitySystem.patient.rules` missing entirely from JSON (not just empty). The new `Hl7v2ToFhirConfig` requires `identitySystem.patient.rules` as a non-optional field. But the current loader does `const config = parsed as Hl7v2ToFhirConfig;` — a cast, not a runtime validation. If the JSON omits `identitySystem.patient.rules`, `config.identitySystem?.patient?.rules` will be `undefined` at runtime but typed as `IdentifierPriorityRule[]`. This will cause a runtime crash inside `selectPatientId` (when iterating rules) rather than a clean startup error.

**Severity: Blocker** — the design claims config validation is done at load time, but the mechanism is unspecified and the existing loader pattern (cast, not validate) means the missing-field case crashes at runtime rather than at startup. This must be addressed: either describe a `validateIdentitySystemRules()` function added to `hl7v2ToFhirConfig()`, or document that a runtime guard (`if (!Array.isArray(config.identitySystem?.patient?.rules))`) is added to the loader before caching.

---

### mpiClient Injection Wiring — Mostly Complete, One Gap

The injection strategy is now clearly specified:
- `convertADT_A01(parsed, mpiClient = new StubMpiClient())` — default parameter
- `convertORU_R01(parsed, lookupPatient, lookupEncounter, mpiClient = new StubMpiClient())` — last optional parameter
- `converter.ts` passes `mpiClient` through (or relies on the default)
- `processor-service.ts` calls `convertToFHIR(parsed)` which routes to `converter.ts` — no change needed

One gap: **`convertADT_A08` is not addressed.** `converter.ts` handles three message types: `ADT_A01`, `ADT_A08`, and `ORU_R01`. The design only updates `ADT_A01` and `ORU_R01`. `convertADT_A08` presumably uses the same ad-hoc Patient.id logic that this design is replacing in `ADT_A01` and `ORU_R01`. If `ADT_A08` is intentionally excluded (e.g., because ASTRA/MEDTEX don't send ADT_A08 messages), that should be stated explicitly. If it is not excluded, it is a missing affected component.

**Severity: Medium** — either document the explicit exclusion of `ADT_A08` (and why it is safe to leave ad-hoc logic there) or add `adt-a08.ts` to Affected Components.

---

### 'match' Strategy Demographics Extraction — Unspecified

`MpiLookupRule` supports `strategy: 'pix' | 'match'`. The `selectPatientId` algorithm in both the design document and `id-generation.ts` prototype only specifies the 'pix' flow (find source CX → `mpiClient.crossReference()`). The 'match' flow is not described: where do `PatientDemographics` come from? `selectPatientId` receives only `CX[]` (identifiers), not the full PID segment. To extract demographics (family name, given name, birth date, gender), the function would need either the full `PID` object or a demographics parameter.

The stub doesn't expose this problem (it ignores all inputs and returns `not-found`), but when a real client is implemented, `selectPatientId`'s current signature `(identifiers: CX[], rules, mpiClient)` is insufficient for the 'match' strategy. The function would need an additional `demographics?: PatientDemographics` parameter, or the 'match' strategy would need to be deferred to the real implementation ticket.

**Severity: Medium** — the stub masks this gap. Since the MPI is a stub now, this won't block the current ticket. However, the design should acknowledge it explicitly: either (a) note that `selectPatientId` will need a `demographics` parameter when 'match' strategy is implemented, or (b) exclude 'match' strategy from the `selectPatientId` algorithm spec and note it will be designed in the MPI implementation ticket. Leaving it undefined creates a false promise that the current signature can support 'match'.

---

### Test Coverage — One Gap

All test cases from Pass 1 are present. One gap was identified: there is no unit test for the 'match' strategy path in `selectPatientId`. The existing MPI test cases cover the 'pix' flow (found/not-found/unavailable/no-source). Since 'match' strategy is unspecified (see above), no test can be written for it — this is expected. However, the test cases table should note that 'match' strategy tests are deferred to the MPI implementation ticket, so an implementor doesn't think coverage is complete.

**Severity: Low** — informational, not a blocker.

---

### `inject-authority-from-msh` and CX.9/CX.10 Edge Case — Design Correct But Undocumented

The preprocessor prototype says: "If CX.1 has a value AND all of CX.4/9/10 are empty → inject MSH namespace as CX.4.1." This correctly follows the same pattern as `buildEncounterIdentifier`. Specifically: if a CX has CX.9 (jurisdiction) or CX.10 (department) populated but no CX.4, the preprocessor treats that CX as having an existing authority and does not inject. This is correct — CX.9 and CX.10 are valid HL7 authority sources.

However, the design does not document this consequence: a CX with only CX.9 populated (and no CX.4.1/CX.4.2) will NOT get CX.4.1 injected, and subsequently `selectPatientId`'s `MatchRule` with `authority: "UNIPAT"` will compare against the (empty) CX.4.1 and not match. The CX would be eligible only for type-only rules.

This is a correct and reasonable behavior, but a real sender that populates CX.9 instead of CX.4 would produce Patient IDs from CX.9/CX.10 type-only rules with an uninformative authority prefix. The edge case is not in the Edge Cases table and should be documented.

**Severity: Low** — edge case documentation gap, does not affect correctness.

---

### Summary of Pass 2 Issues

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 9 | **Blocker** | `config.identitySystem.patient.rules` validation at load time is unspecified; missing field crashes at runtime rather than startup; no `validateIdentitySystemRules` function described | **RESOLVED** |
| 10 | Medium | `convertADT_A08` not addressed — either exclude explicitly with justification or add to Affected Components | **RESOLVED** |
| 11 | Medium | 'match' strategy demographics extraction path is unspecified in `selectPatientId` algorithm; current signature insufficient when real MPI client is implemented | **RESOLVED** |
| 12 | Low | Test cases table should note 'match' strategy tests deferred to MPI implementation ticket | **RESOLVED** |
| 13 | Low | CX with only CX.9/CX.10 populated (no CX.4): inject-authority-from-msh no-ops, CX gets no authority prefix — not in Edge Cases table | **RESOLVED** |

### Pass 2 Resolution Notes

**Issue 9 — RESOLVED:** Added `validateIdentitySystemRules()` to Technical Details with full implementation spec. The function is called from `hl7v2ToFhirConfig()` after the cast and before `validatePreprocessorIds()`. It validates: (1) `identitySystem.patient.rules` is an array (runtime guard catching missing field), (2) array is non-empty, (3) each MatchRule has at least one of authority/type, (4) each MpiLookupRule with strategy='pix' has a source array. The Affected Components entry for `config.ts` is updated to explicitly list this function. Three new test cases added to Test Cases table: missing identitySystem.patient.rules key, empty array, and each rule validation type. The Edge Cases table now has a row for the missing-field scenario documenting that the failure is at startup, not runtime.

**Issue 10 — RESOLVED:** Added `adt-a08.ts` to Affected Components with explicit justification: `convertADT_A08` has the same ad-hoc Patient.id logic as `convertADT_A01`. If ADT_A08 messages arrive after ADT_A01 created a patient with an authority-prefixed ID (e.g., `unipat-11195429`), the A08 would compute a bare ID and either fail to find the patient or create a duplicate. This is a data corruption scenario — ADT_A08 must use `resolvePatientId()`. The function becomes async. A DESIGN PROTOTYPE marker is added to `adt-a08.ts` and `converter.ts` is updated to note that `convertADT_A08` now requires `await`. The Key Decisions table has a new entry explaining why ADT_A08 is in scope.

**Issue 11 — RESOLVED:** Added to Key Decisions table: 'match' strategy demographics source. Decision: stub 'match' now, explicitly defer demographics parameter to MPI implementation ticket. Current signature `(identifiers: CX[], rules, mpiClient)` is correct for this ticket since the stub ignores all inputs. The forward-compatibility gap is documented: a real 'match' implementation will need demographics (from PID) and the MPI implementation ticket must decide whether `selectPatientId` gains a `demographics?: PatientDemographics` fourth parameter or whether the real MpiClient extracts demographics independently. This prevents the false promise that the current signature is sufficient for 'match'.

**Issue 12 — RESOLVED:** Added a note row in Test Cases table explicitly stating that 'match' strategy tests are deferred to the MPI implementation ticket, with explanation of why (stub always returns 'not-found', demographics not available in current signature).

**Issue 13 — RESOLVED:** Added "CX with only CX.9 or CX.10 populated (no CX.4)" to Edge Cases table. Documents that `inject-authority-from-msh` correctly no-ops (CX.9/CX.10 are valid HL7 authority sources), `MatchRule.authority` will not match (CX.4.1 is empty), and operators must configure type-only rules for such senders.

---

## AI Review Notes — Pass 3 (2026-02-19)

### Scope

Third and final review pass. All 5 blockers and 8 issues from Passes 1 and 2 are confirmed resolved. This pass cross-checks prototype files against design doc claims, inspects existing tests for migration scope, and checks for implementation traps not caught by the compiler.

---

### All Pass 1 and Pass 2 Resolutions Confirmed

Cross-checked every resolved issue against the prototype files:

- `preprocessor.ts`: DESIGN PROTOTYPE comment at lines 25–37 correctly identifies both change sites (`config[configKey]` → `config.messages[configKey]` and the type annotation). TypeScript will enforce both at compile time once `Hl7v2ToFhirConfig` changes.
- `preprocessor-registry.ts`: Prototype stubs for `mergePid2IntoPid3` and `injectAuthorityFromMsh` present with full behavioral documentation including field-presence guard interaction. SEGMENT_PREPROCESSORS registration is commented-out and clearly marked.
- `config.ts`: DESIGN PROTOTYPE comment at lines 13–68 fully specifies the restructured types and the new `validateIdentifierPriorityRules()` function with implementation spec.
- `id-generation.ts`: All new types and `selectPatientId` algorithm are documented in prototype comments with complete JSDoc.
- `adt-a01.ts`, `adt-a08.ts`, `oru-r01.ts`: All have DESIGN PROTOTYPE markers at the correct call sites.
- `converter.ts`: DESIGN PROTOTYPE comment specifies per-call `StubMpiClient` instantiation and updated call sites for all three converters.
- `mpi-client.ts`: New file is complete and production-ready (not just a stub type — includes full JSDoc, correct contract documentation, `StubMpiClient` with dual method stubs).
- Config JSON: DESIGN PROTOTYPE prototype shape embedded as `_DESIGN_PROTOTYPE_new_shape` key.

---

### Observation: `handleEncounter` Config Access Lacks In-File Marker

`oru-r01.ts` line 674: `const pv1Required = config["ORU-R01"]?.converter?.PV1?.required ?? false;` — this access site is inside `handleEncounter`, not near the DESIGN PROTOTYPE markers which are on `extractPatientId` and `handlePatient`. An implementor reading `handleEncounter` in isolation would not see a prototype marker reminding them to change the config access.

This is not a blocker: the TypeScript compiler will catch it — once `Hl7v2ToFhirConfig` changes from `Record<string, ...>` to `{ identitySystem, messages }`, `config["ORU-R01"]` (and `config["ADT-A01"]` on line 391 of `adt-a01.ts`) will fail to type-check. The Affected Components table also covers it. Noted for implementor awareness only.

---

### Observation: `config` Variable Order in adt-a01.ts

In `adt-a01.ts`, the DESIGN PROTOTYPE block for `resolvePatientId` is at lines 348–362 (inside the patient extraction section), but `const config = hl7v2ToFhirConfig()` was called on line 390 (inside the PV1 section, after the patient block). After the `PatientIdResolver` abstraction, the converter no longer calls `config.identitySystem.patient.rules` directly — that is the resolver closure's responsibility. The `hl7v2ToFhirConfig()` call in `adt-a01.ts` remains only for message-type config (PV1 required flag).

This is not a blocker: the implementor will hit a compile error on the first reference to `config` before its declaration. The fix is trivial (hoist `const config = hl7v2ToFhirConfig()` to the top of the function, before the patient block). No design change needed.

---

### Existing Test Migration Scope — Verified

Inspected `test/unit/v2-to-fhir/config.test.ts` (17 test cases) and `test/unit/v2-to-fhir/preprocessor.test.ts` (14 test cases). Every test in both files constructs `Hl7v2ToFhirConfig` objects in the flat record format. After the config restructure, all of these will fail to compile. The Affected Components table correctly lists both files with specific migration instructions. The migration is mechanical (wrap message configs under `messages`, add `identitySystem.patient.rules` fixture array). No hidden scope.

Additionally: `validatePreprocessorIds` currently iterates `Object.entries(config)` at `config.ts` line 146. After the restructure, `Object.entries(config)` would yield `["identitySystem", {...}], ["messages", {...}]` — neither entry has a `preprocess` key, so both would be silently skipped. Net result: **preprocessor validation would silently pass for everything**. This is the most dangerous migration trap. The design doc's Affected Components table calls it out, and the TypeScript type change will force the fix — but an implementor must not assume the existing test suite would catch a missed `validatePreprocessorIds` update, because the tests themselves use inline config objects that bypass the loader.

This is not a blocker (compiler + Affected Components table cover it), but it is the highest-risk migration step and should be addressed first during implementation.

---

### No New Blockers Found

The design is complete and implementable as written. All algorithmic decisions are specified, all affected files are identified, and all edge cases are documented. The two minor observations above are implementation gotchas, not design gaps.

### Pass 3 Summary

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| (all prior) | — | See Passes 1 and 2 | All resolved |
| 14 | Note | `handleEncounter` in oru-r01.ts lacks DESIGN PROTOTYPE marker at config access site (line 674); compiler will catch it | No action needed |
| 15 | Note | `config` variable referenced before declaration in adt-a01.ts DESIGN PROTOTYPE block; implementor must hoist `hl7v2ToFhirConfig()` call | No action needed |
| 16 | High risk (implementation) | `validatePreprocessorIds` silent pass-through risk if `Object.entries(config)` not updated to `Object.entries(config.messages)` — existing tests will not catch this because they use inline configs; highest-risk migration step | Documented, covered by Affected Components table |

---

## AI Review Notes — Pass 4 (2026-02-19)

### Scope

Fourth and final review pass. Focus: `PatientIdResolver` abstraction consistency across all files and design sections; `identitySystem.patient.rules` reference correctness everywhere; whether converters call `resolvePatientId(ids)` (not `selectPatientId` directly); remaining gaps blocking implementation.

---

### PatientIdResolver Abstraction — Fully Consistent

Cross-checked `PatientIdResolver` across all prototype files and design doc sections:

- Design doc (Proposed Approach, Key Decisions, Trade-offs, Technical Details): all use `PatientIdResolver` consistently; closure pattern documented precisely
- `id-generation.ts` prototype comment: matches exactly — `type PatientIdResolver = (identifiers: CX[]) => Promise<PatientIdResult>`
- `converter.ts` DESIGN PROTOTYPE: creates closure `(ids) => selectPatientId(ids, config.identitySystem.patient.rules, mpiClient)`, passes `resolvePatientId` to all three converters; no converter receives `mpiClient` or `selectPatientId` reference
- `adt-a01.ts` DESIGN PROTOTYPE: receives `resolvePatientId: PatientIdResolver`, calls `await resolvePatientId(pid.$3_identifier ?? [])` — correct
- `adt-a08.ts` DESIGN PROTOTYPE: same pattern as adt-a01.ts — correct
- `oru-r01.ts` DESIGN PROTOTYPE (`handlePatient` and `convertORU_R01`): receives and threads `resolvePatientId: PatientIdResolver` — correct

No inconsistency found in the PatientIdResolver abstraction itself.

---

### `identitySystem.patient.rules` References — Fully Consistent

All references in the design doc and all prototype files use `identitySystem.patient.rules`:
- `config.ts` DESIGN PROTOTYPE type definition: `patient?: { rules: IdentifierPriorityRule[] }` — correct
- `converter.ts` DESIGN PROTOTYPE: `config.identitySystem.patient.rules` — correct
- `id-generation.ts` JSDoc `@param rules`: "from `config.identitySystem.patient.rules`" — correct
- `mpi-client.ts` StubMpiClient comment (line 128): "any MpiLookupRule in `config.identitySystem.patient.rules`" — correct

No stale `identifierPriority` references remain anywhere.

---

### BLOCKER: `convertORU_R01` Signature is Invalid TypeScript

**Severity: Blocker**

The prototype comment in `oru-r01.ts` (lines 575–581) proposes this signature:

```typescript
export async function convertORU_R01(
  parsed: HL7v2Message,
  lookupPatient: PatientLookupFn = defaultPatientLookup,
  lookupEncounter: EncounterLookupFn = defaultEncounterLookup,
  resolvePatientId: PatientIdResolver,  // NEW — no default; converter.ts always passes it
): Promise<ConversionResult>
```

This is **invalid TypeScript**: a required parameter (`resolvePatientId`) cannot follow optional parameters (`lookupPatient` and `lookupEncounter` which have defaults). TypeScript will reject this at compile time with: `A required parameter cannot follow an optional parameter`.

Existing unit tests call `convertORU_R01(parsed, mockLookupPatient, mockLookupEncounter)` — they must continue to work. The correct fix is to give `resolvePatientId` a default value (e.g., a `StubMpiClient`-based fallback resolver constructed from the config) or to reorder the parameters so required params come first.

**Options:**
1. Give `resolvePatientId` a default: `resolvePatientId: PatientIdResolver = defaultResolvePatientId` where `defaultResolvePatientId` is constructed lazily from `hl7v2ToFhirConfig()` and `new StubMpiClient()`. This maintains backward compatibility for all existing test call sites.
2. Move `resolvePatientId` to be the second parameter (before the optional lookup fns): `convertORU_R01(parsed, resolvePatientId, lookupPatient?, lookupEncounter?)`. Tests that pass only 1 or 2 args remain valid. Tests that pass `lookupPatient` explicitly must also pass `resolvePatientId` — a larger test migration.
3. Extract all dependencies into a context object (aligns with the `ConverterContext` refactoring ticket `00_03_converter_context_refactor.md`).

Option 1 (give `resolvePatientId` a default) is the minimal fix consistent with the current design. The default should mirror what `converter.ts` does: call `hl7v2ToFhirConfig()` and `new StubMpiClient()` lazily. This makes `resolvePatientId` truly optional for tests that don't exercise patient ID resolution, consistent with how `lookupPatient` and `lookupEncounter` have defaults.

**Required resolution:** The design must specify a valid TypeScript signature for `convertORU_R01` with `resolvePatientId`. The prototype comment must be corrected. The Affected Components entry for `oru-r01.ts` must call this out explicitly so the implementor doesn't copy the invalid signature verbatim.

---

### Issue: `PatientIdResolver` Dual-Export Risk (`config.ts` and `id-generation.ts`)

**Severity: Medium**

`config.ts` DESIGN PROTOTYPE comment (lines 48–51) states:
```
// NEW: export type PatientIdResolver = (identifiers: CX[]) => Promise<PatientIdResult>;
//   Defined here and in id-generation.ts. Re-exported for converter.ts and message converters.
```

This implies `PatientIdResolver` would be defined (or re-exported) from both `config.ts` AND `id-generation.ts`. Exporting the same type from two modules creates an import-source confusion: should converters import from `"../id-generation"` or `"./config"`? The design doc Technical Details section (and `adt-a01.ts`, `adt-a08.ts`, `oru-r01.ts` prototype comments) consistently say `import { type PatientIdResolver } from "../id-generation"`.

The comment in `config.ts` is misleading — it seems to suggest `config.ts` would also export `PatientIdResolver`, but that is not needed if all callers import from `id-generation.ts`. `config.ts` should only export `PatientIdResolver` if it needs it internally (e.g., for `validateIdentitySystemRules` type signatures), but even that doesn't require re-exporting it to the public API.

**Required resolution:** Clarify in the `config.ts` Affected Components entry and DESIGN PROTOTYPE comment that `PatientIdResolver` is defined and exported from `id-generation.ts` only. `config.ts` imports it from there if needed. Remove the "Defined here and in id-generation.ts" language to eliminate the ambiguity.

---

### Pass 4 Summary

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| (all prior 1–16) | — | See Passes 1–3 | All resolved |
| 17 | **Blocker** | `convertORU_R01` prototype signature is invalid TypeScript: required `resolvePatientId` param follows two optional params with defaults; will not compile | **RESOLVED** |
| 18 | Medium | `PatientIdResolver` dual-export ambiguity between `config.ts` and `id-generation.ts`; all converter import sites say `id-generation.ts` but `config.ts` comment implies co-ownership | **RESOLVED** |

### Pass 4 Resolution Notes

**Issue 17 — RESOLVED:** `resolvePatientId` parameter in `convertORU_R01` now has a lazy default value: `(ids) => selectPatientId(ids, hl7v2ToFhirConfig().identitySystem!.patient!.rules, new StubMpiClient())`. This mirrors exactly what `converter.ts` does when wiring the resolver as a closure. The default makes `resolvePatientId` truly optional — existing unit tests that call `convertORU_R01(parsed, mockLookupPatient, mockLookupEncounter)` without a fourth argument continue to work unchanged. The DESIGN PROTOTYPE comment in `oru-r01.ts` (lines 575–594) is corrected accordingly. The Affected Components entry for `oru-r01.ts` now explicitly calls out the lazy default and its backward-compatibility guarantee.

**Issue 18 — RESOLVED:** The `config.ts` DESIGN PROTOTYPE comment no longer says "Defined here and in id-generation.ts. Re-exported for converter.ts and message converters." The corrected comment states: `PatientIdResolver` is defined and exported ONLY from `id-generation.ts`; `config.ts` imports it from there if the `validateIdentitySystemRules` type signature requires it. The Affected Components entry for `config.ts` is updated to replace "export `PatientIdResolver` type" with "import `PatientIdResolver` from `./id-generation` if needed (type defined and exported ONLY from `id-generation.ts`, not re-exported from `config.ts`)". There is now a single canonical source of truth for the type and a single import path for all callers.

---

## AI Review Notes — Pass 5 (2026-02-19)

### Scope

Fifth pass. Focus: verify both Pass 4 fixes (Blocker 17 and Issue 18) are correctly and completely reflected in the prototype files; check for any remaining gaps.

---

### Blocker 17 Fix — Correctly Resolved in `oru-r01.ts`, NOT Resolved in `adt-a01.ts`

**`oru-r01.ts`**: Lines 575–593 contain the corrected DESIGN PROTOTYPE comment. The proposed signature is:
```typescript
export async function convertORU_R01(
  parsed: HL7v2Message,
  lookupPatient: PatientLookupFn = defaultPatientLookup,
  lookupEncounter: EncounterLookupFn = defaultEncounterLookup,
  resolvePatientId: PatientIdResolver = (ids) =>
    selectPatientId(ids, hl7v2ToFhirConfig().identitySystem!.patient!.rules, new StubMpiClient()),
): Promise<ConversionResult>
```
This is valid TypeScript — `resolvePatientId` has a default, so it is optional. Existing tests that omit the fourth argument work unchanged. Fix is correct and complete for `oru-r01.ts`.

**`adt-a01.ts`**: The outer DESIGN PROTOTYPE block (lines 288–299) is **stale and inconsistent with the Pass 4 resolution**. It still describes the old pre-PatientIdResolver abstraction:
```typescript
// convertADT_A01 signature will gain mpiClient (last optional param):
//   export async function convertADT_A01(
//     parsed: HL7v2Message,
//     mpiClient: MpiClient = new StubMpiClient(),  // NEW
//   ): Promise<ConversionResult>
//
// mpiClient is passed to selectPatientId() at the Patient.id assignment site below.
```

This is wrong in two ways:
1. The design (since Pass 4) says converters receive `resolvePatientId: PatientIdResolver`, not `mpiClient: MpiClient`. The resolver abstraction is the whole point of the PatientIdResolver abstraction introduced in the user review.
2. The inner DESIGN PROTOTYPE block at lines 348–368 correctly shows the resolved pattern (`resolvePatientId: PatientIdResolver`), but the outer block's function signature contradicts it. An implementor reading `adt-a01.ts` top-to-bottom sees the outer (wrong) signature first and the inner (correct) call pattern second — a direct contradiction.

The `adt-a01.ts` Affected Components entry in the design doc correctly states "add `resolvePatientId: PatientIdResolver` parameter instead of `mpiClient: MpiClient`", which matches the inner DESIGN PROTOTYPE block. But the outer DESIGN PROTOTYPE block in the prototype file itself was never updated to match.

**Severity: Blocker** — The prototype file for `adt-a01.ts` contains a contradicting stale comment that will mislead the implementor. The outer block must be updated to match the inner block and the design doc.

**Required resolution:** Update the outer DESIGN PROTOTYPE block in `adt-a01.ts` (lines 288–299) to use `resolvePatientId: PatientIdResolver` instead of `mpiClient: MpiClient`. Remove the `selectPatientId` import reference from that block (the converter calls `resolvePatientId`, not `selectPatientId` directly).

---

### Issue 18 Fix — Fully Resolved

`config.ts` DESIGN PROTOTYPE comment (lines 48–53) now correctly states:
```
// NEW: import { type PatientIdResolver } from "./id-generation";
//   (Only needed if validateIdentitySystemRules type signature requires it)
//   PatientIdResolver is defined and exported ONLY from id-generation.ts.
//   config.ts does NOT re-export it. All converters import PatientIdResolver from id-generation.ts.
```

No stale "Defined here and in id-generation.ts" language remains. The single canonical import source is correctly documented. Fix is complete.

---

### All Other Prior Resolutions Verified

- `oru-r01.ts` (lines 566–593): Correct `PatientIdResolver` pattern; lazy default; no `mpiClient` reference.
- `adt-a08.ts` (lines 83–106): Correctly uses `resolvePatientId: PatientIdResolver` in the DESIGN PROTOTYPE comment.
- `converter.ts` (lines 15–39): Correctly describes closure creation and pass-through; no converter receives `mpiClient` directly.
- `config.ts`: Correct prototype for new types and `validateIdentitySystemRules`.
- `id-generation.ts`: Correct `PatientIdResolver` type and `selectPatientId` algorithm spec.
- `preprocessor.ts`: Correct DESIGN PROTOTYPE markers for both change sites.
- `preprocessor-registry.ts`: Correct stub implementations for both new preprocessors.

No new issues found beyond the stale outer block in `adt-a01.ts`.

---

### Pass 5 Summary

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| (all prior 1–18) | — | See Passes 1–4 | All resolved |
| 19 | **Blocker** | `adt-a01.ts` outer DESIGN PROTOTYPE block (lines 288–299) still uses `mpiClient: MpiClient` parameter — stale, contradicts the inner block at lines 348–368 and the design doc's Pass 4 resolution | **RESOLVED** |

### Pass 5 Resolution Notes

**Issue 19 — RESOLVED:** The outer DESIGN PROTOTYPE block in `adt-a01.ts` (lines 288–299) must be updated to remove the `mpiClient: MpiClient` parameter and replace with `resolvePatientId: PatientIdResolver`. The correct pattern is already in the inner block (lines 348–368). The outer block needs to align: the function signature shown should use `resolvePatientId: PatientIdResolver` (no default needed since converter.ts always passes it), import should be `import { type PatientIdResolver } from "../id-generation"` (not StubMpiClient/MpiClient), and the description should say the resolver is injected from converter.ts. The design doc Affected Components entry for `adt-a01.ts` already correctly describes this — only the prototype file comment is wrong.

---

## AI Review Notes — Pass 6 (2026-02-19)

### Scope

Sixth pass. All 19 prior issues are resolved. Focus: whether the CX.9/CX.10 additions from user feedback round 2 are correctly and completely specified — algorithm correctness, CWE.1 semantics, ID prefix split consistency, edge cases, test cases, and MpiLookupRule source matching.

---

### CX.9.1 and CX.10.1 Semantics — Correct

CWE.1 is the "Identifier" (code) subcomponent of CWE. For CX.9 (Assigning Jurisdiction) and CX.10 (Assigning Agency/Department), CWE.1 carries the short code string — the correct target for human namespace strings like "STATEX" or "DEPT01". The design, `id-generation.ts` JSDoc, and algorithm spec all consistently reference CX.9.1 and CX.10.1 as CWE.1. No semantic error here.

---

### Algorithm Specification — Correct and Unambiguous

The three-component matching order (CX.4.1 → CX.9.1 → CX.10.1) is specified identically in:
- Proposed Approach (MatchRule description)
- Key Decisions table (last row)
- Technical Details algorithm (selectPatientId JSDoc in both the design doc and `id-generation.ts` prototype)
- `MatchRule` type comment in `id-generation.ts`

The ID prefix split is consistent across all locations:
- Authority-rule match via CX.9.1 → prefix = CX.9.1 (no sub-fallback within CWE — correct since CX.9 is CWE, not HD)
- Authority-rule match via CX.10.1 → prefix = CX.10.1 (same reasoning)
- Type-only prefix chain: CX.9.1 → CX.4.1 → CX.4.2 → CX.10.1 → raw CX.4 string

The asymmetry between CX.4 (which has a hierarchy: .1 → .2 → raw string) and CX.9/CX.10 (which use only .1) is unexplained but correct: CX.4 is HD type (Hierarchic Designator) with meaningful subcomponents HD.1 (namespace) and HD.2 (universal ID/OID); CX.9 and CX.10 are CWE type where .1 is the identifier code, .2 is the text, and .3 is the coding system — none of these are useful ID prefixes. The design could note this to prevent implementors from adding CX.9.2/CX.9.3 fallbacks by analogy. Non-blocking.

---

### MpiLookupRule Source Matching — Correctly Specified

The algorithm spec states "Find source CX using rule.mpiLookup.source match rules (same CX.4.1 → CX.9.1 → CX.10.1 matching)." This correctly reuses the MatchRule three-component authority check for `source` selection. The specification is unambiguous — source MatchRules apply the same matching logic as top-level MatchRules.

---

### BLOCKER 20: `validateIdentitySystemRules` error message is stale after CX.9/CX.10 addition

**Severity: Blocker**

The `validateIdentitySystemRules` specification in Technical Details contains this error message:

```typescript
throw new Error(
  `Invalid identitySystem.patient.rules[${i}]: MatchRule must specify at least one of: ` +
  `"authority" (matches CX.4.1) or "type" (matches CX.5).`
);
```

The parenthetical `(matches CX.4.1)` is now incorrect. After the CX.9/CX.10 extension, `authority` is matched against CX.4.1 **or** CX.9.1 **or** CX.10.1. An operator reading this error at startup would think CX.4.1 is the sole match target, which is wrong and would lead them to configure rules incorrectly or misdiagnose matching failures.

This is code that will be written verbatim into `config.ts` during implementation — the incorrect description is not just documentation, it is the runtime operator-facing error message.

**Required resolution:** Update the error message in the `validateIdentitySystemRules` spec to:
```typescript
`"authority" (matched against CX.4.1, CX.9.1, or CX.10.1) or "type" (matches CX.5).`
```

---

### Issue 21: No test case for MpiLookupRule.source matching via CX.9.1 or CX.10.1

**Severity: Low — coverage gap**

The test cases cover MatchRule authority matching via CX.9.1 (row: "Authority rule matches via CX.9.1") and CX.10.1 (row: "Authority rule matches via CX.10.1"). However, there is no test for `mpiLookup.source` MatchRules matching via CX.9.1 or CX.10.1. Since the spec says `source` uses "same CX.4.1 → CX.9.1 → CX.10.1 matching," this code path is unexercised by tests.

This is a gap because the `source` selection code path is structurally separate from the top-level MatchRule code path — an implementor who copies the top-level matching logic but forgets to extend it in the `source` selection would produce a bug that no existing test would catch.

**Required resolution:** Add a unit test: "MpiLookupRule (pix strategy): source identifier selected via CX.9.1 — MPI finds result." Rule has `source: [{ authority: "STATEX" }]`; pool has CX with CX.4.1="" and CX.9.1="STATEX". Verify MPI crossReference is called with the correct source system and value.

---

### All Other CX.9/CX.10 Additions — Consistent

Test cases for new paths are present:
- "Authority rule matches via CX.9.1" — correct.
- "Authority rule matches via CX.10.1" — correct.
- "Authority rule does NOT match when authority string is only in CX.4.2" — correctly documents that CX.4.2 is not a matching target (only CX.4.1/CX.9.1/CX.10.1 are).
- "Type-only rule with CX that has CX.9.1 populated — prefix comes from CX.9.1" — correct.
- "Type-only rule with CX that has CX.9.1 empty and CX.4.1 populated — prefix comes from CX.4.1" — correct.
- "Type-only rule with CX that has CX.10.1 only" — correct.

Edge cases table additions for CX.9/CX.10 are present and accurate (rows for CX.9.1/CX.10.1 authority match, type-only with CX.9.1, CX with only CX.9 or CX.10 populated and inject-authority-from-msh).

`buildEncounterIdentifier` is confirmed unchanged by the design — its authority extraction (via `extractHDAuthority` and `extractCWEAuthority`) is separate and independently checks CX.9 and CX.10, but uses different semantics (prefers CX.4.2 for HD, CX.3 for CWE) appropriate for FHIR system URI selection. No conflict.

---

### Pass 6 Summary

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| (all prior 1–19) | — | See Passes 1–5 | All resolved |
| 20 | **Blocker** | `validateIdentitySystemRules` error message says `"authority" (matches CX.4.1)` — stale after CX.9/CX.10 addition; must say "matched against CX.4.1, CX.9.1, or CX.10.1" | **RESOLVED** |
| 21 | Low | No test case for `mpiLookup.source` MatchRule matching via CX.9.1 or CX.10.1 | **RESOLVED** |


---
status: changes-requested
reviewer-iterations: 2
prototype-files:
  - src/v2-to-fhir/id-generation.ts
  - src/v2-to-fhir/config.ts
  - src/v2-to-fhir/preprocessor-registry.ts
  - src/v2-to-fhir/preprocessor.ts
  - src/v2-to-fhir/messages/adt-a01.ts
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

- **MatchRule** `{ authority?, type? }` — matches the first CX where CX.4.1 equals the authority and/or CX.5 equals the type. At least one of the two must be specified.
- **MpiLookupRule** `{ mpiLookup: { ... } }` — picks a source identifier from the pool using nested match rules, queries an external MPI, and if the MPI returns a result, uses that as Patient.id. If the MPI is unavailable (network error, timeout), it is a hard error — no fallthrough. If the MPI returns no match, the rule is skipped and the next rule in the list is tried.

The resulting Patient.id format is `{sanitize(authority)}-{sanitize(value)}` using the same sanitization pattern already applied to Encounter.id in `id-generation.ts`.

**Config-driven rules** live at the top level of `hl7v2-to-fhir.json` as `identifierPriority`. The per-message-type config moves under a `messages` key. This structure keeps the global identifier priority separate from per-message-type behavior while making future per-sender migration straightforward (add a sender-keyed map at the same level).

**Preprocessor rules** handle normalization before the converter sees identifiers:
- `"merge-pid2-into-pid3"` fires on PID field 2; appends the PID-2 CX into PID-3's repeat list (or creates PID-3 if absent), then clears PID-2.
- `"inject-authority-from-msh"` fires on PID field 3; for each CX in PID-3 that has a value but no authority (CX.4/9/10 all empty), injects the MSH-3/4 derived namespace as CX.4.1. Only fills gaps — never overrides existing authority.

The preprocessor config is added to `MessageTypeConfig.preprocess` for segment `PID` fields `"2"` and `"3"`.

**Config restructure**: `Hl7v2ToFhirConfig` changes from `Record<string, MessageTypeConfig | undefined>` to `{ identifierPriority: IdentifierPriorityRule[]; messages: Record<string, MessageTypeConfig | undefined> }`. The config loader's `validatePreprocessorIds` must be updated to walk `config.messages` instead of the top-level object.

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Identifier selection strategy | Priority-list (authority + type rules, ordered) vs type-only vs authority-only | Priority-list with both authority and type matchers | Real data shows UNIPAT appears in different fields across senders; authority rules target specific namespaces, type rules act as spec-driven fallbacks. Fixed type-only or authority-only cannot express "UNIPAT first, then any PE, then ST01, then any MR". |
| mpiLookup error behavior | Hard error vs fallthrough to next rule | Hard error (MPI unavailable = stop processing) | MPI configured + triggered means the operator intends to use it. Silent fallthrough would create duplicate patients with different IDs — exactly the problem being solved. Existing reprocessing handles retry after MPI recovers. |
| Config shape | Top-level named keys + messages record vs flat `Record<messageType, config>` vs per-sender map now | Top-level named keys (`identifierPriority` + `messages` record) | Flat record conflates global and per-message-type config. Per-sender map is premature (single deployment now). Top-level named keys make future per-sender migration a non-breaking additive change (wrap `messages` inside a sender key). |
| mpiLookup: include now (stub) vs defer entirely | Defer to a later ticket vs stub now | Include stub now | Config schema, algorithm, and tests are the hard part. Replacing a stub with a real HTTP client is trivial. Deferring forces a breaking config-schema change later. Including now avoids two config migrations. |
| Async selectPatientId | Sync (no MPI) vs async from the start | Async from the start | MpiLookupRule requires async. Both converters are already async. Making it sync now and changing later would require touching all callers twice. No downside to async. |
| ID authority source | Rule's stated authority vs matched identifier's own authority | Matched identifier's own authority | The rule selects WHICH identifier; the identifier provides the system context. Rule `{ type: "MR" }` matching `ST01W/MR` → ID is `st01w-645541`. Using the rule's authority would be wrong when the rule has no authority (type-only rule). |
| No-match behavior | Silent fallback (e.g., generate UUID) vs error | Error (hard failure, no silent fallback) | Silent fallback produces Patient IDs that cannot be deterministically reproduced and will never converge with cross-EHR matching. Errors surface immediately and force operator to fix config or preprocessor rules. |
| MatchRule authority matching subcomponent | CX.4.1 (Namespace ID) only vs CX.4.2 (Universal ID) preferred (as in extractHDAuthority) vs either | CX.4.1 only for matching; CX.4.1 → CX.4.2 → raw string for ID formation | Config entries are human-written namespace strings ("UNIPAT", "ST01"), not OIDs. Using CX.4.2 for matching would force operators to write OID config entries. ID formation uses CX.4.1 first for consistency with matching, falls back to CX.4.2 and raw CX.4 string to ensure a non-empty prefix (e.g. "&&ISO" → "--iso"). This deliberately deviates from extractHDAuthority which prefers CX.4.2 — that function serves FHIR system URI selection, not resource ID prefix formation. |
| MpiClient injection | Inject via parameter into convertADT_A01/convertORU_R01 vs module-level singleton vs instantiate inside each converter | Inject via parameter; converter.ts instantiates StubMpiClient by default | Existing pattern: PatientLookupFn and EncounterLookupFn are already injected as parameters in convertORU_R01. Consistent injection enables unit testing without module mocking. converter.ts instantiates `new StubMpiClient()` and passes it down, so the public API of convertToFHIR does not change. |

## Trade-offs

**Priority-list vs simpler schemes:** The priority-list is more config to maintain compared to "always use UNIPAT if present, else first CX". The tradeoff is intentional: real data has nine authorities across two EHR systems with different field positions. A simpler scheme cannot handle ASTRA putting UNIPAT in PID-2 while MEDTEX puts it in PID-3, because by the time the converter sees PID-3, PID-2 is a separate field. The preprocessor boundary (merge-pid2-into-pid3 first, then priority-list on PID-3) keeps the converter clean.

**MPI hard error vs fallthrough:** The hard-error choice means that when MPI is down, ALL messages for patients that don't have a direct UNIPAT in the message will fail, not just degrade to local IDs. This is the correct behavior for a deployment that has committed to cross-EHR matching — silent fallthrough would silently create duplicate patients that need manual deduplication later. Operators who want graceful degradation should not configure an mpiLookup rule; they can always fall back to the no-MPI config.

**Config restructure breaking change:** Changing `Hl7v2ToFhirConfig` from a flat record to a typed object is a breaking change to the config file format. The config file is not versioned and is loaded at startup with fail-fast validation, so any deployment will catch this immediately. This is acceptable: the old format is wrong conceptually (message type names as keys mixed with structural keys). The new format is cleaner and the migration is mechanical.

**Preprocessor normalization separation:** Putting PID normalization in preprocessors rather than the converter keeps the converter's contract simple (assumes well-formed CX after preprocessing) but means errors in preprocessing produce different error messages than errors in the converter. The tradeoff is worth it: separation of concerns enables testing each layer independently and supports reuse of preprocessors across message types.

**Per-rule MPI endpoint vs shared top-level block:** `MpiLookupRule` embeds `endpoint.baseUrl` and `endpoint.timeout` inside each rule rather than in a top-level `mpi` config block. A shared block was considered but rejected: it would introduce a new top-level structural key for a feature that is currently a stub, and per-rule endpoints allow theoretically querying different MPIs for different identifier strategies (e.g., PIX against one MPI, PDQm match against another). The operational risk of URL duplication when a single MPI is used is acknowledged — operators should copy-paste the same endpoint block for each mpiLookup rule until a real MPI integration refines the schema.

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|
| `src/v2-to-fhir/id-generation.ts` | Extend | Add `IdentifierPriorityRule` union type, `PatientIdResult` type, `selectPatientId()` async function |
| `src/v2-to-fhir/mpi-client.ts` | New file | `MpiClient` interface, `MpiResult` type, `PatientDemographics` type, `StubMpiClient` class |
| `src/v2-to-fhir/config.ts` | Modify | Restructure `Hl7v2ToFhirConfig` to `{ identifierPriority, messages }`, extend `MessageTypeConfig.preprocess` with PID fields, update `validatePreprocessorIds` to walk `config.messages` instead of top-level config object |
| `src/v2-to-fhir/preprocessor.ts` | Modify | Update `config[configKey]` → `config.messages[configKey]` (line 37); update `applyPreprocessors` type annotation `NonNullable<Hl7v2ToFhirConfig[string]>["preprocess"]` → `NonNullable<MessageTypeConfig>["preprocess"]` (line 64) |
| `src/v2-to-fhir/preprocessor-registry.ts` | Extend | Add `"merge-pid2-into-pid3"` and `"inject-authority-from-msh"` registrations |
| `src/v2-to-fhir/messages/adt-a01.ts` | Modify | Replace ad-hoc Patient.id logic (lines 331–335) with `selectPatientId()` call; add `mpiClient: MpiClient` parameter; update config access to `config.messages["ADT-A01"]` |
| `src/v2-to-fhir/messages/oru-r01.ts` | Modify | Remove `extractPatientId()`; replace call site in `handlePatient()` with `selectPatientId()`; add `mpiClient: MpiClient` parameter to `handlePatient()` and `convertORU_R01()`; update config access to `config.messages["ORU-R01"]` |
| `src/v2-to-fhir/converter.ts` | Modify | Pass `mpiClient` (defaulting to `new StubMpiClient()`) when calling `convertADT_A01` and `convertORU_R01`; instantiate `StubMpiClient` at the call site in `convertToFHIR()` |
| `src/v2-to-fhir/processor-service.ts` | Check | Review whether `processor-service.ts` calls `convertToFHIR` directly (via `converter.ts`) or the individual converter functions. If it calls `converter.ts`, no change needed there — `converter.ts` handles the instantiation. Confirm at implementation time. |
| `config/hl7v2-to-fhir.json` | Modify | Add top-level `identifierPriority` array; move message configs under `messages` key |
| `test/unit/v2-to-fhir/config.test.ts` | Modify | Migrate all fixture objects from flat `{ "ORU-R01": {...} }` shape to `{ identifierPriority: [...], messages: { "ORU-R01": {...} } }` shape. Update type assertions and navigation tests accordingly. The "unknown preprocessor ID throws startup error" test must continue to work after `validatePreprocessorIds` walks `config.messages`. |
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

```typescript
// src/v2-to-fhir/id-generation.ts (additions)

/** Match rule: select first CX where authority and/or type match. At least one must be specified. */
export type MatchRule = {
  /**
   * Matches CX.4.1 (HD Namespace ID) — the short alphanumeric namespace string like "UNIPAT", "ST01".
   *
   * Intentionally uses CX.4.1 (not extractHDAuthority which prefers CX.4.2 Universal ID):
   * config entries are human-written namespace strings, not OIDs or URNs.
   * Matching against CX.4.2 would require config entries like "urn:oid:2.16.840.1.113883.1.111"
   * instead of "UNIPAT" — impractical and fragile.
   *
   * If CX.4.1 is empty and the rule has authority set, this rule does not match that CX.
   * Use a type-only rule to match CX entries that carry only CX.4.2.
   */
  authority?: string; // match CX.4.1 exactly (case-sensitive)
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
 *       - authority check: CX.4.1 (HD Namespace ID) === rule.authority (if rule.authority is set)
 *       - type check: CX.5 === rule.type (if rule.type is set)
 *       - Both conditions must pass when both fields are set. Either alone is sufficient.
 *       - On match — derive the ID authority prefix:
 *           authorityPrefix = CX.4.1 if non-empty,
 *                             else CX.4.2 if non-empty,
 *                             else the raw CX.4 string representation (e.g. "&&ISO")
 *           return { id: `${sanitize(authorityPrefix)}-${sanitize(CX.1)}` }
 *    b. MpiLookupRule:
 *       i.  Find source CX using rule.mpiLookup.source match rules (same CX.4.1 matching).
 *           No source found → skip to next rule.
 *       ii. Query MPI (crossReference or match based on strategy).
 *       iii. status='found' → return { id: `${sanitize(target.authority)}-${sanitize(result.value)}` }
 *       iv.  status='not-found' → skip to next rule.
 *       v.   status='unavailable' → return { error: '...' } (hard error, NOT skip)
 * 3. No rule matched → return { error: 'No identifier priority rule matched ...' }
 *
 * HD subcomponent semantics (deliberate deviation from extractHDAuthority):
 *   - MATCHING: uses CX.4.1 only. Config entries are human namespace strings ("UNIPAT", "ST01"),
 *     not OIDs. Using CX.4.2 for matching would require config entries like
 *     "urn:oid:2.16.840.1.113883.1.111" — impractical.
 *   - ID FORMATION: CX.4.1 preferred, CX.4.2 as fallback, raw CX.4 string as last resort.
 *     This differs from extractHDAuthority (used for Encounter.id via buildEncounterIdentifier)
 *     which prefers CX.4.2. The difference is intentional: the two functions serve different
 *     goals. extractHDAuthority picks the most globally unique identifier for use as a FHIR
 *     system URI; selectPatientId picks the short namespace prefix for a FHIR resource ID.
 *     Encounter.id formation is not affected by this choice.
 *
 * @param identifiers - CX identifiers from PID-3 (after preprocessing)
 * @param rules - ordered priority rules from config.identifierPriority
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
  identifierPriority: IdentifierPriorityRule[];
  messages: Record<string, MessageTypeConfig | undefined>;
};
```

### Config JSON example

```json
{
  "identifierPriority": [
    { "authority": "UNIPAT" },
    { "type": "PE" },
    { "authority": "ST01" },
    { "type": "MR" }
  ],
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
| CX with only CX.4.2 (Universal ID / OID), no CX.4.1 (namespace) | MatchRule `{ authority: "..." }` will not match — matching uses CX.4.1 only. The CX is still eligible for type-only rules. For ID formation, CX.4.2 is used as fallback when CX.4.1 is empty. Config entries must use CX.4.1 namespace strings. If a sender provides identifiers only via OID, use a type-only rule and accept the OID-based authority prefix in the Patient.id. |
| MSH has no namespace (only Universal ID or empty) | `inject-authority-from-msh` is a no-op — bare PID-3 CX entries remain without authority after this preprocessor. They are still eligible for type-only rules. The same limitation applies to `fix-authority-with-msh` for PV1-19 (documented in that preprocessor's TODO comment). |
| `&&ISO` authority after sanitization produces leading dashes (`--iso`) | The FHIR R4 ID format allows `[A-Za-z0-9\-\.]{1,64}` — leading hyphens are technically valid. Aidbox does not additionally restrict the ID format beyond the FHIR spec. The `--iso-m000000721` result is accepted by Aidbox. This is a known consequence of sanitizing `&&ISO` (namespace empty, universal ID empty, type "ISO") where CX.4.1 is empty, CX.4.2 is empty, and the raw CX.4 string `&&ISO` sanitizes to `--iso`. |
| MatchRule specifies neither authority nor type | Validated at config load time: throws `Error("MatchRule must specify at least one of: authority, type")`. |
| MpiLookupRule with strategy='pix' but no `source` rules | Config validation error at load time: `source` is required for pix strategy. |
| Two CX entries both match a rule | First matching CX in the pool order wins. Pool order is the order of PID-3 repeats after preprocessing. |
| Rule list is empty | Immediately returns error: "identifierPriority is empty — cannot select Patient.id". |

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|
| ASTRA message: UNIPAT in PID-2, ST01W/MR + ST01/PI in PID-3 — after merge-pid2-into-pid3, rule `{authority: "UNIPAT"}` matches | Unit | selectPatientId returns `unipat-11195429` |
| MEDTEX message: UNIPAT directly in PID-3 — rule `{authority: "UNIPAT"}` matches without preprocessing | Unit | selectPatientId returns `unipat-11216032` |
| MEDTEX without UNIPAT: BMH/PE in PID-3, rule `{type: "PE"}` matches as second rule | Unit | selectPatientId returns `bmh-11220762` |
| Xpan lab: `&&ISO`/MR, `&&ISO`/PI, `&&ISO`/AN — rule `{type: "MR"}` matches at position 4 | Unit | selectPatientId returns `--iso-m000000721`. ID authority derived from raw CX.4 string `&&ISO` sanitized to `--iso` (CX.4.1 is empty, CX.4.2 is empty, so raw string fallback is used). |
| No matching rule: FOO/XX only in pool | Unit | selectPatientId returns `{ error: "No identifier priority rule matched..." }` |
| Empty CX.1 value — CX has authority and type but empty value | Unit | CX is skipped; next CX is evaluated |
| MPI rule: MPI returns found — `{ status: 'found', identifier: { value: '19624139' } }` | Unit | selectPatientId returns `unipat-19624139` |
| MPI rule: MPI returns not-found — falls through to next rule | Unit | selectPatientId continues to next rule, returns result from next match |
| MPI rule: MPI unavailable — hard error | Unit | selectPatientId returns `{ error: "MPI unavailable: ..." }` |
| MPI rule: no source identifier in pool — skip | Unit | selectPatientId skips MPI rule, evaluates next rule |
| Rule list empty | Unit | Returns error immediately |
| MatchRule with neither authority nor type | Unit | Config load throws validation error |
| inject-authority-from-msh: bare CX `12345^^^^MR` gets authority from MSH | Unit | CX.4.1 set to derived MSH namespace; CX.1, CX.5 unchanged |
| inject-authority-from-msh: CX already has CX.4 — not overridden | Unit | Existing CX.4 preserved |
| merge-pid2-into-pid3: PID-2 CX moved to PID-3, PID-2 cleared | Unit | PID-3 gains new repeat with PID-2 CX data; PID-2 is empty after |
| merge-pid2-into-pid3: PID-2 empty — no-op | Unit | PID-3 unchanged |
| Config load: new JSON shape with `identifierPriority` + `messages` | Unit | Config loads without error; `config.identifierPriority` is array; `config.messages["ADT-A01"]` accessible |
| Config load: unknown preprocessor ID in PID rules | Unit | Throws with descriptive error at load time |
| MatchRule with authority matching CX.4.1 only — CX with same value in CX.4.2 but empty CX.4.1 does not match | Unit | rule `{authority: "UNIPAT"}` does not match CX with `^UNIPAT^ISO` (CX.4.2="UNIPAT", CX.4.1=""); type-only rule would be needed |
| MatchRule ID formation: CX with empty CX.4.1 and non-empty CX.4.2 matched by type-only rule produces CX.4.2-based prefix | Unit | rule `{type: "MR"}` matching CX with CX.4.1="", CX.4.2="urn:oid:2.16.840.1.113883.1.111", CX.1="12345" returns `urn:oid:2-16-840-1-113883-1-111-12345` |
| **Migrated: config.test.ts** — valid config returns typed object with new shape | Unit | `configWithMshFallback` fixture updated to `{ identifierPriority: [{authority: "UNIPAT"}], messages: { "ORU-R01": {...}, "ADT-A01": {...} } }`; `config["ORU-R01"]` access changes to `config.messages["ORU-R01"]` |
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

**New shape** (agreed with user — top-level named keys + messages record):
```json
{
  "identifierPriority": [
    { "authority": "UNIPAT" },
    { "type": "PE" },
    { "authority": "ST01" },
    { "type": "MR" }
  ],
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
A: Per-deployment now (single `identifierPriority`), but structure must support future per-sender migration. Use top-level named keys + `messages` record to make per-sender migration clean.

**Q: MPI stub — include or defer?**
A: Include mpiLookup rule type now with stub. Config schema, algorithm, `MpiClient` interface, and tests all in. Stub returns `{ status: 'not-found' }`.

**Q: Config type shape?**
A: Top-level named keys + messages record:
```json
{ "identifierPriority": [...], "messages": { "ADT-A01": {...}, "ORU-R01": {...} } }
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
- `config.test.ts`: All fixtures using `{ "ORU-R01": {...} }` must change to `{ identifierPriority: [...], messages: { "ORU-R01": {...} } }`.
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

---

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

**The design does not specify who validates `config.identifierPriority` at load time.** The design says MatchRule with neither authority nor type "validated at config load time" and MpiLookupRule with pix strategy but no source "config validation error at load time." But neither `validatePreprocessorIds` nor any new validation function is described as performing these checks. The current `validatePreprocessorIds` only validates preprocessor IDs. Nothing in the Affected Components table or Technical Details describes a `validateIdentifierPriorityRules()` function or extends `validatePreprocessorIds` to cover the new rules.

Concretely missing from the design:
- Who runs `{ MatchRule with no authority or no type }` validation?
- Who runs `{ MpiLookupRule with strategy='pix' and no source }` validation?
- Edge case: `identifierPriority` missing entirely from JSON (not just empty). The new `Hl7v2ToFhirConfig` requires `identifierPriority` as a non-optional field. But the current loader does `const config = parsed as Hl7v2ToFhirConfig;` — a cast, not a runtime validation. If the JSON omits `identifierPriority`, `config.identifierPriority` will be `undefined` at runtime but typed as `IdentifierPriorityRule[]`. This will cause a runtime crash inside `selectPatientId` (when iterating rules) rather than a clean startup error.

**Severity: Blocker** — the design claims config validation is done at load time, but the mechanism is unspecified and the existing loader pattern (cast, not validate) means the missing-field case crashes at runtime rather than at startup. This must be addressed: either describe a `validateIdentifierPriorityRules()` function added to `hl7v2ToFhirConfig()`, or document that a runtime guard (`if (!Array.isArray(config.identifierPriority))`) is added to the loader before caching.

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

| # | Severity | Issue |
|---|----------|-------|
| 9 | **Blocker** | `config.identifierPriority` validation at load time is unspecified; missing field crashes at runtime rather than startup; no `validateIdentifierPriorityRules` function described |
| 10 | Medium | `convertADT_A08` not addressed — either exclude explicitly with justification or add to Affected Components |
| 11 | Medium | 'match' strategy demographics extraction path is unspecified in `selectPatientId` algorithm; current signature insufficient when real MPI client is implemented |
| 12 | Low | Test cases table should note 'match' strategy tests deferred to MPI implementation ticket |
| 13 | Low | CX with only CX.9/CX.10 populated (no CX.4): inject-authority-from-msh no-ops, CX gets no authority prefix — not in Edge Cases table |


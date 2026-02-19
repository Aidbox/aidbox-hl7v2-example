---
status: ready-for-review
reviewer-iterations: 0
prototype-files:
  - src/v2-to-fhir/id-generation.ts
  - src/v2-to-fhir/config.ts
  - src/v2-to-fhir/preprocessor-registry.ts
  - src/v2-to-fhir/messages/adt-a01.ts
  - src/v2-to-fhir/messages/oru-r01.ts
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

## Trade-offs

**Priority-list vs simpler schemes:** The priority-list is more config to maintain compared to "always use UNIPAT if present, else first CX". The tradeoff is intentional: real data has nine authorities across two EHR systems with different field positions. A simpler scheme cannot handle ASTRA putting UNIPAT in PID-2 while MEDTEX puts it in PID-3, because by the time the converter sees PID-3, PID-2 is a separate field. The preprocessor boundary (merge-pid2-into-pid3 first, then priority-list on PID-3) keeps the converter clean.

**MPI hard error vs fallthrough:** The hard-error choice means that when MPI is down, ALL messages for patients that don't have a direct UNIPAT in the message will fail, not just degrade to local IDs. This is the correct behavior for a deployment that has committed to cross-EHR matching — silent fallthrough would silently create duplicate patients that need manual deduplication later. Operators who want graceful degradation should not configure an mpiLookup rule; they can always fall back to the no-MPI config.

**Config restructure breaking change:** Changing `Hl7v2ToFhirConfig` from a flat record to a typed object is a breaking change to the config file format. The config file is not versioned and is loaded at startup with fail-fast validation, so any deployment will catch this immediately. This is acceptable: the old format is wrong conceptually (message type names as keys mixed with structural keys). The new format is cleaner and the migration is mechanical.

**Preprocessor normalization separation:** Putting PID normalization in preprocessors rather than the converter keeps the converter's contract simple (assumes well-formed CX after preprocessing) but means errors in preprocessing produce different error messages than errors in the converter. The tradeoff is worth it: separation of concerns enables testing each layer independently and supports reuse of preprocessors across message types.

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|
| `src/v2-to-fhir/id-generation.ts` | Extend | Add `IdentifierPriorityRule` union type, `MpiClient` interface, `MpiResult` type, `PatientIdResult` type, `selectPatientId()` async function |
| `src/v2-to-fhir/mpi-client.ts` | New file | `MpiClient` interface, `MpiResult` type, `StubMpiClient` class |
| `src/v2-to-fhir/config.ts` | Modify | Restructure `Hl7v2ToFhirConfig` to `{ identifierPriority, messages }`, extend `MessageTypeConfig.preprocess` with PID fields, update `validatePreprocessorIds` to walk `config.messages` |
| `src/v2-to-fhir/preprocessor-registry.ts` | Extend | Add `"merge-pid2-into-pid3"` and `"inject-authority-from-msh"` registrations |
| `src/v2-to-fhir/messages/adt-a01.ts` | Modify | Replace ad-hoc Patient.id logic (lines 331–335) with `selectPatientId()` call; update config access to `config.messages["ADT-A01"]` |
| `src/v2-to-fhir/messages/oru-r01.ts` | Modify | Replace `extractPatientId()` definition and call site with `selectPatientId()`; update config access to `config.messages["ORU-R01"]` |
| `config/hl7v2-to-fhir.json` | Modify | Add top-level `identifierPriority` array; move message configs under `messages` key |

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
  authority?: string; // match CX.4.1
  type?: string;      // match CX.5
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
 *    a. MatchRule: find first CX where authority matches CX.4.1 and/or type matches CX.5.
 *       On match: return { id: `${sanitize(cx4Authority)}-${sanitize(cx1Value)}` }
 *    b. MpiLookupRule:
 *       i.  Find source CX from pool using rule.mpiLookup.source match rules.
 *           No source found → skip to next rule.
 *       ii. Query MPI (crossReference or match based on strategy).
 *       iii. status='found' → return { id: `${sanitize(target.authority)}-${sanitize(result.value)}` }
 *       iv.  status='not-found' → skip to next rule.
 *       v.   status='unavailable' → return { error: '...' } (hard error, NOT skip)
 * 3. No rule matched → return { error: 'No identifier priority rule matched ...' }
 *
 * @param identifiers - CX identifiers from PID-3 (after preprocessing)
 * @param rules - ordered priority rules from config
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
 * No-op if PID-2 is empty.
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
 * No-op if MSH has no usable namespace.
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
| Xpan lab: `&&ISO`/MR, `&&ISO`/PI, `&&ISO`/AN — rule `{type: "MR"}` matches at position 4 | Unit | selectPatientId returns `--iso-m000000721` (sanitized authority) |
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

## User Feedback

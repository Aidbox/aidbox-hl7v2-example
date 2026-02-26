# Cross-EHR Patient & Encounter Identity — Design Decisions

**Referenced from:** [Epic 0: Foundation Decisions](00_foundation_decisions_epic.md) (D1a, D1b)
**Blocks:** Epic 1 (Cross-EHR Patient Identity), all message converters

---

## Data Analysis (1,558 messages across all senders)

### Identifier landscape

9 unique authorities found across all senders:

| Authority | Used by | Field | Type code | Scope |
|-----------|---------|-------|-----------|-------|
| `UNIPAT` | ST01 (ASTRA/Cerberus), REG (MEDTEX), IST | PID-2 (ST01) or PID-3 (REG/IST) | `PE` | **Cross-EHR MPI** |
| `ST01W` | ST01\|W (ASTRA) | PID-3 | `MR` | Facility W medical record |
| `ST01L` | ST01\|L (ASTRA) | PID-3 | `MR` | Facility L medical record |
| `ST01F` | ST01\|F (ASTRA) | PID-3 | `MR` | Facility F medical record |
| `ST01` | ST01 (ASTRA) | PID-3 | `PI` | Cross-facility ASTRA patient ID |
| `CERBERUS` | ST01\|W (Cerberus) | PID-3 | `PI`, `MR` | Cerberus-specific |
| `&&ISO` | MEDTEX LAB, MEDTEX PTH | PID-3 | `MR`, `PI`, `AN`, `XX` | Lab systems (ISO namespace) |
| `Saint-Louis` | Legacy | PID-3 | — | Legacy system |
| `MIE&1.2.840.114398.1.100&ISO` | ORM senders | PID-3 | — | OID-based authority |

### UNIPAT distribution

UNIPAT is the shared MPI — it appears across both EHR systems but in **different PID fields**:

| Sender                    | UNIPAT in PID-2 | UNIPAT in PID-3 | No UNIPAT |
|---------------------------|:---------------:|:---------------:|:---------:|
| **ST01 (ASTRA/Cerberus)** |   **136/137**   |        1        |     0     |
| **REG\|BMH (MEDTEX)**     |        0        |   **25/1390**   |   1,365   |
| **IST\|BMH**              |        0        |       4/6       |     2     |
| **Lab/others**            |        0        |        0        |    20     |

Key: ASTRA/Cerberus almost always has UNIPAT (in PID-2). MEDTEX rarely has it (~2%, in PID-3).

### Sample PID patterns

```
# Cerberus (ST01|W) — UNIPAT in PID-2, CERBERUS in PID-3:
PID|1|19624139^^^UNIPAT^PE|04384788^^^CERBERUS^PI||...

# MEDTEX (REG|BMH) — empty PID-2, UNIPAT in PID-3:
PID|1||11216032^^^UNIPAT^PE^BMH||...

# ASTRA (ST01|W) — UNIPAT in PID-2, multiple facility MRs + global PI in PID-3:
PID|1|11195429^^^UNIPAT^PE|645541^^^ST01W^MR~451912^^^ST01L^MR~00999388^^^ST01^PI||...

# MEDTEX without UNIPAT — only local identifier:
PID|1||11220762^^^BMH^PE||...

# Xpan Lab — ISO-based identifiers:
PID|1||M000000721^^^&&ISO^MR~T0-B20250417095542346^^^&&ISO^PI~T00000736^^^&&ISO^XX~CH0000002747^^^&&ISO^AN||...
```

### HL7v2 spec: PID-2 vs PID-3

| Field | v2.5 | v2.8.2 |
|-------|------|--------|
| PID-2 (Patient ID) | **[B]** Backward compatible (deprecated since v2.4) | **Removed** |
| PID-3 (Patient Identifier List) | **[R]** Required, repeating CX | **[R]** Required, repeating CX |

Within each CX identifier:
- CX.1 (Value): **[R]** Required
- CX.4 (Assigning Authority): **[C]** Conditionally required (must have CX.4, CX.9, or CX.10)
- CX.5 (Identifier Type Code): **[R]** Required (HL7 Table 0203)

### HL7v2 identifier type codes (Table 0203, relevant subset)

| Code | Description | Meaning |
|------|-------------|---------|
| **PE** | Living Subject Enterprise Number | Cross-enterprise patient ID — the standard MPI/enterprise type |
| **MR** | Medical record number | Facility-specific chart number |
| **PI** | Patient internal identifier | System-assigned internal ID |
| **PT** | Patient external identifier | Cross-system (older, less common than PE) |
| **AN** | Account number | Billing/financial — NOT a patient identifier |
| **VN** | Visit number | Encounter identifier, not patient |
| **XX** | Organization identifier | Not a patient ID (widely misused for persons) |

---

## Decision D1a: Patient ID — Priority-list identifier selection

### Config shape (per deployment)

```json
{
  "identifierPriority": [
    { "authority": "UNIPAT" },
    { "type": "PE" },
    { "authority": "ST01" },
    { "type": "MR" }
  ]
}
```

Each rule can specify `authority` (match CX.4.1), `type` (match CX.5), or both. Rules are tried in order; first match wins.

### Algorithm

1. **Pool** all CX identifiers from PID-3 (after preprocessing merges PID-2 into PID-3). Skip entries with no CX.1 value.
2. **For each rule** in `identifierPriority` order:
   - `{authority: X}` — match first CX where CX.4.1 = X
   - `{type: T}` — match first CX where CX.5 = T
   - `{authority: X, type: T}` — match first CX where both match
3. **First rule match wins** → Patient.id = `{matched-CX-authority}-{id}`
4. **No match → error.** Message fails, forcing operator to fix preprocessing config or priority rules.

### Preprocessing boundary

The core converter is strict — assumes PID-3 contains properly formed CX identifiers (value + authority + type). Normalization is a preprocessor responsibility:

| Messy input | Preprocessor action |
|---|---|
| PID-2 populated (v2.2 messages) | Move/merge PID-2 into PID-3 repeats |
| CX with no authority (e.g., `12345^^^^MR`) | Inject authority from MSH or sender config |
| CX with no type | Inject type from sender config or context |
| PID-3 empty | Error — nothing to preprocess, message cannot be converted |

### Rationale

- **Rules mix authority and type freely.** Authority-only rules (`{authority: "UNIPAT"}`) target a specific namespace. Type-only rules (`{type: "PE"}`) act as spec-driven fallbacks — PE means "enterprise identifier" per HL7. Combined rules (`{authority: "ST01", type: "MR"}`) are maximally specific.
- **ID uses matched identifier's own authority, not the rule's.** The rule selects WHICH identifier; the identifier provides the authority for the ID. E.g., rule `{type: "MR"}` matching `645541^^^ST01W^MR` → ID is `ST01W-645541`.
- **No silent fallback in converter.** If no rule matches, the error surfaces immediately. This prevents data from silently flowing with wrong patient linkage.
- **Preprocessor is the normalization layer.** Missing authorities, deprecated PID-2, bare values — all fixed before the converter sees the data.

### Example walkthrough

Config: `[{authority: "UNIPAT"}, {type: "PE"}, {authority: "ST01"}, {type: "MR"}]`

| Message | Pool (after preprocessing) | Matched rule | Patient.id |
|---------|--------------------------|-------------|------------|
| ASTRA with UNIPAT | UNIPAT/PE, ST01W/MR, ST01L/MR, ST01/PI | Rule 1: authority UNIPAT | `UNIPAT-11195429` |
| MEDTEX with UNIPAT | UNIPAT/PE | Rule 1: authority UNIPAT | `UNIPAT-11216032` |
| MEDTEX without UNIPAT | BMH/PE | Rule 2: type PE | `BMH-11220762` |
| Xpan lab | &&ISO/MR, &&ISO/PI, &&ISO/AN | Rule 4: type MR | `&&ISO-M000000721` |
| Hypothetical: no match | FOO/XX | No match | **Error** |

### Extended rule type: MPI lookup

#### Problem

Some senders don't include the enterprise identifier. MEDTEX sends `BMH/PE` without UNIPAT ~98% of the time. The priority-list selects the best *available* identifier, but can't obtain identifiers absent from the message. Result: separate FHIR Patients (`BMH-11220762` vs `UNIPAT-19624139`) for the same physical person.

#### Solution

The priority list supports a second rule type — `mpiLookup` — that queries an external MPI to cross-reference local identifiers to enterprise identifiers. MPI rules participate in the same ordered fallback chain as match rules. **Single source of truth** — one list, read top-to-bottom.

#### Extended config

```json
{
  "identifierPriority": [
    { "authority": "UNIPAT" },
    {
      "mpiLookup": {
        "endpoint": { "baseUrl": "https://mpi.example.org/fhir", "timeout": 5000 },
        "strategy": "pix",
        "source": [{ "type": "PE" }, { "type": "MR" }],
        "target": {
          "system": "urn:oid:2.16.840.1.113883.1.111",
          "authority": "UNIPAT",
          "type": "PE"
        }
      }
    },
    { "type": "PE" },
    { "authority": "ST01" },
    { "type": "MR" }
  ]
}
```

Read top-to-bottom: "Try UNIPAT from the message. Not found? Ask MPI. MPI doesn't know this patient? Use whatever PE is available. No PE? Try ST01. Then MR. Nothing? Error."

#### Extended algorithm

The algorithm from D1a gains a second rule type:

For each rule in `identifierPriority`:
- **Match rule** `{authority?, type?}` — unchanged from D1a
- **MPI rule** `{mpiLookup: ...}`:
  1. Pick source identifier from pool using `source` rules (same matching logic as match rules)
  2. No source identifier found → skip to next rule
  3. Query MPI using configured strategy
  4. MPI returns result → return `{target.authority}-{value}` as Patient.id
  5. MPI returns no match → skip to next rule (patient not yet in MPI)
  6. **MPI unavailable → error.** Message processing stops. Does NOT fall through.

Rules after an mpiLookup are reachable when:
- The mpiLookup was **skipped** (no source identifier in pool), OR
- MPI returned **no match** (patient not registered in MPI yet)

They are **NOT** reachable as fallback for MPI failures. MPI configured + triggered + unavailable = hard error. Existing reprocessing mechanism handles retry when MPI recovers.

#### Strategies

**`pix` — IHE PIXm (ITI-83): identifier cross-referencing**

`GET [base]/Patient/$ihe-pix?sourceIdentifier=<system>|<value>&targetSystem=<uri>`

Fast, deterministic. Use when MPI knows both identifier domains (both source systems feed the MPI). Source: picks a CX from the pool using `source` rules. Requires mapping the picked identifier's HL7v2 authority to a FHIR system URI (mapping mechanism is an implementation detail — deferred to MPI integration phase).

**`match` — IHE PDQm (ITI-119): demographic matching**

`POST [base]/Patient/$match` with Patient resource built from PID demographics (name, DOB, sex).

Probabilistic. Use when source identifiers aren't registered in the MPI. Additional config: `matchThreshold` (0-1, default 0.95) — only accepts matches above threshold. Source: demographics from PID, not a pool identifier. `source` rules are not used for this strategy.

Both strategies produce the same output: an identifier to use as Patient.id, or nothing.

#### Example walkthrough (with MPI)

Config: `[{authority: "UNIPAT"}, {mpiLookup: {strategy: "pix", source: [{type: "PE"}], target: {authority: "UNIPAT", ...}}}, {type: "PE"}, {authority: "ST01"}, {type: "MR"}]`

| Message | Pool | Rule evaluation | Patient.id |
|---------|------|-----------------|------------|
| ASTRA with UNIPAT | UNIPAT/PE, ST01W/MR, ST01/PI | Rule 1 matches (UNIPAT in pool) — MPI never called | `UNIPAT-11195429` |
| MEDTEX with UNIPAT | UNIPAT/PE | Rule 1 matches | `UNIPAT-11216032` |
| MEDTEX without UNIPAT | BMH/PE | Rule 1: no UNIPAT → Rule 2: picks BMH/PE, PIXm returns 19624139 | `UNIPAT-19624139` |
| MEDTEX, MPI down | BMH/PE | Rule 1: no → Rule 2: picks BMH/PE, MPI timeout → **error** | — |
| MEDTEX, MPI no match | BMH/PE | Rule 1: no → Rule 2: PIXm returns empty → Rule 3: PE matches BMH | `BMH-11220762` |
| Xpan lab | &&ISO/MR, &&ISO/PI, &&ISO/AN | Rule 1: no → Rule 2: no PE in pool, skip → Rule 3: no PE → Rule 5: MR | `&&ISO-M000000721` |

Config without MPI (simpler deployment — no mpiLookup rule):

`[{authority: "UNIPAT"}, {type: "PE"}, {authority: "ST01"}, {type: "MR"}]`

Identical to original D1a. No external dependencies.

#### Design choice: why inline in the priority list?

Alternative considered: separate `mpiEnrichment` config that runs before the priority list. Rejected because:

- **Config coupling.** Enrichment's "trigger when missing" condition and the priority list's first rule must stay in sync. Change one, forget the other → silent misconfiguration.
- **No ordering control.** Enrichment always runs before all priority rules. Can't express "try local UNIPAT, then MPI, then local PE" — the relative position matters.
- **Multiple MPI targets.** A second MPI would require an enrichment array with unclear ordering. Inline rules interleave naturally.

The inline approach is a single source of truth. The tradeoff (heterogeneous rule types in one list, async algorithm) is handled by dependency injection — the MPI client is an injected interface, easily mocked in tests.

#### Implementation scope

**Current phase: prepare the interface, stub MPI calls.** The priority-list algorithm supports both rule types from the start, but the MPI client is a stub. This ensures the config schema, algorithm, and tests are ready when real MPI integration becomes a priority.

```typescript
interface MpiClient {
  crossReference(source: {system: string, value: string}, targetSystem: string): Promise<MpiResult>;
  match(demographics: PatientDemographics, targetSystem: string): Promise<MpiResult>;
}

type MpiResult =
  | { status: 'found'; identifier: { value: string } }
  | { status: 'not-found' }
  | { status: 'unavailable'; error: string };
```

Stub implementation returns `{ status: 'not-found' }` for all queries. When MPI integration is prioritized, only the stub needs replacement — algorithm, config, and tests are already in place.

---

## Decision D1b: Encounter ID

Encounter.id = `{authority}-{visit-number}` from PV1-19 directly.

- PV1-19 is a single CX (not repeating) — no priority list needed.
- Authority is required after preprocessing. Existing preprocessor rule `fix-pv1-authority-with-msh` already injects authority from MSH when PV1-19 lacks one.
- If PV1-19 is missing or has no value → error (for message types requiring PV1) or skip Encounter (for types where PV1 is optional, like ORU_R01).
- Visits don't cross EHR boundaries, so cross-system linking isn't needed.

**Shared pattern with Patient ID:** both require authority on every CX after preprocessing. Patient ID adds a priority list to choose WHICH CX from a pool; Encounter ID has only one CX, so it's used directly.

**NEW FINDINGS**: PV1-19 is not enough, sometimes id is specified in PV1-51 (^^^^ST01W^TN in ASTRA A04 samples: data/local/awie_case/awie_case_data/ASTRA-ADT-A04-01/ASTRA-ADT-A04-01.txt). 

---

## Impact on existing code

| File | Change needed |
|------|--------------|
| `src/v2-to-fhir/id-generation.ts` | Add Patient ID priority-list algorithm with match + mpiLookup rule types; MpiClient interface + stub; keep existing Encounter ID logic |
| `src/v2-to-fhir/segments/pid-patient.ts` | Patient.id assignment must use priority-list result instead of raw PID-2/PID-3[0] |
| `src/v2-to-fhir/messages/adt-a01.ts` | Replace ad-hoc Patient.id logic (lines 330-334) with priority-list call |
| `src/v2-to-fhir/messages/oru-r01.ts` | Replace `extractPatientId()` (lines 121-129) with priority-list call |
| `src/v2-to-fhir/preprocessor.ts` | Add PID-2→PID-3 merge rule; add authority injection rule |
| `config/hl7v2-to-fhir.json` | Add `identifierPriority` deployment-level config |

# Epic 1: Cross-EHR Patient Identity

**Priority**: P0 (Foundation — must do first)
**Status**: Design needed
**Depends on**: Nothing
**Blocks**: All other epics (resource IDs depend on identity model)

## Problem

The current implementation treats each EHR as an isolated data source with no cross-system reconciliation. This is the **most architecturally significant gap**.

**Evidence from data — all three EHRs use the same shared identifier namespace (`UNIPAT^PE`)**:
- MEDTEX sends: `PID-3: 11220762^^^UNIPAT^PE` (plus local `12345abcde^^^UNIPAT^PE^BMH`)
- ASTRA sends: `PID-3: 11177777^^^UNIPAT^PE` (plus local `645528^^^ST01W^MR~00999388^^^ST01^PI`)
- Cerberus sends: `PID-3: 16763621^^^UNIPAT^PE`

These are different test patients, but the key insight is that all EHRs participate in the **same UNIPAT Master Patient Index**. When the same real patient exists in both EHRs, they'd share the same UNIPAT PE value — that's the cross-EHR linking key. The current code ignores this: it picks PID-2 or PID-3[0] (a local ID) as Patient.id, so the same patient from two EHRs becomes two separate FHIR Patients.

## UNIPAT PE: The Enterprise Identifier

Both EHRs use `UNIPAT^PE` as a shared enterprise identifier in PID-3.

**Good news**: Present consistently in ADT messages from both EHRs.
**Bad news**: NOT present in the MEDTEX ORU sample (`Xpan_ORU_R01_01-patched/`) — that message uses `&&ISO^PE` instead of `UNIPAT^PE`.

## Current ID Generation

`pid-patient.ts` uses PID-2 or PID-3[0].value as Patient.id:
```
if pid.$2_patientId → patient.id = pid.$2_patientId
else → patient.id = pid.$3_identifier[0].$1_value
```

This means MEDTEX patient `12345abcde` and ASTRA patient `11177777` become **two separate FHIR Patients** for the same person.

## Same Problem for Encounters, Practitioners, Organizations

- **Encounter**: PV1-19 differs between EHRs (`visit-id-1` vs `star-adt-a01-01` vs `02`) — no cross-EHR linking
- **Practitioner**: No NPI in data; local IDs without system authority create duplicates
- **Organization**: `BMH` from MEDTEX vs `W` from ASTRA — same hospital, different codes

## Proposed Approaches

**Option A: UNIPAT PE as canonical Patient ID**
- Search PID-3 for `UNIPAT^PE` identifier type
- Use its value as Patient.id (deterministic across EHRs)
- Fall back to PID-2 or PID-3[0] if no UNIPAT PE present
- **Risk**: ORU messages may not have UNIPAT PE → broken link

**Option B: System-prefixed IDs with identifier-based linking**
- Patient.id = `{sender}-{local-id}` (no collisions, but no automatic linking)
- Store ALL identifiers from PID-3 on the Patient resource
- Cross-EHR linking via Aidbox search by identifier (e.g., find Patient with UNIPAT PE = X)
- **Risk**: requires post-processing or search-based linking, not deterministic

**Option C: Two-phase processing**
- Phase 1: Create resources with sender-prefixed IDs
- Phase 2: Run a reconciliation job that links resources sharing UNIPAT PE identifiers
- **Risk**: complexity, eventual consistency

**User Feedback**:
Looks like if they provided authority along with id (e.g. UNIPAT along with 123) then the ID will be the same across different senders, so our id generator needs to just use id+authority.
In cases authority is missing, but we know that 2 senders share the same patients - we can use a placeholdered authority for them in the configuration (need to make per-sender configuration).

## Pitfalls

1. **UNIPAT PE not universal**: If ORU messages lack it, the converter can't link lab results to the ADT-created Patient
2. **Encounter cross-referencing**: Even harder than Patient — no shared visit number between EHRs
3. **Draft patient race condition**: ORU creates draft Patient → ADT later creates "real" Patient with different ID → two Patients for one person
4. **No NPI for practitioners**: Cross-EHR practitioner deduplication is essentially impossible without external data

## Recommendation

Start with **Option A** (UNIPAT PE as canonical) with fallback. Validate that UNIPAT PE is reliably present in production data (not just test data). If ORU messages lack it, add a preprocessor rule to inject UNIPAT PE from a lookup.

## Decisions Needed

- [ ] Is UNIPAT PE reliably present in ALL production messages (including ORU)?
- [ ] Which option (A/B/C) for Patient identity?
- [ ] How to handle Encounter cross-referencing (no shared visit number)?
- [ ] Accept practitioner duplicates initially, or block on NPI/external matching?
- [ ] Per-sender configuration format for authority placeholders?

## Relevant Files

- `src/v2-to-fhir/id-generation.ts` — current Encounter ID logic
- `src/v2-to-fhir/segments/pid-patient.ts` — current Patient ID logic
- `src/v2-to-fhir/segments/pv1-encounter.ts` — current Encounter creation
- `config/hl7v2-to-fhir.json` — per-message-type config (extend for per-sender)
- `data/local/awie_case/awie_case_data/ASTRA-ADT-A01-01/` — ASTRA sample with UNIPAT PE
- `data/local/awie_case/awie_case_data/ADT_A01/` — MEDTEX sample with UNIPAT PE
- `data/local/awie_case/awie_case_data/Xpan_ORU_R01_01-patched/` — ORU sample WITHOUT UNIPAT PE

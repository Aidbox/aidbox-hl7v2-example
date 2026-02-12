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

## Proposed Approach: Authority+ID as Canonical Key

The ID generator should use **authority+id** from PID-3 as the deterministic Patient ID. This is generic — it doesn't hardcode any specific identifier system.

**Algorithm:**
1. Scan PID-3 repeats for an identifier matching a **configured identifier type** (e.g., `PE` type, or a specific authority name) — configurable per deployment, not hardcoded
2. If found: `Patient.id = kebab({authority}-{id})` — deterministic across senders sharing that authority
3. If not found but per-sender config specifies a **placeholder authority**: use `{placeholder-authority}-{id}` from PID-2 or PID-3[0]
4. Fallback: `{sender}-{id}` from PID-2 or PID-3[0] (no cross-EHR linking, but no collisions)

**Why this works generically:**
- Any deployment where multiple senders share a Master Patient Index (MPI) can configure the shared authority type
- Senders without an MPI get sender-prefixed IDs (safe default, no collisions)
- The configuration is per-deployment, not per-sender — though per-sender overrides are supported for edge cases (e.g., one sender uses a different authority name for the same MPI)

**Awie Case example** (for validation, not as the design driver): All three EHRs use `UNIPAT^PE` in PID-3. Configuring `PE` as the preferred identifier type would make `authority+id` identical across senders for the same patient.

**Per-sender placeholder authority**: When a sender omits the authority but is known to share patients with another sender, config can assign a placeholder authority so their IDs still align. Example: if sender X sends `PID-3: 12345` with no authority, config can say "treat sender X identifiers as belonging to authority FOO."

## Pitfalls

1. **Configured authority not universal across message types**: A sender's ADT messages may include the shared authority, but ORU messages from the same sender may not. The fallback chain (step 3-4 above) handles this, but it means some messages won't auto-link. A preprocessor rule could inject the missing authority before conversion.
2. **Encounter cross-referencing**: Harder than Patient — visit numbers (PV1-19) rarely share a cross-EHR authority. The same authority+id approach applies if the authority is present; otherwise encounters remain sender-scoped.
3. **Draft patient race condition**: ORU creates draft Patient (with fallback ID) → ADT later creates "real" Patient (with authority+id) → two Patients for one person. Mitigation: preprocessor that injects authority, or post-processing merge.
4. **No NPI for practitioners**: Cross-EHR practitioner deduplication is essentially impossible without external data. Accept duplicates initially.

## Decisions Needed

- [ ] Configuration format: how to specify preferred identifier type and placeholder authorities per deployment/sender?
- [ ] How to handle Encounter cross-referencing when PV1-19 lacks a shared authority?
- [ ] Accept practitioner duplicates initially, or block on NPI/external matching?
- [ ] Fallback behavior: when no configured authority matches, use `{sender}-{id}` or error?

## Relevant Files

- `src/v2-to-fhir/id-generation.ts` — current Encounter ID logic
- `src/v2-to-fhir/segments/pid-patient.ts` — current Patient ID logic
- `src/v2-to-fhir/segments/pv1-encounter.ts` — current Encounter creation
- `config/hl7v2-to-fhir.json` — per-message-type config (extend for per-sender)
- `data/local/awie_case/awie_case_data/ASTRA-ADT-A01-01/` — ASTRA sample with UNIPAT PE
- `data/local/awie_case/awie_case_data/ADT_A01/` — MEDTEX sample with UNIPAT PE
- `data/local/awie_case/awie_case_data/Xpan_ORU_R01_01-patched/` — ORU sample WITHOUT UNIPAT PE

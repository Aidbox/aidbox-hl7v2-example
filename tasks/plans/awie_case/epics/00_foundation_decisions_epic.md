# Epic 0: Foundation Decisions

**Priority**: P0 (must complete before any implementation)
**Status**: Decision-making in progress
**Depends on**: Nothing
**Blocks**: All epics

This document walks through every architectural decision that, if deferred or made wrong, would force rework on already-completed implementation. Decisions are grouped by urgency.

---

## Findings from Code Review

Before the decisions, some facts that narrow the option space:

1. **PUT is already the default.** ADT_A01, ADT_A08, ORU_R01 all use PUT for main resources. POST is only used for ORU draft Patient/Encounter (conditional create when source data is incomplete). This is NOT an open question — the system is already idempotent-by-default.

2. **Generated segment types available:** ORC, TQ1, EVN, PD1, GT1 — all have interfaces in `src/hl7v2/generated/fields.ts`.

3. **Generated segment types MISSING:** RXO and TXA — no interfaces exist. These block Epic 4 (pharmacy orders) and Epic 5 (MDM documents).

4. **No typed message definitions for ADT, ORM, MDM.** Only BAR_P01 and ORU_R01 have message-level interfaces. However, converters use the generic `HL7v2Message` (segment array) with `findSegment()` / `findAllSegments()` — so this is NOT a blocker, just a nicety.

5. **Converter uses raw segment parsing**, not typed messages. Adding new message types means: add a `case` in `converter.ts` switch + write a converter function that calls `findSegment()`. No generated message type needed.

---

## TIER 1: Blocks Everything (decide before ANY implementation)

### D1. Resource ID Generation — All 5 Resource Types

Epic 1 established the Patient ID principle (authority+id), but **the same problem exists for Encounter, Practitioner, Organization, and Location**. Epic 2 cannot start until IDs are defined for all of them.

**For each resource type below, decide the ID formula and what config is needed.**

#### D1a. Patient ID

Agreed approach: scan PID-3 for identifier with configured authority type, use `{authority}-{id}`.

Remaining question — **what is the identifier selection algorithm?**

**Option 1: Prefer by identifier type code (e.g., `PE`, `MR`)**
- Config: `{ "preferredIdentifierType": "PE" }` per deployment
- Scan PID-3 repeats, pick first with matching CX.5 (identifier type)
- Pro: simple, type codes are semi-standardized
- Con: same type code used differently across senders

**Option 2: Prefer by authority name (e.g., `UNIPAT`, `MPI`)**
- Config: `{ "preferredAuthority": "UNIPAT" }` per deployment
- Scan PID-3 repeats, pick first with matching CX.4.1 (assigning authority)
- Pro: more specific, authorities are globally unique
- Con: authority names vary more across deployments

**Option 3: Priority list of (authority, type) pairs**
- Config: `{ "identifierPriority": [{"authority": "UNIPAT", "type": "PE"}, {"type": "MR"}] }` per deployment
- Try each rule in order, first match wins
- Pro: most flexible, handles edge cases
- Con: more complex config

> **Decision D1a:** ____________________
>
> **Fallback when no match:** `{sender}-{first-PID-3-id}` — acceptable? ____________________

#### D1b. Encounter ID

Current: `id-generation.ts` derives Encounter ID from PV1-19 (Visit Number) using HL7 v2.8.2 CX rules.

**Question: should PV1-19 use the same authority+id logic as Patient?**

PV1-19 is a CX datatype (same as PID-3 repeats), so the same algorithm could apply — scan for configured authority type, use `{authority}-{visit-id}`.

**Option 1: Same authority+id logic as Patient**
- PV1-19 with authority → `{authority}-{visit-number}`
- PV1-19 without authority → `{sender}-{visit-number}` (sender-scoped)
- Pro: consistent model, cross-EHR encounter linking if authority shared
- Con: visit numbers rarely share authorities across EHRs in practice

**Option 2: Always sender-scoped**
- Encounter.id = `{sender}-{visit-number}` always (ignore authority)
- Pro: simple, predictable, no surprise cross-EHR collisions
- Con: can't auto-link encounters across EHRs even when authority exists

> **Decision D1b:** ____________________

#### D1c. Practitioner ID

Current: XCN converter extracts name/ID but doesn't create standalone resources.

**Question: what forms the Practitioner ID?**

Sources: XCN.1 (ID number), XCN.9 (assigning authority), XCN.13 (identifier type).

**Option 1: Authority+ID (same pattern as Patient)**
- `{xcn.9-authority}-{xcn.1-id}` when authority present
- `{sender}-{xcn.1-id}` when authority absent
- Pro: consistent, enables cross-EHR dedup if NPI/authority shared
- Con: XCN.9 is inconsistently populated (often just "XX")

**Option 2: Always sender-scoped**
- `{sender}-{xcn.1-id}` always
- Pro: simple, no false cross-EHR matches from "XX" authority
- Con: same doctor in two EHRs = two FHIR Practitioners

**Option 3: NPI-preferred with sender fallback**
- If XCN.1 looks like NPI (10-digit numeric) and XCN.9="NPI" → use NPI as global ID
- Otherwise → sender-scoped
- Pro: gold standard for US practitioner identity
- Con: no NPI in Awie Case sample data (but other deployments might have it)

> **Decision D1c:** ____________________

#### D1d. Organization ID

Multiple sources with different semantics:
- MSH-4 (Sending Facility, HD): `W`, `BMH` — facility code
- IN1-3/4 (Insurance Company, CX+XON): insurer IDs
- PV1-39 (Servicing Facility, HD): facility code
- XON datatype fields (PD1-3, GT1-5): organization names

**Question: single ID scheme or source-dependent?**

**Option 1: Source-typed IDs**
- Facility: `facility-{code}` (from HD)
- Insurer: `insurer-{id}` (from IN1-3 CX or kebab of IN1-4 name)
- Employer/other: `org-{sender}-{kebab-name}`
- Pro: no collisions between a hospital and an insurer with same code
- Con: more complex, type prefix is a convention not enforced

**Option 2: Flat namespace with sender scope**
- `{sender}-{org-identifier}` for all
- Pro: simple
- Con: same hospital from two senders = two FHIR Organizations

**Option 3: Authority+ID when available, sender-scoped fallback**
- Same pattern as Patient — if org identifier has authority, use it
- Pro: consistent
- Con: HD (facility) doesn't have authority the way CX does

> **Decision D1d:** ____________________

#### D1e. Location ID

Source: PL datatype from PV1-3 (assigned), PV1-6 (prior), PV1-11 (temp), PV1-42 (pending).

Components: PL.1 (point-of-care/unit), PL.2 (room), PL.3 (bed), PL.4 (facility), PL.9 (location description).

**Question 1: which components form the ID?**

**Option 1: All available components**
- `{facility}-{unit}-{room}-{bed}` — omit empty components
- Pro: maximally specific, no collisions
- Con: different EHRs populate different components (ASTRA sends 5, MEDTEX sends 3)

**Option 2: Fixed components, sender-scoped**
- `{sender}-{unit}-{room}-{bed}` — ignore PL.4 facility, use sender instead
- Pro: predictable, no missing-component issues
- Con: can't link same physical location across EHRs

> **Decision D1e (ID scheme):** ____________________

**Question 2: flat or hierarchical?**

**Option A: Flat** — one Location per bed/room. `Location.physicalType` indicates level.
- Pro: simple, fewer resources
- Con: no parent-child relationships for drill-down

**Option B: Hierarchical** — create Location for facility, ward, room, AND bed. Each references parent via `Location.partOf`.
- Pro: richer model, supports "show all beds in ward X"
- Con: 4x Location resources, PL data often insufficient to build full hierarchy

**Option C: Start flat, add hierarchy later** — create bed-level Locations now. Adding hierarchy is backwards-compatible (add partOf reference + parent resources).
- Pro: pragmatic, no wasted effort

> **Decision D1e (hierarchy):** ____________________

---

### D2. Per-Sender Configuration Format

Multiple epics need per-sender config. The minimum viable config shape needs to be decided now so Epic 1 can implement it and later epics can extend it.

**What does per-sender config need to support (now and later)?**

| Need | Epic | Example |
|---|---|---|
| Preferred identifier authority/type | 1 | `"UNIPAT"` / `"PE"` |
| Placeholder authority for senders without one | 1 | Sender X → treat as authority `"FOO"` |
| OBX code whitelist | 7 | Only map these OBX-3 codes |
| Multi-coding precedence | 7 | Prefer standard HL7 component |
| Validation bypass for encrypted fields | 8 | Skip date parsing, gender validation |

**Question: where does per-sender config live?**

**Option 1: Extend existing `config/hl7v2-to-fhir.json`**
- Add a `"senders"` key alongside existing per-message-type config
- Pro: single config file, existing loader
- Con: file grows large, mixes message-type and sender concerns

**Option 2: Separate `config/senders/` directory with per-sender files**
- `config/senders/astra.json`, `config/senders/medtex.json`
- Pro: clean separation, easy to add/remove senders
- Con: new config loader, deployment must know sender names upfront

**Option 3: Single `config/senders.json` file**
- One file with sender-keyed config
- Pro: simple, single new file
- Con: grows with senders

**Question: what identifies a "sender"?**

**Option A: MSH-3 (Sending Application)** — e.g., `ST01`, `REG`, `IST`
**Option B: MSH-4 (Sending Facility)** — e.g., `W`, `BMH`, `CLAR`
**Option C: MSH-3 + MSH-4 combined** — e.g., `ST01|W`, `REG|BMH`
**Option D: Configurable** — deployment specifies which MSH fields identify the sender

> **Decision D2 (config location):** ____________________
>
> **Decision D2 (sender key):** ____________________

---

### D3. Draft Resource Handling

When ORU_R01 arrives before ADT_A01 for the same patient, ORU creates a "draft" Patient (active=false, status=unknown) with POST conditional create. Later, ADT creates the "real" Patient with PUT.

**Question: with the new authority+id model, do draft resources still need special handling?**

If the ORU message has the same authority+id as the ADT message (same PID-3 with authority), then:
- ORU creates Patient via PUT with id `{authority}-{id}`
- ADT later creates Patient via PUT with same id `{authority}-{id}` — overwrites draft with full data

This **just works** with PUT + deterministic IDs. No conditional create needed.

**But if ORU lacks the authority** (e.g., uses `&&ISO^PE` instead of `UNIPAT^PE`):
- ORU creates Patient with fallback id `{sender}-{local-id}`
- ADT creates Patient with proper id `{authority}-{id}`
- Two separate patients = broken link

**Option 1: Accept the gap, document it**
- If authority is missing, IDs diverge. Fix via preprocessor rule or manual merge.
- Pro: simple, no special logic
- Con: broken links until fixed

**Option 2: Preprocessor rule to inject authority**
- Config-driven: "for sender X, if PID-3 lacks authority, inject authority Y"
- Pro: fixes the problem at ingestion time
- Con: preprocessor complexity, config per sender

**Option 3: Always create draft with sender-scoped ID, let ADT overwrite**
- Draft: `{sender}-{local-id}` (always sender-scoped, even with authority)
- Real: `{authority}-{id}` (when authority present)
- Plus: store all identifiers on both → post-processing can merge
- Pro: drafts never collide, real resources link correctly
- Con: draft-to-real transition creates orphaned draft resources

> **Decision D3:** ____________________

---

## TIER 2: Blocks P1 (decide before ADT subtypes)

### D4. ADT Subtype Architecture

Epic 3 adds 6 ADT event types. How they relate to A01's converter affects code structure significantly.

**Option 1: Single parameterized converter**
- One function: `convertADT(parsed, eventType)` with event-specific behavior via switch/if
- A01, A02, A03, etc. all call the same function with different parameters
- Pro: DRY, single place to update segment processing
- Con: function grows complex, event-specific logic interleaved

**Option 2: Separate converter files, shared helpers**
- `adt-a01.ts`, `adt-a02.ts`, `adt-a03.ts`, etc. — each imports shared segment converters
- Pro: clear separation, each file is focused
- Con: duplication of boilerplate (MSH extraction, bundle building)

**Option 3: Base converter + event-specific overrides**
- `adt-base.ts` with common logic (PID, PV1, NK1, DG1, AL1, IN1 extraction)
- Each event file calls base + applies event-specific post-processing (status changes, location updates)
- Pro: balance of DRY and clarity
- Con: inheritance-like pattern can be confusing

> **Decision D4:** ____________________

### D5. Cancel Event Cascading (A11/A12/A13)

When A11 cancels an admission (Encounter → cancelled), what happens to resources created by the original A01?

**Option 1: Only update Encounter**
- Conditions, Coverages, RelatedPersons from the original A01 remain unchanged
- Pro: simple, consistent with HL7v2 semantics (A11 only affects the visit, not the diagnoses)
- Con: "cancelled visit" still has active Conditions — may confuse downstream consumers

**Option 2: Cascade status updates**
- Encounter → cancelled, Conditions → entered-in-error, Coverages → cancelled
- Pro: clean state, no orphaned resources
- Con: HL7v2 A11 doesn't say anything about conditions — we'd be inferring

**Option 3: Configurable per deployment**
- Default: Encounter only. Optional config flag: `"cancelCascade": true`
- Pro: flexible
- Con: more config surface, testing burden

> **Decision D5:** ____________________

---

## TIER 3: Blocks P2 (decide before new message types)

### D6. Missing Segment Types: RXO and TXA

**RXO** (Pharmacy Order) — needed for Epic 4 (ORM pharmacy flavor).
**TXA** (Document Header) — needed for Epic 5 (MDM_T02).

Neither has interfaces in `src/hl7v2/generated/fields.ts`.

**Question: regenerate or manual?**

**Option 1: Regenerate from expanded reference data**
- Check if `data/hl7v2-reference/` has RXO/TXA definitions
- If yes: `bun run regenerate-hl7v2` should pick them up
- If no: need to add reference data first (from HL7v2 spec XSD/PDF)
- Pro: consistent with existing generation pipeline
- Con: may require updating the reference data generator

**Option 2: Manually add to generated files**
- Write RXO/TXA interfaces by hand in `fields.ts`, add `fromRXO`/`fromTXA` extractors
- Pro: fast, unblocked by generator issues
- Con: diverges from generation pipeline, maintenance burden

> **Decision D6:** ____________________
>
> **Note:** This doesn't block P0-P1 work. Can be deferred, but should be investigated early to avoid surprises when P2 starts.

### D7. OBX Routing Strategy

Currently all OBX → Observation. Three new patterns needed:

| Context | OBX Treatment | Epic |
|---|---|---|
| ORU with mostly TX/ST OBX | → DocumentReference (concatenated text) | 6 |
| MDM with ST OBX sections | → DocumentReference content | 5 |
| ADT with non-clinical questionnaire OBX | → Skip or extension | 7 |
| ORU with NM/CE OBX (current) | → Observation (unchanged) | -- |

**Question: where does routing logic live?**

**Option 1: Per-message-type OBX handling**
- Each message converter decides how to handle its OBX segments
- ORU: detect document vs lab per OBR group
- MDM: always concatenate
- ADT: skip or whitelist
- Pro: simple, explicit
- Con: duplicate detection logic if patterns overlap

**Option 2: Central OBX router**
- A shared function that takes OBX group + context → decides treatment
- Pro: single place for all OBX logic
- Con: premature abstraction, contexts are quite different

> **Decision D7:** ____________________

### D8. Non-Clinical OBX in ADT (MEDTEX questionnaire segments)

MEDTEX sends 16-114 OBX per ADT message with registration/questionnaire codes. These are NOT clinical observations.

**Option 1: Skip entirely**
- ADT converters don't process OBX. Questionnaire data is lost.
- Pro: simplest, no mapping noise
- Con: data loss — some questionnaire answers may be clinically relevant (allergies, smoking status)

**Option 2: Store as Observation but with a non-clinical category**
- Create Observations with `category: survey` instead of `laboratory`
- Apply OBX code whitelist: only create Observations for whitelisted codes
- Pro: preserves data, controlled mapping volume
- Con: still creates many resources, whitelist maintenance

**Option 3: Store as extensions on Patient/Encounter**
- Group OBX answers as extensions on the parent resource
- Pro: no standalone resources, data preserved
- Con: non-standard, harder to query

**Option 4: Configurable per sender**
- Default: skip. Per-sender config can enable OBX processing with whitelist.
- Pro: flexible, no noise by default
- Con: config complexity

> **Decision D8:** ____________________

---

## Decision Summary

Copy this section and fill in decisions for quick reference:

```
D1a. Patient ID algorithm:
D1b. Encounter ID:
D1c. Practitioner ID:
D1d. Organization ID:
D1e. Location ID (scheme):
D1e. Location ID (hierarchy):
D2.  Config location:
D2.  Sender key:
D3.  Draft resource handling:
D4.  ADT subtype architecture:
D5.  Cancel cascading:
D6.  Missing segment types:
D7.  OBX routing:
D8.  Non-clinical OBX:
```

---

## Relevant Files

- `src/v2-to-fhir/id-generation.ts` — current Encounter ID logic (PV1-19 CX rules)
- `src/v2-to-fhir/segments/pid-patient.ts` — current Patient ID logic
- `src/v2-to-fhir/converter.ts` — message type routing switch
- `src/v2-to-fhir/messages/adt-a01.ts` — A01 converter (PUT default, bundle entry helper)
- `src/v2-to-fhir/messages/oru-r01.ts` — ORU converter (PUT default, POST for drafts)
- `src/hl7v2/generated/fields.ts` — segment interfaces (has ORC/TQ1/EVN/PD1/GT1; missing RXO/TXA)
- `src/hl7v2/generated/messages.ts` — message definitions (only BAR_P01, ORU_R01)
- `config/hl7v2-to-fhir.json` — current per-message-type config

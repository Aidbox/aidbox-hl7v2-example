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

6. **MSH-10 is not globally unique in this dataset.** The same control ID appears across different event types and files for the same sender, so dedupe MUST NOT rely on `MSH-10` alone.

---

## TIER 1: Blocks Everything (decide before ANY implementation)

### D1. Resource ID Generation

#### D1a–D1b. Patient ID & Encounter ID — DECIDED

**Full design:** [Cross-EHR Patient & Encounter Identity](01_cross_ehr_identity_decisions.md)

Summary:
- **Patient ID**: Priority-list algorithm scanning PID-3 (after preprocessor merges PID-2). Config: ordered `identifierPriority` rules mixing `{authority}` and `{type}` selectors. ID = `{matched-authority}-{id}`. No match → error (strict).
- **Encounter ID**: `{authority}-{visit-number}` from PV1-19 directly. Single CX, no priority list. Authority injected by preprocessor when missing.
- **Preprocessing boundary**: Core converter is strict (requires authority on every CX). Normalization (PID-2→PID-3 merge, authority injection) is preprocessor responsibility.

#### D1c–D1e. Practitioner, Organization, Location IDs

**Deferred to Epic 2** — see [Epic 2 ID decisions](02_missing_fhir_resources_epic_ids.md).

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

> **Decision D6:** They will be generated, it's part of development-guide.
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

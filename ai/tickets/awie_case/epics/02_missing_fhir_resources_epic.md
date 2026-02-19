# Epic 2: Materialize Missing FHIR Resources

**Priority**: P0 (Foundation — must do first)
**Status**: Ready to implement
**Depends on**: Epic 1 (identity model affects ID generation)
**Blocks**: All message type epics (they all produce these resources)

## Problem

4 FHIR resource types required by the Awie Case are NOT produced by any converter, despite converter infrastructure largely existing: Location, Organization, Practitioner, PractitionerRole.

## 2.1 Location

**Source**: PV1-3 (Assigned Location), PV1-6 (Prior Location), PV1-11 (Temp Location), PV1-42 (Pending Location) — all PL datatype.

**Current state**: `pv1-encounter.ts` lines 414-428 call `convertPLToLocation()` extracting identifiers, description, physicalType — but the result is only embedded as `Encounter.location[].location.display`, not materialized as a standalone Location resource.

**Format differences**:
- ASTRA: `2D^0244^B^W^OCC` (5 components: unit^room^bed^facility^status)
- MEDTEX: `B5SURG^5130^D` (3 components: unit^room^bed)

**PL components**: PL.1 (point-of-care/unit), PL.2 (room), PL.3 (bed), PL.4 (facility), PL.9 (location description).

**Pitfalls**:
- PL field depth inconsistency between EHRs
- Physical type must be inferred from component position (PL.1=point-of-care, PL.2=room, PL.3=bed)
- Deduplication: same physical location across messages should produce same Location.id

### ID scheme decision

**Option 1: All available components**
- `{facility}-{unit}-{room}-{bed}` — omit empty components
- Pro: maximally specific, no collisions
- Con: different EHRs populate different components

**Option 2: Fixed components, sender-scoped**
- `{sender}-{unit}-{room}-{bed}` — ignore PL.4 facility, use sender instead
- Pro: predictable, no missing-component issues
- Con: can't link same physical location across EHRs

> **Decision (ID scheme):** ____________________

### Hierarchy decision

**Option A: Flat** — one Location per bed/room. `Location.physicalType` indicates level.
**Option B: Hierarchical** — create Location for facility, ward, room, AND bed with `Location.partOf`.
**Option C: Start flat, add hierarchy later** — backwards-compatible extension.

> **Decision (hierarchy):** ____________________

## 2.2 Organization

**Sources**: MSH-4 (Sending Facility, HD), IN1-3/4 (Insurance Company, CX+XON), PD1-3 (Primary Care Org, XON), GT1-5 (Guarantor Employer, XON), PV1-39 (Servicing Facility, HD).

**Current state**: `xon-organization.ts` — full XON→Organization converter exists but is never called from any message converter. `in1-coverage.ts` lines 135-161 extract org info but only populate `Coverage.payor.display` as inline text.

**Key insight**: There are 5+ distinct sources of Organization data, each requiring different handling. The insurance company Organization is different from the sending facility Organization.

**Pitfalls**:
- Same org under different names/codes (e.g., "BLUE CROSS" in IN1-4 vs code "02" in IN1-3)
- HD (simple) vs XON (rich) format — need converters for both
- `managingOrganization` on Location requires Organization to exist first → ordering dependency in bundle

### ID decision

Multiple sources with different semantics:
- MSH-4 (Sending Facility, HD): `W`, `BMH` — facility code
- IN1-3/4 (Insurance Company, CX+XON): insurer IDs
- PV1-39 (Servicing Facility, HD): facility code
- XON datatype fields (PD1-3, GT1-5): organization names

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

> **Decision:** ____________________

## 2.3 Practitioner

**Sources** (11 roles from description): PV1-7 (attending), PV1-8 (referring), PV1-9 (consulting), PV1-17 (admitting), DG1-16 (diagnosing clinician), ROL segment (variable roles), OBR-16 (ordering provider), OBX-16 (responsible observer), TXA-9 (document author), TXA-10 (authenticator), PD1-4 (primary care provider).

**Current state**: `xcn-practitioner.ts` — full XCN→Practitioner converter exists. PV1 converter calls it (line 352) but only builds `Encounter.participant` with display text, NOT standalone Practitioner resources. Same for DG1 asserter.

**Pitfalls**:
- Same doctor appearing in PV1-7 AND DG1-16 of the same message — must deduplicate within bundle
- No NPI in sample data means cross-EHR practitioner matching is impossible without external mapping
- ROL segment not processed at all currently — contains additional provider roles (Primary Care Provider, Admitting Doctor, NP Informed Provider)
- XCN.9 (assigning authority) inconsistently populated — sometimes just "XX"

### ID decision

ID derived from XCN.1 (ID number), XCN.9 (assigning authority), XCN.13 (identifier type).

#### Data findings

| Sender | XCN.1 (ID) | XCN.9 (Authority) | XCN.13 (Type) |
|--------|-----------|-------------------|---------------|
| ASTRA | `1144244203` (numeric) | (empty) | `XX` |
| MEDTEX | `VASDJ.DO` (text) | (empty) | `XX` |
| Xpan Lab OBR | `FIOM.MD` | `MIS&&ISO` | `XX` |
| Xpan Lab OBX-25 | `Dr D Mathur` | `NPI&2.16.840.1.113883.4.6&ISO` | `NPI` |

Most have no authority. `XX` (Organization identifier) is widely misused as type for persons. No cross-EHR practitioner MPI exists.

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

> **Decision:** ____________________

## 2.4 PractitionerRole

**Sources**: Implicit from PV1-7/8/9/17 (role determined by field position), explicit from ROL segment (ROL.3 role code).

**Current state**: `xcn-practitioner-role.ts` exists with stub implementation. Never called from message converters.

**ID generation**: `{practitioner-id}-{role-code}` (e.g., `prut-do-atnd`)

**Pitfalls**:
- Role type mapping: PV1 uses v3-ParticipationType codes (ATND/REF/CON/ADM), ROL uses HL70443 codes — need harmonization
- Specialty/qualification not available in most messages — PractitionerRole.specialty will be empty
- Decision: create PractitionerRole per encounter-role pair, or per practitioner-role globally?

## Implementation Strategy

The key insight is that **converter infrastructure already exists** for all 4 resources. The work is:
1. Call existing converters from message-level code to produce full resources
2. Assign deterministic IDs
3. Add to FHIR bundle
4. Update references (Encounter.participant, Coverage.payor, etc.) to use `Reference<Resource>` instead of inline display text

This should be done as a **cross-cutting concern** applied to ADT_A01 first, then propagated to other message types.

## Decisions Needed

- [ ] Location ID scheme: all available components vs sender-scoped fixed components?
- [ ] Location hierarchy: flat, hierarchical, or start flat?
- [ ] Organization ID: source-typed, flat sender-scoped, or authority+ID?
- [ ] Practitioner ID: authority+ID, always sender-scoped, or NPI-preferred?
- [ ] PractitionerRole scope: per encounter-role pair, or per practitioner-role globally?
- [ ] ROL segment: process now or defer?

## Relevant Files

- `src/v2-to-fhir/segments/pv1-encounter.ts` — Location extraction (lines 414-428), Practitioner extraction (line 352)
- `src/v2-to-fhir/segments/in1-coverage.ts` — Organization extraction (lines 135-161)
- `src/v2-to-fhir/datatypes/xon-organization.ts` — XON→Organization converter (exists, unused)
- `src/v2-to-fhir/datatypes/xcn-practitioner.ts` — XCN→Practitioner converter (exists, inline only)
- `src/v2-to-fhir/datatypes/xcn-practitioner-role.ts` — stub PractitionerRole converter
- `src/v2-to-fhir/messages/adt-a01.ts` — first message type to enhance
- `data/local/awie_case/awie_case_data/ASTRA-ADT-A01-01/` — ASTRA sample (5-component PL)
- `data/local/awie_case/awie_case_data/ADT_A01/` — MEDTEX sample (3-component PL)

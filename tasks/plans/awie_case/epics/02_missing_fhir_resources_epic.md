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

**ID generation**: `{sender-facility}-{unit}-{room}-{bed}` with kebab-case normalization. Must handle varying component counts.

**Pitfalls**:
- PL field depth inconsistency between EHRs
- Physical type must be inferred from component position (PL.1=point-of-care, PL.2=room, PL.3=bed)
- Deduplication: same physical location across messages should produce same Location.id
- Location hierarchy (bed → room → ward → facility) — do we create multiple nested Locations or flat?

## 2.2 Organization

**Sources**: MSH-4 (Sending Facility, HD), IN1-3/4 (Insurance Company, CX+XON), PD1-3 (Primary Care Org, XON), GT1-5 (Guarantor Employer, XON), PV1-39 (Servicing Facility, HD).

**Current state**: `xon-organization.ts` — full XON→Organization converter exists but is never called from any message converter. `in1-coverage.ts` lines 135-161 extract org info but only populate `Coverage.payor.display` as inline text.

**Key insight**: There are 5+ distinct sources of Organization data, each requiring different handling. The insurance company Organization is different from the sending facility Organization.

**ID generation**:
- For facilities: `{facility-code}` from MSH-4 (e.g., `bmh`, `w`)
- For insurers: `{insurer-id}` from IN1-3 or kebab-case of IN1-4 name
- Include sender context to avoid collisions

**Pitfalls**:
- Same org under different names/codes (e.g., "BLUE CROSS" in IN1-4 vs code "02" in IN1-3)
- HD (simple) vs XON (rich) format — need converters for both
- `managingOrganization` on Location requires Organization to exist first → ordering dependency in bundle

## 2.3 Practitioner

**Sources** (11 roles from description): PV1-7 (attending), PV1-8 (referring), PV1-9 (consulting), PV1-17 (admitting), DG1-16 (diagnosing clinician), ROL segment (variable roles), OBR-16 (ordering provider), OBX-16 (responsible observer), TXA-9 (document author), TXA-10 (authenticator), PD1-4 (primary care provider).

**Current state**: `xcn-practitioner.ts` — full XCN→Practitioner converter exists. PV1 converter calls it (line 352) but only builds `Encounter.participant` with display text, NOT standalone Practitioner resources. Same for DG1 asserter.

**Format variation**:
- ASTRA: `1144244203^LYNN^RICHARD^E^^^MD^^^^^^XX` (numeric ID)
- MEDTEX: `PRUT.DO^Prutz^Thomas^D^JR^^DO^^^^^^XX` (code-based ID)
- No NPI present in any sample data

**ID generation**: `{sender}-{xcn.1}` with normalization. Must handle both numeric and alphanumeric IDs. Cross-EHR deduplication requires NPI or external matching — not possible with current data.

**Pitfalls**:
- Same doctor appearing in PV1-7 AND DG1-16 of the same message — must deduplicate within bundle
- No NPI in sample data means cross-EHR practitioner matching is impossible without external mapping
- ROL segment not processed at all currently — contains additional provider roles (Primary Care Provider, Admitting Doctor, NP Informed Provider)
- XCN.9 (assigning authority) inconsistently populated — sometimes just "XX"

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

- [ ] Location hierarchy: flat (one Location per bed) or hierarchical (bed → room → ward → facility)?
- [ ] Organization deduplication: how to handle same org under different names/codes?
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

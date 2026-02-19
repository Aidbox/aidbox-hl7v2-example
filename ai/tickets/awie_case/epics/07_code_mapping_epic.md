# Epic 7: Code Mapping Scale-Up

**Priority**: P3 (Code Mapping Scale)
**Status**: Design needed
**Depends on**: Epic 3 (ADT subtypes produce codes needing mapping), Epics 4-6 (new message types introduce new code types)
**Blocks**: Nothing directly (existing mapping infrastructure works, this is about scaling it)

## Problem

The current mapping system supports 4 types. The Awie Case data requires 4-8 new mapping types, pre-population of standard HL7 tables to reduce task volume, and a strategy to prevent MEDTEX's questionnaire OBX codes from flooding the mapping queue.

## Current State (4 mapping types)

Defined in `src/code-mapping/mapping-types.ts`:
1. `observation-code-loinc` (OBX-3 → Observation.code)
2. `patient-class` (PV1-2 → Encounter.class)
3. `obr-status` (OBR-25 → DiagnosticReport.status)
4. `obx-status` (OBX-11 → Observation.status)

Resolution flow: unmapped code → `MappingError` → `Task` resource (deterministic ID) → user resolves via UI → `ConceptMap` updated → message requeued.

## ASTRA's 99xxx Custom Tables (15 found)

| Table | Field(s) | FHIR Target | Values | Mapping Strategy |
|---|---|---|---|---|
| 99SEX | PID-8 | Patient.gender | M^MALE, F^FEMALE | Pre-populate (trivial) |
| 99RAC | PID-10 | Patient.extension[us-core-race] | 1^WHITE^C^WHITE^MCKOMB | New mapping type needed |
| 99ETH | PID-22 | Patient.extension[us-core-ethnicity] | 2^NOT HISPANIC/LATINO | New mapping type needed |
| 99NAT | PID-26 | Patient.extension[nationality] | 1^AMERICAN | Extension, low priority |
| 99CLAN | PID-15 | Patient.communication.language | E^ENGLISH | New mapping type needed |
| 99CHR | PD1-12/18 | Patient.extension[religion] | 676^GBG-CHRIST'S CHURCH | Extension, low priority |
| 99REL | NK1-3 | RelatedPerson.relationship | H^SPOUSE, D^DAUGHTER | Pre-populate HL70063 |
| 99ESC | NK1-13, GT1-42 | Extension (employment status) | 3^NOT EMPLOYED | Low priority |
| 99EMP/99H66 | NK1-14, GT1-16 | Organization reference | 395^SPECIALTY BAR PRODUC | Org ID, not code mapping |
| 99ACC | PV2-2 | Encounter.serviceType | E^TELEMETRY, I^ICU | New mapping type (medium) |
| 99ARR | PV2-45 | Extension (arrival mode) | 4^CAR, 2^AMBULANCE | Extension, low priority |
| 99RFC | PV2-11 | Extension (referring facility) | HA^AHN HEMPFIELD | Org reference, not mapping |
| 99CPUB | PV2-30 | Extension (consent) | !^OK TO RELEAS ALL | Boolean intent, extension |
| 99IRE | IN2-29 | Extension (insurance status) | 1^*PATIENT IS INSURED | Extension, low priority |

## MEDTEX's Custom OBX Codes

MEDTEX embeds 16-114 custom OBX segments per ADT message with institution-specific codes: ADM.API, ADMHIECONS, ADMHIEOPT, ADMPAN1Q, REG.ARMREST, REG.LATEX, REG.NOSURPRISE, REGGEND1, REGSO1, GEN.SMKST, AIRWAY, ADM.PORTEN, ADM.VA, etc.

**These are NOT clinical observations** — they're registration/admission questionnaire answers. Treating them as Observations requiring LOINC mapping would create an **unbounded stream of mapping tasks** (~200+ unique codes).

## New Mapping Types Needed

| Priority | Type Name | Source | Target | Rationale |
|---|---|---|---|---|
| CRITICAL | `gender-code` | PID-8 | Patient.gender | Senders use custom gender tables (HL70001 variants) |
| HIGH | `race-code` | PID-10 | us-core-race extension | Custom race codes → CDC race codes for US Core |
| HIGH | `language-code` | PID-15 | Patient.communication | Custom language codes → BCP-47/HL70296 |
| MEDIUM | `ethnicity-code` | PID-22 | us-core-ethnicity extension | Custom ethnicity codes → CDC ethnicity codes |
| MEDIUM | `relationship-code` | NK1-3 | RelatedPerson.relationship | Custom relationship codes → HL70063/v3-RoleCode |
| ORM-specific | `orc-order-control` | ORC-1 | ServiceRequest.status | NW/CA/CM/HD → draft/revoked/completed/on-hold |
| ORM-specific | `rxo-medication-code` | RXO-1 | MedicationRequest.medication | Local drug codes |
| ORM-specific | `rxo-route` | RXO-5 | dosageInstruction.route | PO/IV/IM → FHIR route codes |

## Volume Estimate on First Load

With ~1549 messages (70% ASTRA, 30% MEDTEX):
- **Before pre-population**: ~31,000 raw mapping events
- **After deduplication** (same sender + code = same Task): ~5,000-8,000 unique tasks
- **After pre-populating standard HL7 tables** (0001-gender, 0002-marital, 0005-race, 0066-employment, 0296-language): reduces by ~40% → **~3,000-5,000 tasks**

## Biggest Pitfalls

1. **MEDTEX OBX explosion**: Creating mapping tasks for every custom OBX-3 code floods the queue with non-clinical questionnaire codes. Need a **whitelist/config** for which OBX codes warrant mapping vs. which should be stored as extensions or skipped.

2. **Multi-coding precedence**: Some senders include BOTH a standard HL7 code AND a custom code in the same coded field (e.g., `M^MALE^99SEX` where component 1 is HL7 standard, components 2-3 are custom). Need a generic "prefer standard coding system" rule: when a field contains a code from a recognized standard table alongside a custom code, use the standard one and skip mapping. This should be configurable, not hardcoded to any specific sender or table prefix.

3. **Document-like ORU OBX should bypass mapping**: Pathology ORU payloads may contain hundreds of `TX` OBX lines with empty OBX-3 and often missing OBX-11. If routed through normal code/status mapping they produce meaningless mapping errors. OBX routing must classify these as DocumentReference content before mapping.

4. **Race/ethnicity complexity**: Not a simple code→code mapping. ASTRA 99RAC is `1^WHITE^C^WHITE^MCKOMB` (nested custom codes). FHIR US Core expects CDC race codes. This requires transformation rules, not just ConceptMap lookups.

## Decisions Needed

- [ ] MEDTEX OBX questionnaire data: map to FHIR Observations, store as extensions, or skip entirely?
- [ ] OBX code whitelist format: config file, per-sender, or inline in mapping-types.ts?
- [ ] Multi-coding precedence: always prefer standard HL7 component, or configurable per mapping type?
- [ ] ConceptMap granularity: per (sender + type) or per (sender + type + message-type)?
- [ ] Race/ethnicity: simple code mapping, or transformation rule with nested component handling?
- [ ] Pre-population strategy: ship standard HL7 tables as seed ConceptMaps, or auto-resolve on first encounter?

## Relevant Files

- `src/code-mapping/mapping-types.ts` — mapping type registry (add new types here)
- `src/code-mapping/mapping-errors.ts` — MappingError types and builders
- `src/code-mapping/mapping-task-service.ts` — Task creation/resolution
- `src/code-mapping/concept-map/` — ConceptMap CRUD and code resolution
- `src/api/task-resolution.ts` — Task resolution business logic
- `config/hl7v2-to-fhir.json` — per-message-type config (extend for OBX whitelist?)

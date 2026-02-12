# Awie Case Project

## Context

A company runs 2 EHR systems producing HL7v2 messages of different versions, combined into batches/ZIP archives for FHIR conversion. See `data/local/awie_case/description.md` for full requirements. Sample data in `data/local/awie_case/awie_case_data/`.

IMPORTANT: this case is just ONE example of real-world hl7v2->fhir use-cases. We should not support it by over-adapting to any of their patterns or hardcoding any of the identifiers.

**Two EHR systems identified:**

| | EHR 1: ASTRA/Cerberus (v2.2) | EHR 2: MEDTEX Xpan (v2.5.1) |
|---|---|---|
| MSH-3/4 | ST01 \| W/L/F | REG \| BMH (also IST \| BMH, MEDTEX LAB \| CLAR) |
| Coding | Heavy custom `99xxx` tables (15+ tables) | Standard HL7 + massive custom OBX codes |
| Quirks | Quoted empty `""`, inconsistent provider IDs, email in phone field | 16-114 OBX questionnaire segments per message, encrypted-looking names |
| Samples | `ASTRA-ADT-*`, `cerberus/`, `prod-async-bug/` | `ADT_A01*`, `MEDTEX-*`, `Xpan_*`, `MDM_T02/` |

**Message types in data** (~10 types): ADT A01/A02/A03/A04/A11/A12/A13, ORU_R01, ORM_O01, MDM_T02

**Target**: 13 FHIR resource types (Patient, Encounter, Condition, Coverage, DocumentReference, Location, MedicationRequest, Observation, Organization, Practitioner, PractitionerRole, ServiceRequest + implicitly DiagnosticReport/Specimen/AllergyIntolerance/RelatedPerson).

Cross-EHR referencing required. Encrypted data must pass through untouched. 10k msgs/hr performance target.

---

## Current State vs. Requirements

| Capability | Status | Gap |
|---|---|---|
| ADT_A01 | Done | -- |
| ADT_A08 | Done | -- |
| ADT A02/A03/A04 | Missing | Epic 3 |
| ADT A11/A12/A13 (cancels) | Missing | Epic 3 |
| ORU_R01 (lab) | Done | Needs pathology/document handling (Epic 6) |
| ORM_O01 | Missing | Epic 4 |
| MDM_T02 | Missing | Epic 5 |
| Location resource | Missing | Epic 2 |
| Organization resource | Missing | Epic 2 |
| Practitioner resource | Missing | Epic 2 |
| PractitionerRole resource | Missing | Epic 2 |
| DocumentReference | Missing | Epics 5, 6 |
| ServiceRequest | Missing | Epic 4 |
| MedicationRequest | Missing | Epic 4 |
| Cross-EHR patient identity | Missing | Epic 1 |
| Code mapping (4 types) | Partial | Epic 7 |
| Encrypted data pass-through | Missing | Epic 8 |
| Batch/ZIP ingestion | Missing | Deferred |

---

## Epics

### P0 -- Foundation (must do first)

| # | Epic | Summary | Status |
|---|---|---|---|
| 0 | [Foundation Decisions](epics/00_foundation_decisions_epic.md) | Architectural decisions that block all implementation: ID generation for all 5 resource types, per-sender config format, draft resource handling, ADT subtype architecture, OBX routing. | **In progress** |
| 1 | [Cross-EHR Patient Identity](epics/01_cross_ehr_identity_epic.md) | Generic authority+id identity model for linking patients across EHR systems. Configurable per deployment, not hardcoded to any identifier system. | Blocked by Epic 0 |
| 2 | [Materialize Missing FHIR Resources](epics/02_missing_fhir_resources_epic.md) | Call existing Location/Organization/Practitioner/PractitionerRole converters from message-level code to produce standalone resources (infrastructure ~60% exists). | Blocked by Epic 0 |

### P1 -- ADT Completeness

| # | Epic | Summary | Status |
|---|---|---|---|
| 3 | [ADT Subtypes](epics/03_adt_subtypes_epic.md) | Implement A02 (transfer), A03 (discharge), A04 (register), A11-A13 (cancels). ~90% reuse of A01 logic; key decisions around update semantics and cancel cascading. | Ready to implement |

### P2 -- New Message Types

| # | Epic | Summary | Status |
|---|---|---|---|
| 4 | [ORM_O01 Orders](epics/04_orm_orders_epic.md) | Implement 3 order flavors (imaging, lab, pharmacy) producing ServiceRequest and MedicationRequest. Needs new ORC/RXO/TQ1 converters. | Design needed |
| 5 | [MDM_T02 Documents](epics/05_mdm_documents_epic.md) | Implement document addition producing DocumentReference from TXA header + OBX narrative content. New TXA converter needed. | Design needed |
| 6 | [ORU_R01 Enhancement](epics/06_oru_enhancement_epic.md) | Add pathology/document detection to existing ORU converter. When OBX is mostly TX/ST, create DocumentReference instead of 267 individual Observations. Fix OBX-11 fallback. | Design needed |

### P3 -- Code Mapping Scale

| # | Epic | Summary | Status |
|---|---|---|---|
| 7 | [Code Mapping Scale-Up](epics/07_code_mapping_epic.md) | Add 4-8 new mapping types (gender, race, language, etc.), pre-populate standard HL7 tables, configure OBX whitelist to prevent MEDTEX questionnaire flood (~200+ codes). | Design needed |

### P4 -- Infrastructure

| # | Epic | Summary | Status |
|---|---|---|---|
| 8 | [Encrypted Data Pass-Through](epics/08_encrypted_passthrough_epic.md) | Per-sender config to skip validation/parsing for encrypted fields. Prevent encrypted codes from creating confusing mapping tasks. | Design needed |
| -- | Batch/ZIP Ingestion | Pipeline to accept batched messages and ZIP archives. Lower priority per stakeholder. | Not started |
| -- | Performance Tuning | Optimize for 10k msgs/hr target. | Not started |

---

## Dependency Graph

```
Epic 0 (Foundation Decisions)
  └─► Epic 1 (Identity) ──► Epic 2 (Resources) ──► Epic 3 (ADT Subtypes)
  └─► Epic 4 (ORM Orders)
  └─► Epic 5 (MDM Documents) ◄──► Epic 6 (ORU Enhancement)  [shared DocumentReference pattern]

Epic 3, 4, 5, 6 ──► Epic 7 (Code Mapping)  [new message types introduce new code types]
Epic 7 ──► Epic 8 (Encrypted Pass-Through)  [encrypted codes must not trigger mapping tasks]
```

Epic 0 decisions unblock Epics 1-2 (Tier 1), Epic 3 (Tier 2), and Epics 4-6 (Tier 3).
Epics 4, 5, 6 (P2) are independent of each other and can be parallelized after P0/P1.

---

## Key Cross-Cutting Concerns

These themes span multiple epics and should be tracked as design constraints:

1. **Deterministic IDs**: Every resource gets an ID derived from source data (not random). This enables idempotent reprocessing. Each epic must define its ID generation strategy consistent with Epic 1's identity model.

2. **Bundle request method**: A01 uses conditional create (POST). Update events (A02-A13, reprocessing) need PUT. This affects all epics that produce bundles.

3. **DocumentReference pattern**: Shared between Epics 5 (MDM) and 6 (ORU pathology). Design once, use twice.

4. **Per-sender configuration**: Currently minimal (`config/hl7v2-to-fhir.json`). Epics 1, 7, 8 all need per-sender config extensions. Design the config shape once.

5. **HL7v2 type generation**: Epics 4 (ORC/RXO/TQ1), 5 (TXA) may need `bun run regenerate-hl7v2` or manual additions to `src/hl7v2/generated/`.

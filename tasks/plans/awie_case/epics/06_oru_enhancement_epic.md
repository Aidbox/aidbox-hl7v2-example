# Epic 6: ORU_R01 Enhancement (Pathology/Documents)

**Priority**: P2 (New Message Types)
**Status**: Design needed
**Depends on**: Epic 2 (Practitioner for responsible observer), Epic 5 (shared DocumentReference pattern)
**Blocks**: Nothing directly

## Problem

The existing ORU_R01 converter handles discrete lab results (NM-type OBX) correctly. But the Awie Case data includes a **pathology report** (`Xpan_ORU_R01_02/`) with 267 TX-type OBX segments forming a surgical pathology narrative. The current converter would create 267 individual Observation resources — semantically wrong and performance-killing.

## Detection Heuristic

```
IF (>80% of OBX in an OBR group have value type TX or ST)
  → Treat as document: create DocumentReference instead of Observations
ELSE
  → Treat as lab: create discrete Observations (current behavior)
```

## Critical Bug: Missing OBX-11

The pathology sample has NO OBX-11 (observation result status). Current code calls `resolveOBXStatus()` which would fail with a mapping error for EVERY OBX segment → entire message gets `mapping_error` status.

**Fix needed**: For document-style OBX groups, use a default status ("final") instead of requiring OBX-11.

## Lab Results (Xpan_ORU_R01_01)

The existing converter should handle this correctly:
- 3 OBR groups (Potassium, Creatinine/EGFR, Lithium)
- NM-type OBX with reference ranges and interpretation flags
- SPM specimens (Serum)
- NTE critical result notifications

**Patched version differences** (`Xpan_ORU_R01_01-patched/`):
- PV1-19 populated with encounter ID (was empty in original)
- PID-3 identifier type changed from PI to PE
- IN1 segment removed

## Pitfalls

1. **Threshold tuning**: The 80% heuristic may need adjustment. What if a report has 50% TX and 50% NM? Need a clear rule or configurable threshold.

2. **Shared pattern with MDM**: Epic 5 (MDM_T02) also creates DocumentReference from OBX content. The OBX→document concatenation logic should be extracted as a shared utility.

3. **OBX-11 fallback scope**: The missing OBX-11 fix should only apply to document-style OBX groups. Discrete lab OBX segments must still require OBX-11 for status mapping.

4. **Performance**: 267 OBX segments → if treated as Observations: 267 resources in one bundle. Even as DocumentReference, the text concatenation and base64 encoding of large documents needs attention.

## Decisions Needed

- [ ] Document detection threshold: 80% TX/ST, or different heuristic?
- [ ] OBX-11 fallback: default to "final" for document-style, or make configurable?
- [ ] Coordinate DocumentReference pattern with Epic 5 (MDM)?
- [ ] Pathology report format: plain text, HTML, or structured sections?

## Relevant Files

- `src/v2-to-fhir/messages/oru-r01.ts` — existing ORU converter (add pathology detection)
- `src/v2-to-fhir/segments/obx-observation.ts` — OBX converter (OBX-11 status resolution)
- `src/code-mapping/mapping-types.ts` — `obx-status` mapping type
- `data/local/awie_case/awie_case_data/Xpan_ORU_R01_02/` — pathology sample (267 TX OBX)
- `data/local/awie_case/awie_case_data/Xpan_ORU_R01_01/` — lab sample (NM OBX, working case)
- `data/local/awie_case/awie_case_data/Xpan_ORU_R01_01-patched/` — patched lab sample

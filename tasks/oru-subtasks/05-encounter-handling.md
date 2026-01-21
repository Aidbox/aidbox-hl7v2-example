# ORU_R01 Encounter Handling

Implementation guide for encounter handling in ORU_R01 processing. For full specification, see `docs/technical/modules/v2-to-fhir-oru.md`.

## Requirements

1. **PV1 segment is optional** - proceed without encounter if missing
2. **Extract Encounter ID from PV1-19** (Visit Number) - skip encounter handling if not present
3. **Lookup existing Encounter by ID** - if found, use it (do NOT update - ADT is source of truth)
4. **Create draft Encounter if not found** - use `Encounter.status = unknown` to mark as unverified
5. **Link resources to Encounter** - DiagnosticReport, Observation get `encounter` reference

## Key Design Decisions

**Draft encounter lifecycle:**
- Draft encounter (`status = unknown`) persists until ADT message arrives
- ADT_A01/A08 for same encounter ID overwrites with proper status (PUT is idempotent)
- Lab results remain linked via unchanged reference

**Race condition handling:**
- Uses POST with `If-None-Exist: _id={encounterId}` for conditional creation
- Prevents duplicate encounters when multiple ORU messages for same non-existent encounter arrive simultaneously

## Testing Checklist

**Unit tests:**
- [x] Extract encounter ID from PV1-19
- [x] Return undefined when PV1-19 empty
- [x] Draft encounter has `status = unknown`
- [x] Draft encounter has correct subject reference
- [x] PV1 demographics extracted via `convertPV1ToEncounter()`

**Integration tests:**
- [x] No PV1 segment → resources have no encounter reference
- [x] PV1 without PV1-19 → resources have no encounter reference
- [x] Existing encounter found → resources linked, encounter NOT updated, no Encounter in bundle
- [x] Encounter not found → draft Encounter created and included in bundle
- [x] Idempotency: same message twice → no duplicate encounters (POST with If-None-Exist)
- [x] Error propagation: lookup errors (non-404) propagate correctly

## Implementation Tasks

- [x] **5.1** Add PV1 parsing to ORU_R01 converter (optional segment)
- [x] **5.2** Implement encounter ID extraction from PV1-19
- [x] **5.3** Implement encounter lookup function (similar to patient lookup)
- [x] **5.4** Implement draft encounter creation with `status = unknown`
- [x] **5.5** Check for existing encounter before creating draft
- [x] **5.6** Link encounter reference to DiagnosticReport and Observation
- [x] **5.7** Include Encounter in bundle (if creating draft, POST with If-None-Exist)

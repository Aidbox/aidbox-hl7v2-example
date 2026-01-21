# ORU_R01 Patient Handling

Extends the core ORU_R01 processing (see `docs/technical/modules/v2-to-fhir-oru.md`) with patient lookup and draft patient creation.

## Requirements

1. **PID segment is required** - error if missing or no usable patient ID (PID-2 or PID-3.1)
2. **Lookup existing Patient by ID** - if found, use it (do NOT update - ADT is source of truth)
3. **Create draft Patient if not found** - use `Patient.active = false` to mark as unverified
4. **Link all resources to Patient** - DiagnosticReport, Observation, Specimen, IncomingHL7v2Message

## Patient ID Extraction

Same logic as ADT_A01 (see `src/v2-to-fhir/messages/adt-a01.ts`):

```typescript
function extractPatientId(pid: PID): string {
  if (pid.$2_patientId?.$1_value) return pid.$2_patientId.$1_value;
  if (pid.$3_identifier?.[0]?.$1_value) return pid.$3_identifier[0].$1_value;
  throw new Error("Patient ID (PID-2 or PID-3) is required");
}
```

When PID-3 contains multiple identifiers (MRN, SSN, etc.), use the first one for resource ID. All identifiers are captured in `Patient.identifier[]` via `convertPIDToPatient()`.

## Draft Patient Creation

```typescript
function createDraftPatient(pid: PID, patientId: string): Patient {
  const patient = convertPIDToPatient(pid);  // Already extracts all demographics
  patient.id = patientId;
  patient.active = false;  // Mark as draft/unverified
  return patient;
}
```

**Draft patient lifecycle:**
- Draft patient (`active = false`) persists until ADT message arrives
- ADT_A01/A08 for same patient ID overwrites with `active = true` (PUT is idempotent)
- Lab results remain linked via unchanged reference

**Race condition handling:**
- Uses POST with `If-None-Exist: _id={patientId}` for conditional creation
- If patient already exists (created by concurrent message), server returns existing patient
- Prevents duplicate patients when multiple ORU messages for same non-existent patient arrive simultaneously
- More robust than PUT: guarantees exactly one patient created regardless of timing

## Error Conditions

| Condition | Action |
|-----------|--------|
| PID segment missing | Error: "PID segment is required for ORU_R01 messages" |
| PID-2 and PID-3 both empty | Error: "Patient ID (PID-2 or PID-3) is required" |
| Patient not found | Create draft Patient with `active = false` |

## Testing Checklist

**Unit tests:**
- [ ] Extract patient ID from PID-2
- [ ] Extract patient ID from PID-3.1 when PID-2 empty
- [ ] Error when both PID-2 and PID-3 empty
- [ ] Draft patient has `active = false`
- [ ] All PID demographics extracted (delegates to `convertPIDToPatient()`)

**Integration tests:**
- [ ] Existing patient found → resources linked, patient NOT updated, no Patient in bundle
- [ ] Patient not found → draft Patient created and included in bundle
- [ ] Missing PID → message rejected with error
- [ ] Idempotency: same message twice → no duplicate patients (POST with If-None-Exist)
- [ ] Draft lifecycle: ORU creates draft, ADT updates to active, lab results still linked

## Implementation Tasks

- [ ] **4.1** Add PID parsing to ORU_R01 converter (error if missing)
- [ ] **4.2** Implement patient ID extraction (PID-2 → PID-3.1 fallback)
- [ ] **4.3** Implement draft patient creation with `active = false`
- [ ] **4.4** Check for existing patient before creating draft
- [ ] **4.5** Link subject reference to DiagnosticReport, Observation, Specimen
- [ ] **4.6** Set `IncomingHL7v2Message.patient` reference
- [ ] **4.7** Include Patient in bundle (if creating draft, POST with If-None-Exist for race condition safety)

## Querying Draft Patients

```
GET /Patient?active=false
GET /Patient?active=false&identifier:assigner=ACME_LAB
```

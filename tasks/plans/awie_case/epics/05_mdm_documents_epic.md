# Epic 5: MDM_T02 (Documents)

**Priority**: P2 (New Message Types)
**Status**: Design needed
**Depends on**: Epic 1 (identity model), Epic 2 (Practitioner for document author)
**Blocks**: Nothing directly

## Problem

MDM_T02 (Document Addition Notification) is a target message type with no implementation. It produces DocumentReference — a FHIR resource type not created by any current converter.

## Message Structure (from `MDM_T02/MDM_T02.txt`)

```
MSH (v2.3, XELO)
EVN (T02 - document addition)
PID (patient)
PV1 (outpatient visit)
TXA (document header: type=68834-1 Family Medicine Office Note, author, status=F)
OBX x42 (ST type - structured clinical note sections)
```

## TXA → DocumentReference Mapping

| TXA Field | FHIR Target |
|---|---|
| TXA-2 (Document Type: 68834-1^Family Medicine Office Note) | DocumentReference.type |
| TXA-4 (Activity DateTime) | DocumentReference.date |
| TXA-9 (Originator: 1902217052^Higgins^Tiffany) | DocumentReference.author → Practitioner |
| TXA-10 (Authenticator) | DocumentReference.authenticator → Practitioner |
| TXA-17 (Status: F) | DocumentReference.status (F→current, D→preliminary) |

## OBX as Document Content

The 42 OBX-ST segments form a structured clinical note with sections (HPI, Problem List, Vitals, Physical Exam, Assessment, Plan, etc.). Each OBX-3 has a LOINC section code (e.g., `11348-0^History of Present Illness^LN`).

**Decision**: Concatenate all OBX-5 values with OBX-3 section headers into `DocumentReference.content[0].attachment.data` as plain text. Do NOT create 42 separate Observations — that would be semantically wrong for a clinical note.

## Pitfalls

1. **TXA segment not in generated code**: `src/hl7v2/generated/fields.ts` likely doesn't have TXA interface. Must regenerate or manually add.

2. **No MDM routing**: `src/v2-to-fhir/converter.ts` switch statement has no MDM_T02 case.

3. **ID generation**: TXA-23 (Unique Document ID) is optional and NOT present in sample. Must use composite: `{patient-id}-{document-type}-{date}` or MSH-10 (message control ID).

4. **Shared DocumentReference pattern with ORU**: Epic 6 (ORU Enhancement) also needs to create DocumentReference for pathology reports. The DocumentReference creation logic should be reusable between MDM and ORU pathology detection.

## Decisions Needed

- [ ] TXA types available in generated code, or need regeneration?
- [ ] Document ID strategy: TXA-23 (if present) vs composite vs MSH-10?
- [ ] OBX concatenation format: plain text with section headers, or structured markdown?
- [ ] Coordinate DocumentReference creation pattern with Epic 6 (ORU enhancement)?

## Relevant Files

- `src/v2-to-fhir/converter.ts` — add MDM_T02 routing case
- `src/hl7v2/generated/` — check for TXA type definitions
- `data/local/awie_case/awie_case_data/MDM_T02/MDM_T02.txt` — sample message

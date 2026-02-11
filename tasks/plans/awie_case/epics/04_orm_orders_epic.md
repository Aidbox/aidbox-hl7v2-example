# Epic 4: ORM_O01 (Orders)

**Priority**: P2 (New Message Types)
**Status**: Design needed
**Depends on**: Epic 1 (identity model), Epic 2 (Practitioner/Organization resources for requester/performer)
**Blocks**: Nothing directly

## Problem

ORM_O01 (General Order) is one of the target message types but has no implementation. The 6 sample messages reveal **3 fundamentally different order flavors** that share the ORM_O01 envelope but diverge in content, target FHIR resources, and complexity.

## Three Distinct Flavors Found in Data

| Flavor | Samples | Key Segments | FHIR Output | Source |
|---|---|---|---|---|
| Imaging | ORM-1, ORM-3, ORM-4 | ORC + OBR + DG1 | ServiceRequest | EUPHORIA, ACME (v2.4-2.5.1) |
| Lab | ORM-2, ORM-5 | ORC + OBR + DG1 + NTE | ServiceRequest | Various (v2.3) |
| Pharmacy | ORM-6 | ORC + RXO + NTE + DG1 + OBX + IN1 | MedicationRequest | REG (custom) |

## Architecture Decision: Unified Router

Recommended: Single `src/v2-to-fhir/messages/orm-o01.ts` with ORDER_CHOICE detection:
- If OBR present → imaging/lab handler → ServiceRequest
- If RXO present → pharmacy handler → MedicationRequest
- Common: ORC parsing, DG1→reasonReference, NTE handling, patient/encounter

## New Segment Converters Needed

**ORC (Common Order)**: Maps to ServiceRequest/MedicationRequest shared fields (status from ORC-1, identifiers from ORC-2/3, authoredOn from ORC-9, requester from ORC-12).

**RXO (Pharmacy Order)**: Maps to MedicationRequest-specific fields (medication from RXO-1, dose from RXO-2/3, route from RXO-5, dispense from RXO-9/10/11).

**TQ1 (Timing/Quantity)**: Rich timing structure for dosage instructions (frequency, period, bounds).

## Pitfalls

1. **ORC-1 status mapping split**: ServiceRequest and MedicationRequest have DIFFERENT status enums. ORC-1 "CA" (cancel) → ServiceRequest `revoked` but MedicationRequest `cancelled`. Mapping must be resource-type-aware.

2. **Don't create DiagnosticReport from ORM**: ORM is the ORDER, not the RESULT. OBR in ORM context describes what was ordered, not what was found. DiagnosticReport should only come from ORU_R01 result messages.

3. **NTE escape sequences**: Sample ORM-5 has `\H\`, `\.br\`, `\X0D\\X0A\` escape sequences in NTE text. Current NTE converter (`src/v2-to-fhir/segments/nte-annotation.ts`) doesn't decode these — they'll appear as literal backslash sequences in notes.

4. **ORM-6 (pharmacy) is wildly different**: Has RXO, RXC, IN1 (x3), DG1 (x6), OBX (x6) segments. The pharmacy order structure shares almost nothing with imaging/lab orders beyond MSH/PID/ORC.

5. **Medication code resolution**: RXO-1 uses local medication codes (`medication-code-1^medication-display-1^medication-system-1`). No standard medication terminology (RxNorm, NDC) in sample. Needs code mapping type (see Epic 7).

6. **HL7v2 type generation**: ORC, RXO, TQ1 types may not exist in `src/hl7v2/generated/`. Check if `bun run regenerate-hl7v2` includes these segments; if not, must add to reference data first.

7. **Optional PATIENT group**: ORM_O01 spec allows PATIENT group (PID) to be absent (minOccurs=0). If PID missing, we have no patient context. Decide: error, or allow order-only resources?

## Decisions Needed

- [ ] Which ORM flavor(s) to implement first? (Imaging/lab are simpler; pharmacy is significantly more complex)
- [ ] Unified router vs separate message handlers for each flavor?
- [ ] How to handle missing PID (patient group optional in spec)?
- [ ] NTE escape sequence decoding: implement now or defer?
- [ ] ORC/RXO/TQ1 types available in generated code, or need regeneration?

## Relevant Files

- `src/v2-to-fhir/converter.ts` — add ORM_O01 routing case
- `src/v2-to-fhir/segments/nte-annotation.ts` — existing NTE converter (escape sequence gap)
- `src/hl7v2/generated/` — check for ORC/RXO/TQ1 type definitions
- `data/local/awie_case/awie_case_data/ORM-O01-1/` through `ORM-O01-6/` — sample messages

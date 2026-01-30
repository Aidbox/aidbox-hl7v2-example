# Unified Encounter ID Generation

## Problem Statement

Currently, ADT-A01 and ORU-R01 use **different strategies** for generating Encounter IDs from PV1-19:

**ADT-A01** (`src/v2-to-fhir/messages/adt-a01.ts:387-391`):
```typescript
if (pv1.$19_visitNumber?.$1_value) {
  encounter.id = pv1.$19_visitNumber.$1_value;  // Direct value
} else {
  encounter.id = generateId("encounter", 1, messageControlId);  // Fallback
}
```

**ORU-R01** (`src/v2-to-fhir/messages/oru-r01.ts:606-612`):
```typescript
function generateEncounterId(senderContext: SenderContext, visitNumber: string): string {
  const parts = [senderContext.sendingApplication, senderContext.sendingFacility, visitNumber];
  return parts.join("-").toLowerCase().replace(/[^a-z0-9-]/g, "-");
}
```

### Consequences

1. **Data fragmentation**: Same visit from same sender creates different Encounter IDs
   - ORU creates draft: `Encounter/labcorp-main-v12345`
   - ADT arrives later: `Encounter/v12345`
   - Draft is never replaced, becomes orphaned

2. **Inconsistent with Patient ID handling**: Both ADT and ORU use PID-2/PID-3 directly for Patient ID (no sender prefix)

3. **Scattered logic**: ID generation is duplicated in multiple places with different implementations

---

## Research: HL7v2 Best Practices

### CX Data Type Components

PV1-19 is a CX (Extended Composite ID) with built-in disambiguation:

| Component | Field | Purpose |
|-----------|-------|---------|
| CX.1 | `$1_value` | The visit number itself |
| CX.4 | `$4_system` (HD) | **Assigning Authority** - WHO assigned the ID |
| CX.5 | `$5_type` | Identifier Type Code |
| CX.6 | `$6_assigner` (HD) | **Assigning Facility** - WHERE assigned |

HD subcomponents:
- `$1_namespace` - e.g., "LABCORP"
- `$2_system` - e.g., OID "2.16.840.1.113883.3.123"
- `$3_systemType` - e.g., "ISO"

### Official HL7 v2-to-FHIR Mapping

From [PV1 to Encounter Map](https://build.fhir.org/ig/HL7/v2-to-fhir/ConceptMap-segment-pv1-to-encounter.html):

- PV1-19 → `Encounter.identifier` (not `.id`)
- CX.1 → `Identifier.value`
- CX.4 → `Identifier.system` (when in registry) or `Identifier.assigner`
- CX.5 → `Identifier.type.coding.code` = "VN"

From [CX to Identifier Map](https://build.fhir.org/ig/HL7/v2-to-fhir/ConceptMap-datatype-cx-to-identifier.html):

> "As of v2.7, CX.4 Assigning Authority is required if neither CX.9 nor CX.10 are populated. Best practice is to always send an OID in the Assigning Authority component."

### Key Insight

The HL7v2 spec already solved the collision problem:
- **CX.4 (Assigning Authority)** identifies the system that assigned the visit number
- Different facilities sending the same visit number "12345" will have different CX.4 values
- When CX.4 is empty (common in practice), fall back to MSH-3/MSH-4 sender info

---

## Proposed Solution

### 1. Centralize Deterministic ID Generation

Create a single module for all deterministic FHIR resource ID generation:

```
src/v2-to-fhir/
  id-generation.ts  # NEW: Central place for all ID generation logic
```

This prevents:
- Scattered implementations with inconsistent logic
- Duplication of sanitization rules
- Divergent fallback behaviors

### 2. Encounter ID Generation Strategy

Priority order for disambiguation:
1. **CX.4 (Assigning Authority)** - use `$4_system.$1_namespace` or `$4_system.$2_system`
2. **CX.6 (Assigning Facility)** - use `$6_assigner.$1_namespace` if CX.4 empty
3. **MSH sender info** - fallback when CX components empty (common case)

```typescript
// Proposed API
function generateEncounterId(visitNumber: CX, senderContext: SenderContext): string | undefined {
  const value = visitNumber.$1_value;
  if (!value) return undefined;

  // Prefer CX.4/CX.6, fallback to sender context
  const authority = visitNumber.$4_system?.$1_namespace
    ?? visitNumber.$6_assigner?.$1_namespace
    ?? `${senderContext.sendingApplication}-${senderContext.sendingFacility}`;

  return sanitizeId(`${authority}-${value}`);
}
```

### 3. Move ID Generation into `convertPV1WithMappingSupport`

Since the function already receives:
- `pv1` (has `$19_visitNumber` with full CX)
- `senderContext` (fallback)

It can set `encounter.id` directly when visit number is present.

Caller handles fallback only when visit number is completely missing (rare edge case, ADT-specific).

### 4. Proper `Encounter.identifier` Population

Follow official v2-to-FHIR mapping:
```typescript
encounter.identifier = [{
  type: {
    coding: [{
      system: "http://terminology.hl7.org/CodeSystem/v2-0203",
      code: "VN"
    }],
    text: "visit number"
  },
  system: visitNumber.$4_system?.$2_system,  // OID if available
  value: visitNumber.$1_value,
  assigner: visitNumber.$6_assigner ? { display: visitNumber.$6_assigner.$1_namespace } : undefined
}];
```

---

## References

- [CX Data Type Reference](https://www.hl7.eu/refactored/dtCX.html)
- [CX to Identifier Map](https://build.fhir.org/ig/HL7/v2-to-fhir/ConceptMap-datatype-cx-to-identifier.html)
- [PV1 to Encounter Map](https://build.fhir.org/ig/HL7/v2-to-fhir/ConceptMap-segment-pv1-to-encounter.html)
- [PV1.19 Field Definition](https://hl7-definition.caristix.com/v2/HL7v2.7/Fields/PV1.19)

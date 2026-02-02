# Code Mapping Design Analysis

**Status:** Draft - Design discussion needed
**Date:** 2026-02-02

## Overview

Analysis of the current code mapping system design, identifying inconsistencies and potential improvements.

## Current Design

### Mapping Types and Their Data Structures

Each mapping type has 2-3 separate definitions of essentially the same data:

| Mapping Type | Inline Standard Map | UI Dropdown Values | Runtime Validation |
|--------------|---------------------|-------------------|-------------------|
| patient-class | `PATIENT_CLASS_MAP` (pv1-encounter.ts:43) | `VALID_VALUES` (mapping-type-options.ts:30) | `VALID_ENCOUNTER_CLASS_CODES` (pv1-encounter.ts:170) |
| obr-status | `OBR25_STATUS_MAP` (obr-diagnosticreport.ts:41) | `VALID_VALUES` (mapping-type-options.ts:43) | `VALID_FHIR_DR_STATUSES` (obr-diagnosticreport.ts:248) |
| obx-status | `OBX11_STATUS_MAP` (obx-observation.ts:47) | `VALID_VALUES` (mapping-type-options.ts:55) | `VALID_FHIR_OBS_STATUSES` (obx-observation.ts:501) |
| observation-code-loinc | None (inline CE detection) | None (free-form) | None |

### Resolution Algorithm (Same Pattern Everywhere)

```
1. Try hardcoded inline map (standard HL7v2 codes)
2. If not found → try sender's ConceptMap
3. If not found → return error
```

### Hardcoded Source Systems

All status-based types hardcode the assumed source system:

- patient-class: `"http://terminology.hl7.org/CodeSystem/v2-0004"` (pv1-encounter.ts:56)
- obr-status: `"http://terminology.hl7.org/CodeSystem/v2-0123"` (obr-diagnosticreport.ts:77, 297)
- obx-status: `"http://terminology.hl7.org/CodeSystem/v2-0085"` (obx-observation.ts:86, 548)

## Problems Identified

### 1. Duplicate Definitions of Valid Target Values

Each mapping type defines its valid target values in 2-3 places:
- Inline map values (in segment converter)
- UI dropdown options (in mapping-type-options.ts)
- Runtime validation set (in segment converter)

These can drift out of sync.

### 2. Source System is Always Assumed, Never Captured

When a mapping error is created, `localSystem` is set to a hardcoded HL7 table URI. The actual system the sender uses is ignored.

Example from pv1-encounter.ts:245:
```typescript
return {
  error: {
    localCode: classCode,
    localSystem: PATIENT_CLASS_V2_SYSTEM, // Always hardcoded
    // ...
  },
};
```

Senders may use:
- Their own proprietary code system
- A different HL7 table
- No system identifier at all

### 3. Standard Mappings Cannot Be Overridden

The resolution order (standard first, ConceptMap second) means:
- If sender uses "I" to mean something different than standard HL7v2 "Inpatient", there's no way to override it
- The ConceptMap is only consulted for codes NOT in the standard map

### 4. PATIENT_CLASS_MAP vs VALID_VALUES Conceptual Mismatch

These serve different purposes but overlap:
- `PATIENT_CLASS_MAP`: Source codes (HL7v2 Table 0004) → Target codes (FHIR v3-ActCode)
- `VALID_VALUES["patient-class"]`: All valid FHIR target codes for UI dropdowns

The inline map only produces 4 unique targets (AMB, EMER, IMP, PRENC), but VALID_VALUES has 11 options. This is correct but confusing - they're different domains.

### 5. ConceptMap sourceUri is Synthetic

```typescript
sourceUri: `http://example.org/fhir/CodeSystem/hl7v2-${baseId}`
```

This doesn't represent the actual source systems. The real source systems are in `ConceptMap.group[].source`.

## Proposed Solution

### Consolidate into MAPPING_TYPES Registry

```typescript
export const MAPPING_TYPES = {
  "patient-class": {
    taskDisplay: "Patient class mapping",
    sourceFieldLabel: "PV1.2",
    targetFieldLabel: "Encounter.class",
    targetSystem: "http://terminology.hl7.org/CodeSystem/v3-ActCode",

    // Single source of truth for valid target values
    validTargetValues: {
      AMB: "Ambulatory",
      EMER: "Emergency",
      // ... all 11 values
    },

    // Default source system (when message doesn't specify)
    defaultSourceSystem: "http://terminology.hl7.org/CodeSystem/v2-0004",

    // Standard mappings as FALLBACK (not priority)
    standardMappings: {
      E: "EMER",
      I: "IMP",
      O: "AMB",
      // ...
    },
  },
  // ...
};
```

### Change Resolution Order: ConceptMap First

```typescript
async function resolveCode(mappingType, sourceCode, sourceSystem, sender) {
  // 1. SENDER CONCEPTMAP FIRST - allows overriding anything
  const conceptMapResult = await translateCode(...);
  if (conceptMapResult.status === "found" && isValidTarget(...)) {
    return conceptMapResult;
  }

  // 2. STANDARD MAPPINGS AS FALLBACK
  const standardTarget = config.standardMappings?.[sourceCode];
  if (standardTarget) {
    return { resolved: standardTarget };
  }

  // 3. NO MAPPING FOUND
  return { error: buildMappingError(...) };
}
```

### Derive UI Options from Registry

```typescript
// mapping-type-options.ts becomes a thin wrapper
export function getValidValuesWithDisplay(mappingType) {
  const values = MAPPING_TYPES[mappingType].validTargetValues;
  if (!values) return []; // Free-form types like LOINC
  return Object.entries(values).map(([code, display]) => ({ code, display }));
}
```

### Benefits

1. **Single source of truth** - no duplicate definitions
2. **ConceptMap-first** - sender can override any code
3. **No hardcoded systems in converters** - use config or capture from message
4. **~150 lines of duplicate code removed**

## Downsides of Proposed Solution

### 1. Registry Pollution with UI Concerns

Adding `validTargetValues` with display names to `MAPPING_TYPES` mixes converter logic with UI presentation concerns.

If someone extracts just the v2-to-fhir converter module (without the UI), they would carry along UI-specific display strings that serve no purpose in their context. This breaks the isolation between:
- Core conversion logic (pure HL7v2 → FHIR transformation)
- UI presentation layer (dropdowns, labels, display names)

### 2. Hardcoding Values in Source Code

The proposed solution still hardcodes all valid values and standard mappings in TypeScript source code. Better alternatives might include:
- Loading from configuration files
- Fetching from FHIR terminology server (ValueSet resources)
- Using Aidbox's built-in terminology capabilities
- Or something else

Hardcoded values require code changes and redeployment to update mappings, which may not be acceptable in production healthcare environments.

## Open Questions

1. Should the converter module be designed for extraction/reuse without UI?
2. Should valid target values come from external ValueSet resources instead of code?
3. Is ConceptMap-first resolution acceptable, or do standard codes need guaranteed behavior?
4. How should we handle messages that don't specify source system at all?

## Files Involved

- `src/code-mapping/mapping-types.ts` - Registry
- `src/code-mapping/mapping-type-options.ts` - UI dropdown helpers
- `src/code-mapping/validation.ts` - Validation wrapper
- `src/v2-to-fhir/segments/pv1-encounter.ts` - Patient class mapping
- `src/v2-to-fhir/segments/obr-diagnosticreport.ts` - OBR status mapping
- `src/v2-to-fhir/segments/obx-observation.ts` - OBX status mapping
- `src/code-mapping/concept-map/lookup.ts` - ConceptMap $translate
- `src/code-mapping/concept-map/service.ts` - ConceptMap CRUD

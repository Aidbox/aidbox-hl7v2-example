# Draft: Non-blocking Warning for Missing PV1.19 Visit Number in ORU

TODO: this is mostly implemented, but need to make a clear default config and the documentation that refers to the spec as the rationale of the chosen default config behavior.

## Overview

When an ORU message contains a PV1 segment but is missing PV1.19 (Visit Number), the system should save all valid clinical data (DiagnosticReport, Observations) while flagging the missing encounter association as a warning. This follows HL7 best practices: "some data is better than none" for clinical results.

## Context

- **Files involved**:
  - `src/v2-to-fhir/messages/oru-r01.ts` - Main ORU converter, `handleEncounter()` function
  - `src/v2-to-fhir/converter.ts` - `ConversionResult` type definition
  - `src/v2-to-fhir/processor-service.ts` - Message processing, status updates
  - `src/fhir/custom/IncomingHL7v2Message.ts` - Custom resource type (if warnings field needed)

- **Related code**:
  - `handleEncounter()` currently returns early with null refs when visit number missing (line 667-669)
  - `ConversionResult.messageUpdate` has `status` field but no warnings mechanism
  - Similar pattern: `mappingError` handling creates Tasks for tracking issues

- **Key constraint**:
  - **MUST NOT block clinical data** - Observations and DiagnosticReport must be saved even when encounter context is incomplete
  - Encounter cannot be created without visit number (no deterministic ID possible)

## Background Research

Per [HL7 V2 ACK Guidance](https://confluence.hl7.org/spaces/CONF/pages/256183953/HL7+V2+ACK+Guidance):
- "Some data is better than none" - accept valid portions even when some fields have errors
- Can respond with AA (Accept) with warnings indicated
- Rejecting clinical results can delay lab data and impact patient safety

## Development Approach

- **Testing approach**: TDD - write tests first
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: broken encounter data MUST NOT block conversion of valid observations**

---

## Technical Details

### ConversionResult type change

```typescript
export interface ConversionResult {
  bundle: Bundle;
  messageUpdate: {
    status: "processed" | "mapping_error" | "error";
    patient?: Reference<"Patient">;
    warnings?: string[];  // NEW: non-blocking issues
  };
}
```

### handleEncounter return type change

```typescript
interface EncounterHandlingResult {
  encounterRef: Reference<"Encounter"> | null;
  encounterEntry: BundleEntry | null;
  patientClassTaskEntry?: BundleEntry;
  warning?: string;  // NEW: warning when encounter skipped due to missing data
}
```

### Warning message format

```
"PV1 segment present but PV1.19 (Visit Number) is missing - encounter association skipped. DiagnosticReport and Observations saved without encounter reference."
```

## Edge Cases and Error Handling

### PV1 present but PV1.19 missing
- **Behavior**: Save clinical data, add warning, status = "processed"
- **Rationale**: Clinical data is valuable; encounter context is supplementary

### PV1 completely absent
- **Behavior**: No warning (PV1 is optional for ORU per HL7 spec)
- **Rationale**: Sender intentionally omitted visit info

### PV1.19 present but empty string
- **Behavior**: Treat same as missing, add warning
- **Rationale**: Empty string is not a valid visit number

### Multiple OBR groups with valid observations
- **Behavior**: All observations saved, single warning about encounter
- **Rationale**: Warning is about encounter, not about individual observations

### Mapping errors AND missing PV1.19
- **Behavior**: mapping_error status takes precedence, but warning still recorded
- **Rationale**: Mapping errors block processing; warning is recorded for when message is reprocessed

## Post-Completion Verification

1. Send ORU message with PV1 but no PV1.19 via MLLP client
2. Verify message status is "processed" (not "error")
3. Verify DiagnosticReport and Observations are created in Aidbox
4. Verify warning appears on IncomingHL7v2Message resource
5. Verify warning displays in UI with appropriate styling
6. Verify observations do NOT have encounter reference (expected when encounter skipped)

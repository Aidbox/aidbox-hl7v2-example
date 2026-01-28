# Plan: Unified Mapping Tasks

## Overview

Extend the current LOINC-only mapping task system to support any field type mapping (Address type, Patient class, OBR/OBX status, etc.). This enables human operators to resolve mapping errors for any HL7v2-to-FHIR field conversion, not just Observation codes.

## Context

**Files involved:**
- `src/code-mapping/mapping-task-service.ts` - Task creation/resolution (extend for multiple types)
- `src/code-mapping/concept-map/service.ts` - ConceptMap CRUD (add field-specific ConceptMaps)
- `src/code-mapping/concept-map/lookup.ts` - Code resolution (generalize beyond LOINC)
- `src/v2-to-fhir/messages/oru-r01.ts` - Current LOINC error handling (extract reusable logic)
- `src/v2-to-fhir/segments/obr-diagnosticreport.ts` - OBR-25 status mapping (add Task support)
- `src/v2-to-fhir/segments/obx-observation.ts` - OBX-11 status mapping (add Task support)
- `src/v2-to-fhir/segments/pv1-encounter.ts` - PV1.2 Patient Class (add Task support)
- `src/v2-to-fhir/datatypes/xad-address.ts` - XAD.7 Address Type (add Task support)
- `src/ui/pages/mapping-tasks.ts` - UI page (add type filters)
- `src/ui/mapping-tasks-queue.ts` - Task resolution (generalize output)
- `src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts` - UnmappedCode structure (keep as-is, works for all types)
- `src/index.ts` - API routes (update resolution endpoint)

**Dependencies:** None (all functionality is internal)

**Related code patterns:**
- Current LOINC mapping flow in `oru-r01.ts:278-332` (createMappingTask)
- ConceptMap service in `src/code-mapping/concept-map/service.ts`
- Task resolution in `src/ui/mapping-tasks-queue.ts`

## Development Approach

- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes**

## Validation Commands

- `bun test` - Run unit tests (alias: `bun test:unit`)
- `bun test:integration` - Run integration tests (requires Aidbox)
- `bun test:all` - Run all tests: unit + integration
- `bun run typecheck` - TypeScript type checking

---

## Task 1: Define Mapping Types and Target Systems Registry

Create a centralized registry for mapping types that defines:
- Task code values for filtering
- Target FHIR code systems
- ConceptMap ID suffixes
- Display names for UI

This ensures extensibility and fail-fast behavior when a new field type is added without proper configuration.

- [x] Create `src/code-mapping/mapping-types.ts` with MappingType enum/const
- [x] Define mapping type registry with these fields for each type:
  - `taskCode`: string for Task.code.coding[0].code (e.g., "loinc-mapping", "address-type-mapping")
  - `taskDisplay`: string for Task.code.coding[0].display
  - `targetSystem`: FHIR code system URI (e.g., "http://loinc.org", "http://hl7.org/fhir/address-type")
  - `conceptMapSuffix`: string for ConceptMap ID (e.g., "-to-loinc", "-to-address-type")
  - `sourceField`: HL7v2 field name (e.g., "OBX-3", "PID.11", "PV1.2", "OBR-25", "OBX-11")
  - `targetField`: FHIR field name (e.g., "Observation.code", "Address.type", "Encounter.class", "DiagnosticReport.status", "Observation.status")
- [x] Add initial types: `loinc`, `address-type`, `patient-class`, `obr-status`, `obx-status`
- [x] Add helper function `getMappingType(taskCode: string)` that throws if type not found
- [x] Add helper function `getMappingTypeOrFail(type: string)` for fail-fast on unknown types
- [x] Write unit tests for registry lookup and fail-fast behavior
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 2: Generalize ConceptMap Service for Multiple Target Systems

Update ConceptMap service to support target systems other than LOINC.

- [x] Update `generateConceptMapId()` in `lookup.ts` to accept optional `mappingType` parameter
- [x] When mappingType provided, append type's `conceptMapSuffix` instead of "-to-loinc"
- [x] Update `createEmptyConceptMap()` to accept target system from mapping type registry
- [x] Update `addMappingToConceptMap()` to use configurable target system
- [x] Ensure backward compatibility: existing LOINC calls work unchanged
- [x] Update/add unit tests for ConceptMap with different target systems
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 3: Generalize Task Creation for Multiple Mapping Types

Extract and generalize task creation from `oru-r01.ts` to support all mapping types.

- [x] Move `createMappingTask()` from `oru-r01.ts` to `mapping-task-service.ts`
- [x] Add `mappingType` parameter to `createMappingTask()`
- [x] Use mapping type registry to set Task.code.coding values
- [x] Add "Source field" and "Target field" inputs from mapping type registry
- [x] Update `generateMappingTaskId()` to include mapping type in ID for uniqueness
- [x] Export `createMappingTask()` and `createTaskBundleEntry()` from service
- [x] Update `oru-r01.ts` to import and use the exported functions
- [x] Update existing unit tests, add tests for new mapping types
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 4: Create Generic Mapping Error Types and Builders

Create error types and result builders that work for any mapping type.

- [x] Create `src/code-mapping/mapping-errors.ts` with:
  - `MappingError` interface (localCode, localDisplay, localSystem, mappingType)
  - `MappingErrorResult` type for converter returns
- [x] Create `buildMappingErrorResult()` function (extract from oru-r01.ts, generalize)
- [x] Function should accept: sender context, mapping errors array, patient ref, optional entries
- [x] Function returns: ConversionResult with Tasks and unmappedCodes
- [x] Update `oru-r01.ts` to use the new shared `buildMappingErrorResult()`
- [x] Verify existing LOINC mapping error flow still works
- [x] Write unit tests for buildMappingErrorResult with different mapping types
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 5: Update Task Resolution for Multiple Target Systems

Generalize task resolution to handle non-LOINC mappings.

- [x] Update `resolveTaskWithMapping()` in `mapping-tasks-queue.ts`:
  - Extract mapping type from Task.code
  - Get target system from mapping type registry
  - Use correct target system in ConceptMap and Task output
- [x] Update `resolveMappingTask()` in `mapping-task-service.ts` similarly
- [x] Rename output type from "Resolved LOINC" to "Resolved mapping" (or make it dynamic based on type)
- [x] Write **integration tests** for resolution with different mapping types (these functions call Aidbox - no mocks)
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 6: Add OBR-25 Status Mapping Task Support

Add Task creation for invalid OBR-25 (DiagnosticReport.status) values.

- [x] Update `mapOBRStatusToFHIR()` to return a result object instead of throwing:
  - `{ status: DiagnosticReport["status"] }` on success
  - `{ error: MappingError }` on failure
- [x] Create `convertOBRWithMappingSupport()` wrapper that collects mapping errors
- [x] Update OBR converter call sites in oru-r01.ts to use new wrapper
- [x] Collect OBR status errors alongside LOINC errors in mapping error array
- [x] Write **unit tests** for `mapOBRStatusToFHIR()` pure function (valid/invalid status values)
- [x] Write **integration test** for full ORU flow with invalid OBR-25 status:
  - Send message with OBR-25 = "Y" → verify Task created with type `obr-status-mapping`
  - Resolve task → verify message reprocesses successfully
- [x] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 7: Add OBX-11 Status Mapping Task Support

Add Task creation for invalid OBX-11 (Observation.status) values.

- [ ] Update `mapOBXStatusToFHIR()` to return a result object instead of throwing:
  - `{ status: Observation["status"] }` on success
  - `{ error: MappingError }` on failure
- [ ] Update `convertOBXToObservation()` to handle mapping errors alongside LOINC errors
- [ ] Ensure both LOINC and status errors are collected and returned
- [ ] Write **unit tests** for `mapOBXStatusToFHIR()` pure function (valid/invalid status values)
- [ ] Write **integration test** for full ORU flow with invalid OBX-11 status:
  - Send message with OBX-11 = "N" → verify Task created with type `obx-status-mapping`
  - Test combined errors: message with unknown LOINC AND invalid OBX-11 → verify two Tasks created
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 8: Add PV1.2 Patient Class Mapping Task Support

Add Task creation for invalid PV1.2 (Encounter.class) values.

- [ ] Create helper function in `pv1-encounter.ts` for patient class mapping with error support
- [ ] Return `{ class: Coding, status: Encounter["status"] }` on success
- [ ] Return `{ error: MappingError }` on failure for unknown values like "1"
- [ ] Update PV1 converter to collect patient class mapping errors
- [ ] Decide how to propagate errors from PV1 (different from ORU - needs converter refactor)
- [ ] Add mapping error collection to ADT message converters (if applicable)
- [ ] Write **unit tests** for patient class mapping pure function (valid/invalid class values)
- [ ] Write **integration test** for full message flow with invalid PV1.2:
  - Send message with PV1.2 = "1" → verify Task created with type `patient-class-mapping`
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 9: Add PID.11 Address Type Mapping Task Support

Add Task creation for invalid XAD.7 (Address.type) values.

- [ ] Create helper in `xad-address.ts` for address type mapping with error support
- [ ] Return `{ type?: Address["type"], use?: Address["use"] }` on success
- [ ] Return `{ error: MappingError }` on failure for unknown values like "P"
- [ ] Update `convertXADToAddress()` to collect address type mapping errors
- [ ] Propagate address errors through PID converter
- [ ] Write **unit tests** for address type mapping pure function (valid/invalid type values)
- [ ] Write **integration test** for full message flow with invalid XAD.7:
  - Send message with PID.11 address type = "P" → verify Task created with type `address-type-mapping`
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 10: Update Mapping Tasks UI for Multiple Types

Add type filtering to the mapping tasks page.

- [ ] Update `getMappingTasks()` to accept optional `taskCode` filter parameter
- [ ] Add filter tabs to UI: "All", "LOINC", "Address Type", "Patient Class", "Status"
- [ ] Update URL handling: `/mapping/tasks?type=loinc`, `/mapping/tasks?type=address-type`, etc.
- [ ] Display mapping type badge on each task in the list
- [ ] Show source/target field info in task details panel
- [ ] Update LOINC autocomplete to generic code autocomplete based on task type:
  - LOINC tasks: keep existing LOINC search
  - Other tasks: show allowed values from FHIR ValueSet (could be dropdown)
- [ ] Write **unit tests** for UI rendering functions with fixture Task data (pure rendering, no Aidbox)
- [ ] Write **integration test** for `getMappingTasks()` with type filtering (calls Aidbox)
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 11: Update API Resolution Endpoint for Multiple Types

Update the task resolution API to handle different mapping types.

- [ ] Update `/api/mapping/tasks/:id/resolve` to detect task type from Task resource
- [ ] For LOINC tasks: keep existing LOINC validation
- [ ] For status tasks: validate against FHIR ValueSet (DiagnosticReport.status, Observation.status)
- [ ] For address-type tasks: validate against FHIR address-type ValueSet
- [ ] For patient-class tasks: validate against FHIR encounter-class ValueSet
- [ ] Return appropriate error if resolved value is not valid for the target system
- [ ] Write **integration tests** for API endpoint with different mapping types:
  - Test LOINC task resolution (existing behavior)
  - Test OBR/OBX status task resolution with valid/invalid status codes
  - Test validation error response for invalid resolved values
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 12: Update Code Mappings Table UI

Update the ConceptMap table UI to support multiple mapping types.

- [ ] Update `/mapping/table` to show mappings from all ConceptMaps (not just LOINC)
- [ ] Add filter by mapping type (similar to tasks page)
- [ ] Update "Add mapping" form to select mapping type first
- [ ] Show target system column in the table
- [ ] Update entry edit/delete to work with type-specific ConceptMaps
- [ ] Write **unit tests** for UI rendering functions with fixture ConceptMap data (pure rendering)
- [ ] Write **integration tests** for ConceptMap fetching with type filtering and CRUD operations
- [ ] Run `bun test:all` and `bun run typecheck` - must pass before next task

---

## Task 13: Final Integration Verification

Run all integration tests and verify end-to-end flows work correctly.

Note: Most integration tests are now written in Tasks 5-12. This task focuses on:
1. Running the full test suite to verify no regressions
2. Testing any edge cases not covered by individual task tests

- [ ] Run full integration test suite: `bun test:integration`
- [ ] Verify backward compatibility: existing LOINC mapping flow still works unchanged
- [ ] Test edge case: resolving one Task when message has multiple unmapped codes of different types
- [ ] Test edge case: ConceptMap already has mapping for a code (no new Task created on reprocess)
- [ ] Run `bun test:all` - all must pass

---

## Task 14: Update Documentation

Update documentation to reflect the unified mapping system.

- [ ] Update `docs/developer-guide/code-mapping.md`:
  - Document all supported mapping types
  - Document how to add a new mapping type (registry, ConceptMap, Task, UI)
  - Document target code systems for each type
  - Document the extensibility pattern and fail-fast behavior
- [ ] Update `CLAUDE.md`:
  - Update code-mapping section with new types
  - Document mapping type registry location
- [ ] Add inline documentation to `mapping-types.ts` explaining the registry pattern

---

## Technical Details

### Mapping Type Registry Structure

```typescript
// src/code-mapping/mapping-types.ts

export const MAPPING_TYPES = {
  loinc: {
    taskCode: "loinc-mapping",
    taskDisplay: "Local code to LOINC mapping",
    targetSystem: "http://loinc.org",
    conceptMapSuffix: "-to-loinc",
    sourceField: "OBX-3",
    targetField: "Observation.code",
  },
  "address-type": {
    taskCode: "address-type-mapping",
    taskDisplay: "Address type mapping",
    targetSystem: "http://hl7.org/fhir/address-type",
    conceptMapSuffix: "-to-address-type",
    sourceField: "PID.11 (XAD.7)",
    targetField: "Address.type",
  },
  "patient-class": {
    taskCode: "patient-class-mapping",
    taskDisplay: "Patient class mapping",
    targetSystem: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    conceptMapSuffix: "-to-encounter-class",
    sourceField: "PV1.2",
    targetField: "Encounter.class",
  },
  "obr-status": {
    taskCode: "obr-status-mapping",
    taskDisplay: "OBR result status mapping",
    targetSystem: "http://hl7.org/fhir/diagnostic-report-status",
    conceptMapSuffix: "-to-diagnostic-report-status",
    sourceField: "OBR-25",
    targetField: "DiagnosticReport.status",
  },
  "obx-status": {
    taskCode: "obx-status-mapping",
    taskDisplay: "OBX observation status mapping",
    targetSystem: "http://hl7.org/fhir/observation-status",
    conceptMapSuffix: "-to-observation-status",
    sourceField: "OBX-11",
    targetField: "Observation.status",
  },
} as const;

export type MappingTypeName = keyof typeof MAPPING_TYPES;

export function getMappingType(taskCode: string): (typeof MAPPING_TYPES)[MappingTypeName] {
  const entry = Object.entries(MAPPING_TYPES).find(([, v]) => v.taskCode === taskCode);
  if (!entry) {
    throw new Error(`Unknown mapping task code: ${taskCode}. Add it to MAPPING_TYPES registry.`);
  }
  return entry[1];
}
```

### ConceptMap ID Generation

```typescript
// Updated generateConceptMapId in lookup.ts

export function generateConceptMapId(
  sender: SenderContext,
  mappingType: MappingTypeName = "loinc"
): string {
  const type = MAPPING_TYPES[mappingType];
  const app = toKebabCase(sender.sendingApplication);
  const facility = toKebabCase(sender.sendingFacility);
  return `hl7v2-${app}-${facility}${type.conceptMapSuffix}`;
}

// Examples:
// generateConceptMapId(sender, "loinc")        → "hl7v2-acme-lab-acme-hosp-to-loinc"
// generateConceptMapId(sender, "address-type") → "hl7v2-acme-lab-acme-hosp-to-address-type"
// generateConceptMapId(sender, "obr-status")   → "hl7v2-acme-lab-acme-hosp-to-diagnostic-report-status"
```

### Task Structure for Different Types

```typescript
// Task for address type mapping
{
  resourceType: "Task",
  id: "map-hl7v2-lab-hosp-to-address-type-v2-0190-P",
  status: "requested",
  intent: "order",
  code: {
    coding: [{
      system: "http://example.org/task-codes",
      code: "address-type-mapping",
      display: "Address type mapping"
    }],
    text: "Map HL7v2 address type to FHIR"
  },
  input: [
    { type: { text: "Sending application" }, valueString: "LAB" },
    { type: { text: "Sending facility" }, valueString: "HOSP" },
    { type: { text: "Local code" }, valueString: "P" },
    { type: { text: "Local display" }, valueString: "Permanent" },
    { type: { text: "Local system" }, valueString: "http://terminology.hl7.org/CodeSystem/v2-0190" },
    { type: { text: "Source field" }, valueString: "PID.11 (XAD.7)" },
    { type: { text: "Target field" }, valueString: "Address.type" },
  ]
}
```

### Mapping Error Flow

```typescript
// Generic mapping error interface
interface MappingError {
  localCode: string;
  localDisplay?: string;
  localSystem?: string;
  mappingType: MappingTypeName;
}

// Status mapping with error support
function mapOBRStatusToFHIRWithError(
  status: string | undefined
): { status: DiagnosticReport["status"] } | { error: MappingError } {
  if (status === undefined || !(status.toUpperCase() in OBR25_STATUS_MAP)) {
    return {
      error: {
        localCode: status || "undefined",
        localDisplay: `OBR-25 status: ${status}`,
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0123",
        mappingType: "obr-status",
      }
    };
  }
  return { status: OBR25_STATUS_MAP[status.toUpperCase()]! };
}
```

## Edge Cases and Error Handling

### Multiple Mapping Errors in Same Message

- A single message may have multiple mapping errors of different types (e.g., LOINC + OBR status)
- All errors should be collected and returned together
- Each error creates its own Task with appropriate type
- Message status is `mapping_error` if any errors exist
- Resolving one Task doesn't clear the message until all Tasks resolved

### ConceptMap Conflicts

- Different senders may have same local code with different meanings
- ConceptMap is always scoped to sender (sendingApplication + sendingFacility)
- ConceptMap ID includes mapping type to prevent cross-type conflicts

### Invalid Resolved Values

- API must validate resolved value against target ValueSet
- For status mappings: only accept valid FHIR status codes
- For address-type: only accept valid Address.type values
- Return 400 error with helpful message if validation fails

### Unknown Mapping Type

- If Task.code doesn't match any known type, throw error in resolution
- Fail-fast pattern: better to fail clearly than silently use wrong target system

### Backward Compatibility

- Existing LOINC tasks (code="local-to-loinc-mapping") must continue to work
- Add "local-to-loinc-mapping" as alias for "loinc-mapping" in registry lookup
- Existing ConceptMaps and resolution flow unchanged for LOINC

## Post-Completion Verification

1. **Manual test: OBR status error**
   - Send ORU message with OBR-25 = "Y" (invalid)
   - Verify Task created at /mapping/tasks with type "OBR Status"
   - Resolve task by selecting "final" status
   - Verify message processes successfully on second attempt

2. **Manual test: Multiple error types**
   - Send ORU message with unknown LOINC code AND invalid OBX-11 status
   - Verify two Tasks created (one LOINC, one OBX status)
   - Resolve LOINC task first, verify message still blocked
   - Resolve status task, verify message processes

3. **Manual test: UI filters**
   - Navigate to /mapping/tasks
   - Verify filter tabs work: All, LOINC, Address Type, Patient Class, Status
   - Verify correct tasks appear under each filter

4. **Manual test: ConceptMap table**
   - Navigate to /mapping/table
   - Verify mappings from different types are shown
   - Verify filtering by type works
   - Verify add/edit/delete works for non-LOINC mappings

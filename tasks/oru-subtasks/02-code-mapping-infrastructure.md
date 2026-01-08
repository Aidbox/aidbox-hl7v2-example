# Code Mapping Infrastructure

This document covers the code mapping workflow for handling unknown laboratory codes in ORU_R01 messages, including custom ConceptMap mappings and the LabCodeMappingTask resource.

## Overview

When ORU_R01 messages contain OBX segments with local codes that cannot be resolved to LOINC, the system creates mapping tasks and blocks processing until the codes are mapped.

---

## Use Case: Failed Mapping (Unmapped Codes)

**Scenario:** An ORU_R01 message contains OBX segments with local codes that:
- Do not have a LOINC code in the alternate coding fields, AND
- Have not been mapped in the ConceptMap for this sender

**Flow:**
1. MLLP server receives message → creates `IncomingHL7v2Message` with `status=received`
2. Processor service picks up the message
3. During code resolution, one or more OBX codes cannot be resolved:
   - Local code found, but no LOINC in alternate fields
   - ConceptMap lookup returns no match for this sender + local code
4. Processing stops with `mapping_error` status
5. For each unmapped code:
   - Create or update `LabCodeMappingTask` resource (one per unique sender + code combination)
   - Link the task to the affected message
6. Update `IncomingHL7v2Message` to `status=mapping_error`, store list of unmapped codes

**Resolution Path A: Via Mapping Tasks Queue**
1. User views "Mapping Tasks Queue" showing pending unmapped codes
2. User clicks on a task to open the mapping form
3. User searches for and selects the correct LOINC code
4. System creates ConceptMap entry for this sender + local code
5. System marks the LabCodeMappingTask as resolved
6. System queries `GET /IncomingHL7v2Message?status=mapping_error&unmappedCodes.mappingTaskId={taskId}` to find affected messages
7. For each affected message:
   - Remove the resolved task's entry from `unmappedCodes[]`
   - If `unmappedCodes[]` is now empty → change status to `received` for reprocessing
   - If still has entries → message stays in `mapping_error` status

**Resolution Path B: Via ConceptMap Table**
1. User navigates to "Code Mappings" page
2. User adds a new mapping entry (sender + local code → LOINC)
3. System creates ConceptMap entry
4. System queries `LabCodeMappingTask` where sender + localCode matches → marks as resolved
5. For each resolved task, system finds affected messages and processes them as in Path A steps 6-7

**Key Insight:** One new mapping may resolve multiple messages, but some messages may require multiple mappings before they can be reprocessed.

---

## Data Model

### LabCodeMappingTask (Custom Resource)

```typescript
interface LabCodeMappingTask {
  resourceType: "LabCodeMappingTask";
  id: string;                          // {senderId}-{localCode-hash}
  status: "pending" | "resolved";

  // Sender identification (from MSH)
  sendingApplication: string;          // MSH-3
  sendingFacility: string;             // MSH-4

  // Unmapped code details (from OBX-3)
  localCode: string;                   // OBX-3.1
  localDisplay: string;                // OBX-3.2
  localSystem: string;                 // OBX-3.3

  // Sample context for mapping assistance
  sampleValue: string;                 // Example OBX-5 value
  sampleUnits: string;                 // Example OBX-6 units
  sampleReferenceRange: string;        // Example OBX-7

  // Resolution
  resolvedLoincCode?: string;          // Target LOINC code when resolved
  resolvedLoincDisplay?: string;       // Target LOINC display
  resolvedAt?: string;                 // DateTime of resolution
  resolvedBy?: string;                 // User who resolved

  // Tracking
  affectedMessageCount: number;        // Count of messages waiting on this mapping
  firstEncountered: string;            // DateTime first seen
  lastEncountered: string;             // DateTime last seen
}
```

### SenderConceptMap (Standard FHIR ConceptMap)

```typescript
// One ConceptMap per sender, containing all local→LOINC mappings
interface SenderConceptMap {
  resourceType: "ConceptMap";
  id: string;                          // sender-{sendingApplication}-{sendingFacility}
  name: string;                        // "Lab Code Mappings for {sender}"
  status: "active";
  sourceUri: string;                   // Sender's code system URI
  targetUri: "http://loinc.org";
  group: [{
    source: string;                    // Sender's code system
    target: "http://loinc.org";
    element: [{
      code: string;                    // Local code (OBX-3.1)
      display: string;                 // Local display (OBX-3.2)
      target: [{
        code: string;                  // LOINC code
        display: string;               // LOINC display
        equivalence: "equivalent";
      }]
    }]
  }]
}
```

### IncomingHL7v2Message Extensions

```typescript
interface IncomingHL7v2Message {
  // ... existing fields ...
  status: "received" | "processed" | "error" | "mapping_error";

  // Sender identification (extracted from MSH-3/MSH-4 during MLLP storage, before conversion)
  sendingApplication?: string;         // MSH-3
  sendingFacility?: string;            // MSH-4

  // For mapping_error status (each element is removed when the corresponding task is resolved):
  unmappedCodes?: Array<{
    // Cached for display in UI
    localCode: string;
    localDisplay: string;
    localSystem: string;

    // Aidbox reference to the mapping task
    mappingTask: {
      resourceType: "LabCodeMappingTask";
      id: string;
    };
  }>;
}
```

---

## File Structure

```
src/
├── v2-to-fhir/
│   └── code-mapping/
│       └── loinc-resolver.ts          # Code resolution logic (imports from code-mapping services)
├── code-mapping/                      # Standalone module for mapping management (UI-facing)
│   ├── concept-map-service.ts         # ConceptMap CRUD operations
│   └── mapping-task-service.ts        # LabCodeMappingTask management
```

---

## Code Mapping Resolution Algorithm

```typescript
interface CodeResolutionResult {
  resolved: boolean;
  loincCode?: string;
  loincDisplay?: string;
  source: "inline" | "conceptmap" | "unresolved";
}

async function resolveObservationCode(
  obx3: CWE,
  sendingApp: string,
  sendingFacility: string
): Promise<CodeResolutionResult> {
  // 1. Check if LOINC provided inline in alternate coding
  if (obx3.$4_alternateIdentifier && isLoincSystem(obx3.$6_alternateSystem)) {
    return {
      resolved: true,
      loincCode: obx3.$4_alternateIdentifier,
      loincDisplay: obx3.$5_alternateText,
      source: "inline"
    };
  }

  // 2. Lookup in sender-specific ConceptMap
  const conceptMapId = `sender-${toKebabCase(sendingApp)}-${toKebabCase(sendingFacility)}`;
  const mapping = await lookupConceptMap(conceptMapId, obx3.$1_identifier);

  if (mapping) {
    return {
      resolved: true,
      loincCode: mapping.code,
      loincDisplay: mapping.display,
      source: "conceptmap"
    };
  }

  // 3. Unresolved
  return { resolved: false, source: "unresolved" };
}
```

---

## Solution Requirements

### Functional Requirements

1. **Code Mapping**
   - Support LOINC codes provided in OBX alternate coding fields
   - Support custom sender-specific mappings via ConceptMap
   - Block processing when unmapped codes are encountered
   - Track unmapped codes as discrete tasks (deduplicated by sender + code)
   - Reset message status to `received` when all unmapped codes are resolved, allowing natural reprocessing by the polling service
   - Use deterministic IDs for LabCodeMappingTask (`{senderId}-{hash(localCode)}`) with PUT (upsert) to prevent race conditions when multiple workers process messages with the same unmapped code

### Non-Functional Requirements

1. **Idempotency:** Processing the same message twice produces identical results
2. **Traceability:** All resources tagged with source message ID

---

## Implementation Tasks

### Phase 2: Code Mapping Infrastructure

- [ ] **2.1** Write tests for code mapping (TDD - write tests first)
  - **Unit tests:**
    - LOINC inline extraction from OBX-3.4-6
    - ConceptMap lookup logic
    - Task deduplication (deterministic ID generation)
    - Message status transition rules
  - **Integration tests:**
    - Full flow: unmapped code → task creation → resolution → message status change
    - Multiple messages blocked by same code
    - Message with multiple unmapped codes (partial resolution)
  - **Edge cases:**
    - Race condition: two messages with same unmapped code processed simultaneously
    - Resolution while new message with same code arrives
    - ConceptMap entry added before any task exists

- [ ] **2.2** Create LabCodeMappingTask StructureDefinition
  - Add StructureDefinition to `init-bundle.json` (for Aidbox to accept the resource type)
  - Manually create `src/fhir/aidbox-hl7v2-custom/LabCodeMappingTask.ts` with TypeScript interface
  - Run `bun src/migrate.ts` to apply the StructureDefinition

- [ ] **2.3** Implement code resolution service: `loinc-resolver.ts`
  - Check inline LOINC in OBX-3 alternate fields
  - Lookup in sender-specific ConceptMap
  - Return resolution result with source

- [ ] **2.4** Implement ConceptMap service: `concept-map-service.ts`
  - Get or create ConceptMap for sender
  - Add/update/delete entries
  - Search entries by local code, loinc or sender

- [ ] **2.5** Implement mapping task service: `mapping-task-service.ts`
  - Create task for unmapped code using deterministic ID (`{senderId}-{hash(localCode)}`) with PUT (upsert)
  - Update affected message count
  - Mark task as resolved
  - Find affected messages and update their status

- [ ] **2.6** Update IncomingHL7v2Message processing
  - Add `mapping_error` status handling
  - Store unmapped codes list with task references
  - When mapping resolved: remove entry from `unmappedCodes[]`, if empty change status to `received`
  - Add the sender fields (sendingApplication and sendingFacility) to the IncomingHL7v2Message if they're empty (no matter if the parsing was successful or not)

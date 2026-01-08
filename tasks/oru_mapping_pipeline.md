# ORU_R01 Message Conversion Implementation

## Overview

This document describes the implementation of ORU_R01 (Unsolicited Observation Result) message parsing from HL7v2 to FHIR, with a custom code mapping workflow for handling unknown laboratory codes.

ORU_R01 messages contain laboratory results and must be converted to FHIR DiagnosticReport and Observation resources. Unlike ADT messages, lab results require code mapping from sender-specific local codes to standard LOINC codes.

---

## Use Cases

### 1. Successful Mapping (Happy Path)

**Scenario:** An ORU_R01 message arrives with lab results where all OBX observation codes either:
- Already contain a valid LOINC code in the alternate coding fields (OBX-3.4 through OBX-3.6), or
- Have been previously mapped in the ConceptMap for this sender

**Flow:**
1. MLLP server receives ORU_R01 message → creates `IncomingHL7v2Message` with `status=received`
2. Processor service picks up the message
3. For each OBX segment:
   - Extract local code from OBX-3.1-3 (identifier, text, system)
   - Check if LOINC code exists in OBX-3.4-6 (alternate identifier, text, system)
   - If no LOINC, lookup in sender-specific ConceptMap
   - All codes resolve → continue processing
4. Convert to FHIR Bundle:
   - PID → Patient (lookup or create)
   - PV1 → Encounter (lookup existing visit, do NOT create)
   - OBR → DiagnosticReport
   - OBX → Observation (linked to DiagnosticReport)
   - NTE → Annotation (attached to Observation or DiagnosticReport)
5. Submit transaction bundle to Aidbox
6. Update `IncomingHL7v2Message` to `status=processed`

**Expected Outcome:** Lab results appear in patient's record as DiagnosticReport with linked Observations.

### 2. Failed Mapping (Unmapped Codes)

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

**Resolution Path 2a: Via Mapping Tasks Queue**
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

**Resolution Path 2b: Via ConceptMap Table**
1. User navigates to "Code Mappings" page
2. User adds a new mapping entry (sender + local code → LOINC)
3. System creates ConceptMap entry
4. System queries `LabCodeMappingTask` where sender + localCode matches → marks as resolved
5. For each resolved task, system finds affected messages and processes them as in 2a steps 6-7

**Key Insight:** One new mapping may resolve multiple messages, but some messages may require multiple mappings before they can be reprocessed.

### 3. Editing Custom Mappings

**Scenario:** An administrator needs to:
- View existing code mappings for a specific sender
- Add a new mapping for an unmapped code
- Edit an incorrect mapping
- Delete an obsolete mapping

**Flow for Adding Mapping (from Mapping Tasks Queue):**
1. User views "Mapping Tasks Queue" showing unmapped codes
2. User clicks on a task to open the mapping form
3. Form displays:
   - Sender information (from MSH-3/MSH-4)
   - Local code (OBX-3.1), local text (OBX-3.2), local system (OBX-3.3)
   - Sample value and units from a message containing this code
4. User searches for target LOINC code using terminology lookup:
   - Search by code, display name, or synonyms using text-based search (e.g., `GET /Concept?system=http://loinc.org&display:contains=potassium` or `GET /fhir/ValueSet/$expand?url=http://loinc.org&filter=potassium`)
   - Use `$lookup` on CodeSystem for validation after selection (e.g., `GET /CodeSystem/$lookup?system=http://loinc.org&code=2823-3`) to confirm the code exists and retrieve canonical display name
5. User selects correct LOINC code
6. System creates/updates ConceptMap entry:
   - Source: `{sender-system}|{local-code}`
   - Target: `http://loinc.org|{loinc-code}`
7. Mapping task is marked resolved
8. Affected messages are checked for reprocessing eligibility

**Flow for Managing Mappings (from Mappings Page):**
1. User navigates to "Code Mappings" page
2. User filters by sender (required - each mapping is sender-specific)
3. Table displays all mappings for that sender:
   - Local code, local display, LOINC code, LOINC display, created date
4. User can:
   - **Create:** Add new mapping via form (triggers task/message resolution - see Resolution Path 2b above)
   - **Edit:** Modify target LOINC code
   - **Delete:** Remove mapping (with confirmation; does not affect already-processed messages)


---

## Solution Requirements

### Functional Requirements

1. **Message Processing**
   - Parse ORU_R01 messages following HL7v2 structure
   - Extract patient identifier and lookup existing Patient resource (fail if not found)
   - Lookup existing Encounter (do NOT create new visits for lab results, fail if not found)
   - Convert OBR segments to DiagnosticReport resources
   - Convert OBX segments to Observation resources with proper value types
   - Handle NTE segments as annotations

2. **Code Mapping**
   - Support LOINC codes provided in OBX alternate coding fields
   - Support custom sender-specific mappings via ConceptMap
   - Block processing when unmapped codes are encountered
   - Track unmapped codes as discrete tasks (deduplicated by sender + code)
   - Reset message status to `received` when all unmapped codes are resolved, allowing natural reprocessing by the polling service
   - Use deterministic IDs for LabCodeMappingTask (`{senderId}-{hash(localCode)}`) with PUT (upsert) to prevent race conditions when multiple workers process messages with the same unmapped code

3. **Mapping Task Queue UI**
   - Display count of pending mapping tasks as badge
   - List mapping tasks with sender info, local code, sample context
   - Provide LOINC search/lookup within mapping form
   - Show affected message count per task

4. **Mappings Management UI**
   - Filter mappings by sender
   - CRUD operations for ConceptMap entries
   - Validation of LOINC codes via terminology service

### Non-Functional Requirements

1. **Idempotency:** Processing the same message twice produces identical results
2. **Traceability:** All resources tagged with source message ID
3. **Documentation:** The solution should be documented in spec folder before the implementation 

---

## Data Model

### FHIR Resources Created by ORU_R01 Processing

```
DiagnosticReport
├── id: {messageControlId}-{obrSetId}
├── status: from OBR-25 (mapped to FHIR status)
├── code: from OBR-4 (Universal Service Identifier)
├── subject: Reference(Patient)
├── encounter: Reference(Encounter) - looked up, not created
├── effectiveDateTime: from OBR-7 (Observation Date/Time)
├── issued: from OBR-22 (Results Report/Status Change)
├── performer: from OBR-16 (Ordering Provider)
├── result: [Reference(Observation), ...]
└── meta.tag: [{system: "urn:aidbox:hl7v2:message-id", code: "{messageControlId}"}]

Observation
├── id: {diagnosticReportId}-obx-{setId}
├── status: from OBX-11 (Observation Result Status)
├── code: CodeableConcept with LOINC (resolved via mapping)
├── subject: Reference(Patient)
├── encounter: Reference(Encounter)
├── effectiveDateTime: from OBX-14 (Date/Time of Observation)
├── valueQuantity | valueString | valueCodeableConcept: from OBX-5 based on OBX-2
├── interpretation: from OBX-8 (Abnormal Flags)
├── referenceRange: from OBX-7 (Reference Range)
├── performer: from OBX-16 (Responsible Observer)
└── note: from associated NTE segments
```

### Custom Resources for Mapping Workflow

**LabCodeMappingTask** (new StructureDefinition)
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

**ConceptMap Entry Structure** (standard FHIR ConceptMap)
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

Add to existing resource for ORU messages:
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

## Technical Specification

### File Structure

```
src/
├── v2-to-fhir/
│   ├── messages/
│   │   └── oru-r01.ts                 # ORU_R01 message converter
│   ├── segments/
│   │   ├── obr-diagnosticreport.ts    # OBR → DiagnosticReport
│   │   ├── obx-observation.ts         # OBX → Observation
│   │   └── nte-annotation.ts          # NTE → Annotation
│   ├── code-mapping/
│   │   └── loinc-resolver.ts          # Code resolution logic (imports from code-mapping services)
│   └── converter.ts                   # Add ORU_R01 case to router
├── code-mapping/                      # Standalone module for mapping management (UI-facing)
│   ├── concept-map-service.ts         # ConceptMap CRUD operations
│   └── mapping-task-service.ts        # LabCodeMappingTask management
├── ui/
│   ├── mapping-tasks-queue.ts         # Mapping tasks queue UI
│   └── code-mappings.ts               # ConceptMap management UI
└── index.ts                           # Add new routes
```

### Code Mapping Resolution Algorithm

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

### OBX Value Type Mapping

| OBX-2 (Value Type) | FHIR Observation.value[x] | Notes |
|--------------------|---------------------------|-------|
| NM | valueQuantity | Numeric with OBX-6 units |
| ST | valueString | String/text |
| TX | valueString | Text data |
| CE | valueCodeableConcept | Coded entry |
| CWE | valueCodeableConcept | Coded with exceptions |
| SN | valueQuantity or valueRange or valueRatio or valueString | Structured numeric (see below) |
| DT | valueDateTime | Date |
| TM | valueTime | Time |
| TS | valueDateTime | Timestamp |

**SN (Structured Numeric) Parsing Logic:**
- SN format: `<comparator>^<num1>^<separator>^<num2>` (e.g., ">^90", "<^5", "^10^-^20", "^1^:^500")
- **Comparator + number** (e.g., ">^90"): Use `valueQuantity` with `comparator` field set to `>`, `<`, `>=`, `<=`
- **Range** (e.g., "^10^-^20"): Use `valueRange` with `low` and `high` Quantity values
- **Ratio** (e.g., "^1^:^500"): Use `valueRatio` with `numerator` and `denominator` Quantity values
- **Plain number** (e.g., "^90"): Use `valueQuantity`
- **Fallback**: If pattern cannot be parsed, use `valueString` with raw value 

### API Endpoints

```typescript
// Existing (add ORU support)
POST /process-incoming-messages        // Process received messages (add ORU_R01 handling)

// New UI pages
GET  /mapping/task-queue              // Mapping tasks queue page
GET  /mapping/table                   // Code mappings management page

// API endpoints for UI (custom endpoints for full control over response format and multi-step operations)
GET  /api/mapping/tasks                // List pending LabCodeMappingTask
GET  /api/mapping/tasks/:id            // Get single task with message examples
POST /api/mapping/tasks/:id/resolve    // Resolve task with LOINC code and trigger the stuck messages update

GET  /api/concept-maps                 // List ConceptMaps (filter by sender)
GET  /api/concept-maps/:id/entries     // List entries in a ConceptMap
POST /api/concept-maps/:id/entries     // Add entry to ConceptMap and trigger the stuck messages update
PUT  /api/concept-maps/:id/entries/:code  // Update entry
DELETE /api/concept-maps/:id/entries/:code  // Delete entry

GET  /api/terminology/loinc                 // Search LOINC codes (terminology service)
GET  /api/terminology/loinc/:code           // Lookup specific LOINC code
```

---

## Implementation Tasks

### Phase 0: Documentation

Before implementation, create/update spec documents in the `spec/` folder:

- [ ] **0.1** Review existing docs in `spec/` folder to understand documentation structure
- [ ] **0.2** Create `spec/oru-r01-processing.md` - ORU_R01 message parsing and FHIR conversion
- [ ] **0.3** Create `spec/code-mapping-workflow.md` - Code mapping workflow and resolution flows
- [ ] **0.4** Create `spec/lab-code-mapping-task.md` - LabCodeMappingTask resource definition
- [ ] **0.5** Update `spec/incoming-hl7v2-message.md` - Add sendingApplication, sendingFacility, unmappedCodes fields

### Phase 1: Core ORU_R01 Processing (No Custom Mapping)

- [ ] **1.0** Add sendingApplication and sendingFacility fields to IncomingHL7v2Message
  - Update StructureDefinition in init-bundle.json
  - Update TypeScript interface in `src/fhir/aidbox-hl7v2-custom/`

- [ ] **1.1** Write tests for ORU_R01 processing (TDD - write tests first)
  - **Unit tests:**
    - OBR → DiagnosticReport field mapping
    - OBX → Observation for each value type (NM, ST, TX, CE, CWE, SN)
    - Reference range parsing (simple "3.5-5.5", comparator ">60", text "negative")
    - Abnormal flag mapping (version-aware: simple string for v2.6-, CWE for v2.7+)
  - **Integration tests:**
    - Full ORU_R01 message → FHIR Bundle conversion
    - Sample messages from spec (v2.3 and v2.5.1 examples)
  - **Edge cases:**
    - Missing optional fields
    - Multiple OBR groups
    - NTE attachment to correct parent
    - Invalid/malformed values
  - **Error handling:**
    - Missing required fields
    - Patient not found
    - Encounter not found

- [ ] **1.2** Create segment converter: `obr-diagnosticreport.ts`
  - Extract OBR fields to DiagnosticReport
  - Map OBR-25 status to FHIR DiagnosticReport.status
  - Generate deterministic ID: `{messageControlId}-{obrSetId}`

- [ ] **1.3** Create segment converter: `obx-observation.ts`
  - Extract OBX fields to Observation
  - Map OBX-11 status to FHIR Observation.status
  - Handle all OBX-2 value types (NM, ST, TX, CE, CWE, SN, etc.)
  - Parse OBX-7 reference range into Observation.referenceRange
  - Handle OBX-8 interpretation codes with version awareness:
    - Check MSH-12 for HL7 version
    - For v2.6 and earlier: parse as simple code string (H, L, A, N, etc.)
    - For v2.7+: parse as CWE, extract code from OBX-8.1 and system from OBX-8.3
    - Fallback to simple string parsing if CWE parsing fails
  - Generate deterministic ID: `{diagnosticReportId}-obx-{setId}`

- [ ] **1.4** Create segment converter: `nte-annotation.ts`
  - Convert NTE segments to Annotation
  - Attach to parent Observation or DiagnosticReport

- [ ] **1.5** Create message converter: `oru-r01.ts`
  - Parse full ORU_R01 message structure
  - Lookup existing Patient by PID-3 (do NOT create)
  - Lookup existing Encounter by PV1-19 or account number (do NOT create)
  - Assemble DiagnosticReport with linked Observations
  - Return FHIR transaction Bundle

- [ ] **1.6** Integrate into converter router
  - Add `ORU_R01` case to `src/v2-to-fhir/converter.ts`

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
  
### Phase 3: Mapping Tasks Queue UI

- [ ] **3.1** Create mapping tasks queue page
  - List tasks with: sender, local code, local display, affected messages count, first seen
  - Sort by affected message count (highest first)
  - Click to open task detail

- [ ] **3.2** Create mapping task detail/form
  - Display full task context (local code, sample value, units, reference range)
  - LOINC search field with autocomplete
  - Preview of LOINC code details (from $lookup)
  - Submit button to resolve mapping

- [ ] **3.3** Implement LOINC search endpoint
  - Use Aidbox terminology service for text search
  - Use $lookup for validation after selection
  - Return code, display, and component details

- [ ] **3.4** Add navigation badge
  - Query pending task count on page load
  - Render badge count server-side in navigation HTML
  - Badge updates naturally on page navigation/reload

### Phase 4: Code Mappings Management UI

- [ ] **4.1** Create code mappings page
  - Sender filter dropdown (required)
  - Table with: local code, local display, LOINC code, LOINC display, actions
  - Pagination

- [ ] **4.2** Implement create mapping form
  - Input local code and display
  - LOINC search and select
  - Create ConceptMap entry

- [ ] **4.3** Implement edit mapping modal
  - Pre-fill current values
  - Allow changing target LOINC code
  - Save updates to ConceptMap

- [ ] **4.4** Implement delete mapping
  - Confirmation dialog
  - Remove entry from ConceptMap
  - Note: Does not affect already-processed messages

---

## Notes

---

## Appendix: OBX Field Reference

| Field | Name | Usage |
|-------|------|-------|
| OBX-1 | Set ID | Sequence number within OBR group |
| OBX-2 | Value Type | Determines how to interpret OBX-5 |
| OBX-3 | Observation Identifier | Local code (1-3) + LOINC (4-6) |
| OBX-4 | Observation Sub-ID | Used for multi-part results |
| OBX-5 | Observation Value | The actual result value |
| OBX-6 | Units | UCUM or local unit code |
| OBX-7 | Reference Range | Normal range (e.g., "3.5-5.5") |
| OBX-8 | Abnormal Flags | H=High, L=Low, A=Abnormal, etc. |
| OBX-11 | Observation Result Status | F=Final, P=Preliminary, C=Corrected |
| OBX-14 | Date/Time of Observation | When observation was made |
| OBX-16 | Responsible Observer | Person/entity that performed test |

## Appendix: OBR Field Reference

| Field | Name | Usage |
|-------|------|-------|
| OBR-1 | Set ID | Sequence number for multiple OBR |
| OBR-2 | Placer Order Number | Ordering system's order ID |
| OBR-3 | Filler Order Number | Lab's order ID |
| OBR-4 | Universal Service ID | Test/panel code |
| OBR-7 | Observation Date/Time | When specimen collected |
| OBR-16 | Ordering Provider | Physician who ordered test |
| OBR-22 | Results Rpt/Status Chng | When results reported |
| OBR-25 | Result Status | F=Final, P=Preliminary, etc. |

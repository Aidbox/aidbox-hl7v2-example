# Code Mapping User Interface

This document covers the user interface components for managing code mappings: the Mapping Tasks Queue and the Code Mappings Management page.

## Overview

Two UI components enable administrators to manage code mappings:
1. **Mapping Tasks Queue** - Shows pending unmapped codes that need resolution
2. **Code Mappings Page** - CRUD interface for managing ConceptMap entries

---

## Use Case: Editing Custom Mappings

**Scenario:** An administrator needs to:
- View existing code mappings for a specific sender
- Add a new mapping for an unmapped code
- Edit an incorrect mapping
- Delete an obsolete mapping

### Flow for Adding Mapping (from Mapping Tasks Queue)

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

### Flow for Managing Mappings (from Mappings Page)

1. User navigates to "Code Mappings" page
2. User filters by sender (required - each mapping is sender-specific)
3. Table displays all mappings for that sender:
   - Local code, local display, LOINC code, LOINC display, created date
4. User can:
   - **Create:** Add new mapping via form (triggers task/message resolution)
   - **Edit:** Modify target LOINC code
   - **Delete:** Remove mapping (with confirmation; does not affect already-processed messages)

---

## File Structure

```
src/
├── ui/
│   ├── mapping-tasks-queue.ts         # Mapping tasks queue UI
│   └── code-mappings.ts               # ConceptMap management UI
```

---

## API Endpoints

```typescript
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

## Solution Requirements

### Functional Requirements

1. **Mapping Task Queue UI**
   - Display count of pending mapping tasks as badge
   - List mapping tasks with sender info, local code, sample context
   - Provide LOINC search/lookup within mapping form
   - Show affected message count per task

2. **Mappings Management UI**
   - Filter mappings by sender
   - CRUD operations for ConceptMap entries
   - Validation of LOINC codes via terminology service

---

## Implementation Tasks

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

# Code Mapping User Interface

This document covers the user interface components for managing code mappings: the Mapping Tasks Queue and the Code Mappings Management page.

## Overview

Two UI components enable administrators to manage code mappings:
1. **Mapping Tasks Queue** (`/mapping/tasks`) - Shows pending and resolved mapping tasks
2. **Code Mappings Page** (`/mapping/table`) - CRUD interface for managing ConceptMap entries

Both pages follow the existing UI pattern from the Incoming Messages page: collapsible `<details>` panels where each item (task or mapping) is a panel that expands to show forms and details.

---

## Navigation

- Two separate top-level nav items: "Mapping Tasks" and "Code Mappings"
- "Mapping Tasks" nav item displays a numeric badge (circular, colored) showing pending task count
- Badge count updates on page load only (no real-time polling or WebSocket updates)

---

## Use Case: Editing Custom Mappings

**Scenario:** An administrator needs to:
- View existing code mappings for a specific sender
- Add a new mapping for an unmapped code
- Edit an incorrect mapping
- Delete an obsolete mapping

### Flow for Adding Mapping (from Mapping Tasks Queue)

1. User views "Mapping Tasks Queue" showing unmapped codes as collapsible panels
2. User expands a task panel to open the mapping form
3. Form displays (read-only context):
   - Sender information: "App | Facility" format (e.g., "ACME_LAB | ACME_HOSP", from MSH-3/MSH-4)
   - Local code (OBX-3.1), local text (OBX-3.2), local system (OBX-3.3)
   - Sample value, units, and reference range from Task.input
4. User searches for target LOINC code using terminology lookup:
   - Debounced search (300-500ms) triggers on keystroke
   - Search by code, display name, or synonyms using text-based search (e.g., `GET /Concept?system=http://loinc.org&display:contains=potassium` or `GET /fhir/ValueSet/$expand?url=http://loinc.org&filter=potassium`)
   - Dropdown shows up to 10 results with full details (code, display, component, property, timing, scale)
5. User selects LOINC code from dropdown
6. System validates via `/api/terminology/loinc/:code` before allowing submission
  - Validation endpoint confirms the code exists and retrieves canonical display name
7. User clicks "Save Mapping"
8. System creates atomic transaction:
   - Updates Task status to "completed" with output containing resolved LOINC
   - Creates/updates ConceptMap entry
     - Source: `{sender-system}|{local-code}`
     - Target: `http://loinc.org|{loinc-code}`
9. Panel auto-collapses, task moves to History tab
10. Affected messages have `unmappedCodes[]` entries removed; if empty, status changes to `received` (batched reprocessing - processor service picks them up)

### Flow for Managing Mappings (from Mappings Page)

1. User navigates to "Code Mappings" page
2. User filters by sender (required - each mapping is sender-specific)
3. List displays collapsible panels per mapping (all mappings for that sender):
   - Local code, local display → LOINC code, LOINC display, created date
4. User can:
   - **Create:** Click "Add Mapping" button, fill form: local code details, search and select LOINC (triggers task/message resolution)
   - **Edit:** Expand panel, modify local code or target LOINC, save changes
   - **Delete:** Remove mapping (with confirmation; does not affect already-processed messages)

---

## Mapping Tasks Queue Page

### URL Structure

- `/mapping/tasks` - Default view (pending tasks)
- `/mapping/tasks?status=requested` - Pending tasks tab
- `/mapping/tasks?status=completed` - History tab (resolved tasks)

Tabs are URL-based (server-rendered), not client-side JavaScript tabs.

### Pending Tasks Tab (`status=requested`)

**Layout:**
- Tab bar: "Pending" | "History"
- List of collapsible panels, one per task
- Fixed sort order: by affected message count (highest first) - no user-sortable columns
- Pagination: 50 items per page

**Panel Summary (Collapsed State):**
- Chevron icon (rotates on expand)
- Sender: "App | Facility" format (e.g., "ACME_LAB | ACME_HOSP")
- Local code and local display
- Status badge: "Pending" (yellow)
- Affected messages count badge (e.g., "12 messages")
- First seen date

**Panel Content (Expanded State):**

Read-only context section:
- Sender information (sending application, sending facility)
- Local code, local display, local system
- Sample value, sample units, sample reference range (from Task.input)

These context fields are informational only, not editable.

Resolution form:
- LOINC search input field with autocomplete dropdown
- Search triggers on debounced keystroke (300-500ms delay)
- Search matches both LOINC codes and display text (e.g., typing "2823" finds "2823-3 Potassium")
- Dropdown shows up to 10 results before scroll
- Each result shows full LOINC details: code, display, component, property, time aspect, scale
- User must select from search results (no manual code entry option)
- When user selects a code, system validates via `/api/terminology/loinc/:code` before allowing submission
- Validation errors shown as inline message below the search field
- "Save Mapping" button

**On Successful Resolution:**
1. System creates ConceptMap entry and marks Task as completed (atomic transaction via Aidbox bundle)
2. Panel auto-collapses
3. Task moves to History tab
4. Affected messages have their `unmappedCodes[]` entries removed; if empty, status changes to `received` for reprocessing (batched - processor service picks them up on next poll)
5. No toast/notification (consistent with existing UI patterns)

### History Tab (`status=completed`)

**Layout:**
- Same panel-based layout as Pending tab
- Shows all completed tasks (no time limit/retention policy)
- Read-only view - no edit actions available

**Panel Summary:**
- Sender, local code, local display
- Status badge: "Completed" (green)
- Resolved date

**Panel Content (Expanded):**
- Read-only display of task details
- Resolved LOINC code and display (from Task.output)
- No edit functionality - edits happen from Code Mappings page

---

## Code Mappings Page

### URL Structure

- `/mapping/table` - Shows all mappings
- `/mapping/table?conceptMapId=hl7v2-acme-lab-acme-hosp-to-loinc` - Filtered by ConceptMap ID

### Layout

- Page title: "Code Mappings"
- Sender filter dropdown (populated from existing ConceptMaps only)
- Initial state: show all mappings (filter narrows down results)
- "Add Mapping" button
- List of collapsible panels, one per mapping entry
- Pagination: 50 items per page

### Panel Summary (Collapsed State)

- Chevron icon
- Local code and local display
- Arrow icon (→)
- LOINC code and LOINC display

### Panel Content (Expanded State)

Edit form with all fields editable:
- Local code (text input)
- Local display (text input)
- Local system (text input)
- LOINC search field (same autocomplete behavior as task resolution)
- "Save Changes" button

**Duplicate Handling:**
If user tries to save a mapping where the sender + local system + local code combination already exists (as a different entry), show inline error: "Mapping already exists for this code".

**On Save:**
- Update existing ConceptMap element in place (even if local code changed)
- No retroactive changes to already-processed messages
- Panel collapses on success

### Add Mapping Form

Triggered by "Add Mapping" button. Form appears above the mappings list (same pattern as "Add Invoice" form on Invoices page).

**Prerequisite:** Sender filter must be selected (ConceptMap ID in URL). The "Add Mapping" button is disabled until a sender is selected.

Fields:
- Sender (read-only, from selected filter - displays "App | Facility" format)
- Local code (text input)
- Local display (text input)
- Local system (text input)
- LOINC search field with autocomplete

**On Submit:**
1. Validate LOINC code via `/api/terminology/loinc/:code`
2. Check for duplicate (sender + local system + local code)
3. Add entry to ConceptMap (ConceptMap already exists since filter was selected)
4. If a matching Task exists (same sender + local system + local code), mark it as completed
5. Update affected messages (same logic as task resolution)
6. Form hides on success

---

## File Structure

```
src/
├── ui/
│   ├── mapping-tasks-queue.ts         # Mapping tasks queue: UI + form handlers
│   ├── code-mappings.ts               # Code mappings page: UI + form handlers
│   └── terminology-api.ts             # LOINC search/lookup JSON API (for autocomplete)
```

---

## API Endpoints

### UI Pages (HTML)

```
GET  /mapping/tasks                    # Mapping tasks queue (default: pending)
GET  /mapping/tasks?status=requested   # Pending tasks tab
GET  /mapping/tasks?status=completed   # History tab
GET  /mapping/table                    # Code mappings page
GET  /mapping/table?conceptMapId={id}  # Filtered by ConceptMap ID
```

### Form Actions (HTML)

All form submissions use standard HTML forms with POST, redirecting back to the originating page on success.

```
POST /api/mapping/tasks/:id/resolve          # Resolve task with LOINC code
     # Form fields: loincCode, loincDisplay
     # Atomic transaction: Task update + ConceptMap entry
     # Redirects to /mapping/tasks on success

POST   /api/concept-maps/:id/entries         # Add entry to ConceptMap
     # Triggers stuck messages update
     # Redirects to /mapping/table?conceptMapId={id} on success

PUT    /api/concept-maps/:id/entries/:code   # Update entry

DELETE /api/concept-maps/:id/entries/:code   # Delete entry
```

### API Endpoints (JSON)

Terminology endpoints return JSON for autocomplete functionality.

```typescript
GET  /api/terminology/loinc?q={query}  // Search LOINC codes (by code or display text)
     // Returns: Array<{ code, display, component, property, timing, scale }>
     // Limit: 10 results
GET  /api/terminology/loinc/:code      // Lookup specific LOINC code for validation
     // Uses Aidbox $lookup operation
```

### Terminology Service Integration

LOINC search calls go through the app API layer (`/api/terminology/loinc`), which proxies to Aidbox:
- Search: `GET /fhir/ValueSet/$expand?url=http://loinc.org&filter={query}&count=10`
- Validation: `GET /fhir/CodeSystem/$lookup?system=http://loinc.org&code={code}`

**Error Handling:**
If Aidbox terminology service is unavailable:
1. Auto-retry 2-3 times
2. Show error message with "Retry" button below search field

---

## Solution Requirements

### Functional Requirements

1. **Mapping Task Queue UI**
   - Display count of pending mapping tasks as numeric badge on nav item
   - List mapping tasks as collapsible panels with sender info, local code, affected messages count
   - Provide LOINC search/lookup within expanded panel form
   - Show affected message count in panel summary (live query)
   - Separate URL-based tabs for Pending and History
   - Fixed sort by affected message count (highest first)
   - Pagination: 50 items per page

2. **Mappings Management UI**
   - Show all mappings initially; sender filter narrows results
   - Collapsible panels per mapping entry
   - Create new mappings via "Add Mapping" form (requires sender filter to be selected)
   - Edit local code and LOINC in expanded panel (sender is read-only)
   - Validation of LOINC codes via `/api/terminology/loinc/:code`

### Data Behavior

- **Reprocessing:** Batched - set message status to `received`, processor service picks them up
- **Edit behavior:** No retroactive changes to already-processed messages
- **Concurrency:** If-Match with ETag for Task and message updates
- **Local system storage:** Store as-is (exact value from OBX-3.3, no normalization)
- **Duplicate detection:** Block with inline error if sender + local system + local code exists

---

## Concurrency Control

- Task resolution uses If-Match with ETag when updating Task resource
- Message updates use If-Match with ETag when modifying `unmappedCodes[]`
- If concurrent modification detected, show error: "Task was modified by another user. Please refresh and try again."

---

## Implementation Tasks

### Phase 3: Mapping Tasks Queue UI

- [ ] **3.0** Write tests for Mapping Tasks Queue (TDD - write tests first)

  **Unit tests - Terminology API:**
  - LOINC search endpoint:
    - Search by code prefix (e.g., "2823") → returns matching LOINC codes
    - Search by display text (e.g., "potassium") → returns matching codes
    - Empty query → returns empty array
    - Results limited to 10 items
    - Response includes: code, display, component, property, timing, scale
  - LOINC validation endpoint:
    - Valid LOINC code → returns code details with canonical display
    - Invalid/unknown code → returns 404 error
    - Aidbox unavailable → retries up to 3 times, then returns error

  **Unit tests - Task resolution:**
  - Atomic transaction bundle:
    - Task status updated to "completed"
    - Task output contains resolved LOINC (code + display)
    - ConceptMap entry created/updated with mapping
  - ETag concurrency control:
    - Stale ETag → returns conflict error
    - Valid ETag → update succeeds

  **Integration tests - Task resolution flow:**
  - Happy path:
    - Resolve task → Task marked completed, ConceptMap entry created
    - Resolve task → affected messages have unmappedCodes entry removed
    - Resolve task when message has single unmapped code → message status changes to "received"
    - Resolve task when message has multiple unmapped codes → message stays in "mapping_error"
  - Form submission:
    - Valid submission → redirects to /mapping/tasks
    - Invalid LOINC code → shows inline error, no redirect
    - Concurrent modification → shows conflict error message

  **Edge cases:**
  - Task already completed → show error or redirect to history
  - ConceptMap entry already exists for this code → update existing entry
  - No affected messages (task exists but messages were deleted) → task still resolves

- [ ] **3.1** Create mapping tasks queue page with tabs
  - Implement `/mapping/tasks` route with URL-based tabs (status param)
  - Pending tab: list tasks with status=requested, sorted by affected message count
  - History tab: list tasks with status=completed
  - Collapsible panel pattern matching Incoming Messages page
  - Panel summary: sender (App | Facility), local code/display, status badge, affected count, date
  - Pagination: 50 items per page

- [ ] **3.2** Implement task resolution form (expanded panel content)
  - Read-only context section: sender info, local code details, sample value/units/range
  - LOINC search input with debounced autocomplete (300-500ms)
  - Dropdown showing 10 results with full LOINC details (code, display, component, property, timing, scale)
  - Search matches both code and display text
  - `/api/terminology/loinc/:code` validation before submission
  - Inline error display below search field
  - Save button triggers atomic resolution
  - Panel auto-collapses on success, task moves to History tab

- [ ] **3.3** Implement LOINC terminology API proxy
  - `GET /api/terminology/loinc?q={query}` - search endpoint
  - `GET /api/terminology/loinc/:code` - validation endpoint
  - Auto-retry (2-3 times) on Aidbox unavailability
  - Return structured results: code, display, component, property, timing, scale

- [ ] **3.4** Implement task resolution form handler
  - `POST /api/mapping/tasks/:id/resolve` - HTML form submission
  - Atomic transaction bundle: Task update + ConceptMap entry
  - ETag-based concurrency control
  - Update affected messages: remove from `unmappedCodes[]`, change status if empty
  - Redirect to `/mapping/tasks` on success

- [ ] **3.5** Add navigation badge
  - Query pending task count (`Task?status=requested&code=local-to-loinc-mapping`)
  - Render numeric badge (circular, colored) on "Mapping Tasks" nav item
  - Badge updates on page navigation/reload only

### Phase 4: Code Mappings Management UI

- [ ] **4.0** Write tests for Code Mappings Management (TDD - write tests first)

  **Unit tests - ConceptMap entry operations:**
  - Create entry:
    - Valid input → entry added to ConceptMap
    - Duplicate (sender + local system + local code) → returns error
  - Update entry:
    - Valid input → entry updated in place
    - Change local code to existing code → returns duplicate error
  - ConceptMap queries:
    - List all ConceptMaps → returns array with id and sender info
    - List entries by ConceptMap ID → returns all entries for that sender
    - Filter by conceptMapId query param → returns filtered results

  **Integration tests - Create mapping flow:**
  - Happy path:
    - Create mapping → ConceptMap entry added
    - Create mapping when matching Task exists → Task marked completed
    - Create mapping → affected messages updated (unmappedCodes removed)
  - Form submission:
    - Valid submission → redirects to /mapping/table?conceptMapId={id}
    - Duplicate code → shows inline error, no redirect
    - Invalid LOINC → shows validation error

  **Integration tests - Edit mapping flow:**
  - Happy path:
    - Edit mapping → ConceptMap entry updated
    - Edit local code → entry updated, no new entry created
  - Form submission:
    - Valid submission → redirects to /mapping/table?conceptMapId={id}
    - Change to duplicate code → shows inline error

  **Integration tests - Delete mapping flow:**
  - Happy path:
    - Delete mapping → ConceptMap entry removed
    - Delete mapping → does not affect already-processed messages
  - Confirmation:
    - Delete requires confirmation before execution
  - Error cases:
    - Delete non-existent entry → returns 404 error
    - Delete entry from non-existent ConceptMap → returns 404 error

  **Edge cases:**
  - Create mapping for code that has no pending Task → mapping created, no task update needed
  - Edit mapping that was created via Task resolution → edit succeeds
  - Sender filter not selected → "Add Mapping" button disabled
  - Delete last entry in ConceptMap → ConceptMap remains (empty but valid)

- [ ] **4.1** Create code mappings page
  - Implement `/mapping/table` route
  - Sender filter dropdown (populated from existing ConceptMaps only)
  - Show all mappings initially, filter narrows down
  - Collapsible panel per mapping entry
  - Panel summary: local code/display → LOINC code/display, sender (App | Facility)
  - Pagination: 50 items per page

- [ ] **4.2** Implement edit mapping form (expanded panel)
  - Editable fields: local code/display/system, LOINC (sender is read-only)
  - Same LOINC search autocomplete as task resolution
  - Duplicate detection on save (block with inline error)
  - Update ConceptMap element in place
  - Panel collapses on success

- [ ] **4.3** Implement create mapping form
  - "Add Mapping" button reveals form above list (disabled until sender filter selected)
  - Sender displayed as read-only (from selected ConceptMap filter)
  - Text inputs for local code, display, system
  - LOINC search with autocomplete
  - Duplicate detection on submit
  - Mark matching Task as completed if exists
  - Update affected messages

- [ ] **4.4** Implement ConceptMap entry endpoints
  - `POST /api/concept-maps/:id/entries` - add entry, trigger stuck messages update
  - `PUT /api/concept-maps/:id/entries/:code` - update entry
  - `DELETE /api/concept-maps/:id/entries/:code` - delete entry

---

## UI Consistency Notes

- Follow existing Tailwind CSS patterns from `src/index.ts`
- Use `<details>` elements for collapsible panels (same as Incoming Messages page)
- Status badges: yellow for pending, green for completed
- Form styling matches existing forms (Invoice add form pattern)
- No toasts/notifications (consistent with rest of app)
- Errors shown as inline messages below relevant fields
- Sender displayed as "App | Facility" format throughout

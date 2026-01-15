# Code Mapping User Interface

Two UI pages for managing code mappings:
1. **Mapping Tasks Queue** (`/mapping/tasks`) - Pending/resolved mapping tasks
2. **Code Mappings Page** (`/mapping/table`) - CRUD for ConceptMap entries

Both use collapsible `<details>` panels (same pattern as Incoming Messages page).

## Navigation

- Two nav items: "Mapping Tasks" (with pending count badge) and "Code Mappings"
- Badge updates on page load only

## Shared: LOINC Search Autocomplete

Used in task resolution and mapping forms:
- Debounced search (300-500ms) on keystroke
- Searches both code and display text
- Dropdown shows up to 10 results with: code, display, component, property, timing, scale
- User must select from results (no manual entry)
- Validates via `/api/terminology/loinc/:code` before submission
- Inline error display below search field

## Mapping Tasks Queue (`/mapping/tasks`)

### URL Structure

- `/mapping/tasks` or `?status=requested` - Pending tasks (default)
- `/mapping/tasks?status=completed` - History tab

Tabs are URL-based (server-rendered).

### Pending Tab

**Panel Summary:** Chevron, Sender ("App | Facility"), local code/display, "Pending" badge (yellow), affected messages count, first seen date

**Panel Expanded:**
- Read-only context: sender info, local code/display/system, sample value/units/range (from Task.input)
- LOINC search autocomplete + "Save Mapping" button

**On Resolution:**
1. Atomic transaction: Task → completed + ConceptMap entry created
2. Panel collapses, task moves to History
3. Affected messages: remove from `unmappedCodes[]`, change status to `received` if empty

**Sort:** By affected message count (highest first).

**Pagination:** 50/page.

### History Tab

Read-only view of completed tasks. Panel shows resolved LOINC code/display (from Task.output).

## Code Mappings Page (`/mapping/table`)

### URL Structure

- `/mapping/table` - All mappings
- `/mapping/table?conceptMapId={id}` - Filtered by sender

### Layout

- Sender filter dropdown (from existing ConceptMaps)
- "Add Mapping" button (disabled until sender filter selected)
- Collapsible panels per mapping entry.

**Pagination:** 50/page.

**Panel Summary:** Local code/display → LOINC code/display

**Panel Expanded (Edit Form):**
- Editable: local code/display/system, LOINC search
- Sender is read-only
- Duplicate check on save (sender + local system + local code)

**Add Mapping Form:** Appears above list when button clicked. Same fields as edit form.

**On Save (Add/Edit):**
- Update/create ConceptMap entry
- If matching Task exists → mark completed
- Update affected messages (same as task resolution)
- No retroactive changes to already-processed messages

## File Structure

```
src/ui/
├── mapping-tasks-queue.ts    # Tasks queue UI + handlers
├── code-mappings.ts          # Mappings page UI + handlers
└── terminology-api.ts        # LOINC search/lookup API
```

## API Endpoints

### Pages (HTML)

```
GET  /mapping/tasks                    # Tasks queue (default: pending)
GET  /mapping/tasks?status=requested   # Pending tab
GET  /mapping/tasks?status=completed   # History tab
GET  /mapping/table                    # Mappings page
GET  /mapping/table?conceptMapId={id}  # Filtered by sender
```

### Form Actions (HTML POST → redirect)

```
POST /api/mapping/tasks/:id/resolve        # Resolve task (loincCode, loincDisplay)
POST /api/concept-maps/:id/entries         # Add entry
PUT  /api/concept-maps/:id/entries/:code   # Update entry
DELETE /api/concept-maps/:id/entries/:code # Delete entry (with confirmation)
```

### JSON API (for autocomplete)

```
GET /api/terminology/loinc?q={query}  # Search (returns up to 10 results)
GET /api/terminology/loinc/:code      # Validate code
```

Proxies to Aidbox:
- Search: `GET /fhir/ValueSet/$expand?url=http://loinc.org&filter={query}&count=10`
- Validate: `GET /fhir/CodeSystem/$lookup?system=http://loinc.org&code={code}`

Auto-retry 2-3 times on Aidbox unavailability.

## Data Behavior

- **Reprocessing:** Batched - set message status to `received`, processor picks them up
- **Concurrency:** If-Match with ETag for Task and message updates
- **Local system:** Store as-is (no normalization)
- **Duplicates:** Block with inline error

## Implementation Tasks

### Phase 3: Mapping Tasks Queue UI

- [ ] **3.0** Write tests (TDD)
  - Terminology API: search (by code/display), validation, retry logic, 10-item limit
  - Task resolution: atomic bundle (Task + ConceptMap), ETag concurrency
  - Integration: resolve flow, message updates, edge cases (already completed, no affected messages)

- [ ] **3.1** Create mapping tasks queue page
  - `/mapping/tasks` route with URL-based tabs
  - Collapsible panels with summary info
  - Sort by affected message count, pagination 50/page

- [ ] **3.2** Implement task resolution form
  - Read-only context + LOINC search autocomplete
  - Atomic resolution, panel auto-collapse

- [ ] **3.3** Implement LOINC terminology API proxy
  - Search and validation endpoints with retry logic

- [ ] **3.4** Implement task resolution handler
  - `POST /api/mapping/tasks/:id/resolve`
  - Atomic transaction, ETag control, message updates

- [ ] **3.5** Add navigation badge
  - Query pending count, render on nav item

### Phase 4: Code Mappings Management UI

- [ ] **4.0** Write tests (TDD)
  - ConceptMap CRUD: create/update/delete entries, duplicate detection
  - Integration: create/edit/delete flows, Task completion, message updates

- [ ] **4.1** Create code mappings page
  - `/mapping/table` route with sender filter
  - Collapsible panels, pagination 50/page

- [ ] **4.2** Implement edit mapping form
  - LOINC autocomplete, duplicate detection, in-place update

- [ ] **4.3** Implement create mapping form
  - "Add Mapping" button (requires sender filter)
  - Mark matching Task completed, update messages

- [ ] **4.4** Implement ConceptMap entry endpoints
  - POST/PUT/DELETE handlers with message updates

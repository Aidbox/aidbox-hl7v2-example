# Code Mapping User Interface

This document covers the user interface for managing code mappings between local laboratory codes and LOINC codes.

## Overview

Two pages enable users to manage the code mapping workflow:
1. **Mapping Tasks Queue** - View and resolve pending mapping tasks created by ORU processing
2. **Code Mappings Table** - Direct CRUD operations on ConceptMap entries

## Key Behaviors

- Task resolution and direct ConceptMap edits trigger the same side effects
- LOINC codes are selected via terminology search (no manual entry)
- Pending task count displayed in navigation badge
- Both pages use pagination (50 items per page)

## Mapping Tasks Queue

Displays Task resources with `code.coding.code = "local-to-loinc-mapping"`.

**Pending tasks (status=requested):**
- Sorted by `authoredOn` (oldest first)
- Shows sender, local code/display, sample value context from Task.input
- User selects LOINC code to resolve

**Completed tasks (status=completed):**
- Sorted by `lastModified` (newest first)
- Shows resolved LOINC from Task.output (read-only)

## Code Mappings Table

Displays ConceptMap entries grouped by sender.

- Filter by sender (ConceptMap)
- Add new mappings (requires sender selection)
- Edit existing mappings (change LOINC target)
- Delete mappings (with confirmation)
- Duplicate detection: sender + local system + local code must be unique

## Resolution Flow

When a mapping is created (via task resolution or direct add/edit):

1. **Update ConceptMap:** Add or update entry in sender's ConceptMap
2. **Complete matching Tasks:** Find Task(s) with same sender + local code → set `status=completed`, add LOINC to `output`
3. **Update affected messages:** For `IncomingHL7v2Message` with `status=mapping_error`:
   - Remove resolved entry from `unmappedCodes[]`
   - If `unmappedCodes[]` becomes empty → set `status=received` for reprocessing

## Resource Changes

### ConceptMap (on resolution)

New entry added to sender's ConceptMap:

```diff
{
  "resourceType": "ConceptMap",
  "id": "hl7v2-ACME_LAB-ACME_HOSP-to-loinc",
  "group": [{
    "source": "ACME-LAB-CODES",
    "target": "http://loinc.org",
    "element": [
      // ... existing entries ...
+     {
+       "code": "K_SERUM",
+       "display": "Potassium [Serum/Plasma]",
+       "target": [{
+         "code": "2823-3",
+         "display": "Potassium [Moles/volume] in Serum or Plasma",
+         "equivalence": "equivalent"
+       }]
+     }
    ]
  }]
}
```

### Task (on resolution)

```diff
{
  "resourceType": "Task",
- "status": "requested",
+ "status": "completed",
+ "lastModified": "2025-02-12T15:05:00Z",
  "input": [ ... ],
+ "output": [
+   {
+     "type": { "text": "Resolved LOINC" },
+     "valueCodeableConcept": {
+       "coding": [{
+         "system": "http://loinc.org",
+         "code": "2823-3",
+         "display": "Potassium [Moles/volume] in Serum or Plasma"
+       }]
+     }
+   }
+ ]
}
```

### IncomingHL7v2Message (on resolution)

When all unmapped codes are resolved:

```diff
{
  "resourceType": "IncomingHL7v2Message",
- "status": "mapping_error",
+ "status": "received",
- "unmappedCodes": [{ "localCode": "K_SERUM", ... }]
+ "unmappedCodes": []
}
```

## LOINC Terminology API

- **Search:** Query by code or display text, returns up to 10 matches with LOINC axes (component, property, timing, scale)
- **Validate:** Confirm code exists before saving
- Auto-retry on server unavailability

# Code Mapping

Handles local laboratory codes that arrive without standard LOINC codes, enabling users to map them and resume processing.

## How It Works

When ORU_R01 messages contain OBX segments with local codes that cannot be resolved to LOINC, the system:
1. Blocks message processing with `status=mapping_error` (a dedicated status, separate from generic `error`, so users immediately know the action required)
2. Creates mapping Tasks for each unmapped code (deduplicated, so the same code from multiple messages creates one Task)
3. Waits for users to provide LOINC mappings
4. Automatically reprocesses messages once all codes are mapped

### Resolution Paths

Users can resolve mappings via two UI pages (both trigger identical side effects):

**Path A: Mapping Tasks Queue (`/mapping/tasks`)**
1. View pending tasks, each showing sender, local code, and sample value context
2. Search LOINC terminology for appropriate code
3. Select LOINC → system creates ConceptMap entry and completes Task

**Path B: ConceptMap Table (`/mapping/table`)**
1. Navigate to sender's ConceptMap
2. Add new mapping entry directly
3. System finds matching Tasks and completes them

### Side Effects on Resolution

When a mapping is created (via either path):

1. **ConceptMap updated**: Entry added to sender's ConceptMap
2. **Tasks completed**: Matching Task(s) marked `status=completed` with LOINC in output
3. **Messages updated**: For each affected `IncomingHL7v2Message`:
   - Remove resolved code from `unmappedCodes[]`
   - If `unmappedCodes[]` now empty → set `status=received` for reprocessing

## Implementation Details

### Code Locations

| Component | File | Entry Point |
|-----------|------|-------------|
| LOINC resolution during ORU processing | `src/v2-to-fhir/code-mapping/index.ts` | `resolveLOINCCode()` |
| ConceptMap lookup | `src/code-mapping/concept-map/lookup.ts` | `lookupInConceptMap()` |
| ConceptMap CRUD | `src/code-mapping/concept-map/service.ts` | `addConceptMapEntry()` |
| Task creation/resolution | `src/code-mapping/mapping-task-service.ts` | `createMappingTask()`, `resolveTask()` |
| Terminology API client | `src/code-mapping/terminology-api.ts` | `searchLOINC()`, `validateLOINC()` |
| Mapping Tasks UI | `src/ui/mapping-tasks.ts` | `renderMappingTasksPage()` |
| ConceptMap Table UI | `src/ui/concept-map-table.ts` | `renderConceptMapTable()` |

### Task Resource Structure

Each unmapped code creates one Task (deduplicated by sender + local system + code):

```json
{
  "resourceType": "Task",
  "id": "map-acme-lab-k-serum",
  "status": "requested",
  "intent": "order",
  "code": {
    "coding": [{
      "system": "http://example.org/task-codes",
      "code": "local-to-loinc-mapping"
    }]
  },
  "authoredOn": "2025-02-12T14:20:00Z",
  "input": [
    { "type": { "text": "Sending application" }, "valueString": "ACME_LAB" },
    { "type": { "text": "Sending facility" }, "valueString": "ACME_HOSP" },
    { "type": { "text": "Local code" }, "valueString": "K_SERUM" },
    { "type": { "text": "Local display" }, "valueString": "Potassium [Serum/Plasma]" },
    { "type": { "text": "Local system" }, "valueString": "ACME-LAB-CODES" },
    { "type": { "text": "Sample value" }, "valueString": "4.2" },
    { "type": { "text": "Sample units" }, "valueString": "mmol/L" }
  ]
}
```

When resolved, `status` becomes `completed` and `output` contains the LOINC:

```json
{
  "output": [{
    "type": { "text": "Resolved LOINC" },
    "valueCodeableConcept": {
      "coding": [{
        "system": "http://loinc.org",
        "code": "2823-3",
        "display": "Potassium [Moles/volume] in Serum or Plasma"
      }]
    }
  }]
}
```

### ConceptMap Structure

One ConceptMap per sender (application + facility), containing all local→LOINC mappings. This isolation ensures the same local code from different lab systems can map to different LOINC codes without conflict:

```json
{
  "resourceType": "ConceptMap",
  "id": "hl7v2-ACME_LAB-ACME_HOSP-to-loinc",
  "status": "active",
  "sourceUri": "urn:oid:acme-lab-codes",
  "targetUri": "http://loinc.org",
  "group": [{
    "source": "ACME-LAB-CODES",
    "target": "http://loinc.org",
    "element": [{
      "code": "K_SERUM",
      "display": "Potassium [Serum/Plasma]",
      "target": [{
        "code": "2823-3",
        "display": "Potassium [Moles/volume] in Serum or Plasma",
        "equivalence": "equivalent"
      }]
    }]
  }]
}
```

### IncomingHL7v2Message Extensions

Messages with unmapped codes store references for tracking:

```typescript
{
  status: "mapping_error",
  sendingApplication: "ACME_LAB",      // MSH-3
  sendingFacility: "ACME_HOSP",        // MSH-4
  unmappedCodes: [{
    localCode: "K_SERUM",
    localDisplay: "Potassium [Serum/Plasma]",
    localSystem: "ACME-LAB-CODES",
    mappingTask: { resourceType: "Task", id: "map-acme-lab-k-serum" }
  }]
}
```

### LOINC Terminology API

The system integrates with an external terminology server:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/terminology/loinc?q={query}` | Search by code or display text (max 10 results) |
| `GET /api/terminology/loinc/{code}` | Validate specific code exists |

Search results include LOINC axes (component, property, timing, scale) for disambiguation.

## See Also

- [ORU Processing](oru-processing.md) - How ORU messages trigger code mapping
- [Architecture](architecture.md) - Design decisions on ConceptMap-per-sender and deterministic Task IDs

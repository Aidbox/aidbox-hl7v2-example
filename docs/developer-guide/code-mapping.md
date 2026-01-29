# Code Mapping

Handles HL7v2 codes that cannot be automatically converted to FHIR, enabling users to map them and resume processing. For conceptual background on LOINC and ConceptMaps, see the [User Guide](../user-guide/concepts.md#loinc).

## Overview

When HL7v2 messages contain codes that cannot be resolved to valid FHIR values:

1. Message processing blocks with `status=mapping_error`
2. A Task is created for each unmapped code (deduplicated by sender + code + mapping type)
3. Users provide mappings via UI
4. System automatically reprocesses affected messages

## Supported Mapping Types

The system supports four mapping types, defined in `src/code-mapping/mapping-types.ts`:

| Type | Source Field | Target | Use Case |
|------|--------------|--------|----------|
| `loinc` | OBX-3 | Observation.code | Local lab codes to LOINC |
| `patient-class` | PV1.2 | Encounter.class | Patient class codes (I, O, E, etc.) |
| `obr-status` | OBR-25 | DiagnosticReport.status | Result status codes (F, P, C, etc.) |
| `obx-status` | OBX-11 | Observation.status | Observation status codes (F, P, C, etc.) |

## LOINC Resolution

The core operation for OBX processing is `resolveToLoinc()` - called during OBX processing to convert local codes to LOINC:

```typescript
import { resolveToLoinc, fetchConceptMap, LoincResolutionError } from "./code-mapping";

try {
  const result = await resolveToLoinc(obx.$3_observationIdentifier, sender, fetchConceptMap);
  // result.loinc = { system: "http://loinc.org", code: "2823-3", display: "..." }
} catch (e) {
  if (e instanceof LoincResolutionError) {
    // Code not found - triggers Task creation and mapping_error status
  }
}
```

## Code Organization

```
src/code-mapping/
├── mapping-types.ts                 # Mapping type registry (CRITICAL: add new types here)
├── mapping-errors.ts                # MappingError types and builders
├── concept-map/
│   ├── lookup.ts                    # resolveToLoinc(), lookupInConceptMap()
│   ├── service.ts                   # ConceptMap CRUD
│   └── index.ts
├── mapping-task-service.ts          # Task creation and resolution
└── terminology-api.ts               # LOINC search/validation

src/v2-to-fhir/code-mapping/         # Integration with ORU processing
├── index.ts                         # Re-exports from src/code-mapping
└── coding-systems.ts                # System URI normalization
```

## Resolution Cascade

`resolveToLoinc()` tries three sources in order:

```
resolveToLoinc(observationIdentifier, sender)
    │
    ├─► 1. Check inline LOINC (OBX-3 component 3 = "LN")
    │       → Return immediately if found
    │
    ├─► 2. Check alternate LOINC (OBX-3 component 6 = "LN")
    │       → Return LOINC + local coding if found
    │
    └─► 3. Lookup in sender's ConceptMap
            │
            └─► If not found: throw LoincResolutionError
                    → Triggers mapping_error status and Task creation
```

## Key Design Decisions

**Sender-isolated ConceptMaps**: Each sender (MSH-3 + MSH-4) gets its own ConceptMap per mapping type. The same local code from different lab systems can map to different values. IDs follow the pattern `hl7v2-{app}-{facility}{type-suffix}`, e.g., `hl7v2-acme-lab-hosp-to-loinc` or `hl7v2-acme-lab-hosp-to-address-type`.

**Deterministic Task IDs**: Task IDs include mapping type, sender, and local code, ensuring the same unmapped code creates exactly one Task per type. Multiple messages with the same unmapped code share that Task.

**System URI normalization**: Known HL7v2 coding system abbreviations are normalized to standard FHIR URIs (e.g., `LN` → `http://loinc.org`). Unknown systems pass through unchanged. See `coding-systems.ts`.

**Fail-fast on unknown types**: If a Task references an unknown mapping type, resolution fails immediately with a clear error. This ensures new mapping types are properly configured in the registry before use.

## User Resolution Paths

Users can resolve mappings via two UI pages:

**Mapping Tasks Queue (`/mapping/tasks`)**: View pending tasks filtered by type → search or select target code → resolve. Creates ConceptMap entry and completes Task.

**ConceptMap Table (`/mapping/table`)**: Navigate to sender's ConceptMap → filter by mapping type → add entry directly. System finds and completes matching Tasks.

### Side Effects on Resolution

When a mapping is created (via either path):

1. **ConceptMap updated**: Entry added to sender's type-specific ConceptMap
2. **Tasks completed**: Matching Task(s) marked `status=completed`
3. **Messages updated**: Resolved code removed from `unmappedCodes[]`; if empty → `status=received` for reprocessing

Note: A message may have multiple unmapped codes of different types. Each code is tracked independently, and the message only returns to `received` status when all codes are resolved.

## Common Tasks

### Adding a mapping programmatically

```typescript
import { addMapping } from "./code-mapping";

await addMapping(
  { sendingApplication: "LAB_SYS", sendingFacility: "HOSP_A" },
  "K_SERUM",        // local code
  "urn:oid:acme",   // local system
  "Potassium",      // local display
  "2823-3",         // LOINC code
  "Potassium [Moles/volume] in Serum or Plasma",
);
```

### Searching LOINC terminology

```typescript
import { searchLoincCodes, validateLoincCode } from "./code-mapping";

const results = await searchLoincCodes("potassium serum");
// Returns: [{ code, display, component, property, timing, scale }]

const valid = await validateLoincCode("2823-3");
// Returns: { code, display } or null
```

### Working with Tasks

```typescript
import { resolveMappingTask, findAffectedMessages } from "./code-mapping";

// Complete a task with LOINC mapping
await resolveMappingTask(taskId, "2823-3", "Potassium [Moles/volume]...");

// Find messages blocked by a task
const messages = await findAffectedMessages(taskId);
```

## FHIR Resource Structures

<details>
<summary>Task Resource</summary>

Each unmapped code creates one Task. The `code.coding[0].code` field identifies the mapping type, used for filtering and resolution logic. Sender info and local code in `input`; resolved code in `output` when completed.

```json
{
  "resourceType": "Task",
  "id": "map-hl7v2-acme-lab-hosp-to-loinc-a1b2c3-d4e5f6",
  "status": "requested",
  "intent": "order",
  "code": {
    "coding": [{
      "system": "urn:aidbox-hl7v2-converter:task-code",
      "code": "loinc-mapping",
      "display": "Local code to LOINC mapping"
    }]
  },
  "input": [
    { "type": { "text": "Sending application" }, "valueString": "ACME_LAB" },
    { "type": { "text": "Sending facility" }, "valueString": "ACME_HOSP" },
    { "type": { "text": "Local code" }, "valueString": "K_SERUM" },
    { "type": { "text": "Local display" }, "valueString": "Potassium [Serum/Plasma]" },
    { "type": { "text": "Local system" }, "valueString": "ACME-LAB-CODES" },
    { "type": { "text": "Source field" }, "valueString": "OBX-3" },
    { "type": { "text": "Target field" }, "valueString": "Observation.code" }
  ]
}
```

</details>

<details>
<summary>ConceptMap Structure</summary>

One ConceptMap per sender per mapping type. ConceptMap ID includes the type suffix:

```json
{
  "resourceType": "ConceptMap",
  "id": "hl7v2-acme-lab-acme-hosp-to-loinc",
  "status": "active",
  "sourceUri": "urn:oid:acme-lab-codes",
  "targetUri": "http://loinc.org",
  "group": [{
    "source": "urn:oid:acme-lab-codes",
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

</details>

<details>
<summary>IncomingHL7v2Message with unmapped codes</summary>

Messages with unmapped codes store references in `unmappedCodes[]`:

```json
{
  "status": "mapping_error",
  "sendingApplication": "ACME_LAB",
  "sendingFacility": "ACME_HOSP",
  "unmappedCodes": [{
    "localCode": "K_SERUM",
    "localDisplay": "Potassium [Serum/Plasma]",
    "localSystem": "urn:oid:acme-lab-codes",
    "mappingTask": { "reference": "Task/map-hl7v2-acme-lab-..." }
  }]
}
```

</details>

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/terminology/loinc?q={query}` | Search LOINC by code or display text |
| `GET /api/terminology/loinc/{code}` | Validate specific code exists |
| `POST /api/mapping/tasks/:id/resolve` | Resolve task with target code (validated per type) |
| `POST /api/concept-maps/:id/entries` | Add ConceptMap entry |

The resolution endpoint (`/api/mapping/tasks/:id/resolve`) validates the resolved code against the appropriate target ValueSet based on the task's mapping type:
- LOINC tasks: validates against LOINC terminology
- Status tasks: validates against FHIR status ValueSets
- Address-type tasks: validates against FHIR address-type ValueSet
- Patient-class tasks: validates against FHIR encounter-class ValueSet

## See Also

- [Adding a New Mapping Type](how-to/adding-mapping-type.md) - Step-by-step guide
- [ORU Processing](oru-processing.md) - How ORU messages trigger code mapping
- [Architecture](architecture.md) - Design decisions on ConceptMap-per-sender

# Code Mapping

Handles local laboratory codes that arrive without standard LOINC codes, enabling users to map them and resume processing. For conceptual background on LOINC and ConceptMaps, see the [User Guide](../user-guide/concepts.md#loinc).

## Code Organization

Code mapping functionality is split between two modules:

```
src/code-mapping/                    # Core mapping infrastructure
├── concept-map/
│   ├── lookup.ts                    # resolveToLoinc(), lookupInConceptMap()
│   ├── service.ts                   # ConceptMap CRUD, fetchConceptMap()
│   └── index.ts                     # Module exports
├── mapping-task-service.ts          # Task creation and resolution
└── terminology-api.ts               # LOINC search/validation via external API

src/v2-to-fhir/code-mapping/         # Integration with ORU processing
├── index.ts                         # Re-exports from src/code-mapping
└── coding-systems.ts                # System URI normalization
```

**Key entry points:**

- `resolveToLoinc(ce, sender, fetch)` in `concept-map/lookup.ts` - Main resolution function
- `lookupInConceptMap(map, code, system)` in `concept-map/lookup.ts` - ConceptMap lookup
- `createMappingTask()` in `mapping-task-service.ts` - Creates Task for unmapped code
- `resolveTask()` in `mapping-task-service.ts` - Resolves Task with LOINC mapping

## How It Works

When ORU_R01 messages contain OBX segments with local codes that cannot be resolved to LOINC:

1. Message processing blocks with `status=mapping_error`
2. A Task is created for each unmapped code (deduplicated by sender + code)
3. Users provide LOINC mappings via UI
4. System automatically reprocesses affected messages

### Resolution Paths

Users can resolve mappings via two UI pages:

**Path A: Mapping Tasks Queue (`/mapping/tasks`)**
1. View pending tasks showing sender, local code, and sample value
2. Search LOINC terminology for appropriate code
3. Select LOINC → creates ConceptMap entry and completes Task

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

## Key Patterns

### Resolution Cascade

The `resolveToLoinc()` function tries three sources in order:

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
            ├─► fetchConceptMap(generateConceptMapId(sender))
            ├─► lookupInConceptMap(map, localCode, localSystem)
            │
            └─► If not found: throw LoincResolutionError
                    → Triggers mapping_error status and Task creation
```

### Sender-Specific ConceptMaps

Each sender (MSH-3 + MSH-4 combination) has its own ConceptMap. This isolation ensures the same local code from different lab systems can map to different LOINC codes:

```typescript
// ID format: hl7v2-{app}-{facility}-to-loinc
function generateConceptMapId(sender: SenderContext): string {
  const app = toKebabCase(sender.sendingApplication);
  const facility = toKebabCase(sender.sendingFacility);
  return `hl7v2-${app}-${facility}-to-loinc`;
}

// Example: "hl7v2-acme-lab-main-hospital-to-loinc"
```

### Deterministic Task IDs

Tasks are deduplicated using deterministic IDs based on ConceptMap ID + code:

```typescript
function generateMappingTaskId(conceptMapId, localSystem, localCode): string {
  const systemHash = simpleHash(localSystem);
  const codeHash = simpleHash(localCode);
  return `map-${conceptMapId}-${systemHash}-${codeHash}`;
}

// Example: "map-hl7v2-acme-lab-main-hospital-to-loinc-a1b2c3-d4e5f6"
```

This ensures:
- Same unmapped code from same sender creates one Task
- Multiple messages with same unmapped code share one Task
- Task can be upserted without duplicates

### System URI Normalization

Local coding system names are normalized to URIs for consistent lookup:

```typescript
// coding-systems.ts
function normalizeSystem(system: string | undefined): string | undefined {
  if (!system) return undefined;
  if (system.startsWith("http://") || system.startsWith("urn:")) return system;
  return `urn:oid:${system.toLowerCase()}`;
}

// "ACME-LAB" → "urn:oid:acme-lab"
```

## Implementation Details

### Task Resource Structure

Each unmapped code creates one Task:

```json
{
  "resourceType": "Task",
  "id": "map-acme-lab-k-serum",
  "status": "requested",
  "intent": "order",
  "code": {
    "coding": [{ "system": "http://example.org/task-codes", "code": "local-to-loinc-mapping" }]
  },
  "authoredOn": "2025-02-12T14:20:00Z",
  "input": [
    { "type": { "text": "Sending application" }, "valueString": "ACME_LAB" },
    { "type": { "text": "Sending facility" }, "valueString": "ACME_HOSP" },
    { "type": { "text": "Local code" }, "valueString": "K_SERUM" },
    { "type": { "text": "Local display" }, "valueString": "Potassium [Serum/Plasma]" },
    { "type": { "text": "Local system" }, "valueString": "ACME-LAB-CODES" }
  ]
}
```

When resolved, `status` becomes `completed` and `output` contains the LOINC:

```json
{
  "output": [{
    "type": { "text": "Resolved LOINC" },
    "valueCodeableConcept": {
      "coding": [{ "system": "http://loinc.org", "code": "2823-3", "display": "Potassium [Moles/volume] in Serum or Plasma" }]
    }
  }]
}
```

### ConceptMap Structure

One ConceptMap per sender containing all local→LOINC mappings:

```json
{
  "resourceType": "ConceptMap",
  "id": "hl7v2-ACME_LAB-ACME_HOSP-to-loinc",
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

### IncomingHL7v2Message Tracking

Messages with unmapped codes store references:

```typescript
{
  status: "mapping_error",
  sendingApplication: "ACME_LAB",
  sendingFacility: "ACME_HOSP",
  unmappedCodes: [{
    localCode: "K_SERUM",
    localDisplay: "Potassium [Serum/Plasma]",
    localSystem: "urn:oid:acme-lab-codes",
    mappingTask: { reference: "Task/map-acme-lab-k-serum" }
  }]
}
```

### LOINC Terminology API

External terminology server integration:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/terminology/loinc?q={query}` | Search by code or display text (max 10 results) |
| `GET /api/terminology/loinc/{code}` | Validate specific code exists |

## Extension Points

### Adding New Terminology Targets

To support mapping to terminologies other than LOINC:

1. Create resolution function similar to `resolveToLoinc()`
2. Generate ConceptMap IDs with different suffix (e.g., `-to-snomed`)
3. Update Task code to identify mapping type

### Custom ConceptMap Sources

To load ConceptMaps from external systems:

1. Implement custom `fetchConceptMap()` function
2. Pass to `resolveToLoinc()` as third parameter
3. Cache results for performance

## See Also

- [ORU Processing](oru-processing.md) - How ORU messages trigger code mapping
- [Architecture](architecture.md) - Design decisions on ConceptMap-per-sender

# Adding Field Mappings

This guide explains how to add code mappings for laboratory codes that arrive without standard LOINC codes.

## When You Need This

When your system receives ORU (lab results) messages from external labs, those labs often use their own local codes instead of standard LOINC codes. For example, a lab might send `K_SERUM` instead of the LOINC code `2823-3` for a potassium test.

The system needs to know how to translate these local codes to LOINC. You have three options:

- **Via the Web UI** - Resolve codes one-by-one as they appear
- **Bulk import** - Load many mappings at once from a file

**Extending the converter:**
If you need to map additional HL7v2 fields beyond what's currently supported, see:
- [Extending Outgoing Fields](../technical/how-to/extending-outgoing-fields.md) — FHIR→HL7v2
- [Extending Incoming Fields](../technical/how-to/extending-incoming-fields.md) — HL7v2→FHIR

## Using the Web UI

The simplest approach is using the Mapping Tasks and Code Mappings pages. When a message arrives with an unmapped code:

1. The message gets `status=mapping_error`
2. A task appears on the Mapping Tasks page (`/mapping/tasks`)
3. You search for the matching LOINC code and resolve it
4. The mapping is saved and the message can be reprocessed

See [Overview](overview.md) for more context on the code mapping workflow.

## Bulk Import via ConceptMap

For importing many mappings at once (e.g., when onboarding a new lab), you can load a ConceptMap directly into Aidbox.

### ConceptMap Structure

ConceptMaps are stored as FHIR resources, one per sender (identified by sending application + facility from the message header).

```json
{
  "resourceType": "ConceptMap",
  "id": "LabSystem-MainFacility",
  "title": "LabSystem|MainFacility",
  "status": "active",
  "group": [{
    "source": "http://labsystem.local/codes",
    "target": "http://loinc.org",
    "element": [{
      "code": "K_SERUM",
      "display": "Serum Potassium",
      "target": [{
        "code": "2823-3",
        "display": "Potassium [Moles/volume] in Serum or Plasma",
        "equivalence": "equivalent"
      }]
    }]
  }]
}
```

**Key fields:**
- `id` - Format: `{SendingApplication}-{SendingFacility}` (from message header MSH-3 and MSH-4)
- `group[].source` - The local code system identifier
- `group[].element[]` - Array of local codes with their LOINC mappings

### Loading via API

```sh
# Get existing ConceptMap (if any)
curl -u root:Vbro4upIT1 \
  "http://localhost:8080/fhir/ConceptMap/LabSystem-MainFacility"

# Create or update ConceptMap
curl -X PUT -u root:Vbro4upIT1 \
  -H "Content-Type: application/json" \
  "http://localhost:8080/fhir/ConceptMap/LabSystem-MainFacility" \
  -d @conceptmap.json
```

### Loading via Script

Create a script to transform your mapping data into ConceptMap format:

```typescript
// scripts/import-mappings.ts
import { putResource } from "../src/aidbox";

const mappings = [
  { local: "GLU_FAST", loinc: "1558-6", display: "Fasting glucose" },
  { local: "HBA1C", loinc: "4548-4", display: "Hemoglobin A1c" },
  // ... more mappings
];

const conceptMap = {
  resourceType: "ConceptMap",
  id: "LabSystem-MainFacility",
  title: "LabSystem|MainFacility",
  status: "active",
  group: [{
    source: "http://labsystem.local/codes",
    target: "http://loinc.org",
    element: mappings.map(m => ({
      code: m.local,
      display: m.display,
      target: [{ code: m.loinc, display: m.display, equivalence: "equivalent" }]
    }))
  }]
};

await putResource("ConceptMap", conceptMap.id, conceptMap);
```

Run with:
```sh
bun scripts/import-mappings.ts
```

### Verifying Imported Mappings

After import, you can verify the mappings:

1. Go to the Code Mappings page (`/mapping/table`) in the web UI
2. Select the sender from the dropdown
3. You should see all imported mappings in the table

Or via API:
```sh
curl -u root:Vbro4upIT1 \
  "http://localhost:8080/fhir/ConceptMap/LabSystem-MainFacility"
```

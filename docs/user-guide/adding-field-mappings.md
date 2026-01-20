# Adding Field Mappings

This guide explains how to extend field mappings for BAR message generation and ORU message processing.

## BAR Message: Adding a New FHIR → HL7v2 Field

When you need to include additional FHIR data in outgoing BAR messages, follow these steps.

### Step 1: Identify the Target HL7v2 Field

Determine which HL7v2 segment and field should receive the data. Common BAR segments:

| Segment | Purpose |
|---------|---------|
| PID | Patient identification |
| PV1 | Patient visit/encounter |
| GT1 | Guarantor information |
| IN1 | Insurance information |
| DG1 | Diagnosis codes |
| PR1 | Procedure codes |

### Step 2: Locate the Segment Builder

Open `src/bar/generator.ts` and find the builder function for your target segment:

- `buildPID()` - Patient demographics
- `buildPV1()` - Visit/encounter info
- `buildGT1()` - Guarantor info
- `buildIN1()` - Insurance info
- `buildDG1()` - Diagnoses
- `buildPR1()` - Procedures

### Step 3: Add the Field

Add a new property to the return object. Field names follow the pattern `$N_fieldName` where N is the HL7v2 field sequence number.

**Example: Adding PID-14 (Business Phone)**

```typescript
function buildPID(input: BarMessageInput): PID {
  const { patient, account } = input;
  const businessPhone = patient.telecom?.find(t => t.system === "phone" && t.use === "work");

  return {
    // ... existing fields ...
    $13_homePhone: [{ $1_value: phone?.value }],

    // Add PID-14: Business Phone
    $14_businessPhone: [{
      $1_value: businessPhone?.value,
    }],

    $18_accountNumber: { $1_value: account.identifier?.[0]?.value }
  }
}
```

### Step 4: Check Type Definitions

The field types are defined in `src/hl7v2/generated/fields.ts`. Each segment has a TypeScript interface showing available fields and their structure.

```typescript
// From fields.ts - shows PID structure
interface PID {
  $14_businessPhone?: XTN[];  // XTN is a phone number datatype
  // ...
}

// XTN structure for phone numbers
interface XTN {
  $1_value?: string;
  $2_telecomUseCode?: string;
  // ...
}
```

### Step 5: Test Your Change

```sh
# Create a test invoice with the new data
bun scripts/load-test-data.ts

# Generate a BAR message
# Go to http://localhost:3000/invoices
# Create invoice → Build BAR → View in Outgoing Messages
```

## ORU Processing: Adding a New HL7v2 → FHIR Field

When you need to extract additional data from incoming ORU messages into FHIR resources.

### Step 1: Identify the Source HL7v2 Field

Common ORU segments to extend:

| Segment | Converter File | FHIR Output |
|---------|---------------|-------------|
| OBR | `segments/obr-diagnosticreport.ts` | DiagnosticReport |
| OBX | `segments/obx-observation.ts` | Observation |
| PID | `segments/pid-patient.ts` | Patient |
| PV1 | `segments/pv1-encounter.ts` | Encounter |

### Step 2: Locate the Segment Converter

Open the relevant file in `src/v2-to-fhir/segments/`.

### Step 3: Add the Field Mapping

Extract the HL7v2 field and map it to the appropriate FHIR element.

**Example: Adding OBX-17 (Observation Method) to Observation**

```typescript
// In src/v2-to-fhir/segments/obx-observation.ts

export function convertOBXToObservation(
  obx: OBX,
  obrFillerOrderNumber: string,
): Observation {
  // ... existing code ...

  const observation: Observation = {
    resourceType: "Observation",
    id,
    status: mapOBXStatusToFHIR(obx.$11_observationResultStatus as string),
    code,
  };

  // Add OBX-17: Observation Method → method
  if (obx.$17_observationMethod && obx.$17_observationMethod.length > 0) {
    const method = obx.$17_observationMethod[0];
    observation.method = {
      coding: [{
        code: method.$1_code,
        display: method.$2_text,
        system: normalizeSystem(method.$3_system),
      }],
    };
  }

  // ... rest of function ...
  return observation;
}
```

### Step 4: Check HL7v2 Field Types

Field types are in `src/hl7v2/generated/fields.ts`:

```typescript
// OBX segment fields
interface OBX {
  $17_observationMethod?: CE[];  // CE is Coded Element
  // ...
}
```

### Step 5: Test Your Change

```sh
# Send a test ORU message with the field populated
# Go to http://localhost:3000/mllp-client
# Send an ORU^R01 message
# Check Incoming Messages → Process → View created Observation in Aidbox
```

## Datatype Converters

For complex datatypes, use the converters in `src/v2-to-fhir/datatypes/`:

| HL7v2 Type | FHIR Output | Converter |
|------------|-------------|-----------|
| CWE | CodeableConcept | `cwe-codeableconcept.ts` |
| XPN | HumanName | `xpn-humanname.ts` |
| XAD | Address | `xad-address.ts` |
| XTN | ContactPoint | `xtn-contactpoint.ts` |
| CX | Identifier | `cx-identifier.ts` |
| DTM | dateTime | `dtm-datetime.ts` |

**Example using a datatype converter:**

```typescript
import { convertCWEToCodeableConcept } from "../datatypes/cwe-codeableconcept";

// In your segment converter:
if (obx.$17_observationMethod) {
  observation.method = convertCWEToCodeableConcept(obx.$17_observationMethod[0]);
}
```

## Code Mappings: Local-to-LOINC via ConceptMap

For mapping local lab codes to LOINC codes (used in OBX-3 resolution).

### Using the Web UI

The simplest approach is using the Mapping Tasks and Code Mappings pages. See [Web UI Guide](web-ui.md#mapping-tasks-page).

### Programmatic ConceptMap Updates

ConceptMaps are stored as FHIR resources in Aidbox, one per sender (MSH-3 + MSH-4 combination).

**ConceptMap Structure:**

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

**Adding a mapping via API:**

```sh
# Get existing ConceptMap
curl -u root:Vbro4upIT1 \
  "http://localhost:8080/fhir/ConceptMap/LabSystem-MainFacility"

# Update with new mapping (add to group[0].element array)
curl -X PUT -u root:Vbro4upIT1 \
  -H "Content-Type: application/json" \
  "http://localhost:8080/fhir/ConceptMap/LabSystem-MainFacility" \
  -d @conceptmap.json
```

### Bulk Import

For importing many mappings at once, create a ConceptMap JSON file and PUT it to Aidbox:

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

## Testing Field Mappings

### BAR Testing

1. Create test FHIR resources with the new field populated
2. Generate a BAR message via the UI or service
3. Inspect the HL7v2 output in Outgoing Messages

### ORU Testing

1. Create a sample HL7v2 message with the new field
2. Send via MLLP Test Client
3. Process the message
4. Query Aidbox for the created FHIR resource

```sh
# Query for Observations
curl -u root:Vbro4upIT1 \
  "http://localhost:8080/fhir/Observation?_sort=-_lastUpdated&_count=5"
```

## Technical Documentation

For detailed segment-to-FHIR mapping tables and supported datatypes, see:
- [FHIR to HL7v2 (BAR)](../technical/modules/fhir-to-hl7v2.md)
- [HL7v2 to FHIR (ORU)](../technical/modules/v2-to-fhir-oru.md)
- [V2-to-FHIR Specification](../v2-to-fhir-spec/)

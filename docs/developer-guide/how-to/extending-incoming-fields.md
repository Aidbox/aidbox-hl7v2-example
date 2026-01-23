# Extending Incoming Field Mappings

How to add new HL7v2→FHIR field mappings when processing incoming messages.

## Complete Worked Example: Adding OBX-17 (Observation Method)

This example walks through adding support for observation methods in lab results, from identifying the requirement to testing the change.

### Step 1: Identify the Requirement

**Goal:** Capture the method used to perform a lab observation (e.g., "Microscopy", "Culture") in the resulting FHIR resource.

**HL7v2 Source:** OBX-17 (Observation Method)
**FHIR Target:** `Observation.method`

### Step 2: Check the HL7v2 Field Type

Look up OBX-17 in `src/hl7v2/generated/fields.ts`:

```typescript
// In fields.ts, find the OBX interface
export interface OBX {
  // ...
  $17_observationMethod?: CE[];  // This is our source field
  // ...
}

// CE (Coded Element) structure
export interface CE {
  $1_code?: string;      // Code value
  $2_text?: string;      // Display text
  $3_system?: string;    // Coding system (e.g., "LN" for LOINC)
  // ...
}
```

### Step 3: Locate the Segment Converter

Open `src/v2-to-fhir/segments/obx-observation.ts` and find the converter function:

```typescript
export function convertOBXToObservation(
  obx: OBX,
  obrFillerOrderNumber: string,
): Observation {
  const id = generateObservationId(obx, obrFillerOrderNumber);
  const code = convertCodeToCodeableConcept(obx.$3_observationIdentifier);

  return {
    resourceType: "Observation",
    id,
    status: mapOBXStatusToFHIR(obx.$11_observationResultStatus as string),
    code,
    // ... value handling ...
  };
}
```

### Step 4: Add the Field Mapping

Modify the converter to extract OBX-17 and map it to `Observation.method`:

```typescript
export function convertOBXToObservation(
  obx: OBX,
  obrFillerOrderNumber: string,
): Observation {
  const id = generateObservationId(obx, obrFillerOrderNumber);
  const code = convertCodeToCodeableConcept(obx.$3_observationIdentifier);

  const observation: Observation = {
    resourceType: "Observation",
    id,
    status: mapOBXStatusToFHIR(obx.$11_observationResultStatus as string),
    code,
    // ... value handling ...
  };

  // NEW: Add OBX-17 Observation Method
  if (obx.$17_observationMethod?.[0]) {
    const method = obx.$17_observationMethod[0];
    observation.method = {
      coding: [{
        code: method.$1_code,
        display: method.$2_text,
        system: normalizeSystem(method.$3_system),
      }],
    };
  }

  return observation;
}
```

**Tip:** For complex datatypes, use existing converters in `src/v2-to-fhir/datatypes/`:

```typescript
import { convertCEToCodeableConcept } from "../datatypes/ce-codeableconcept";

if (obx.$17_observationMethod?.[0]) {
  observation.method = convertCEToCodeableConcept(obx.$17_observationMethod[0]);
}
```

### Step 5: Test the Change

1. **Create a test ORU message with OBX-17:**

```
MSH|^~\&|LAB|FACILITY|||20240115120000||ORU^R01|MSG001|P|2.5
PID|1||12345^^^MRN||Smith^John||19900101|M
OBR|1||LAB123|CBC^Complete Blood Count^LN|||20240115100000
OBX|1|NM|WBC^White Blood Cell Count^LN||7.5|10*9/L|4.5-11.0|N|||F|||||MICROSCOPY^Microscopy^LN
                                                                     │
                                                                     └─ OBX-17 (Observation Method)
```

2. **Send the message and process it:**

```sh
# Start the server
bun run dev

# Go to http://localhost:3000/mllp-client
# Paste the ORU message above and send it
# Go to Incoming Messages → click Process
```

3. **Check the FHIR output:**

View the created Observation in Aidbox. It should include:

```json
{
  "resourceType": "Observation",
  "status": "final",
  "code": {
    "coding": [{
      "code": "WBC",
      "display": "White Blood Cell Count",
      "system": "http://loinc.org"
    }]
  },
  "method": {
    "coding": [{
      "code": "MICROSCOPY",
      "display": "Microscopy",
      "system": "http://loinc.org"
    }]
  },
  "valueQuantity": {
    "value": 7.5,
    "unit": "10*9/L"
  }
}
```

## Finding More Segments to Extend

| Segment | Converter File | FHIR Output |
|---------|---------------|-------------|
| OBR | `segments/obr-diagnosticreport.ts` | DiagnosticReport |
| OBX | `segments/obx-observation.ts` | Observation |
| PID | `segments/pid-patient.ts` | Patient |
| PV1 | `segments/pv1-encounter.ts` | Encounter |

## See Also

- [ORU Processing](../oru-processing.md) - ORU processing pipeline
- [HL7v2 Module](../hl7v2-module.md) - Segment interfaces and datatype definitions

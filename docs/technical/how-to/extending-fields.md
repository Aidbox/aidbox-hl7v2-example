# Extending Field Mappings

How to add new FHIR↔HL7v2 field mappings by modifying the source code.

## BAR Message: Adding FHIR → HL7v2 Fields

When you need to include additional FHIR data in outgoing BAR messages.

### Step 1: Identify the Target HL7v2 Field

Determine which segment and field should receive the data:

| Segment | Purpose | Builder Location |
|---------|---------|------------------|
| PID | Patient identification | `buildPID()` |
| PV1 | Patient visit/encounter | `buildPV1()` |
| GT1 | Guarantor information | `buildGT1()` |
| IN1 | Insurance information | `buildIN1()` |
| DG1 | Diagnosis codes | `buildDG1()` |
| PR1 | Procedure codes | `buildPR1()` |

### Step 2: Locate the Segment Builder

Open `src/bar/generator.ts` and find the builder function for your target segment.

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

Field types are defined in `src/hl7v2/generated/fields.ts`. Each segment has a TypeScript interface:

```typescript
// Shows PID structure
interface PID {
  $14_businessPhone?: XTN[];  // XTN is phone number datatype
  // ...
}

// XTN structure
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

## ORU Processing: Adding HL7v2 → FHIR Fields

When you need to extract additional data from incoming ORU messages into FHIR resources.

### Step 1: Identify the Source HL7v2 Field

Common segments to extend:

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

  return observation;
}
```

### Step 4: Check HL7v2 Field Types

Field types are in `src/hl7v2/generated/fields.ts`:

```typescript
interface OBX {
  $17_observationMethod?: CE[];
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

For complex datatypes, use existing converters in `src/v2-to-fhir/datatypes/`:

| HL7v2 Type | FHIR Output | Converter |
|------------|-------------|-----------|
| CWE | CodeableConcept | `cwe-codeableconcept.ts` |
| XPN | HumanName | `xpn-humanname.ts` |
| XAD | Address | `xad-address.ts` |
| XTN | ContactPoint | `xtn-contactpoint.ts` |
| CX | Identifier | `cx-identifier.ts` |
| DTM | dateTime | `dtm-datetime.ts` |
| CE | CodeableConcept | `ce-codeableconcept.ts` |

**Example using a datatype converter:**

```typescript
import { convertCWEToCodeableConcept } from "../datatypes/cwe-codeableconcept";

if (obx.$17_observationMethod) {
  observation.method = convertCWEToCodeableConcept(obx.$17_observationMethod[0]);
}
```

## See Also

- [BAR Generation](../bar-generation.md) - Full BAR message specification
- [ORU Processing](../oru-processing.md) - ORU processing pipeline
- [HL7v2 Module](../hl7v2-module.md) - Segment builders and datatype interfaces

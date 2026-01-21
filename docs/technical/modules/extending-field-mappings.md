# Extending Field Mappings

This guide explains how to extend field mappings by modifying the source code. The examples below use BAR message generation and ORU message processing, but the same patterns apply to other message types.

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

## Related Documentation

- [FHIR to HL7v2 (BAR)](fhir-to-hl7v2.md) - Field mapping tables
- [HL7v2 to FHIR (ORU)](v2-to-fhir-oru.md) - ORU processing pipeline
- [HL7v2 Builders](hl7v2-builders.md) - Segment builder API and datatype interfaces
- [V2-to-FHIR Specification](../../v2-to-fhir-spec/) - Supported segments and datatypes

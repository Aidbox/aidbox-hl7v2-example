# Extending Field Mappings

How to add new FHIR↔HL7v2 field mappings by modifying the source code.

## Complete Worked Example: Adding PID-14 (Business Phone)

This example walks through adding support for business phone numbers in BAR messages, from identifying the requirement to testing the change.

### Step 1: Identify the Requirement

**Goal:** Include the patient's work phone number in outgoing BAR messages.

**HL7v2 Target:** PID-14 (Phone Number - Business)
**FHIR Source:** `Patient.telecom` where `use="work"` and `system="phone"`

### Step 2: Check the HL7v2 Field Type

Look up PID-14 in `src/hl7v2/generated/fields.ts`:

```typescript
// In fields.ts, find the PID interface
export interface PID {
  // ...
  $13_homePhone?: XTN[];
  $14_businessPhone?: XTN[];  // This is our target field
  // ...
}

// XTN (Extended Telecommunication Number) structure
export interface XTN {
  $1_value?: string;           // Phone number
  $2_telecomUseCode?: string;  // PRN, ORN, WPN, etc.
  $3_equipmentType?: string;   // PH, FX, MD, CP, etc.
  // ...
}
```

### Step 3: Locate the Segment Builder

Open `src/bar/generator.ts` and find `buildPID()`:

```typescript
function buildPID(input: BarMessageInput): PID {
  const { patient, account } = input;
  const name = patient.name?.[0];
  const address = patient.address?.[0];
  const phone = patient.telecom?.find(t => t.system === "phone");

  return {
    $1_setIdPid: "1",
    $3_identifier: [{ /* ... */ }],
    $5_name: [{ /* ... */ }],
    $7_birthDate: formatHL7Date(patient.birthDate),
    $8_gender: mapGender(patient.gender),
    $11_address: [{ /* ... */ }],
    $13_homePhone: [{
      $1_value: phone?.value,
    }],
    $18_accountNumber: { $1_value: account.identifier?.[0]?.value }
  };
}
```

### Step 4: Add the Field Mapping

Modify `buildPID()` to extract and include the business phone:

```typescript
function buildPID(input: BarMessageInput): PID {
  const { patient, account } = input;
  const name = patient.name?.[0];
  const address = patient.address?.[0];

  // Find home phone (existing)
  const homePhone = patient.telecom?.find(
    t => t.system === "phone" && (t.use === "home" || !t.use)
  );

  // Find work phone (new)
  const workPhone = patient.telecom?.find(
    t => t.system === "phone" && t.use === "work"
  );

  return {
    $1_setIdPid: "1",
    $3_identifier: [{
      $1_value: patient.identifier?.[0]?.value,
      $5_type: "MR",
    }],
    $5_name: [{
      $1_family: { $1_family: name?.family },
      $2_given: name?.given?.[0],
      $3_additionalGiven: name?.given?.[1],
    }],
    $7_birthDate: formatHL7Date(patient.birthDate),
    $8_gender: mapGender(patient.gender),
    $11_address: [{
      $1_line1: { $1_line: address?.line?.[0] },
      $3_city: address?.city,
      $4_state: address?.state,
      $5_postalCode: address?.postalCode,
      $6_country: address?.country,
    }],
    $13_homePhone: [{
      $1_value: homePhone?.value,
    }],
    // NEW: Add PID-14 Business Phone
    $14_businessPhone: workPhone ? [{
      $1_value: workPhone.value,
      $2_telecomUseCode: "WPN",  // Work Phone Number
    }] : undefined,
    $18_accountNumber: {
      $1_value: account.identifier?.[0]?.value
    }
  };
}
```

### Step 5: Test the Change

1. **Create test data with a work phone:**

```typescript
// In scripts/load-test-data.ts or a test file
const patient: Patient = {
  resourceType: "Patient",
  id: "test-patient",
  name: [{ family: "Smith", given: ["John"] }],
  telecom: [
    { system: "phone", use: "home", value: "555-1234" },
    { system: "phone", use: "work", value: "555-5678" },  // This should appear in PID-14
    { system: "email", value: "john@example.com" }
  ]
};
```

2. **Generate a BAR message and verify:**

```sh
# Start the server
bun run dev

# Create an invoice for the test patient
# Go to http://localhost:3000/invoices
# Create invoice → Build BAR → View in Outgoing Messages
```

3. **Check the output:**

The generated HL7v2 should include:
```
PID|1||12345^^^MRN||Smith^John||19900101|M|||123 Main St^^City^ST^12345||555-1234|555-5678|...
                                                                          │         │
                                                                          │         └─ PID-14 (new)
                                                                          └─ PID-13 (existing)
```

## BAR Message: Adding FHIR → HL7v2 Fields

### Quick Reference

| Segment | Purpose | Builder Function |
|---------|---------|------------------|
| PID | Patient identification | `buildPID()` |
| PV1 | Patient visit/encounter | `buildPV1()` |
| GT1 | Guarantor information | `buildGT1()` |
| IN1 | Insurance information | `buildIN1()` |
| DG1 | Diagnosis codes | `buildDG1()` |
| PR1 | Procedure codes | `buildPR1()` |

### Steps Summary

1. **Identify the target** - Which HL7v2 segment and field?
2. **Check the type** - Look in `src/hl7v2/generated/fields.ts`
3. **Locate the builder** - Find `buildXXX()` in `src/bar/generator.ts`
4. **Add the mapping** - Extract FHIR data, set HL7v2 field
5. **Test** - Create data, generate message, verify output

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
# Send an ORU^R01 message with OBX-17 populated
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

- [BAR Generation](../bar-generation.md) - BAR message structure and code flow
- [ORU Processing](../oru-processing.md) - ORU processing pipeline
- [HL7v2 Module](../hl7v2-module.md) - Segment builders and datatype interfaces

# HL7v2 Module

Type-safe HL7v2 message handling with schema-driven code generation.

## Internal Representation

Messages use numeric field keys matching HL7v2 positions:

```ts
type FieldValue = string | FieldValue[] | { [key: number]: FieldValue };

interface HL7v2Segment {
  segment: string;
  fields: Record<number, FieldValue>;
}

type HL7v2Message = HL7v2Segment[];
```

**Example:**

```ts
const msg: HL7v2Message = [
  {
    segment: "MSH",
    fields: {
      3: "SENDING_APP",
      7: "202312011200",
      9: { 1: "ADT", 2: "A01" },  // MSG datatype: message code, trigger event
      10: "MSG001"
    }
  },
  {
    segment: "PID",
    fields: {
      3: [{ 1: "12345", 4: { 1: "MRN" } }],  // Repeating CX datatype
      5: [{ 1: { 1: "Doe" }, 2: "John" }],   // XPN: family name (FN), given name
      7: "19900101",
      8: "M"
    }
  }
];
```

## File Structure

```
src/hl7v2/
  types.ts       # FieldValue, HL7v2Segment, HL7v2Message
  format.ts      # serialize to pipe-delimited string
  fields.ts      # segment field helpers + fluent builders - GENERATED
  messages.ts    # message-level type-safe builders - GENERATED
  codegen.ts     # generates fields.ts and messages.ts from schema

hl7v2/schema/
  messages/      # ADT_A01.json, BAR_P01.json - message structures
  segments/      # PID.json, MSH.json - segment field lists
  fields/        # PID.5.json - field metadata and data types
  dataTypes/     # XPN.json - complex type components
  structure/     # index.json - message code to structure mapping
```

## Schema Reference

### Messages (`messages/*.json`)

Defines segment structure with cardinality:

```json
{
  "BAR_P01": {
    "elements": [
      { "segment": "MSH", "minOccurs": "1", "maxOccurs": "1" },
      { "segment": "PID", "minOccurs": "1", "maxOccurs": "1" },
      { "group": "VISIT", "minOccurs": "1", "maxOccurs": "unbounded" }
    ]
  },
  "VISIT": {
    "elements": [
      { "segment": "PV1", "minOccurs": "0", "maxOccurs": "1" },
      { "segment": "DG1", "minOccurs": "0", "maxOccurs": "unbounded" },
      { "group": "INSURANCE", "minOccurs": "0", "maxOccurs": "unbounded" }
    ]
  }
}
```

### Segments (`segments/*.json`)

```json
{ "fields": [{ "field": "PID.3", "minOccurs": "1", "maxOccurs": "unbounded" }] }
```

### Fields (`fields/*.json`)

```json
{ "dataType": "XPN", "longName": "Patient Name" }
```

### Data Types (`dataTypes/*.json`)

```json
{
  "components": [
    { "dataType": "XPN.1", "minOccurs": "0", "maxOccurs": "1" }
  ]
}
```

## Code Generation

Generate helpers for specific message types:

```sh
# Generate segment-level field helpers and builders
bun src/hl7v2/codegen.ts BAR_P01 > src/hl7v2/fields.ts

# Generate message-level type-safe builders
bun src/hl7v2/codegen.ts BAR_P01 --messages > src/hl7v2/messages.ts
```

### Segment Builders

Fluent API for building segments. Method names follow the pattern `set_[segment][idx]_fieldName`:

```ts
import { PIDBuilder } from "./hl7v2/fields";

const pid = new PIDBuilder()
  // Primitive field - direct value
  .set_pid1_setIdPid("1")
  .set_pid8_administrativeSex("M")

  // Complex field - record object with __N suffix for component positions
  .set_pid5_patientName([{
    familyName__1: {
      surname__1: "Smith",
      ownSurnamePrefix__2: "van"
    },
    givenName__2: "John",
    middleName__3: "Robert",
    suffix__4: "Jr"
  }])

  // Repeating field - set all values as array
  .set_pid3_patientIdentifierList([{
    idNumber__1: "12345",
    assigningAuthority__4: {
      namespaceId__1: "Hospital"
    },
    identifierTypeCode__5: "MR"
  }])

  // Repeating field - add additional values one by one
  .add_pid3_patientIdentifierList({
    idNumber__1: "67890",
    identifierTypeCode__5: "SSN"
  })

  .build();
```

### Field Naming Convention

Field names use `__N` suffix to indicate HL7v2 component position:

```
{name}__N     →  component N
{name}__N__M  →  component N, subcomponent M (flattened in parent)
```

Examples:
- `givenName__2` → XPN.2
- `surname__1` → FN.1 (when nested in `familyName__1`)
- `idNumber__1` → CX.1

### DataType Interfaces

Generated interfaces mirror HL7v2 datatype structure:

```ts
// XPN - Extended Person Name
interface XPN {
  familyName__1?: FN;        // complex component
  givenName__2?: string;     // primitive component
  middleName__3?: string;
  suffix__4?: string;
  prefix__5?: string;
  degree__6?: string;
  nameTypeCode__7?: string;
  // ...
}

// FN - Family Name (nested in XPN.1)
interface FN {
  surname__1?: string;
  ownSurnamePrefix__2?: string;
  ownSurname__3?: string;
  surnamePrefixFromPartner__4?: string;
  surnameFromPartner__5?: string;
}

// CX - Composite ID
interface CX {
  idNumber__1?: string;
  checkDigit__2?: string;
  checkDigitScheme__3?: string;
  assigningAuthority__4?: HD;
  identifierTypeCode__5?: string;
  assigningFacility__6?: HD;
  // ...
}

// HD - Hierarchic Designator
interface HD {
  namespaceId__1?: string;
  universalId__2?: string;
  universalIdType__3?: string;
}
```

### Field Access Patterns

| Schema | Method | Example |
|--------|--------|---------|
| primitive | `set_[seg][N]_name(value)` | `set_pid8_administrativeSex("M")` |
| complex, single | `set_[seg][N]_name(record)` | `set_msh9_messageType({ messageCode__1: "BAR" })` |
| complex, repeating | `set_[seg][N]_name(records[])` | `set_pid3_patientIdentifierList([{ idNumber__1: "123" }])` |
| complex, repeating | `add_[seg][N]_name(record)` | `add_pid3_patientIdentifierList({ idNumber__1: "456" })` |

### Nullable Fields

All fields in record objects are optional. Undefined/null values are ignored:

```ts
// Pass values directly - undefined fields are skipped
pid.set_pid5_patientName([{
  familyName__1: {
    surname__1: patient.name?.family  // undefined if missing
  },
  givenName__2: patient.name?.given?.[0]
}])
```

### Message Builders

Type-safe builders enforce message structure from schema:

```ts
import { BAR_P01Builder } from "./hl7v2/messages";

const message = new BAR_P01Builder()
  .msh(msh => msh
    .set_msh3_sendingApplication({ namespaceId__1: "FHIR_APP" })
    .set_msh9_messageType({
      messageCode__1: "BAR",
      triggerEvent__2: "P01",
      messageStructure__3: "BAR_P01"
    })
    .set_msh10_messageControlId("MSG001"))
  .evn(evn => evn
    .set_evn1_eventTypeCode("P01")
    .set_evn2_recordedDateTime("20231201120000"))
  .pid(pid => pid
    .set_pid3_patientIdentifierList([{
      idNumber__1: "12345",
      identifierTypeCode__5: "MR"
    }])
    .set_pid5_patientName([{
      familyName__1: { surname__1: "Smith" },
      givenName__2: "John"
    }]))
  .addVISIT(visit => visit
    .pv1(pv1 => pv1.set_pv12_patientClass("I"))
    .addDG1(dg1 => dg1
      .set_dg13_diagnosisCodeDg1({
        identifier__1: "J20.9",
        nameOfCodingSystem__3: "ICD10"
      }))
    .addINSURANCE(ins => ins
      .in1(in1 => in1.set_in11_setIdIn1("1"))))
  .build();
```

**Generator example** (from `src/bar/generator.ts`):

```ts
const buildPID = (input: BarMessageInput) => (pid: PIDBuilder) => {
  const name = input.patient.name?.[0];
  const address = input.patient.address?.[0];

  return pid
    .set_pid3_patientIdentifierList([{
      idNumber__1: input.patient.identifier?.[0]?.value,
      identifierTypeCode__5: "MR"
    }])
    .set_pid5_patientName([{
      familyName__1: { surname__1: name?.family },
      givenName__2: name?.given?.[0]
    }])
    .set_pid11_patientAddress([{
      streetAddress__1: { streetOrMailingAddress__1: address?.line?.[0] },
      city__3: address?.city,
      stateOrProvince__4: address?.state,
      zipOrPostalCode__5: address?.postalCode
    }]);
};

export function generateBarMessage(input: BarMessageInput): HL7v2Message {
  return new BAR_P01Builder()
    .msh(buildMSH(input))
    .evn(buildEVN(input))
    .pid(buildPID(input))
    .addVISIT(buildVisit(input))
    .build();
}
```

## Wire Format

Serialize to pipe-delimited HL7v2:

```ts
import { formatMessage } from "./hl7v2/format";

const wireFormat = formatMessage(message);
// MSH|^~\&|SENDING_APP||...
// PID|1||12345^^^MRN||Smith^John||19900101|M
```

## Field Helpers

Auto-generated getters/setters follow naming convention:

```
{SEGMENT}_{FIELD}_{COMPONENT}_{name}
```

Examples:
- `PID_5_1_family_name` - PID.5.1 (Patient Name → Family Name)
- `MSH_9_1_message_code` - MSH.9.1 (Message Type → Message Code)

```ts
import { PID_5_1_family_name, set_PID_5_1_family_name } from "./hl7v2/fields";

const familyName = PID_5_1_family_name(pidSegment);
set_PID_5_1_family_name(pidSegment, "Smith");
```

## Design Benefits

- **1:1 mapping to wire format** - serialization is trivial
- **Schema-validatable** - fields validated against `hl7v2/schema/`
- **IDE autocomplete** - type `PID_` to see all PID field helpers
- **Compile-time safety** - message builders catch missing required segments
- **Auto-generated** - regenerate when schema updates

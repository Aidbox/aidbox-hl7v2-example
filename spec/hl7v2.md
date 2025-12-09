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

Fluent API for building segments. Fields use callbacks for complex/repeating types:

```ts
import { PIDBuilder } from "./hl7v2/fields";

const pid = new PIDBuilder()
  // Primitive field (maxOccurs: 1) - direct value
  .set1_setIdPid("1")
  .set8_administrativeSex("M")

  // Complex field (maxOccurs: 1) - callback with datatype builder
  .set9(msg => msg
    .set1_messageCode("BAR")
    .set2_triggerEvent("P01"))

  // Repeating field (maxOccurs: unbounded) - set first value
  .set3(cx => cx
    .set1_idNumber("12345")
    .set5_identifierTypeCode("MR"))

  // Repeating field - add additional values
  .add3(cx => cx
    .set1_idNumber("67890")
    .set5_identifierTypeCode("SSN"))

  // Complex field with nested components (PID.5 = XPN, XPN.1 = FN)
  .set5(xpn => xpn
    .set1_surname("Smith")      // XPN.1.1 (FN.1 = surname)
    .set2_givenName("John"))    // XPN.2

  .build();
```

### Field Access Patterns

| Schema | Method | Example |
|--------|--------|---------|
| `maxOccurs: 1`, primitive | `setN_name(value)` | `set8_administrativeSex("M")` |
| `maxOccurs: 1`, complex | `setN(cb)` | `set9(msg => msg.set1_messageCode("BAR"))` |
| `maxOccurs: unbounded` | `setN(cb)` / `addN(cb)` | `set3(cx => ...)`, `add3(cx => ...)` |

### DataType Builders

Each complex datatype (CX, XPN, MSG, etc.) gets its own builder:

```ts
// CXBuilder - Composite ID with Check Digit
cx.set1_idNumber("12345")
  .set4_assigningAuthority("Hospital")
  .set5_identifierTypeCode("MR")

// XPNBuilder - Extended Person Name
// XPN.1 is FN (Family Name) which has subcomponents, but we flatten common paths
xpn.set1_surname("Smith")       // sets XPN.1.1 (FN.1)
   .set2_givenName("John")      // sets XPN.2
   .set3_middleName("Robert")   // sets XPN.3

// MSGBuilder - Message Type
msg.set1_messageCode("BAR")
   .set2_triggerEvent("P01")
   .set3_messageStructure("BAR_P01")
```

### Nullable Setters

All setter methods accept `string | null | undefined`. When null/undefined is passed, the setter is a no-op:

```ts
// Pass nullable values directly - no fallbacks needed
pid.set5(xpn => xpn
    .set1_surname(patient.name?.family)
    .set2_givenName(patient.name?.given?.[0]))
```

**Why all setters accept null:**
- **Data type components**: All have `minOccurs: "0"` in schema (all optional)
- **Validation**: Required segments validated at message build time
- **Formatter**: Empty/null values ignored during serialization

### Message Builders

Type-safe builders enforce message structure from schema:

```ts
import { BAR_P01Builder } from "./hl7v2/messages";

const message = new BAR_P01Builder()
  .msh(msh => msh
    .set3_sendingApplication("FHIR_APP")
    .set9(msg => msg
      .set1_messageCode("BAR")
      .set2_triggerEvent("P01"))
    .set10_messageControlId("MSG001"))
  .evn(evn => evn
    .set1_eventTypeCode("P01")
    .set2_recordedDateTime("20231201120000"))
  .pid(pid => pid
    .set3(cx => cx
      .set1_idNumber("12345")
      .set5_identifierTypeCode("MR"))
    .set5(xpn => xpn
      .set1_surname("Smith")
      .set2_givenName("John")))
  .addVISIT(visit => visit
    .pv1(pv1 => pv1.set2_patientClass("I"))
    .addDG1(dg1 => dg1
      .set3(ce => ce
        .set1_identifier("J20.9")
        .set3_nameOfCodingSystem("ICD10")))
    .addINSURANCE(ins => ins
      .in1(in1 => in1.set1_setIdIn1("1"))))
  .build();
```

**Curried builder functions** (from `src/bar/generator.ts`):

```ts
// Curried functions capture context, return callbacks for builders
const buildMSH = (input: BarMessageInput) => (msh: MSHBuilder) => msh
  .set3_sendingApplication(input.sendingApplication)
  .set9(msg => msg
    .set1_messageCode("BAR")
    .set2_triggerEvent(input.triggerEvent))
  .set10_messageControlId(input.messageControlId);

const buildPID = (input: BarMessageInput) => (pid: PIDBuilder) => {
  const name = input.patient.name?.[0];
  const address = input.patient.address?.[0];
  return pid
    .set3(cx => cx.set1_idNumber(input.patient.identifier?.[0]?.value))
    .set5(xpn => xpn
      .set1_surname(name?.family)
      .set2_givenName(name?.given?.[0]))
    .set11(xad => xad.set3_city(address?.city));
};

const buildVisit = (input: BarMessageInput) => (visit: BAR_P01_VISITBuilder) => {
  if (input.encounter) visit.pv1(buildPV1(input.encounter));
  input.conditions?.forEach((c, i) => visit.addDG1(buildDG1(c, i + 1)));
  return visit;
};

// Usage
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

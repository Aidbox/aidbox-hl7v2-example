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

Fluent API for building individual segments:

```ts
import { MSHBuilder, PIDBuilder } from "./hl7v2/fields";

const msh = new MSHBuilder()
  .set9_1_messageCode("BAR")
  .set9_2_triggerEvent("P01")
  .set10_messageControlId("MSG001")
  .build();

const pid = new PIDBuilder()
  .set3_1_idNumber("12345")
  .set5_1_1_surname("Smith")
  .set5_2_givenName("John")
  .build();
```

### Nullable Setters

All setter methods accept `string | null | undefined`. When null/undefined is passed, the setter is a no-op (value is not set). This allows passing nullable values directly without fallbacks:

```ts
// Clean - pass nullable values directly
pid.set5_1_1_surname(patient.name?.family)
   .set5_2_givenName(patient.name?.given?.[0])
   .set11_3_city(patient.address?.city);

// No need for fallbacks like:
// .set5_1_1_surname(patient.name?.family ?? "")
```

**Why all setters accept null:**
- **Segment fields**: Some have `minOccurs: "1"` (required), some `minOccurs: "0"` (optional)
- **Data type components**: All have `minOccurs: "0"` in schema (all optional)
- **Validation**: Required segments are validated at message build time, not field level
- **Formatter**: Empty/null values are ignored during serialization anyway

This design prioritizes developer ergonomics - pass values as-is from nullable sources without defensive coding.

### Message Builders

Type-safe builders enforce message structure from schema. Methods accept either:
1. A pre-built `HL7v2Segment`
2. A segment builder instance (e.g., `MSHBuilder`)
3. A callback function that receives the builder for inline configuration

```ts
import { BAR_P01Builder, BAR_P01_VISIT } from "./hl7v2/messages";

// Callback API - configure builder inline (recommended)
const message = new BAR_P01Builder()
  .msh(msh => msh
    .set9_1_messageCode("BAR")
    .set9_2_triggerEvent("P01")
    .set10_messageControlId("MSG001"))
  .evn(evn => evn
    .set1_eventTypeCode("P01")
    .set2_recordedDateTime("20231201120000"))
  .pid(pid => pid
    .set3_1_idNumber("12345")
    .set5_1_1_surname("Smith")
    .set5_2_givenName("John"))
  .addVISIT(visit)
  .build();

// Also accepts pre-built segments or builders
const mshSegment = new MSHBuilder()
  .set9_1_messageCode("BAR")
  .build();

const message2 = new BAR_P01Builder()
  .msh(mshSegment)           // pre-built segment
  .evn(new EVNBuilder())     // builder instance
  .pid(pid => pid...)        // callback
  .build();
```

VISIT groups also have builders with callback support:

```ts
import { BAR_P01Builder, BAR_P01_VISITBuilder } from "./hl7v2/messages";

// Full callback-based API
new BAR_P01Builder()
  .msh(msh => msh
    .set9_1_messageCode("BAR")
    .set9_2_triggerEvent("P01"))
  .evn(evn => evn.set1_eventTypeCode("P01"))
  .pid(pid => pid.set3_1_idNumber("12345"))
  .addVISIT(visit => visit
    .pv1(pv1 => pv1.set2_patientClass("I"))
    .addDG1(dg1 => dg1.set3_1_identifier("J20.9"))
    .addINSURANCE(ins => ins
      .in1(in1 => in1.set1_setIdIn1("1"))))
  .build();

// Or use plain objects (backward compatible)
const visit: BAR_P01_VISIT = {
  pv1: new PV1Builder().set2_patientClass("I").build(),
  dg1: [new DG1Builder().set3_1_identifier("J20.9").build()],
};
new BAR_P01Builder()
  .msh(mshSegment)
  .evn(evnSegment)
  .pid(pidSegment)
  .addVISIT(visit)
  .build();
```

**Curried builder functions** (from `src/bar/generator.ts`):

```ts
// Curried functions capture context, return callbacks for builders
const buildMSH = (input: BarMessageInput) => (msh: MSHBuilder) => msh
  .set9_1_messageCode("BAR")
  .set9_2_triggerEvent(input.triggerEvent)
  .set10_messageControlId(input.messageControlId);

const buildPID = (input: BarMessageInput) => (pid: PIDBuilder) => {
  const name = input.patient.name?.[0];
  const address = input.patient.address?.[0];
  return pid
    .set3_1_idNumber(input.patient.identifier?.[0]?.value)
    .set5_1_1_surname(name?.family)
    .set5_2_givenName(name?.given?.[0])
    .set11_3_city(address?.city);
};

const buildVisit = (input: BarMessageInput) => (visit: BAR_P01_VISITBuilder) => {
  if (input.encounter) visit.pv1(buildPV1(input.encounter));
  input.conditions?.forEach((c, i) => visit.addDG1(buildDG1(c, i + 1)));
  return visit;
};

// Usage - curried functions called with input, return callbacks
export function generateBarMessage(input: BarMessageInput): HL7v2Message {
  return new BAR_P01Builder()
    .msh(buildMSH(input))
    .evn(buildEVN(input))
    .pid(buildPID(input))
    .addVISIT(buildVisit(input))
    .build();
}
```

**Generated interfaces and builders:**

```ts
interface BAR_P01_VISIT {
  pv1?: HL7v2Segment;
  dg1?: HL7v2Segment[];
  procedure?: BAR_P01_PROCEDURE[];
  gt1?: HL7v2Segment[];
  insurance?: BAR_P01_INSURANCE[];
}

class BAR_P01_VISITBuilder {
  pv1(segment: HL7v2Segment | PV1Builder | ((b: PV1Builder) => PV1Builder)): this;
  addDG1(segment: HL7v2Segment | DG1Builder | ((b: DG1Builder) => DG1Builder)): this;
  addPROCEDURE(group: BAR_P01_PROCEDURE | BAR_P01_PROCEDUREBuilder | ((b: BAR_P01_PROCEDUREBuilder) => BAR_P01_PROCEDUREBuilder)): this;
  // ...
  build(): BAR_P01_VISIT;
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

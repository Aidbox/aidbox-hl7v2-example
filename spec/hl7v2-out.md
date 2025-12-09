# HL7v2 Outgoing Message

We implement HL7v2 as array of objects: 

```ts
interface HL7v2Segment {
    segment: string;
    fields: Record<string | number, string>;
}

type HL7v2Message = HL7v2Segment[];

// Example:
const msg: HL7v2Message = [
    {
        segment: "MSH",
        fields: {
            3: "SENDING",
            4: "FACILITY",
            5: "RECEIVING",
            6: "FACILITY",
            7: "202312011200",
        }
    },
    { 
        segment: "PID",
        fields: {
            3: "1234567890",
            5: [{0: "Doe", 1: "Smith"}],
            6: "19900101",
            7: "M",
        }
    }
];
```

Each object has a key and a value. The key is the field name and the value is the field value.
Fields are array of fileds, which consists of components (objects).
The order of the objects is the order of the fields in the HL7v2 message. Formatter should be able to render this array of objects into a HL7v2 message string.

## HL7v2 Schema Reference

The `hl7v2/schema/` directory contains a comprehensive HL7v2 message schema library for parsing/building HL7v2 messages:

### Directory Structure

| Directory | Description |
|-----------|-------------|
| `messages/` | Message structure definitions (ADT_A01, ORU_R01, BAR_P01, etc.) |
| `segments/` | Segment field definitions (MSH, PID, PV1, etc.) |
| `fields/` | Field-to-datatype mappings with human-readable names |
| `dataTypes/` | Complex data type component definitions |
| `structure/index.json` | Message type code to structure mapping |

### Messages (`messages/*.json`)

Defines which segments a message type contains with cardinality:

```json
// ADT_A01.json
{
  "ADT_A01": {
    "elements": [
      { "segment": "MSH", "minOccurs": "1", "maxOccurs": "1" },
      { "segment": "EVN", "minOccurs": "1", "maxOccurs": "1" },
      { "segment": "PID", "minOccurs": "1", "maxOccurs": "1" },
      { "segment": "PV1", "minOccurs": "1", "maxOccurs": "1" },
      { "group": "INSURANCE", "minOccurs": "0", "maxOccurs": "unbounded" }
    ]
  }
}
```

### Segments (`segments/*.json`)

Defines which fields a segment contains:

```json
// PID.json
{
  "fields": [
    { "field": "PID.3", "minOccurs": "1", "maxOccurs": "unbounded" },
    { "field": "PID.5", "minOccurs": "1", "maxOccurs": "unbounded" }
  ]
}
```

### Fields (`fields/*.json`)

Maps fields to data types:

```json
// PID.5.json
{ "dataType": "XPN", "longName": "Patient Name" }
```

### Data Types (`dataTypes/*.json`)

Defines complex type components:

```json
// XPN.json - Extended Person Name
{
  "components": [
    { "dataType": "XPN.1", "minOccurs": "0", "maxOccurs": "1" },
    { "dataType": "XPN.2", "minOccurs": "0", "maxOccurs": "1" }
  ]
}

// XPN.1.json
{ "dataType": "FN", "longName": "Family Name" }
```

### Structure Mapping (`structure/index.json`)

Maps message codes to structure definitions:

```json
{
  "ADT": { "A01": "ADT_A01", "A04": "ADT_A01", "A08": "ADT_A01" },
  "BAR": { "P01": "BAR_P01", "P02": "BAR_P02", "P05": "BAR_P05" },
  "ORU": { "R01": "ORU_R01" }
}
```
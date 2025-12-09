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
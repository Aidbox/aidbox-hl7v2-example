# ADR: HL7v2 Message Representation

## Status

Accepted

## Context

We need an internal representation for HL7v2 messages that:
- Maps directly to the wire format (pipe-delimited)
- Supports complex nested fields and repeating values
- Is easy to serialize/deserialize
- Allows convenient field access when needed

## Decision

### Internal Representation

Use numeric field keys matching HL7v2 field positions:

```ts
type FieldValue = string | FieldValue[] | { [key: number]: FieldValue };

interface HL7v2Segment {
  segment: string;
  fields: Record<number, FieldValue>;
}

type HL7v2Message = HL7v2Segment[];
```

### Example

```ts
const msg: HL7v2Message = [
  {
    segment: "MSH",
    fields: {
      3: "SENDING_APP",
      4: "SENDING_FAC",
      5: "RECEIVING_APP",
      6: "RECEIVING_FAC",
      7: "202312011200",
      9: { 1: "ADT", 2: "A01" },  // MSG datatype: message code, trigger event
      10: "MSG001",
      11: { 1: "P" },
      12: { 1: "2.5.1" }
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
  },
  {
    segment: "PV1",
    fields: {
      2: "I",
      3: { 1: "ICU", 2: "101", 3: "A" }
    }
  }
];
```

### Named Field Helpers

Provide explicit helper functions for common field access. Naming convention:

```
{SEGMENT}_{FIELD}_{COMPONENT}_{name}
```

Examples:
- `PID_5_1_family_name` - PID.5.1 (Patient Name → Family Name)
- `PID_5_2_given_name` - PID.5.2 (Patient Name → Given Name)
- `PID_7_birth_date` - PID.7 (Date of Birth)
- `MSH_9_1_message_code` - MSH.9.1 (Message Type → Message Code)
- `MSH_9_2_trigger_event` - MSH.9.2 (Message Type → Trigger Event)

```ts
// Getters
export const PID_5_1_family_name = (seg: HL7v2Segment): string | undefined => {
  const f5 = seg.fields[5];
  const first = Array.isArray(f5) ? f5[0] : f5;
  if (typeof first === "object") {
    const comp1 = first[1];
    return typeof comp1 === "object" ? comp1[1] : comp1;
  }
};

export const MSH_9_1_message_code = (seg: HL7v2Segment): string | undefined => {
  const f9 = seg.fields[9];
  return typeof f9 === "object" ? f9[1] as string : undefined;
};

// Setters
export const set_PID_5_1_family_name = (seg: HL7v2Segment, value: string) => {
  seg.fields[5] ??= [{}];
  const f5 = Array.isArray(seg.fields[5]) ? seg.fields[5][0] : seg.fields[5];
  if (typeof f5 === "object") {
    f5[1] = { 1: value };
  }
};
```

### File Structure

```
src/hl7v2/
  types.ts       # FieldValue, HL7v2Segment, HL7v2Message
  format.ts      # serialize to pipe-delimited string
  parse.ts       # parse from pipe-delimited string
  fields.ts      # named field helpers (getters/setters) - GENERATED
  codegen.ts     # generates fields.ts from schema
```

### Code Generation from Schema

Field helpers are auto-generated from `hl7v2/schema/` directory:

```
hl7v2/schema/
  segments/       # PID.json, MSH.json → which fields exist
  fields/         # PID.5.json → { dataType: "XPN", longName: "Patient Name" }
  dataTypes/      # XPN.json → components, XPN.1.json → { dataType: "FN", longName: "Family Name" }
```

**Generation algorithm:**

1. For each segment in `segments/*.json`:
   - Read field list (e.g., PID has fields PID.1 through PID.39)
2. For each field in `fields/*.json`:
   - Get `dataType` and `longName` (e.g., PID.5 → XPN, "Patient Name")
3. For complex datatypes in `dataTypes/*.json`:
   - Get components (e.g., XPN has XPN.1 through XPN.14)
   - Get component names (e.g., XPN.1 → FN, "Family Name")
4. Generate helper function with name derived from path + longName:
   - `PID_5_patient_name` (field-level)
   - `PID_5_1_family_name` (component-level)

**Example codegen output:**

```ts
// AUTO-GENERATED from hl7v2/schema - do not edit manually

// PID.5 - Patient Name (XPN)
export const PID_5_patient_name = (seg: HL7v2Segment) => seg.fields[5];
export const PID_5_1_family_name = (seg: HL7v2Segment) => getComponent(seg, 5, 1);
export const PID_5_2_given_name = (seg: HL7v2Segment) => getComponent(seg, 5, 2);

// PID.7 - Date/Time of Birth (TS)
export const PID_7_birth_date = (seg: HL7v2Segment) => seg.fields[7];

// MSH.9 - Message Type (MSG)
export const MSH_9_message_type = (seg: HL7v2Segment) => seg.fields[9];
export const MSH_9_1_message_code = (seg: HL7v2Segment) => getComponent(seg, 9, 1);
export const MSH_9_2_trigger_event = (seg: HL7v2Segment) => getComponent(seg, 9, 2);
```

**Run codegen:**

```sh
bun src/hl7v2/codegen.ts > src/hl7v2/fields.ts
```

## Consequences

### Positive

- **1:1 mapping to wire format** - serialization is trivial
- **No translation layer** - parsers write directly to internal format
- **Schema-validatable** - can walk fields by number against `hl7v2/schema/`
- **Grep-friendly helpers** - `grep PID_5` finds all Patient Name helpers
- **IDE autocomplete** - type `PID_` to see all PID field helpers
- **Self-documenting** - helper names include semantic meaning

### Negative

- **Raw format requires HL7v2 knowledge** - field numbers aren't obvious without helpers

### Neutral

- Helpers are optional - use for common segments, skip for rare ones
- **Helpers are auto-generated** - no manual maintenance, regenerate when schema updates

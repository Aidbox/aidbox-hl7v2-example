# HL7v2 Module

Type-safe HL7v2 message building and parsing with schema-driven code generation. For conceptual background on HL7v2 message structure, see the [User Guide](../user-guide/concepts.md#hl7v2).

## Overview

This module provides:
- TypeScript interfaces for HL7v2 segments and datatypes
- Fluent builders for constructing messages
- Field accessors for reading parsed messages
- Serialization to wire format (pipe-delimited)

All types are generated from HL7v2 schema files, ensuring correctness and IDE autocomplete support.

## Building Messages (Outgoing)

Use **message builders** to construct messages, then `formatMessage()` to serialize:

```typescript
import { BAR_P01Builder } from "./hl7v2/generated/messages";
import { formatMessage } from "@atomic-ehr/hl7v2/src/hl7v2/format";

const message = new BAR_P01Builder()
  .msh(mshData)
  .evn(evnData)
  .pid(pidData)
  .addVISIT(visit => visit.pv1(pv1Data))
  .build();

const wireFormat = formatMessage(message);
// MSH|^~\&|FHIR_APP||...
// PID|1||12345^^^MRN||Smith^John||19900101|M
```

Builders enforce:
- Required segments are present
- Segment order matches schema
- Repeating groups use `addXXX()` methods
- Typed segment data via interfaces

## Reading Messages (Incoming)

Use **typed interfaces** with `fromXXX()` functions for parsing:

```typescript
import { fromPID, type PID } from "./hl7v2/generated/fields";

const pidSegment = message.find(s => s.segment === "PID");
const pid: PID = fromPID(pidSegment);

// Access fields with IDE autocomplete
const familyName = pid.$5_name?.[0]?.$1_family?.$1_family;
const birthDate = pid.$7_birthDate;
```

### Field Naming Convention

All generated interfaces use the `$N_fieldName` pattern where N is the HL7v2 field or component position:

| Pattern | Meaning | Example |
|---------|---------|---------|
| `$N_fieldName` | Field N in segment | `$5_name` → PID-5 |
| `$N_componentName` | Component N in datatype | `$1_family` → XPN.1 |

Nested structures follow HL7v2 hierarchy. For example, `pid.$5_name[0].$1_family.$1_family` navigates: PID-5 (patient name) → first repetition → XPN.1 (family name component) → FN.1 (surname string).

### Wrappers

The `src/hl7v2/wrappers/` directory contains fixes for edge cases in the generated parsers. Use wrappers instead of generated functions where available:

```typescript
import { fromOBX } from "./hl7v2/wrappers";  // Instead of from generated/fields
```

Currently: `obx.ts` fixes SN (Structured Numeric) value parsing where `^` is data, not a component separator.

## How It Works

### Internal Representation

Messages use numeric field keys matching HL7v2 positions:

```typescript
type FieldValue = string | FieldValue[] | { [key: number]: FieldValue };

interface HL7v2Segment {
  segment: string;
  fields: Record<number, FieldValue>;
}

type HL7v2Message = HL7v2Segment[];
```

**Example:**
```typescript
const msg: HL7v2Message = [
  {
    segment: "MSH",
    fields: {
      3: "SENDING_APP",
      7: "202312011200",
      9: { 1: "ADT", 2: "A01" },  // MSG datatype
      10: "MSG001"
    }
  },
  {
    segment: "PID",
    fields: {
      3: [{ 1: "12345", 4: { 1: "MRN" } }],  // Repeating CX
      5: [{ 1: { 1: "Doe" }, 2: "John" }],   // XPN with nested FN
      7: "19900101",
      8: "M"
    }
  }
];
```

### Code Generation

Regenerate TypeScript bindings from the `@atomic-ehr/hl7v2` package:

```sh
bun run regenerate-hl7v2
```

The script runs the code generator from the package to produce type definitions in `src/hl7v2/generated/`. This provides type safety and IDE autocomplete.

## Code Locations

| Component | File | Entry Point |
|-----------|------|-------------|
| Core types | `src/hl7v2/generated/types.ts` | `HL7v2Message`, `HL7v2Segment` |
| Segment interfaces | `src/hl7v2/generated/fields.ts` | `PID`, `MSH`, `OBX`, `fromPID()`, etc. |
| Message builders | `src/hl7v2/generated/messages.ts` | `BAR_P01Builder`, `ORU_R01Builder` |
| Table constants | `src/hl7v2/generated/tables.ts` | HL7 table values |
| Wrappers | `src/hl7v2/wrappers/` | Parser fixes (e.g., OBX SN values) |
| Wire format | `@atomic-ehr/hl7v2` | `formatMessage()` |
| Regeneration script | `scripts/regenerate-hl7v2.sh` | - |

## See Also

- [BAR Generation](bar-generation.md) - Using builders for outgoing messages
- [ORU Processing](oru-processing.md) - Parsing incoming messages
- [How-To: Extending Outgoing Fields](how-to/extending-outgoing-fields.md) - Adding FHIR→HL7v2 mappings
- [How-To: Extending Incoming Fields](how-to/extending-incoming-fields.md) - Adding HL7v2→FHIR mappings
- [How-To: Extracting Modules](how-to/extracting-modules.md) - Using this module standalone

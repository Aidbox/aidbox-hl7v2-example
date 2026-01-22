# HL7v2 Module

Type-safe HL7v2 message building and parsing with schema-driven code generation. For conceptual background on HL7v2 message structure, see the [User Guide](../user-guide/concepts.md#hl7v2).

## Overview

This module provides:
- TypeScript interfaces for HL7v2 segments and datatypes
- Fluent builders for constructing messages
- Field accessors for reading parsed messages
- Serialization to wire format (pipe-delimited)

All types are generated from HL7v2 schema files, ensuring correctness and IDE autocomplete support.

## When to Use What

| Task | Approach | Example |
|------|----------|---------|
| **Build outgoing message** | Message builder + segment builders | `BAR_P01Builder().msh(buildMSH()).pid(buildPID()).build()` |
| **Read incoming message** | `fromXXX()` functions + typed interfaces | `const pid = fromPID(segment); pid.$5_name[0].$1_family` |
| **Access single field** | Field helper functions | `PID_5_1_family_name(segment)` |
| **Modify existing segment** | Setter functions | `set_PID_5_1_family_name(segment, "Smith")` |

### Building Messages (Outgoing)

Use **message builders** for constructing complete messages with proper structure:

```typescript
import { BAR_P01Builder } from "./hl7v2/generated/messages";

const message = new BAR_P01Builder()
  .msh(mshData)
  .evn(evnData)
  .pid(pidData)
  .addVISIT(visit => visit.pv1(pv1Data))
  .build();
```

Builders enforce:
- Required segments are present
- Segment order matches schema
- Repeating groups use `addXXX()` methods

### Reading Messages (Incoming)

Use **typed interfaces** with `fromXXX()` functions for parsing:

```typescript
import { fromPID, fromOBX, type PID, type OBX } from "./hl7v2/generated/fields";

const pidSegment = message.find(s => s.segment === "PID");
const pid: PID = fromPID(pidSegment);

// Access fields with IDE autocomplete
const familyName = pid.$5_name?.[0]?.$1_family?.$1_family;
const birthDate = pid.$7_birthDate;
```

### Direct Field Access

Use **field helpers** for simple reads or modifications:

```typescript
import { PID_5_1_family_name, set_PID_5_1_family_name } from "./hl7v2/generated/fields";

// Read
const name = PID_5_1_family_name(pidSegment);

// Write
set_PID_5_1_family_name(pidSegment, "Smith");
```

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

Generate TypeScript bindings from HL7v2 schema:

```sh
# Regenerate all HL7v2 types
bun run regenerate-hl7v2

# Or manually for specific message types
bun src/hl7v2/codegen.ts BAR_P01 > src/hl7v2/generated/fields.ts
bun src/hl7v2/codegen.ts BAR_P01 --messages > src/hl7v2/generated/messages.ts
```

## Implementation Details

### Segment Interfaces

Segments are defined as TypeScript interfaces with `$N_fieldName` property names:

```typescript
import type { PID, MSH } from "./hl7v2/generated/fields";

const pid: PID = {
  $1_setIdPid: "1",
  $3_identifier: [{
    $1_value: "12345",
    $5_type: "MR",
  }],
  $5_name: [{
    $1_family: { $1_family: "Smith" },
    $2_given: "John",
  }],
  $7_birthDate: "19900101",
  $8_gender: "M",
};
```

### Field Naming Convention

Field names use `$N_fieldName` prefix where N is the HL7v2 field/component number:

```
$N_fieldName         →  field N
$N_componentName     →  component N (within complex types)
```

Examples:
- `$5_name` → PID-5
- `$1_family` → XPN.1 (family name component)
- `$2_given` → XPN.2 (given name component)

### Datatype Interfaces

Generated interfaces match HL7v2 datatype structure:

```typescript
// XPN - Extended Person Name (used in PID-5)
interface XPN {
  $1_family?: FN;
  $2_given?: string;
  $3_additionalGiven?: string;
  $4_suffix?: string;
  $5_prefix?: string;
}

// FN - Family Name (nested in XPN.$1_family)
interface FN {
  $1_family?: string;
}

// CX - Composite ID (used in PID-3)
interface CX {
  $1_value?: string;
  $4_authority?: HD;
  $5_type?: string;
}

// HD - Hierarchic Designator
interface HD {
  $1_namespace?: string;
  $2_universalId?: string;
  $3_universalIdType?: string;
}
```

### Message Builders

Message builders accept segment data objects directly:

```typescript
import { BAR_P01Builder } from "./hl7v2/generated/messages";
import type { MSH, EVN, PID, PV1, DG1 } from "./hl7v2/generated/fields";

const msh: MSH = {
  $3_sendingApplication: { $1_namespace: "FHIR_APP" },
  $9_messageType: { $1_code: "BAR", $2_event: "P01" },
  $10_messageControlId: "MSG001",
};

const pid: PID = {
  $1_setIdPid: "1",
  $3_identifier: [{ $1_value: "12345", $5_type: "MR" }],
  $5_name: [{ $1_family: { $1_family: "Smith" }, $2_given: "John" }],
};

const message = new BAR_P01Builder()
  .msh(msh)
  .evn({ $1_eventTypeCode: "P01" })
  .pid(pid)
  .addVISIT(visit => visit
    .pv1({ $2_class: "I" })
    .addDG1({
      $1_setIdDg1: "1",
      $3_diagnosisCodeDg1: { $1_code: "J20.9", $3_system: "ICD10" },
    }))
  .build();
```

### Wire Format Serialization

Convert internal representation to pipe-delimited HL7v2:

```typescript
import { formatMessage } from "@atomic-ehr/hl7v2/src/hl7v2/format";

const wireFormat = formatMessage(message);
// MSH|^~\&|FHIR_APP||...
// PID|1||12345^^^MRN||Smith^John||19900101|M
```

### Field Helper Functions

Auto-generated getters/setters for direct field access:

```typescript
import { PID_5_1_family_name, set_PID_5_1_family_name } from "./hl7v2/generated/fields";

const familyName = PID_5_1_family_name(pidSegment);
set_PID_5_1_family_name(pidSegment, "Smith");
```

Pattern: `{SEGMENT}_{FIELD}_{COMPONENT}_{name}`

### Schema Files

```
hl7v2/schema/
├── messages/     # ADT_A01.json, BAR_P01.json - message structure
├── segments/     # PID.json, MSH.json - segment field lists
├── fields/       # PID.5.json - field metadata
├── dataTypes/    # XPN.json - complex type components
└── structure/    # index.json - message code mapping
```

**Message schema example:**
```json
{
  "BAR_P01": {
    "elements": [
      { "segment": "MSH", "minOccurs": "1", "maxOccurs": "1" },
      { "segment": "PID", "minOccurs": "1", "maxOccurs": "1" },
      { "group": "VISIT", "minOccurs": "1", "maxOccurs": "unbounded" }
    ]
  }
}
```

### Design Benefits

- **1:1 mapping to wire format** - Serialization is trivial
- **Schema-validatable** - Fields validated against `hl7v2/schema/`
- **IDE autocomplete** - Type definitions enable discovery
- **Compile-time safety** - Message builders catch missing required segments
- **Auto-generated** - Regenerate when schema updates

## Code Locations

| Component | File | Entry Point |
|-----------|------|-------------|
| Core types | `src/hl7v2/generated/types.ts` | `HL7v2Message`, `HL7v2Segment` |
| Segment interfaces | `src/hl7v2/generated/fields.ts` | `PID`, `MSH`, `OBX`, `fromPID()`, etc. |
| Message builders | `src/hl7v2/generated/messages.ts` | `BAR_P01Builder`, `ORU_R01Builder` |
| Table constants | `src/hl7v2/generated/tables.ts` | HL7 table values |
| Wire format | `@atomic-ehr/hl7v2` | `formatMessage()` |
| Regeneration script | `scripts/regenerate-hl7v2.sh` | - |

## See Also

- [BAR Generation](bar-generation.md) - Using builders for outgoing messages
- [ORU Processing](oru-processing.md) - Parsing incoming messages
- [How-To: Extending Fields](how-to/extending-fields.md) - Adding new field mappings
- [How-To: Extracting Modules](how-to/extracting-modules.md) - Using this module standalone

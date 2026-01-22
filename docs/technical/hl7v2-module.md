# HL7v2 Module

Type-safe HL7v2 message building and parsing with schema-driven code generation.

## Overview

This module provides:
- TypeScript interfaces for HL7v2 segments and datatypes
- Fluent builders for constructing messages
- Field accessors for reading parsed messages
- Serialization to wire format (pipe-delimited)

All types are generated from HL7v2 schema files, ensuring correctness and IDE autocomplete support.

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

### Segment Builders

Fluent API for building segments. Method pattern: `set_{segment}{N}_{fieldName}`:

```typescript
import { PIDBuilder } from "./hl7v2/generated/fields";

const pid = new PIDBuilder()
  .set_pid1_setIdPid("1")
  .set_pid8_administrativeSex("M")
  .set_pid5_patientName([{
    familyName__1: { surname__1: "Smith" },
    givenName__2: "John"
  }])
  .set_pid3_patientIdentifierList([{
    idNumber__1: "12345",
    identifierTypeCode__5: "MR"
  }])
  .add_pid3_patientIdentifierList({
    idNumber__1: "67890",
    identifierTypeCode__5: "SSN"
  })
  .build();
```

**Method patterns:**

| Schema | Method | Example |
|--------|--------|---------|
| Primitive, single | `set_{seg}{N}_{name}(value)` | `set_pid8_administrativeSex("M")` |
| Complex, single | `set_{seg}{N}_{name}(record)` | `set_msh9_messageType({ messageCode__1: "BAR" })` |
| Complex, repeating | `set_{seg}{N}_{name}(records[])` | `set_pid3_patientIdentifierList([...])` |
| Complex, repeating | `add_{seg}{N}_{name}(record)` | `add_pid3_patientIdentifierList({...})` |

### Field Naming Convention

Field names use `__N` suffix for HL7v2 component position:

```
{name}__N     →  component N
{name}__N__M  →  component N, subcomponent M (flattened)
```

Examples:
- `givenName__2` → XPN.2
- `surname__1` → FN.1 (when nested in `familyName__1`)
- `idNumber__1` → CX.1

### Datatype Interfaces

Generated interfaces match HL7v2 datatype structure:

```typescript
// XPN - Extended Person Name
interface XPN {
  familyName__1?: FN;
  givenName__2?: string;
  middleName__3?: string;
  suffix__4?: string;
  prefix__5?: string;
  nameTypeCode__7?: string;
}

// FN - Family Name (nested in XPN.1)
interface FN {
  surname__1?: string;
  ownSurnamePrefix__2?: string;
  ownSurname__3?: string;
}

// CX - Composite ID
interface CX {
  idNumber__1?: string;
  checkDigit__2?: string;
  assigningAuthority__4?: HD;
  identifierTypeCode__5?: string;
}

// HD - Hierarchic Designator
interface HD {
  namespaceId__1?: string;
  universalId__2?: string;
  universalIdType__3?: string;
}
```

### Message Builders

Type-safe builders enforce message structure from schema:

```typescript
import { BAR_P01Builder } from "./hl7v2/generated/messages";

const message = new BAR_P01Builder()
  .msh(msh => msh
    .set_msh3_sendingApplication({ namespaceId__1: "FHIR_APP" })
    .set_msh9_messageType({
      messageCode__1: "BAR",
      triggerEvent__2: "P01"
    })
    .set_msh10_messageControlId("MSG001"))
  .evn(evn => evn
    .set_evn1_eventTypeCode("P01"))
  .pid(pid => pid
    .set_pid3_patientIdentifierList([{
      idNumber__1: "12345",
      identifierTypeCode__5: "MR"
    }]))
  .addVISIT(visit => visit
    .pv1(pv1 => pv1.set_pv12_patientClass("I"))
    .addDG1(dg1 => dg1
      .set_dg13_diagnosisCodeDg1({
        identifier__1: "J20.9",
        nameOfCodingSystem__3: "ICD10"
      })))
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
| Core types | `src/hl7v2/types.ts` | `HL7v2Message`, `HL7v2Segment` |
| Segment builders | `src/hl7v2/generated/fields.ts` | `PIDBuilder`, `MSHBuilder`, etc. |
| Message builders | `src/hl7v2/generated/messages.ts` | `BAR_P01Builder`, `ORU_R01Builder` |
| Table constants | `src/hl7v2/generated/tables.ts` | HL7 table values |
| Code generator | `src/hl7v2/codegen.ts` | `generateFields()`, `generateMessages()` |
| Wire format | `@atomic-ehr/hl7v2` | `formatMessage()` |
| Regeneration script | `scripts/regenerate-hl7v2.sh` | - |
| Schema files | `hl7v2/schema/` | JSON definitions |

## See Also

- [BAR Generation](bar-generation.md) - Using builders for outgoing messages
- [ORU Processing](oru-processing.md) - Parsing incoming messages
- [How-To: Extending Fields](how-to/extending-fields.md) - Adding new field mappings
- [How-To: Extracting Modules](how-to/extracting-modules.md) - Using this module standalone

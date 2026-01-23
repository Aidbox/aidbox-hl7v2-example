# Extracting Modules

How to extract and integrate modules from this project into your own application.

## Module Dependencies

```
hl7v2/          → standalone (no project dependencies)
mllp/           → depends on hl7v2/
bar/            → depends on hl7v2/, fhir/
code-mapping/   → depends on fhir/
v2-to-fhir/     → depends on hl7v2/, fhir/, code-mapping/
```

## Code Generation

This project uses two code generators from [@atomic-ehr](https://github.com/atomic-ehr).

### FHIR R4 Types

```sh
bun run regenerate-fhir   # Regenerates src/fhir/hl7-fhir-r4-core/
```

- Script: `scripts/regenerate-fhir.ts`
- Output: TypeScript interfaces for FHIR R4 resources

### HL7v2 Message Bindings

```sh
bun run regenerate-hl7v2  # Regenerates src/hl7v2/generated/
```

- Script: `scripts/regenerate-hl7v2.sh`
- Output: Segment interfaces, builders, message builders, table constants

## Extracting the HL7v2 Module

The `src/hl7v2/` module provides type-safe HL7v2 message building and parsing. This is the most reusable module with no project-specific dependencies.

### Files to Copy

```
src/hl7v2/
├── generated/
│   ├── types.ts       # Core types (HL7v2Message, HL7v2Segment)
│   ├── fields.ts      # Segment interfaces and fromXXX() parsers
│   ├── messages.ts    # Message builders
│   └── tables.ts      # HL7 table constants
└── wrappers/
    ├── index.ts       # Wrapper exports
    └── obx.ts         # OBX SN value parsing fix
```

### External Dependencies

```json
{
  "dependencies": {
    "@atomic-ehr/hl7v2": "^x.x.x"
  }
}
```

Used for: `formatMessage()`, `highlightHL7Message()`

### Usage Example

```typescript
import { BAR_P01Builder } from "./hl7v2/generated/messages";
import type { MSH, PID } from "./hl7v2/generated/fields";
import { formatMessage } from "@atomic-ehr/hl7v2/src/hl7v2/format";

const msh: MSH = {
  $3_sendingApplication: { $1_namespace: "MY_APP" },
  $10_messageControlId: "MSG001",
};

const pid: PID = {
  $3_identifier: [{ $1_value: "12345" }],
};

const message = new BAR_P01Builder()
  .msh(msh)
  .pid(pid)
  .build();

console.log(formatMessage(message));
```

## Extracting the MLLP Server

The `src/mllp/` module implements MLLP protocol for receiving HL7v2 messages.

### Files to Copy

```
src/mllp/
├── mllp-server.ts     # Server implementation
└── index.ts           # Module exports
```

### Dependencies

- `src/hl7v2/` - For message type extraction and ACK generation
- Requires replacing `storeMessage()` function with your storage logic

### Customization

The server accepts a custom message handler:

```typescript
import { createMLLPServer } from "./mllp";

const server = createMLLPServer(2575, {
  storeMessageFn: async (hl7Message: string) => {
    // Your custom storage logic
    await myDatabase.insert({ message: hl7Message });
  }
});

server.listen(2575);
```

## Extracting the BAR Generator

The `src/bar/` module generates HL7v2 BAR messages from FHIR resources.

### Files to Copy

```
src/bar/
├── generator.ts       # Core BAR message generation
├── types.ts           # Input types (BarMessageInput)
└── index.ts           # Module exports
```

### Dependencies

- `src/hl7v2/` - For message building
- `src/fhir/` - For FHIR type definitions

### Usage Example

```typescript
import { generateBarMessage, BarMessageInput } from "./bar";
import { formatMessage } from "@atomic-ehr/hl7v2/src/hl7v2/format";

const input: BarMessageInput = {
  patient,      // FHIR Patient
  account,      // FHIR Account
  encounter,    // FHIR Encounter
  coverages,    // FHIR Coverage[]
  conditions,   // FHIR Condition[]
  procedures,   // FHIR Procedure[]
  messageControlId: "MSG001",
  triggerEvent: "P01",
};

const message = generateBarMessage(input);
console.log(formatMessage(message));
```

## Extracting the V2-to-FHIR Converter

The `src/v2-to-fhir/` module converts incoming HL7v2 messages to FHIR resources.

### Files to Copy

```
src/v2-to-fhir/
├── converter.ts       # Core conversion logic
├── messages/          # Message-level converters (adt-a01.ts, adt-a08.ts, oru-r01.ts)
├── segments/          # Segment converters (pid-patient.ts, obx-observation.ts)
├── datatypes/         # Datatype converters (xpn-humanname.ts, cwe-codeableconcept.ts)
└── index.ts           # Module exports
```

### Dependencies

- `src/hl7v2/` - For message parsing
- `src/fhir/` - For FHIR type definitions
- `src/code-mapping/` - For LOINC code resolution

### Custom Resources Required

If using the processor service with Aidbox, you need custom resource definitions:

- `IncomingHL7v2Message` - StructureDefinition for storing received messages
- SearchParameter `unmapped-task` - For querying messages by mapping task reference

See `src/migrate.ts` and `init-bundle.json` for loading these definitions.

### Customization

Replace the code mapping dependency if you don't need LOINC resolution:

```typescript
// Stub that always returns the code as-is
const resolveLOINCCode = (code: string) => ({
  resolved: true,
  loincCode: code
});
```

## Extracting the Code Mapping System

The `src/code-mapping/` module handles local-to-LOINC code mappings.

### Files to Copy

```
src/code-mapping/
├── concept-map/
│   ├── lookup.ts      # ConceptMap lookup
│   ├── service.ts     # ConceptMap CRUD
│   └── index.ts
├── mapping-task-service.ts   # Task lifecycle
├── terminology-api.ts        # External LOINC lookup
└── index.ts
```

### Dependencies

- Requires a FHIR server for ConceptMap and Task storage
- Requires a terminology server for LOINC lookups (or stub it)
- `src/fhir/` - For FHIR type definitions

### Customization Points

1. **Storage**: Requires Aidbox or your FHIR server
2. **Terminology**: Replace terminology API with your LOINC source
3. **Task handling**: Customize Task resource structure if needed

## Testing

```sh
bun test              # Run all tests
bun run typecheck     # TypeScript type checking
```

## See Also

- [HL7v2 Module](../hl7v2-module.md) - Detailed API documentation
- [BAR Generation](../bar-generation.md) - BAR message specification
- [ORU Processing](../oru-processing.md) - ORU conversion details
- [Code Mapping](../code-mapping.md) - Code mapping workflow

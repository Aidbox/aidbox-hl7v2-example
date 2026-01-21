# Integration Guide

How to extract and integrate modules from this project into your own application.

## Code Generation

This project uses two code generators from the [@atomic-ehr](https://github.com/atomic-ehr) ecosystem.

### FHIR R4 Types

Generated using [@atomic-ehr/codegen](https://github.com/atomic-ehr/codegen) from the official HL7 FHIR R4 specification.

```sh
bun run regenerate-fhir   # Regenerates src/fhir/hl7-fhir-r4-core/
```

- Script: `scripts/regenerate-fhir.ts`
- Output: TypeScript interfaces for FHIR R4 resources in `src/fhir/hl7-fhir-r4-core/`
- Includes Patient, Encounter, Coverage, Condition, Procedure, Invoice, DiagnosticReport, Observation, etc.

### HL7v2 Message Bindings

Generated using [@atomic-ehr/hl7v2](https://github.com/atomic-ehr/atomic-hl7v2) for type-safe HL7v2 message handling.

```sh
bun run regenerate-hl7v2  # Regenerates src/hl7v2/generated/
```

- Script: `scripts/regenerate-hl7v2.sh`
- Output:
  - `generated/types.ts` - Core types: `HL7v2Message`, `HL7v2Segment`, `FieldValue`
  - `generated/fields.ts` - Segment interfaces, `toSegment()`, and `fromXXX()` getters
  - `generated/messages.ts` - Message builders (`BAR_P01Builder`, `ORU_R01Builder`)
  - `generated/tables.ts` - HL7 table constants

See [HL7v2 Builders](modules/hl7v2-builders.md) for detailed usage.

## Testing

```sh
bun test         # Run all tests
bun run typecheck  # TypeScript type checking
```

## Module Dependencies

```
hl7v2/          → standalone (no project dependencies)
mllp/           → depends on hl7v2/
bar/            → depends on hl7v2/, fhir/
v2-to-fhir/     → depends on hl7v2/, fhir/, code-mapping/
code-mapping/   → depends on fhir/ (for ConceptMap, Task types)
```

## Extracting the HL7v2 Module

The `src/hl7v2/` module provides type-safe HL7v2 message building and parsing.

### Files to extract

- `src/hl7v2/generated/` - Generated types, builders, field helpers
- `hl7v2/schema/` - HL7v2 schema files (if regeneration needed)

### Dependencies

- `@atomic-ehr/hl7v2` - For `formatMessage`, `highlightHL7Message`

## Extracting the MLLP Server

The `src/mllp/` module implements the MLLP protocol for receiving HL7v2 messages.

### Files to extract

- `src/mllp/mllp-server.ts` - MLLP server implementation

### Dependencies

- `src/hl7v2/` - For message parsing and ACK generation

## Extracting the BAR Generator

The `src/bar/` module generates HL7v2 BAR messages from FHIR resources.

### Files to extract

- `src/bar/generator.ts` - Core BAR message generation
- `src/bar/types.ts` - Input types

### Dependencies

- `src/hl7v2/` - For message building
- `src/fhir/` - For FHIR type definitions

## Extracting the V2-to-FHIR Converter

The `src/v2-to-fhir/` module converts incoming HL7v2 messages to FHIR resources.

### Files to extract

- `src/v2-to-fhir/converter.ts` - Core conversion logic
- `src/v2-to-fhir/messages/` - Message-level converters
- `src/v2-to-fhir/segments/` - Segment-to-FHIR converters
- `src/v2-to-fhir/datatypes/` - HL7v2 datatype converters

### Dependencies

- `src/hl7v2/` - For message parsing
- `src/fhir/` - For FHIR type definitions
- `src/code-mapping/` - For LOINC code resolution

## Extracting the Code Mapping System

The `src/code-mapping/` module handles local-to-LOINC code mappings.

### Files to extract

- `src/code-mapping/concept-map/` - ConceptMap CRUD operations
- `src/code-mapping/mapping-task-service.ts` - Task lifecycle management
- `src/code-mapping/terminology-api.ts` - External terminology server integration

### Dependencies

- Requires a FHIR server (Aidbox) for ConceptMap and Task storage
- Requires a terminology server for LOINC lookups

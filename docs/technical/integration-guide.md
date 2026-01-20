# Integration Guide

How to extract and integrate modules from this project into your own application.

## Module Dependencies

```
hl7v2/          → standalone (no project dependencies)
mllp/           → depends on hl7v2/
bar/            → depends on hl7v2/, fhir/
v2-to-fhir/     → depends on hl7v2/, fhir/, code-mapping/
code-mapping/   → depends on fhir/ (for ConceptMap, Task types)
```

## Extracting the HL7v2 Module

<!-- TODO: What files to copy, npm dependencies, usage example -->

The `src/hl7v2/` module provides type-safe HL7v2 message building and parsing.

### Files to extract

- `src/hl7v2/generated/` - Generated types, builders, field helpers
- `hl7v2/schema/` - HL7v2 schema files (if regeneration needed)

### Dependencies

- `@atomic-ehr/hl7v2` - For `formatMessage`, `highlightHL7Message`

## Extracting the MLLP Server

<!-- TODO: What files to copy, configuration, standalone usage -->

## Extracting the BAR Generator

<!-- TODO: What files to copy, FHIR type dependencies -->

## Extracting the V2-to-FHIR Converter

<!-- TODO: What files to copy, converter patterns -->

## Extracting the Code Mapping System

<!-- TODO: What files to copy, Aidbox/FHIR server requirements -->

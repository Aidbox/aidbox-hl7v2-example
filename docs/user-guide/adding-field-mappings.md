# Adding Field Mappings

This guide explains how to extend field mappings for BAR message generation and ORU message processing without deep code changes.

## BAR Message: Adding a New FHIR → HL7v2 Field

<!-- TODO: Step-by-step guide for adding a field to BAR generation -->
<!-- Reference: docs/technical/modules/fhir-to-hl7v2.md for segment mapping tables -->

### Example: Adding a new PID field

1. Locate the segment builder in `src/bar/generator.ts`
2. Find the `buildPID` function
3. Add the new field using the builder API
4. Test with sample data

## ORU Processing: Adding a New HL7v2 → FHIR Field

<!-- TODO: Step-by-step guide for adding a field to ORU conversion -->
<!-- Reference: docs/technical/modules/v2-to-fhir-oru.md for field mapping tables -->

### Example: Adding a new OBX field mapping

1. Locate the segment converter in `src/v2-to-fhir/segments/`
2. Add the field extraction logic
3. Map to appropriate FHIR element
4. Test with sample HL7v2 message

## Code Mappings: Adding Local-to-LOINC Mappings

For adding mappings via the UI, see [Web UI Guide - Code Mappings](web-ui.md#code-mappings-page).

For bulk imports or programmatic mapping:

<!-- TODO: Describe ConceptMap structure and how to add entries -->

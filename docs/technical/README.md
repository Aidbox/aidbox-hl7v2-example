# Technical Documentation

Documentation for developers who want to understand, extend, or extract modules from this project.

## Contents

- [Architecture](architecture.md) - System design, data flow, pull-based polling pattern
- [Integration Guide](integration-guide.md) - How to extract and integrate modules into your project

### Module Documentation

- [HL7v2 Builders](modules/hl7v2-builders.md) - Type-safe HL7v2 message construction
- [FHIR to HL7v2 (BAR)](modules/fhir-to-hl7v2.md) - BAR message generation from FHIR resources
- [HL7v2 to FHIR (ORU)](modules/v2-to-fhir-oru.md) - ORU_R01 lab results processing
- [HL7v2 to FHIR (Spec)](../v2-to-fhir-spec/) - Supported segments and datatypes
- [Code Mapping Infrastructure](modules/code-mapping-infrastructure.md) - ConceptMap and Task data model
- [Code Mapping UI](modules/code-mapping-ui.md) - UI workflows for resolving unmapped codes
- [MLLP Server](modules/mllp-server.md) - MLLP protocol implementation

# Developer Guide

Documentation for developers who need to understand, extend, or integrate with this project.

## Getting Started

1. **[User Guide: Getting Started](../user-guide/getting-started.md)** — Setup, installation, running services
2. **[Development Guide](how-to/development-guide.md)** — Day-to-day workflows: testing (unit & integration), debugging, code generation

## Understanding the System

Start with **[Architecture](architecture.md)** for:
- System overview and component diagram
- Data flow sequences
- Design decisions explaining why things work the way they do

## Understanding a Specific Feature?

Each document explains how the feature works, implementation details, and where to find the code.

- [BAR Generation](bar-generation.md) — FHIR → HL7v2 BAR message pipeline, segment mappings, trigger events
- [ORU Processing](oru-processing.md) — HL7v2 ORU → FHIR conversion, status codes, error handling
- [Code Mapping](code-mapping.md) — ConceptMap workflow, Task creation, LOINC resolution
- [MLLP Server](mllp-server.md) — TCP/MLLP protocol, ACK generation, message storage
- [HL7v2 Module](hl7v2-module.md) — Type-safe builders, datatypes, wire format

## Extending the System

Step-by-step guides for common tasks.

- [Extending Outgoing Fields](how-to/extending-outgoing-fields.md) — Add FHIR→HL7v2 field mappings
- [Extending Incoming Fields](how-to/extending-incoming-fields.md) — Add HL7v2→FHIR field mappings
- [Converter Pipeline Skill](how-to/converter_skill_guide.md) — Use `/hl7v2-to-fhir-pipeline` for structured converter implementation
- [Extracting Modules](how-to/extracting-modules.md) — Use modules in your own project

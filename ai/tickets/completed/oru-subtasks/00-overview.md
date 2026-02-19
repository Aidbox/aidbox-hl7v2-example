# ORU_R01 Message Conversion Implementation

## Overview

This directory contains the implementation specification for ORU_R01 (Unsolicited Observation Result) message parsing from HL7v2 to FHIR, with a custom code mapping workflow for handling unknown laboratory codes.

ORU_R01 messages contain laboratory results and must be converted to FHIR DiagnosticReport and Observation resources. Unlike ADT messages, lab results require code mapping from sender-specific local codes to standard LOINC codes.

## Documents

| Document | Description |
|----------|-------------|
| [01-oru-core-processing.md](./01-oru-core-processing.md) | Core ORU_R01 message parsing and FHIR conversion without custom mapping logic |
| [02-code-mapping-infrastructure.md](./02-code-mapping-infrastructure.md) | Code mapping workflow, ConceptMap, and LabCodeMappingTask resources |
| [03-mapping-ui.md](./03-mapping-ui.md) | User interface for mapping tasks queue and code mappings management |
| [04-patient-handling.md](./04-patient-handling.md) | Patient matching, draft patient creation, and resource linking |

## Implementation Phases

### Phase 0: Documentation
- Review existing docs in `spec/` folder
- Create specification documents for ORU processing, code mapping workflow, and resources

### Phase 1: Core ORU_R01 Processing
Covered in [01-oru-core-processing.md](./01-oru-core-processing.md)
- Segment converters (OBR, OBX, NTE)
- Message converter (oru-r01.ts)
- Integration into converter router

### Phase 2: Code Mapping Infrastructure
Covered in [02-code-mapping-infrastructure.md](./02-code-mapping-infrastructure.md)
- LabCodeMappingTask resource
- Code resolution service
- ConceptMap and mapping task services

### Phase 3: Mapping Tasks Queue UI
Covered in [03-mapping-ui.md](./03-mapping-ui.md)
- Tasks queue page
- Task detail/resolution form
- LOINC search endpoint

### Phase 4: Code Mappings Management UI
Covered in [03-mapping-ui.md](./03-mapping-ui.md)
- Mappings table page
- CRUD operations for ConceptMap entries

### Phase 5: Patient Handling
Covered in [04-patient-handling.md](./04-patient-handling.md)
- Parse PID segment and extract patient ID (required)
- Match existing patients or create draft (active=false)
- Link DiagnosticReport, Observation, Specimen to Patient
- Reject messages with missing PID or patient ID

## Non-Functional Requirements

1. **Idempotency:** Processing the same message twice produces identical results
2. **Traceability:** All resources tagged with source message ID
3. **Documentation:** The solution should be documented in spec folder before the implementation

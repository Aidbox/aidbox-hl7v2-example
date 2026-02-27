# Goal

Implement an HL7v2 ORM (Order Message) → FHIR converter. This converter will handle incoming ORM^O01 messages and convert them into appropriate FHIR resources (e.g., ServiceRequest, Task, Patient, Encounter, etc.) following the V2-to-FHIR IG mappings and existing project patterns.

## Example Messages

Located in: `ai/tickets/converter-skill-tickets/orm-converter/examples/`

# Goal

Implement an HL7v2 SIU (Scheduling Information Unsolicited) to FHIR converter for the **SIU^S12** trigger event (Notification of New Appointment Booking).

The converter will turn incoming SIU^S12 messages into an appropriate FHIR resource bundle (at minimum: Patient, Appointment; plus related resources such as Encounter/Practitioner/Location/Slot/HealthcareService as the V2-to-FHIR IG prescribes), following existing project patterns.

A real SIU^S12 sample was verified as not yet supported via `message-lookup` (returned `Unsupported message type: SIU_S12`).

## Example Messages

Located in: `ai/tickets/converter-skill-tickets/siu-s12-converter/examples/`

The user supplied one real-world message (v2.4). A de-identified version is saved as `examples/siu-s12-1.hl7`. The requirements sub-agent may generate additional examples across supported versions.

# Goal

Add support for HL7v2 `ADT^A03` (Discharge/End Visit) messages to the HL7v2 → FHIR pipeline.

Currently routing fails with `Unsupported message type: ADT_A03`. Need a converter that produces the appropriate FHIR resources (Patient, Encounter at minimum, plus Practitioners/Locations/etc. per V2-to-FHIR IG) and registers the route.

## Examples

Real example messages live under `examples/` (de-identified). Sample sender observed: `ST01 / W`, HL7v2 v2.2, includes `MSH`, `EVN`, `PID`, `PV1`, `PV2` segments.

---
status: created
reviewer-iterations: 0
prototype-files: []
---

# User description

Bug: DiagnosticReport, Observation, and Specimen IDs lack sender-scoping — collision risk

DiagnosticReport ID is generated from OBR-3 (filler order number) value only, without any authority or sender prefix.
If two different senders assign the same order number (e.g., both send "ORDER-001"), they produce the same FHIR resource ID and overwrite each other.

Patient and Encounter IDs are safe (they use CX authority from PID-3 / PV1-19).
DiagnosticReport, Observation, and Specimen should follow the same pattern: include authority from EI.2/EI.3/EI.4, or fall back to MSH-3/MSH-4 sender context.

**Affected code:**
- `src/v2-to-fhir/segments/obr-diagnosticreport.ts` — `generateIdFromEI()` uses EI.1 only
- `src/v2-to-fhir/segments/obx-observation.ts` — inherits order number without scoping
- `src/v2-to-fhir/messages/oru-r01.ts` — Specimen IDs inherit order number
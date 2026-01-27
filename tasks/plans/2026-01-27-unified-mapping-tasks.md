# Plan: Make Unified Mapping Tasks

## Task draft

Update the Task resource operations, so they can be useful for any type of mapping.
Right now they are only used for unknown mappings for Observation codes (when ORU^R01 converter meets an unknown code, a new Task is created so the human operator can assign the mapping).
This feature needs to extend the Task operations/service/mechanism, so any converter can create a Task for any type of mapping.

**Requirements:**

- Task structure supports any resource/field
- mapping-error blocking and Task resolving work for any type of Task
- ConceptMap works for any resource/field as well
- ConceptMap ui supports it too
- Usage: right now by a hardcoded call from code (should be able to call it from any place in code, like it's called from ORU^R01 converter now)

Example cases:

1:

“PID.11 - Patient Address" has “P” value: Address types like "P" (Permanent) don't have a standard FHIR mapping (example /tasks/examples/sample02.hl7)
```
PID|1|1000116|A999-1000116|A999|MARTIN^STACEY^^^^^D||19450623|F|||214 WILLOW ST^^SPRINGFIELD^IL^62704^USA^P|||||||1000009527||||||||||||N|||20240618180634|1|
```

2:

Need to support PV1.2: Patient Class = “1” (non-FHIR value)  (example /tasks/examples/sample03.hl7)

```
PV1|1|1|POPN||||005039^HOLLOWAY^CLAIRE^Y^^^^^CER PROV ID^^^^CER PROV ID||||||||||||50020020043444|||||||||||||||||||||||||||||||GRN01277958
```

3:

OBR-25 Result Status → DiagnosticReport.status
Need to support Task creation to handle incorrect values: `A, M, N, Y, Z`
check mapOBRStatusToFHIR function (only maps what's standard in FHIR)


4:

OBX-11 Result Status → Observation.status
Need to support Task creation to handle incorrect values: `N, B, I, O, R, S, V, U`
- check `mapOBXStatusToFHIR` function (only maps what's standard in FHIR)

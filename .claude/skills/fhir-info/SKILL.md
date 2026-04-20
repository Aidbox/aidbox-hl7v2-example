---
name: fhir-info
description: Look up FHIR resource/datatype/backbone fields, types, cardinality, reference targets, and coded value enums. MUST use this skill for writing HL7v2↔FHIR converters, mapping FHIR fields, checking field cardinality/optionality, verifying FHIR compliance, or answering questions about FHIR R4 types (including custom resources like IncomingHL7v2Message and OutgoingBarMessage).
---

# FHIR Reference Lookup

Look up FHIR definitions using the reference script:

```bash
bun scripts/fhir-ref-lookup.ts <Query> [--inherited]
bun scripts/fhir-ref-lookup.ts --list
```

- `<Query>`: the FHIR identifier to look up. Supported forms:
  - Resource: `Patient`, `Observation`, `Encounter`, `IncomingHL7v2Message`
  - Datatype: `HumanName`, `CodeableConcept`, `Coding`, `Reference`, `Period`
  - BackboneElement: `PatientContact`, `ObservationComponent`, `ObservationReferenceRange`
  - Helper type: `UnmappedCode` (custom resource helpers)
  - Field: `Patient.name`, `Observation.status`, `HumanName.given`
- `--inherited` (`-i`): include inherited fields from parent types (e.g., `DomainResource`, `Resource`, `Element`)
- `--list`: list all known types grouped by kind

## Data source

This skill reads the **generated TypeScript types** in `src/fhir/`:
- `src/fhir/hl7-fhir-r4-core/` — FHIR R4 core (150 resources, 47 datatypes, 467 backbone elements)
- `src/fhir/aidbox-hl7v2-custom/` — custom resources (`IncomingHL7v2Message`, `OutgoingBarMessage`, `UnmappedCode`)

The types are regenerated from the FHIR R4 package via `bun run regenerate-fhir`. If you've made changes to custom resource definitions in `fhir/` or need to refresh after an upstream update, run that script first.

## Limitations

Because the data source is generated TypeScript (not raw StructureDefinitions), the skill cannot report:
- **Element descriptions / definitions** — not preserved in the TS output.
- **Precise cardinality ranges** beyond `[0..1]`, `[0..*]`, `[1..1]`, `[1..*]` — richer `min`/`max` (e.g. `[0..3]`) is lost.
- **ValueSet binding strength / URLs** — coded fields show only the allowed string literals inlined in the TS union type; no link back to the ValueSet canonical URL.
- **Invariants (`constraint`), slicing, must-support flags** — not in the TS output.
- **US Core / IG-specific profile constraints** — these are not currently generated into `src/fhir/`.

When you need any of the above, query Aidbox directly: `curl http://localhost:8080/fhir/StructureDefinition/<Resource>`.

## When to use

- **Answering questions**: User asks about FHIR resources, datatypes, fields, reference targets, or coded value enums
- **Design / architecture**: Need to understand what fields a resource has, what resources a `Reference<>` points to, or the allowed values of a coded field
- **Coding**: Building or parsing FHIR resources — look up field names, cardinality, types, reference targets, enum values
- **HL7v2↔FHIR converters**: Verify the FHIR target structure matches what the TypeScript compiler expects
- **Code review**: Verify that resource field mappings and reference targets are correct

Do NOT skip this skill and rely on codebase exploration or memory for FHIR specifications. The generated types are the authoritative source for this project's runtime shape.

When looking up multiple types/fields, make **separate Bash tool calls** in the same response — do NOT use shell `&` or `&&` to chain commands. Show the full script output to the user without modification.

## Related

- **`hl7v2-info`** skill — HL7v2 side of the same need (segments, fields, datatypes, tables, messages).
- **`docs/v2-to-fhir-spec/mappings/`** — authoritative HL7v2↔FHIR field mappings (CSV). This skill covers the FHIR target shape only; use the mapping CSVs to determine which HL7v2 field maps to which FHIR element.

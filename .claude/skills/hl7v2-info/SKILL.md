---
name: hl7v2-info
description: "Look up segment fields, datatypes, components, tables, and message structures. MUST use this skill for writing HL7v2↔FHIR converters, mapping HL7v2 fields, checking field positions/optionality, verifying HL7v2 compliance or answering questions about hl7v2."
---

# HL7v2 Reference Lookup

Look up HL7v2 definitions using the reference script:

```bash
bun scripts/hl7v2-ref-lookup.ts <code> [--version <version>]
```

- `<code>`: the HL7v2 identifier to look up. Must be one of:
  - Message: `ORU_R01`, `ADT_A01`
  - Segment: `PID`, `OBX`
  - Field: `PID.3`, `OBX.2`
  - Component: `PID.3.1`, `CWE.1`
  - Table: `0001`, `0203`
  - Datatype: `CWE`, `ST`, `ID`
- `--version`: HL7v2 version (default `2.5`). Supported: `2.5`, `2.8.2`

## When to use

- **Answering questions**: User asks about HL7v2 fields, datatypes, or message structures
- **Design/architecture**: Need to understand what fields a segment contains, what values a table allows, or how a message is structured
- **Coding**: Building or parsing HL7v2 segments — look up field positions, datatypes, optionality, cardinality, and valid table values
- **Code review**: Verify that field mappings, datatypes, and table values are correct

Do NOT skip this skill and rely on codebase exploration or memory for HL7v2 specifications. The reference data is the authoritative source.

Look up multiple codes in parallel when needed. Show the full script output to the user without modification.

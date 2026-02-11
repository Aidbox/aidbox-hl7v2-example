---
name: hl7-info
description: Answer questions about HL7v2 messages, segments, fields, components, datatypes, or tables
---

# HL7v2 Reference Lookup

Run the lookup script and show the output to the user:

```bash
bun scripts/hl7v2-ref-lookup.ts <code> [--version <version>]
```

- `<code>`: the HL7v2 identifier extracted from the user's question. Must be one of:
  - Message: `ORU_R01`, `ADT_A01`
  - Segment: `PID`, `OBX`
  - Field: `PID.3`, `OBX.2`
  - Component: `PID.3.1`, `CWE.1`
  - Table: `0001`, `0203`
  - Datatype: `CWE`, `ST`, `ID`
- `--version`: HL7v2 version (default `2.5`). Supported: `2.5`, `2.8.2`

If the user's question involves multiple codes, run the script once per code.

Show the full script output to the user without modification.

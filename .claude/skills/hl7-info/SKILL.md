---
name: hl7-info
description: Look up HL7v2 message, segment, field, component, datatype, or table definitions
---

# HL7v2 Reference Lookup

Run the lookup script and show the output to the user:

```bash
bun scripts/hl7v2-ref-lookup.ts <query> [--version <version>]
```

- `<query>`: what the user asked about (message like `ORU_R01`, segment like `PID`, field like `PID.3`, component like `PID.3.1`, table like `0001`, or datatype like `CWE`)
- `--version`: HL7v2 version, default `2.5`. Supported: `2.5`, `2.8.2`

Show the full script output to the user without modification.

# HL7v2 Reference Data Generation

The `data/hl7v2-reference/` directory contains structured JSON reference data extracted from official HL7 specifications. This data is used by Claude skills for HL7v2 field/segment/datatype lookups.

## Source Files

Download the official HL7v2 specification from:
https://www.hl7.org/implement/standards/product_brief.cfm?product_id=185

You need two packages:
- **XSD schemas** — extract to `tmp/HL7-xml v2.5/` (or similar for other versions)
- **PDF specification** — extract to `tmp/HL7_Messaging_v25_PDF/` (or similar)

## Running the Generator

```sh
bun run generate-hl7v2-reference -- \
  --xsd-dir "tmp/HL7-xml v2.5" \
  --pdf-dir "tmp/HL7_Messaging_v25_PDF" \
  --version 2.5
```

Options:
- `--xsd-dir` — path to extracted XSD schemas (required)
- `--pdf-dir` — path to extracted PDF chapters (required)
- `--version` — HL7v2 version string, used in output path (default: `2.5`)
- `--output-dir` — custom output directory (default: `data/hl7v2-reference/v{version}`)

**Prerequisite**: `pdftotext` from poppler-utils must be available. On NixOS, the script automatically wraps calls via `nix-shell -p poppler-utils`.

## Output Structure

The script produces 5 JSON files in `data/hl7v2-reference/v{version}/`:

| File | Content | Keys |
|------|---------|------|
| `fields.json` | Field definitions with descriptions | `PID.3`, `OBR.4`, etc. |
| `segments.json` | Segment definitions with field lists | `PID`, `OBR`, etc. |
| `datatypes.json` | Datatype component definitions | `CX`, `CE`, etc. |
| `messages.json` | Message structures with nested groups | `BAR_P01`, `ORU_R01`, etc. |
| `tables.json` | HL7 table value sets | `0001`, `0003`, etc. |

## Validation

The script prints a validation report showing:
- Field description coverage (expect ~98%)
- Segment description coverage (expect ~94%)
- Table and value counts
- Cross-validation warnings (XSD vs PDF mismatches)

The output is deterministic — running the script twice produces identical files.

## Looking Up Reference Data

Use the lookup script to query the generated JSON:

```sh
bun scripts/hl7v2-ref-lookup.ts <query> [--version 2.5|2.8.2]
```

Examples: `PID` (segment), `PID.3` (field), `PID.3.1` (component), `ORU_R01` (message), `0001` (table), `CWE` (datatype).

Also available as the `/hl7-info` Claude skill.

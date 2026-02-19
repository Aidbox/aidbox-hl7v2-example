# Generate HL7v2 Reference JSON from XSD + PDF

## Context

We need HL7v2 structural reference data (field definitions with prose descriptions) for a future Claude skill (`.skills/`) that provides HL7v2 reference lookups — e.g., user asks about "PID.3" and gets field info, datatype components, table values, and description.

This plan covers **only JSON data generation** — not the skill itself. The JSON structure is designed for the skill's lookup patterns: direct key access by `PID.3` (fields), `PID` (segments), `CX` (datatypes), `BAR_P01` (messages), `0001` (tables).

The user wants a **deterministic, rerunnable** build script — no AI calls — that works across HL7v2 versions (v2.3–v2.6). **All data comes from official HL7 sources only** (XSD + PDF) — no dependency on Redox/atomic-ehr data.

**Source files** (downloaded from https://www.hl7.org/implement/standards/product_brief.cfm?product_id=185):
- XSD schemas (`tmp/HL7-xml v2.5/`) → structural data
- PDF spec chapters (`tmp/HL7_Messaging_v25_PDF/`) → prose descriptions + table value sets

**Design decision — normalized (5 files) over denormalized:**
The skill will load all 5 JSON files upfront (~2-3MB total, trivial for Bun) and cross-reference them in memory. This avoids data duplication (e.g., CX components repeated in every CX-typed field) and keeps the generation script simple.

## Output

5 JSON files in `data/hl7v2-reference/v2.5/`:

| File | Content | Source |
|------|---------|--------|
| `fields.json` | ~2094 fields: item, dataType, longName, maxLength, table, **description** | XSD + PDF chapters |
| `segments.json` | ~153 segments: longName, fields with cardinality, **description** | XSD + PDF chapters |
| `datatypes.json` | ~80 datatypes, ~431 components | XSD |
| `messages.json` | ~191 message structures with nested groups | XSD |
| `tables.json` | ~344 table value sets (type, name, ~4549 values) | PDF AppendixA |

### Key JSON shapes

**fields.json** — flat map keyed by `SEG.N`:
```json
{
  "PID.3": {
    "segment": "PID", "position": 3,
    "item": "00106", "dataType": "CX",
    "longName": "Patient Identifier List",
    "maxLength": 250, "table": "0061",
    "description": "This field contains the list of identifiers..."
  }
}
```

**segments.json** — keyed by segment code:
```json
{
  "PID": {
    "longName": "Patient Identification",
    "description": "The PID segment is used by all applications...",
    "fields": [
      { "field": "PID.1", "position": 1, "minOccurs": 0, "maxOccurs": 1 },
      { "field": "PID.3", "position": 3, "minOccurs": 1, "maxOccurs": "unbounded" }
    ]
  }
}
```

**tables.json** — keyed by table number:
```json
{
  "0001": {
    "tableNumber": "0001",
    "name": "Administrative Sex",
    "type": "User",
    "values": [
      { "code": "F", "display": "Female" },
      { "code": "M", "display": "Male" }
    ]
  }
}
```

## File Structure

```
scripts/
  generate-hl7v2-reference.ts          # CLI entry point
  hl7v2-reference/
    types.ts                            # TypeScript interfaces
    xsd-parser.ts                       # Parse fields.xsd, segments.xsd, datatypes.xsd, message XSDs
    pdf-parser.ts                       # pdftotext + regex extraction of descriptions and tables
    merge.ts                            # Merge all sources, write JSON, validate
data/
  hl7v2-reference/v2.5/                 # Output (5 JSON files)
```

Parsing code in `scripts/` (not `src/`) — this is build-time tooling per code-style.md.

## Implementation Steps

### Step 1: Add dependency
- `bun add -d fast-xml-parser` — XSD files are minified single-line XML, needs a real parser

### Step 2: `scripts/hl7v2-reference/types.ts`
- Interfaces for XSD data (XsdField, XsdSegment, XsdDatatype, XsdMessage)
- Interfaces for PDF data (PdfFieldDescription, PdfSegmentDescription, PdfTable)
- Interfaces for output JSON shapes

### Step 3: `scripts/hl7v2-reference/xsd-parser.ts`

**fields.xsd** — parse `xsd:attributeGroup` elements named `SEG.N.ATTRIBUTES`:
- Each has `fixed=""` attributes: Item, Type, Table, LongName, maxLength
- Use ATTRIBUTES (not CONTENT) because it has clean values without "HL7" prefix

**segments.xsd** — parse `xsd:complexType` elements named `SEG.CONTENT`:
- Extract `xsd:element` children with ref, minOccurs, maxOccurs

**datatypes.xsd** — parse composite types + `XX.N.ATTRIBUTES` for components

**Message XSDs** — parse all `*.xsd` except the 3 core files:
- Root type: `MSGTYPE.CONTENT`, groups: `MSGTYPE.GROUP.CONTENT`
- Build hierarchical structure with nested groups

### Step 4: `scripts/hl7v2-reference/pdf-parser.ts`

**Text extraction**: `pdftotext` via `Bun.spawn` (with `-layout` flag for AppendixA tables). NixOS detection: if `pdftotext` not in PATH, use `nix-shell -p poppler-utils --run "pdftotext ..."`.

**Page noise removal** — strip lines matching:
- `Page N-N`, `Health Level Seven...`, `Final Standard.`, `July 2003.`, `Chapter N: ...`, `Appendix A: ...`

**Segment heading extraction** — regex handles both `-` and `–` (en-dash):
```
/(?:^\d+[\.\d]*\s+)?(\w{2,3})\s*[-\u2013]\s*(.+)/
```
Description: text between heading and "HL7 Attribute Table" or first field header.

**Field description extraction** — two known heading formats:
1. `4.5.3.1 OBR-1 Set ID – OBR (SI) 00237` (section number on same line)
2. Section number on separate line, then `OBX-1 Set ID - OBX (SI) 00569`

Combined regex: `(?:^\d+[\.\d]*\s+)?(\w{2,3})-(\d+)\s+(.+?)\s+\((\w{2,3})\)\s+(\d{5})`

For each field header:
1. Skip Components/Subcomponents blocks
2. Find "Definition:" marker (covers 98.2% of fields)
3. Fallback for 38 fields without marker: take paragraph text after components
4. End at next field header or segment heading

**Table value extraction** from AppendixA.pdf (using `pdftotext -layout`):
- Section A.5 (alphabetic list): parse `Type`, `Table Number`, `Name`, `Chapter` per table
- Section A.6 (numeric sort): parse table values with pattern:
  - Header lines: `HL7|User` + table name
  - Value lines: `\s+NNNN\s+CODE\s+Description`
- Result: ~344 tables, ~4549 values

### Step 5: `scripts/hl7v2-reference/merge.ts`
- Match PDF descriptions to XSD fields by `SEG.N` key
- Match PDF segment descriptions to XSD segments by code
- Cross-validate: PDF item numbers and dataTypes should match XSD
- Write 5 JSON files to output directory

### Step 6: `scripts/generate-hl7v2-reference.ts`
- CLI with configurable paths: `--xsd-dir`, `--pdf-dir`, `--version`, `--output-dir`
- Orchestrates phases, prints validation report

### Step 7: Register npm script
- Add `"generate-hl7v2-reference"` to package.json scripts

### Step 8: Update developer guide documentation
- Add section to `docs/developer-guide/` about HL7v2 reference data generation
- Document the download link: https://www.hl7.org/implement/standards/product_brief.cfm?product_id=185
- Document how to run the script for different HL7v2 versions
- Document the output JSON structure for skill developers

## Validation (built into script)

**Hard checks** (fail the script):
- XSD field count ~2094, segment count ~153, datatype count ~80, component count ~431
- All fields have item, dataType, longName, maxLength

**Coverage report** (warnings):
- % of fields with PDF descriptions (expect ~98%)
- % of segments with PDF descriptions (expect ~97%)
- Table count from AppendixA (expect ~344)
- Cross-validation: PDF dataType/item match XSD values

## Edge Cases

| Edge case | Handling |
|-----------|----------|
| En-dash `–` vs hyphen `-` in headings | `[-\u2013]` in all regexes |
| 38 fields without "Definition:" marker | Fallback: paragraph text after Components block |
| 4 segments not in PDF (GP1, GP2, Hxx, ZL7) | description: null |
| "HL7" prefix in XSD LongName | Parse from ATTRIBUTES (no prefix) not CONTENT |
| Page breaks mid-description | Strip noise lines, rejoin paragraphs |
| pdftotext not installed | Detect at startup, try nix-shell wrapper, clear error message |
| Multi-line table descriptions in AppendixA | Join continuation lines (indented, no table number) |

## Verification

1. Run: `bun scripts/generate-hl7v2-reference.ts --xsd-dir "tmp/HL7-xml v2.5" --pdf-dir "tmp/HL7_Messaging_v25_PDF" --version 2.5`
2. Check output in `data/hl7v2-reference/v2.5/` — 5 JSON files created
3. Spot-check known fields: PID.3 description, OBR.4 description, OBX.5 description
4. Spot-check tables: 0001 (Administrative Sex), 0003 (Event type)
5. Validation report should show ~98% field description coverage, ~97% segment coverage
6. Run twice — output should be identical (deterministic)

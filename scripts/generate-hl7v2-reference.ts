/**
 * Generate HL7v2 reference JSON from official XSD schemas and PDF specification.
 *
 * Usage:
 *   bun scripts/generate-hl7v2-reference.ts \
 *     --xsd-dir "tmp/HL7-xml v2.5" \
 *     --pdf-dir "tmp/HL7_Messaging_v25_PDF" \
 *     --version 2.5
 *
 * Output: data/hl7v2-reference/v{version}/ with 5 JSON files
 *
 * Source files must be downloaded from:
 *   https://www.hl7.org/implement/standards/product_brief.cfm?product_id=185
 */

import { parseArgs } from "node:util";
import { parseXsdFields, parseXsdSegments, parseXsdDatatypes, parseXsdMessages } from "./hl7v2-reference/xsd-parser";
import { parsePdfDescriptions, parsePdfTables, parsePdfAttributeTables, parsePdfDatatypeDescriptions, parsePdfComponentTables } from "./hl7v2-reference/pdf-parser";
import { mergeAndWrite } from "./hl7v2-reference/merge";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "xsd-dir": { type: "string" },
    "pdf-dir": { type: "string" },
    "version": { type: "string", default: "2.5" },
    "output-dir": { type: "string" },
  },
});

const xsdDir = values["xsd-dir"];
const pdfDir = values["pdf-dir"];
const version = values["version"]!;
const outputDir = values["output-dir"] || `data/hl7v2-reference/v${version}`;

if (!xsdDir || !pdfDir) {
  console.error("Usage: bun scripts/generate-hl7v2-reference.ts --xsd-dir <path> --pdf-dir <path> [--version <ver>] [--output-dir <path>]");
  process.exit(1);
}

console.log(`Generating HL7v2 v${version} reference data...`);
console.log(`  XSD source: ${xsdDir}`);
console.log(`  PDF source: ${pdfDir}`);
console.log(`  Output:     ${outputDir}`);
console.log();

// Phase 1: Parse XSD
console.log("Phase 1: Parsing XSD schemas...");
const [xsdFields, xsdSegments, xsdDatatypes, xsdMessages] = await Promise.all([
  parseXsdFields(xsdDir),
  parseXsdSegments(xsdDir),
  parseXsdDatatypes(xsdDir),
  parseXsdMessages(xsdDir),
]);
console.log(`  Fields:    ${xsdFields.size}`);
console.log(`  Segments:  ${xsdSegments.size}`);
console.log(`  Datatypes: ${xsdDatatypes.size}`);
console.log(`  Messages:  ${xsdMessages.size}`);
console.log();

// Phase 2: Parse PDF
console.log("Phase 2: Parsing PDF specifications...");
const [
  { fields: pdfFields, segments: pdfSegments },
  pdfTables,
  pdfAttributeTables,
  { datatypes: pdfDatatypeDescs, components: pdfComponentDescs },
  pdfComponentTables,
] = await Promise.all([
  parsePdfDescriptions(pdfDir),
  parsePdfTables(pdfDir),
  parsePdfAttributeTables(pdfDir),
  parsePdfDatatypeDescriptions(pdfDir),
  parsePdfComponentTables(pdfDir),
]);
console.log(`  Field descriptions:     ${pdfFields.size}`);
console.log(`  Segment descriptions:   ${pdfSegments.size}`);
console.log(`  Attribute tables:       ${pdfAttributeTables.size}`);
console.log(`  Datatype descriptions:  ${pdfDatatypeDescs.size}`);
console.log(`  Component descriptions: ${pdfComponentDescs.size}`);
console.log(`  Component tables:       ${pdfComponentTables.size}`);
console.log(`  Tables:                 ${pdfTables.size}`);
console.log();

// Phase 3: Merge and write
console.log("Phase 3: Merging data and writing JSON...");
const report = await mergeAndWrite(
  { xsdFields, xsdSegments, xsdDatatypes, xsdMessages, pdfFields, pdfSegments, pdfTables, pdfAttributeTables, pdfDatatypeDescs, pdfComponentDescs, pdfComponentTables },
  outputDir,
);
console.log(`  Output written to: ${outputDir}`);
console.log();

// Validation report
console.log("=== Validation Report ===");
console.log(`Fields:    ${report.fieldCount} total, ${report.fieldDescriptionCount} with descriptions (${report.fieldDescriptionPercent}%)`);
console.log(`Segments:  ${report.segmentCount} total, ${report.segmentDescriptionCount} with descriptions (${report.segmentDescriptionPercent}%)`);
console.log(`Usage:     ${report.fieldUsageCount} of ${report.fieldCount} fields with usage codes (${report.fieldUsagePercent}%)`);
console.log(`Datatypes: ${report.datatypeCount} total, ${report.datatypeDescriptionCount} with descriptions (${report.datatypeDescriptionPercent}%)`);
console.log(`Comp.Desc: ${report.componentDescriptionCount} components with descriptions (${report.componentDescriptionPercent}%)`);
console.log(`Comp.Opt:  ${report.componentOptionalityCount} components with optionality (${report.componentOptionalityPercent}%)`);
console.log(`Messages:  ${report.messageCount}`);
console.log(`Tables:    ${report.tableCount} tables, ${report.tableValueCount} values`);

if (report.warnings.length > 0) {
  console.log();
  console.log(`Warnings (${report.warnings.length}):`);
  for (const w of report.warnings.slice(0, 20)) {
    console.log(`  - ${w}`);
  }
  if (report.warnings.length > 20) {
    console.log(`  ... and ${report.warnings.length - 20} more`);
  }
}

console.log();
console.log("Done.");

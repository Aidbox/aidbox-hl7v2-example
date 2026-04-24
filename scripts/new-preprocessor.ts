#!/usr/bin/env bun
/**
 * Scaffold a new HL7v2 segment preprocessor:
 *   1. Insert entry into SEGMENT_PREPROCESSORS in preprocessor-registry.ts.
 *   2. Append a stub function body at the end of that file.
 *   3. Ensure the SEG.FIELD slot exists in MessageTypeConfig (config.ts).
 *   4. Print a copy/paste JSON snippet for config/hl7v2-to-fhir.json
 *      (JSON config is not auto-edited because it is JSONC).
 *
 * Usage:
 *   bun scripts/new-preprocessor.ts <id> <SEG> <FIELD> [--params=a,b,...]
 *
 * Example:
 *   bun scripts/new-preprocessor.ts swap-dg1-dates DG1 5 --params=a,b
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface ParsedArgs {
  id: string;
  segment: string;
  field: string;
  params: string[];
}

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  let params: string[] = [];
  for (const a of argv) {
    if (a.startsWith("--params=")) {
      params = a.slice("--params=".length).split(",").map(s => s.trim()).filter(Boolean);
    } else {
      positional.push(a);
    }
  }
  if (positional.length !== 3) {
    die("Usage: bun scripts/new-preprocessor.ts <id> <SEG> <FIELD> [--params=a,b,...]");
  }
  const id = positional[0]!;
  const segment = positional[1]!;
  const field = positional[2]!;
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(id)) {
    die(`id must be kebab-case (got "${id}")`);
  }
  if (!/^[A-Z][A-Z0-9]{2}$/.test(segment)) {
    die(`SEG must be 3-char uppercase (got "${segment}")`);
  }
  if (!/^[1-9][0-9]*$/.test(field)) {
    die(`FIELD must be positive integer (got "${field}")`);
  }
  for (const p of params) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p)) {
      die(`param name must be identifier (got "${p}")`);
    }
  }
  return { id, segment, field, params };
}

function toCamelCase(id: string): string {
  const parts = id.split("-");
  const head = parts[0] ?? "";
  return head + parts.slice(1).map(p => (p[0] ?? "").toUpperCase() + p.slice(1)).join("");
}

function updateRegistry(args: ParsedArgs, projectRoot: string): void {
  const path = join(projectRoot, "src/v2-to-fhir/preprocessor-registry.ts");
  const content = readFileSync(path, "utf-8");

  if (content.includes(`"${args.id}":`)) {
    die(`Preprocessor id "${args.id}" already registered in ${path}`);
  }

  const fnName = toCamelCase(args.id);
  const mapAnchor = `export const SEGMENT_PREPROCESSORS: Record<string, SegmentPreprocessorFn> = {`;
  const mapEnd = "};";
  const mapStart = content.indexOf(mapAnchor);
  if (mapStart === -1) {
    die(`Cannot locate SEGMENT_PREPROCESSORS map in ${path}`);
  }
  const mapCloseIdx = content.indexOf(mapEnd, mapStart);
  if (mapCloseIdx === -1) {
    die(`Cannot locate SEGMENT_PREPROCESSORS map terminator in ${path}`);
  }

  const newEntry = `  "${args.id}": ${fnName},\n`;
  const updatedMap =
    content.slice(0, mapCloseIdx) + newEntry + content.slice(mapCloseIdx);

  const paramsDestructure = args.params.length > 0
    ? `\n  const { ${args.params.join(", ")} } = (params ?? {}) as Record<string, unknown>;\n  void ${args.params.map(p => `${p}`).join("; void ")};`
    : "";
  const paramsSignature = args.params.length > 0 ? "params?: PreprocessorParams" : "_params?: PreprocessorParams";

  const stub = `
/**
 * TODO(${args.id}): describe what this preprocessor fixes and cite the sender bug / FHIR constraint.
 * Fires on ${args.segment}-${args.field}.
 */
function ${fnName}(
  _context: PreprocessorContext,
  segment: HL7v2Segment,
  ${paramsSignature},
): void {
  if (segment.segment !== "${args.segment}") {
    return;
  }${paramsDestructure}

  // TODO: implement. Modify \`segment.fields[${args.field}]\` in place.
  // See fixAuthorityWithMsh / swapIfReversed for reference.
}
`;

  writeFileSync(path, updatedMap + stub, "utf-8");
  console.log(`OK  registry: added "${args.id}" -> ${fnName}`);
}

function updateConfigTs(args: ParsedArgs, projectRoot: string): void {
  const path = join(projectRoot, "src/v2-to-fhir/config.ts");
  const content = readFileSync(path, "utf-8");

  const segRegex = new RegExp(`${args.segment}\\?: \\{([^}]*)\\};`, "s");
  const match = content.match(segRegex);

  if (match) {
    // SEG slot exists — check FIELD
    const fieldRegex = new RegExp(`"${args.field}"\\?: PreprocessorEntry\\[\\];`);
    if (fieldRegex.test(match[1] ?? "")) {
      console.log(`SKIP config.ts: ${args.segment}."${args.field}" slot already present`);
      return;
    }
    // Append FIELD inside the SEG block
    const segStart = content.indexOf(match[0]);
    const braceOpen = content.indexOf("{", segStart);
    const braceClose = content.indexOf("};", braceOpen);
    const inner = content.slice(braceOpen + 1, braceClose).trimEnd();
    const newInner = inner + `\n      "${args.field}"?: PreprocessorEntry[];\n    `;
    const updated = content.slice(0, braceOpen + 1) + newInner + content.slice(braceClose);
    writeFileSync(path, updated, "utf-8");
    console.log(`OK  config.ts: added ${args.segment}."${args.field}" slot to existing SEG`);
    return;
  }

  // SEG slot missing — insert before the closing of `preprocess?: { ... };`
  const preprocessAnchor = "preprocess?: {";
  const anchorIdx = content.indexOf(preprocessAnchor);
  if (anchorIdx === -1) {
    die(`Cannot locate "preprocess?: {" in ${path}`);
  }
  // Find matching close of this block (simple depth counter from anchor)
  let depth = 0;
  let i = anchorIdx + preprocessAnchor.length - 1;
  for (; i < content.length; i++) {
    if (content[i] === "{") {depth++;}
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) {break;}
    }
  }
  if (i >= content.length) {
    die(`Cannot find matching close brace for preprocess block in ${path}`);
  }
  const insertAt = i; // position of closing `}`
  const newSeg = `    ${args.segment}?: {\n      "${args.field}"?: PreprocessorEntry[];\n    };\n  `;
  const updated = content.slice(0, insertAt) + newSeg + content.slice(insertAt);
  writeFileSync(path, updated, "utf-8");
  console.log(`OK  config.ts: added new ${args.segment} slot with "${args.field}"`);
}

function printJsonSnippet(args: ParsedArgs): void {
  const entry = args.params.length > 0
    ? `{ "id": "${args.id}", "params": { ${args.params.map(p => `"${p}": null`).join(", ")} } }`
    : `"${args.id}"`;
  console.log("");
  console.log("=== Copy into config/hl7v2-to-fhir.json under the target message type ===");
  console.log(`"${args.segment}": { "${args.field}": [${entry}] }`);
  console.log("");
  if (args.params.length > 0) {
    console.log("(replace null with concrete values; params object passed to your stub)");
  }
}

function main(): void {
  const projectRoot = join(import.meta.dir, "..");
  const args = parseArgs(process.argv.slice(2));
  updateRegistry(args, projectRoot);
  updateConfigTs(args, projectRoot);
  printJsonSnippet(args);
  console.log("Next steps:");
  console.log("  1. Implement TODO in src/v2-to-fhir/preprocessor-registry.ts");
  console.log("  2. Paste the JSON snippet above into config/hl7v2-to-fhir.json");
  console.log("  3. Run `bun test test/unit/v2-to-fhir/` to verify registration");
}

main();

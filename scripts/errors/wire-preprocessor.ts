#!/usr/bin/env bun
/**
 * Wire a segment preprocessor into both config files in one step.
 *
 * Edits:
 * 1. src/v2-to-fhir/config.ts — ensures MessageTypeConfig.preprocess.<SEG>.<FIELD> type slot
 * 2. config/hl7v2-to-fhir.json — appends preprocessor entry under messages.<msgType>.preprocess.<SEG>.<FIELD>
 *
 * Usage:
 *   bun scripts/errors/wire-preprocessor.ts <msgType> <SEG> <FIELD> <preprocessorId> [paramsJson]
 *
 * Example:
 *   bun scripts/errors/wire-preprocessor.ts ADT-A01 IN1 12 swap-if-reversed '{"a":12,"b":13}'
 *
 * Idempotent: re-running with the same args is a no-op.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { SEGMENT_PREPROCESSORS } from "../../src/v2-to-fhir/preprocessor-registry";

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const [msgType, seg, field, id, paramsJson] = process.argv.slice(2);
if (!msgType || !seg || !field || !id) {
  console.error(
    "Usage: bun scripts/errors/wire-preprocessor.ts <msgType> <SEG> <FIELD> <preprocessorId> [paramsJson]",
  );
  process.exit(2);
}

if (!(id in SEGMENT_PREPROCESSORS)) {
  die(
    `Unknown preprocessor ID "${id}". Valid: ${Object.keys(SEGMENT_PREPROCESSORS).join(", ")}`,
  );
}

let params: unknown;
if (paramsJson) {
  try {
    params = JSON.parse(paramsJson);
  } catch (e) {
    die(`Invalid paramsJson: ${(e as Error).message}`);
  }
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    die("paramsJson must be a JSON object");
  }
}

const root = join(import.meta.dir, "..", "..");

// ---------- 1. src/v2-to-fhir/config.ts ----------
const configTsPath = join(root, "src", "v2-to-fhir", "config.ts");
let configTs = readFileSync(configTsPath, "utf-8");

// Find MessageTypeConfig.preprocess block — `preprocess?: {` ... matching `};`.
const preStart = configTs.indexOf("preprocess?: {");
if (preStart === -1) {
  die("Could not find `preprocess?: {` in config.ts");
}
// Walk braces to find matching close.
let depth = 0;
let preEnd = -1;
for (let i = preStart + "preprocess?: {".length - 1; i < configTs.length; i++) {
  const ch = configTs[i];
  if (ch === "{") depth++;
  else if (ch === "}") {
    depth--;
    if (depth === 0) {
      preEnd = i;
      break;
    }
  }
}
if (preEnd === -1) die("Unbalanced braces in preprocess block");

const preBlockOpenEnd = preStart + "preprocess?: {".length;
const preBody = configTs.slice(preBlockOpenEnd, preEnd);

// Detect existing SEG block inside preBody.
const segOpenRe = new RegExp(`(^|\\n)(\\s*)${seg}\\?:\\s*\\{`);
const segOpenMatch = preBody.match(segOpenRe);

function writeConfigTs(newPreBody: string): void {
  const updated = configTs.slice(0, preBlockOpenEnd) + newPreBody + configTs.slice(preEnd);
  writeFileSync(configTsPath, updated);
  configTs = updated;
}

if (segOpenMatch && segOpenMatch.index !== undefined) {
  // Walk to matching `};` for the SEG block.
  const segBraceStart = preBody.indexOf("{", segOpenMatch.index);
  let d = 0;
  let segCloseIdx = -1;
  for (let i = segBraceStart; i < preBody.length; i++) {
    const ch = preBody[i];
    if (ch === "{") d++;
    else if (ch === "}") {
      d--;
      if (d === 0) {
        segCloseIdx = i;
        break;
      }
    }
  }
  if (segCloseIdx === -1) die(`Unbalanced braces in ${seg} block of config.ts`);

  const segInner = preBody.slice(segBraceStart + 1, segCloseIdx);
  const fieldRe = new RegExp(`"${field}"\\?:`);
  if (fieldRe.test(segInner)) {
    console.log(`[config.ts] ${seg}."${field}" slot already exists`);
  } else {
    // Indent follows the SEG's inner indent (look at first non-blank line).
    const indent = (segInner.match(/\n(\s+)\S/)?.[1] ?? "      ").replace(/[^\s]/g, "");
    const before = preBody.slice(0, segCloseIdx);
    const after = preBody.slice(segCloseIdx);
    // Ensure trailing newline before `};` has indent context.
    const trimmedBefore = before.replace(/\s+$/, "");
    const insertion = `\n${indent}"${field}"?: PreprocessorEntry[];\n${indent.slice(0, -2)}`;
    const newPreBody = trimmedBefore + insertion + after.trimStart().replace(/^\}/, "}");
    writeConfigTs(newPreBody);
    console.log(`[config.ts] added ${seg}."${field}" slot`);
  }
} else {
  // Insert a whole SEG block before closing `};` of preprocess body.
  // Base indent: look at existing SEG blocks (e.g. "    PV1?:").
  const anchorIndent = preBody.match(/\n(\s+)[A-Z0-9]+\?:\s*\{/)?.[1] ?? "    ";
  const inner = `${anchorIndent}  `;
  const insertion =
    `${anchorIndent}${seg}?: {\n${inner}"${field}"?: PreprocessorEntry[];\n${anchorIndent}};\n`;
  // Append at end of preBody before whitespace.
  const trimmed = preBody.replace(/\s+$/, "");
  const newPreBody = `${trimmed}\n${insertion}${anchorIndent.slice(0, -2)}`;
  writeConfigTs(newPreBody);
  console.log(`[config.ts] added ${seg} block with "${field}" slot`);
}

// ---------- 2. config/hl7v2-to-fhir.json ----------
const jsonPath = join(root, "config", "hl7v2-to-fhir.json");
const jsonText = readFileSync(jsonPath, "utf-8");
if (/^\s*\/\//m.test(jsonText) || /\/\*/.test(jsonText)) {
  die("config/hl7v2-to-fhir.json contains comments — edit manually.");
}

type PreprocessorEntryLike = string | { id: string; params?: Record<string, unknown> };
type ConfigShape = {
  messages?: Record<
    string,
    | {
        preprocess?: Record<string, Record<string, PreprocessorEntryLike[]>>;
        [k: string]: unknown;
      }
    | undefined
  >;
  [k: string]: unknown;
};

const json = JSON.parse(jsonText) as ConfigShape;
json.messages ??= {};
json.messages[msgType] ??= {};
const msgCfg = json.messages[msgType]!;
msgCfg.preprocess ??= {};
msgCfg.preprocess[seg] ??= {};
msgCfg.preprocess[seg][field] ??= [];

const list = msgCfg.preprocess[seg][field];
const entry: PreprocessorEntryLike = params ? { id, params: params as Record<string, unknown> } : id;

const already = list.some((e) => (typeof e === "string" ? e : e.id) === id);
if (already) {
  console.log(`[config.json] ${msgType}.preprocess.${seg}."${field}" already includes "${id}"`);
} else {
  list.push(entry);
  writeFileSync(jsonPath, `${JSON.stringify(json, null, 2)}\n`);
  console.log(
    `[config.json] wired ${msgType}.preprocess.${seg}."${field}" += ${JSON.stringify(entry)}`,
  );
}

console.log("Done. Review the diffs before committing.");

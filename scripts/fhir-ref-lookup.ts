#!/usr/bin/env bun
// FHIR reference lookup. Parses generated TypeScript types in src/fhir/ and
// prints resource/datatype/backbone structure info.
// Data source: src/fhir/hl7-fhir-r4-core/ (FHIR R4 core) and
// src/fhir/aidbox-hl7v2-custom/ (custom resources).

import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const FHIR_DIRS = [
  resolve(PROJECT_ROOT, "src/fhir/hl7-fhir-r4-core"),
  resolve(PROJECT_ROOT, "src/fhir/aidbox-hl7v2-custom"),
];

interface FieldInfo {
  name: string;
  optional: boolean;
  isArray: boolean;
  rawType: string; // The type expression as written, e.g. `Reference<"Organization">[]`
  referenceTargets: string[] | null; // Parsed from `Reference<"X" | "Y">`
  enumValues: string[] | null; // Parsed from union of string literals
}

interface InterfaceInfo {
  name: string;
  parent: string | null;
  parentArgs: string | null; // Raw generic args on parent, e.g. `T` in `extends Reference<T>`
  canonicalUrl: string | null;
  file: string; // Absolute path
  kind: "resource" | "datatype" | "backbone" | "custom-resource" | "helper";
  fields: FieldInfo[];
}

type Index = Map<string, InterfaceInfo>;

function parseFieldType(raw: string): Omit<FieldInfo, "name" | "optional"> {
  let t = raw.trim();
  // Strip a top-level array marker
  let isArray = false;
  if (t.endsWith("[]")) {
    isArray = true;
    t = t.slice(0, -2).trim();
  }
  // Unwrap parenthesized unions: (a | b)
  if (t.startsWith("(") && t.endsWith(")")) {
    const inner = t.slice(1, -1);
    // Only strip parens when they enclose the whole thing (simple heuristic)
    let depth = 0;
    let balanced = true;
    for (const ch of inner) {
      if (ch === "(") depth++;
      else if (ch === ")") {
        if (depth === 0) { balanced = false; break; }
        depth--;
      }
    }
    if (balanced && depth === 0) t = inner.trim();
  }

  let referenceTargets: string[] | null = null;
  const refMatch = t.match(/^Reference<([^>]+)>$/);
  if (refMatch) {
    const inside = refMatch[1]!;
    referenceTargets = inside
      .split("|")
      .map(s => s.trim().replace(/^"(.*)"$/, "$1"))
      .filter(s => s.length > 0);
  }

  let enumValues: string[] | null = null;
  if (/^".+"(\s*\|\s*".+")+$/.test(t) || /^".+"$/.test(t)) {
    enumValues = t.split("|").map(s => s.trim().replace(/^"(.*)"$/, "$1"));
  }

  return { isArray, rawType: raw.trim(), referenceTargets, enumValues };
}

async function parseFile(path: string): Promise<InterfaceInfo[]> {
  const src = await Bun.file(path).text();
  const lines = src.split("\n");
  const results: InterfaceInfo[] = [];

  let canonicalUrl: string | null = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const urlMatch = line.match(/^\/\/\s*CanonicalURL:\s*(\S+)/);
    if (urlMatch) {
      canonicalUrl = urlMatch[1]!;
      i++;
      continue;
    }
    const ifaceMatch = line.match(/^export interface (\w+)(?:<[^>]+>)?(?:\s+extends\s+(\w+)(?:<([^>]+)>)?)?\s*\{/);
    if (!ifaceMatch) {
      i++;
      continue;
    }
    const name = ifaceMatch[1]!;
    const parent = ifaceMatch[2] ?? null;
    const parentArgs = ifaceMatch[3] ?? null;

    // Collect body until matching closing `}` at column 0.
    const bodyLines: string[] = [];
    i++;
    while (i < lines.length && !lines[i]!.match(/^\}/)) {
      bodyLines.push(lines[i]!);
      i++;
    }
    i++; // Skip closing }

    const fields: FieldInfo[] = [];
    // Fields look like:  `    name?: Type;` possibly spanning continuation of literal types.
    // All observed fields in the generated files fit on one line.
    for (const bl of bodyLines) {
      const fm = bl.match(/^\s+(\w+)(\?)?:\s*(.+?);\s*$/);
      if (!fm) continue;
      const fname = fm[1]!;
      const optional = fm[2] === "?";
      const rawType = fm[3]!;
      fields.push({ name: fname, optional, ...parseFieldType(rawType) });
    }

    const kind = classifyInterface(name, parent, path, fields);
    results.push({
      name,
      parent,
      parentArgs,
      canonicalUrl,
      file: path,
      kind,
      fields,
    });
    canonicalUrl = null; // Consume
  }

  return results;
}

function classifyInterface(
  name: string,
  parent: string | null,
  path: string,
  fields: FieldInfo[],
): InterfaceInfo["kind"] {
  if (parent === "BackboneElement") return "backbone";
  if (path.includes("aidbox-hl7v2-custom")) {
    const isResource = fields.some(f => f.name === "resourceType" && f.rawType.startsWith('"'));
    return isResource ? "custom-resource" : "helper";
  }
  // Only the base Resource/DomainResource and concrete resources declare resourceType
  // as a literal string. BackboneElement quirk: ExampleScenarioInstance declares
  // `resourceType: string` (generic), not a literal.
  const hasLiteralResourceType = fields.some(
    f => f.name === "resourceType" && f.rawType.startsWith('"'),
  );
  if (hasLiteralResourceType) return "resource";
  if (name === "Resource" || name === "DomainResource") return "resource";
  return "datatype";
}

async function buildIndex(): Promise<Index> {
  const index: Index = new Map();
  for (const dir of FHIR_DIRS) {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".ts") || entry === "index.ts") continue;
      const path = resolve(dir, entry);
      const ifaces = await parseFile(path);
      for (const iface of ifaces) {
        if (!index.has(iface.name)) index.set(iface.name, iface);
      }
    }
  }
  return index;
}

// Cardinality string from optional + isArray.
// FHIR R4 min/max beyond 0..1 / 0..* / 1..1 / 1..* cannot be recovered from TS types alone.
function cardinality(optional: boolean, isArray: boolean): string {
  const min = optional ? 0 : 1;
  const max = isArray ? "*" : 1;
  return `[${min}..${max}]`;
}

function collectInherited(iface: InterfaceInfo, index: Index): InterfaceInfo[] {
  const chain: InterfaceInfo[] = [];
  let cur = iface.parent ? index.get(iface.parent) : null;
  while (cur) {
    chain.push(cur);
    cur = cur.parent ? index.get(cur.parent) : null;
  }
  return chain;
}

function formatType(f: FieldInfo): string {
  if (f.referenceTargets) {
    const targets = f.referenceTargets.join(" | ");
    return `Reference(${targets})`;
  }
  // Collapse the massive resourceType union in Resource/DomainResource.
  if (f.name === "resourceType" && f.enumValues && f.enumValues.length > 5) {
    return `<any resource type> (${f.enumValues.length} variants)`;
  }
  // Strip trailing [] since cardinality already conveys "many".
  return f.isArray ? f.rawType.replace(/\[\]$/, "") : f.rawType;
}

function fieldsInSameFile(iface: InterfaceInfo, index: Index): InterfaceInfo[] {
  return [...index.values()].filter(i => i.file === iface.file && i.name !== iface.name);
}

function showInterface(iface: InterfaceInfo, index: Index, showInherited: boolean) {
  const kindLabel = {
    resource: "Resource",
    datatype: "Datatype",
    backbone: "BackboneElement",
    "custom-resource": "Custom Resource",
    helper: "Helper Type",
  }[iface.kind];

  let header = `${kindLabel} ${iface.name}`;
  if (iface.canonicalUrl) header += ` — ${iface.canonicalUrl}`;
  console.log(header);
  if (iface.parent) console.log(`Extends: ${iface.parent}`);

  if (iface.fields.length > 0) {
    console.log("\nFields:");
    printFields(iface.fields);
  }

  if (showInherited) {
    const chain = collectInherited(iface, index);
    const seen = new Set(iface.fields.map(f => f.name));
    for (const anc of chain) {
      const newFields = anc.fields.filter(f => !seen.has(f.name));
      if (newFields.length === 0) continue;
      console.log(`\nInherited from ${anc.name}:`);
      printFields(newFields);
      for (const f of newFields) seen.add(f.name);
    }
  }

  const siblings = fieldsInSameFile(iface, index);
  if (siblings.length > 0) {
    console.log(`\nSibling types defined in same file:`);
    for (const s of siblings) {
      const fieldCount = s.fields.length;
      const label = s.kind === "backbone" ? "backbone" : s.parent === "BackboneElement" ? "backbone" : "helper";
      console.log(`  ${s.name.padEnd(30)} ${label} (${fieldCount} field${fieldCount === 1 ? "" : "s"})`);
    }
  }
}

function printFields(fields: FieldInfo[]) {
  const maxName = Math.max(...fields.map(f => f.name.length));
  for (const f of fields) {
    const card = cardinality(f.optional, f.isArray);
    const type = formatType(f);
    console.log(`  ${f.name.padEnd(maxName)}  ${card.padEnd(7)} ${type}`);
  }
}

function showField(typeName: string, fieldName: string, index: Index) {
  const iface = index.get(typeName);
  if (!iface) {
    console.error(`${typeName} not found`);
    process.exit(1);
  }

  // Look up in interface itself first, then walk inheritance chain.
  let found: { field: FieldInfo; owner: InterfaceInfo } | null = null;
  const candidates = [iface, ...collectInherited(iface, index)];
  for (const cand of candidates) {
    const f = cand.fields.find(x => x.name === fieldName);
    if (f) { found = { field: f, owner: cand }; break; }
  }
  if (!found) {
    console.error(`Field ${typeName}.${fieldName} not found (searched ${candidates.map(c => c.name).join(", ")})`);
    process.exit(1);
  }

  const { field, owner } = found;
  console.log(`Field ${typeName}.${fieldName}`);
  if (owner.name !== typeName) console.log(`  (Inherited from ${owner.name})`);
  console.log(`  Type: ${field.rawType}`);
  console.log(`  Cardinality: ${cardinality(field.optional, field.isArray)}`);

  if (field.referenceTargets) {
    console.log(`  Reference targets: ${field.referenceTargets.join(", ")}`);
  }
  if (field.enumValues && field.enumValues.length > 1) {
    console.log(`  Allowed values:`);
    for (const v of field.enumValues) console.log(`    ${v}`);
  }

  // If the field's type resolves to a known interface, show its structure.
  const innerType = field.rawType
    .replace(/\[\]$/, "")
    .replace(/^\((.+)\)$/, "$1")
    .trim();
  const resolved = index.get(innerType);
  if (resolved) {
    console.log(`\n${resolved.kind === "backbone" ? "BackboneElement" : resolved.kind === "datatype" ? "Datatype" : "Type"} ${resolved.name}:`);
    printFields(resolved.fields);
  }
}

async function listAll(index: Index) {
  const groups = { resource: [], "custom-resource": [], datatype: [], backbone: [], helper: [] } as Record<string, string[]>;
  for (const iface of index.values()) {
    groups[iface.kind]!.push(iface.name);
  }
  for (const [k, names] of Object.entries(groups)) {
    names.sort();
    console.log(`\n${k} (${names.length}):`);
    console.log(`  ${names.join(", ")}`);
  }
}

function parseArgs(args: string[]): { query: string; inherited: boolean; list: boolean } {
  let query = "";
  let inherited = false;
  let list = false;
  for (const arg of args) {
    if (arg === "--inherited" || arg === "-i") inherited = true;
    else if (arg === "--list") list = true;
    else if (!query) query = arg;
  }
  if (!query && !list) {
    console.error("Usage: bun scripts/fhir-ref-lookup.ts <Query> [--inherited]");
    console.error("       bun scripts/fhir-ref-lookup.ts --list");
    console.error("");
    console.error("  <Query>:");
    console.error("    Patient              -> resource/datatype/backbone info");
    console.error("    Patient.name         -> field detail (+ expands into referenced type)");
    console.error("    HumanName.given      -> datatype component");
    console.error("    PatientContact       -> backbone element");
    console.error("");
    console.error("  --inherited: include inherited fields from parent types");
    console.error("  --list: list all known types grouped by kind");
    process.exit(1);
  }
  return { query, inherited, list };
}

const { query, inherited, list } = parseArgs(process.argv.slice(2));
const index = await buildIndex();

if (list) {
  await listAll(index);
  process.exit(0);
}

// Case-insensitive resolution (prefer exact).
function resolveName(q: string): string | null {
  if (index.has(q)) return q;
  const lower = q.toLowerCase();
  for (const name of index.keys()) {
    if (name.toLowerCase() === lower) return name;
  }
  return null;
}

if (query.includes(".")) {
  const [rawType, rawField, ...rest] = query.split(".");
  if (rest.length > 0) {
    console.error(`Only two-segment paths are supported (got ${query}).`);
    console.error(`To inspect a backbone element, look up its type name directly.`);
    process.exit(1);
  }
  const typeName = resolveName(rawType!);
  if (!typeName) {
    console.error(`Type "${rawType}" not found. Try --list to see all known types.`);
    process.exit(1);
  }
  showField(typeName, rawField!, index);
} else {
  const typeName = resolveName(query);
  if (!typeName) {
    console.error(`"${query}" not found. Try --list to see all known types.`);
    process.exit(1);
  }
  showInterface(index.get(typeName)!, index, inherited);
}

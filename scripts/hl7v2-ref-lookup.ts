import { resolve } from "path";
import type {
  OutputField,
  OutputSegment,
  OutputSegmentField,
  OutputDatatype,
  OutputTable,
  XsdMessageElement,
} from "./hl7v2-reference/types";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const DEFAULT_VERSION = "2.5";

interface ReferenceData {
  fields: Record<string, OutputField>;
  segments: Record<string, OutputSegment>;
  datatypes: Record<string, OutputDatatype>;
  messages: Record<string, { elements: XsdMessageElement[] }>;
  tables: Record<string, OutputTable>;
}

async function loadReferenceData(version: string): Promise<ReferenceData> {
  const dir = resolve(PROJECT_ROOT, "data/hl7v2-reference", `v${version}`);
  const load = async <T>(file: string): Promise<T> => {
    const f = Bun.file(resolve(dir, file));
    if (!(await f.exists())) {
      console.error(`No reference data for version ${version} (missing ${file})`);
      process.exit(1);
    }
    return f.json();
  };

  const [fields, segments, datatypes, messages, tables] = await Promise.all([
    load<Record<string, OutputField>>("fields.json"),
    load<Record<string, OutputSegment>>("segments.json"),
    load<Record<string, OutputDatatype>>("datatypes.json"),
    load<Record<string, { elements: XsdMessageElement[] }>>("messages.json"),
    load<Record<string, OutputTable>>("tables.json"),
  ]);

  return { fields, segments, datatypes, messages, tables };
}

type QueryType = "table" | "message" | "component" | "field" | "name";

function detectQueryType(query: string): QueryType {
  if (/^\d{4}$/.test(query)) return "table";
  if (query.includes("_")) return "message";
  if (/^[A-Z][A-Z0-9]{0,2}\d?\.\d+\.\d+$/.test(query)) return "component";
  if (/^[A-Z][A-Z0-9]{0,2}\d?\.\d+$/.test(query)) return "field";
  if (/^[A-Z][A-Z0-9]{0,3}$/.test(query)) return "name";
  console.error(`Unknown query format: ${query}`);
  process.exit(1);
}

function cardinality(min: number, max: number | "unbounded"): string {
  const hi = max === "unbounded" ? "*" : String(max);
  return `[${min}..${hi}]`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.lastIndexOf(".", maxLen);
  return text.slice(0, cut > maxLen * 0.5 ? cut + 1 : maxLen) + "..";
}

function showTable(query: string, data: ReferenceData) {
  const table = data.tables[query];
  if (!table) {
    console.error(`Table ${query} not found`);
    process.exit(1);
  }
  console.log(`Table ${table.tableNumber} — ${table.name} (${table.type}-defined)\n`);
  console.log("Values:");
  for (const v of table.values) {
    console.log(`  ${v.code.padEnd(10)} ${v.display}`);
  }
}

function showMessage(query: string, data: ReferenceData) {
  const msg = data.messages[query];
  if (!msg) {
    console.error(`Message ${query} not found`);
    process.exit(1);
  }
  console.log(`Message ${query}\n`);
  console.log("Structure:");
  printElements(msg.elements, 1);
}

function printElements(elements: XsdMessageElement[], depth: number) {
  const indent = "  ".repeat(depth);
  for (const el of elements) {
    const card = cardinality(el.minOccurs, el.maxOccurs);
    if (el.segment) {
      console.log(`${indent}${el.segment} ${card}`);
    } else if (el.group) {
      const groupName = el.group.split(".").slice(1).join(".");
      console.log(`${indent}${groupName} ${card}`);
      if (el.elements) printElements(el.elements, depth + 1);
    }
  }
}

function showField(query: string, data: ReferenceData) {
  const field = data.fields[query];
  if (!field) {
    console.error(`Field ${query} not found`);
    process.exit(1);
  }

  const segmentKey = query.split(".")[0]!;
  const seg = data.segments[segmentKey];
  const segField = seg?.fields.find((f: OutputSegmentField) => f.field === query);
  const reqStr = segField
    ? `${segField.minOccurs > 0 ? "required" : "optional"}${segField.maxOccurs !== 1 ? ", repeating" : ""}`
    : "unknown";

  console.log(`Field ${query} — ${field.longName}`);
  console.log(`  Data Type: ${field.dataType}`);
  if (field.maxLength !== null) console.log(`  Max Length: ${field.maxLength}`);
  console.log(`  Table: ${field.table ?? "-"}`);
  console.log(`  Cardinality: ${reqStr}`);
  if (field.description) console.log(`\n${field.description}`);

  const dt = data.datatypes[field.dataType];
  if (dt && dt.components.length > 0) {
    console.log(`\nComponents (${field.dataType}):`);
    for (const c of dt.components) {
      const maxLen = c.maxLength !== null ? `, maxLen: ${c.maxLength}` : "";
      console.log(`  ${c.component.padEnd(8)} ${c.longName} (${c.dataType}${maxLen})`);
    }
  }
}

function showComponent(query: string, data: ReferenceData) {
  const parts = query.split(".");
  const fieldKey = `${parts[0]}.${parts[1]}`;
  const compPos = parseInt(parts[2]!, 10);

  const field = data.fields[fieldKey];
  if (!field) {
    console.error(`Field ${fieldKey} not found`);
    process.exit(1);
  }

  const dt = data.datatypes[field.dataType];
  if (!dt) {
    console.error(`${fieldKey} has primitive type ${field.dataType} (no components)`);
    process.exit(1);
  }

  const comp = dt.components.find(c => c.position === compPos);
  if (!comp) {
    console.error(`Component ${compPos} not found in ${field.dataType} (has ${dt.components.length} components)`);
    process.exit(1);
  }

  console.log(`Component ${query} — ${comp.longName}`);
  console.log(`  Field: ${fieldKey} ${field.longName} (${field.dataType})`);
  console.log(`  Component: ${comp.component} ${comp.longName}`);
  console.log(`  Data Type: ${comp.dataType}`);
  if (comp.maxLength !== null) console.log(`  Max Length: ${comp.maxLength}`);
}

function showSegment(query: string, data: ReferenceData): boolean {
  const seg = data.segments[query];
  if (!seg) return false;

  console.log(`Segment ${query} — ${seg.longName ?? "(no name)"}`);
  if (seg.description) console.log(`\n${truncate(seg.description, 500)}`);

  if (seg.fields.length > 0) {
    console.log("\nFields:");
    for (const sf of seg.fields) {
      const f = data.fields[sf.field];
      const name = f?.longName ?? "?";
      const dt = f?.dataType ?? "?";
      const maxLen = f?.maxLength !== null && f?.maxLength !== undefined ? `, maxLen: ${f.maxLength}` : "";
      const table = f?.table ? ` [table ${f.table}]` : "";
      const repeat = sf.maxOccurs !== 1 ? ", repeating" : "";
      console.log(`  ${sf.field.padEnd(8)} ${name} (${dt}${maxLen}${repeat})${table}`);
    }
  }
  return true;
}

function showDatatype(query: string, data: ReferenceData): boolean {
  const dt = data.datatypes[query];
  if (!dt) return false;

  console.log(`Datatype ${query}\n`);
  console.log("Components:");
  for (const c of dt.components) {
    const maxLen = c.maxLength !== null ? `, maxLen: ${c.maxLength}` : "";
    console.log(`  ${c.component.padEnd(8)} ${c.longName} (${c.dataType}${maxLen})`);
  }
  return true;
}

function showByName(query: string, data: ReferenceData) {
  if (showSegment(query, data)) return;
  if (showDatatype(query, data)) return;

  if (data.messages[query]) {
    showMessage(query, data);
    return;
  }

  console.error(`"${query}" not found as segment, datatype, or message`);
  process.exit(1);
}

function parseCliArgs(args: string[]): { query: string; version: string } {
  let query = "";
  let version = DEFAULT_VERSION;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--version" && i + 1 < args.length) {
      version = args[++i]!;
    } else if (!query) {
      query = args[i]!.toUpperCase();
    }
  }

  if (!query) {
    console.error("Usage: bun scripts/hl7v2-ref-lookup.ts <query> [--version 2.5|2.8.2]");
    console.error("  query: PID, PID.3, PID.3.1, ORU_R01, 0001, CWE, etc.");
    process.exit(1);
  }

  return { query, version };
}

const { query, version } = parseCliArgs(process.argv.slice(2));
const data = await loadReferenceData(version);
const type = detectQueryType(query);

switch (type) {
  case "table": showTable(query, data); break;
  case "message": showMessage(query, data); break;
  case "field": showField(query, data); break;
  case "component": showComponent(query, data); break;
  case "name": showByName(query, data); break;
}

import { join } from "node:path";
import { readdir } from "node:fs/promises";
import type { PdfAttributeTableField, PdfComponentDescription, PdfComponentTableField, PdfDatatypeDescription, PdfDeprecatedComponent, PdfFieldDescription, PdfSegmentDescription, PdfTable, PdfTableValue } from "./types";

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

export async function findPdfToText(): Promise<string[]> {
  // Check if pdftotext is directly available
  const direct = Bun.spawnSync(["which", "pdftotext"]);
  if (direct.exitCode === 0) return ["pdftotext"];

  // NixOS: use nix-shell wrapper
  const nixShell = Bun.spawnSync(["which", "nix-shell"]);
  if (nixShell.exitCode === 0) return ["nix-shell", "-p", "poppler-utils", "--run"];

  throw new Error(
    "pdftotext not found. Install poppler-utils (e.g., apt install poppler-utils) " +
    "or on NixOS ensure nix-shell is available."
  );
}

async function extractPdfText(pdfPath: string, cmd: string[], layout: boolean = false): Promise<string> {
  let proc;
  if (cmd[0] === "nix-shell") {
    const pdfCmd = `pdftotext ${layout ? "-layout " : ""}${shellEscape(pdfPath)} -`;
    proc = Bun.spawn([...cmd, pdfCmd], { stdout: "pipe", stderr: "pipe" });
  } else {
    const args = layout ? ["-layout", pdfPath, "-"] : [pdfPath, "-"];
    proc = Bun.spawn(["pdftotext", ...args], { stdout: "pipe", stderr: "pipe" });
  }

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`pdftotext failed on ${pdfPath}: ${stderr}`);
  }

  return output;
}

const PAGE_NOISE_PATTERNS = [
  /^Page\s+[A-Z]?-?\d/,              // "Page 4-1" (v2.5), "Page 1" / "Page A-25" (v2.8.2)
  /^Health Level Seven/,              // Both versions
  /©.*Health Level Seven/,            // v2.8.2: "©Health Level Seven..." and reversed even-page format
  /^Final Standard\./,               // v2.5
  /^\w+\s+\d{4}\.\s*$/,             // "July 2003." (v2.5), "September 2015." (v2.8.2)
  /^Chapter \d+[A-Z]?:/,              // Both versions (e.g., "Chapter 2A:", "Chapter 3:")
  /^Appendix [A-Z]:/,                // Both versions
];

function stripPageNoise(text: string): string {
  return text
    .split("\n")
    .filter(line => !PAGE_NOISE_PATTERNS.some(p => p.test(line.trim())))
    .join("\n");
}

// Matches field definition headers — complete on one line:
// 1. "4.5.3.1 OBR-1 Set ID – OBR (SI) 00237" (section number, datatype, item)
// 2. "OBX-1 Set ID - OBX (SI) 00569" (no section number)
// 3. "2.12.1.1 BHS-1 Batch Field Separator (ST)" (no item number)
// Captures: segment, position, field name, dataType, item number (optional)
const FIELD_HEADER_RE = /^(?:\d+[A-Z]?[\.\d]*\s+)?(\w{2,3})-(\d+)\s+(.+?)\s+\((\w{2,7})\)(?:\s+(\d{5}))?\s*$/;

// Matches field headers where the datatype is on a SUBSEQUENT line:
// "RXV-1 Set ID"            ← bare header (no datatype)
// "OM1-7 Other Service/..."  ← name may continue on next line(s)
// Then a later line has "(SI) 03318" or "(CWE) 00592"
// Captures: segment, position, field name start
const BARE_FIELD_HEADER_RE = /^(?:\d+[A-Z]?[\.\d]*\s+)?(\w{2,3})-(\d+)\s+(.+?)\s*$/;

// Matches a standalone "(DT) NNNNN" or "(DT)" line (datatype + optional item)
const DEFERRED_DT_RE = /^\((\w{2,7})\)(?:\s+(\d{5}))?\s*$/;

// Matches "Definition:" or "Description:" marker at start of line
const DEFINITION_RE = /^(?:Definition|Description):\s*/;

// Matches Components/Subcomponents blocks to skip
const COMPONENTS_RE = /^(?:Components:|Subcomponents\s)/;

function parseFieldDescriptions(text: string): Map<string, PdfFieldDescription> {
  const lines = text.split("\n");
  const fields = new Map<string, PdfFieldDescription>();

  // First pass: find all field header positions
  const headers: { index: number; segment: string; position: number; item: string; dataType: string; longName: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    // Try complete single-line match first
    const match = lines[i]!.match(FIELD_HEADER_RE);
    if (match) {
      headers.push({
        index: i,
        segment: match[1]!,
        position: parseInt(match[2]!, 10),
        item: match[5] ? match[5].padStart(5, "0") : "",
        dataType: match[4]!,
        longName: match[3]!.trim().replace(/\s*[-\u2013]\s*\w{2,3}\s*$/, ""), // strip trailing "– SEG"
      });
      continue;
    }

    // Try bare header (no datatype on this line)
    const bareMatch = lines[i]!.trim().match(BARE_FIELD_HEADER_RE);
    if (!bareMatch) continue;

    const seg = bareMatch[1]!;
    const pos = bareMatch[2]!;
    let longNameParts = [bareMatch[3]!];

    // Must look like a real segment code
    if (!/^[A-Z][A-Z0-9]{1,2}$/.test(seg)) continue;
    // The field name should start with an uppercase letter (not lowercase text or digits,
    // which would indicate an inline reference like "RXE-33 and RXE-34 as:")
    if (!/^[A-Z]/.test(bareMatch[3]!.trim())) continue;

    // Look ahead up to 6 lines for (DT) or continuation of the field name ending with (DT)
    let dataType = "";
    let item = "";
    let resolvedLine = i;
    for (let j = i + 1; j <= Math.min(i + 6, lines.length - 1); j++) {
      const ahead = lines[j]!.trim();
      if (!ahead) continue; // skip blank lines

      // Check for standalone "(DT) NNNNN"
      const dtMatch = ahead.match(DEFERRED_DT_RE);
      if (dtMatch) {
        dataType = dtMatch[1]!;
        item = dtMatch[2] ? dtMatch[2].padStart(5, "0") : "";
        resolvedLine = j;
        break;
      }

      // Check for continuation line that ends with "(DT) NNNNN" (multi-line field name)
      const contMatch = ahead.match(/^(.+?)\s+\((\w{2,7})\)(?:\s+(\d{5}))?\s*$/);
      if (contMatch) {
        longNameParts.push(contMatch[1]!);
        dataType = contMatch[2]!;
        item = contMatch[3] ? contMatch[3].padStart(5, "0") : "";
        resolvedLine = j;
        break;
      }

      // Stop lookahead at structural elements
      if (DEFINITION_RE.test(ahead)) break;
      if (COMPONENTS_RE.test(ahead)) break;
      if (/^Attention:/.test(ahead)) break;
      if (ATTRIBUTE_TABLE_RE.test(ahead)) break;

      // Could be a name continuation line (e.g., "Observation (CWE) 00592")
      // If it doesn't match, it might be just a wrapped name part — but only
      // if it doesn't look like a section number or another field header
      if (/^(\w{2,3})-\d+\s/.test(ahead)) break; // another field header
      if (/^\d+[\.\d]*\s*$/.test(ahead)) break;   // bare section number (don't consume)
    }

    const longName = longNameParts.join(" ").trim().replace(/\s*[-\u2013]\s*\w{2,3}\s*$/, "");

    // Accept the header: with resolved datatype OR as a field without inline datatype
    if (dataType) {
      headers.push({
        index: i,
        segment: seg,
        position: parseInt(pos, 10),
        item,
        dataType,
        longName,
      });
      // Skip past the resolved DT line to avoid re-matching
      i = resolvedLine;
    } else {
      // No datatype found — accept if we see a structural marker confirming this is
      // a real field header (Definition:, Attention:, or Components:)
      let isRealField = false;
      for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
        const ahead = lines[j]!.trim();
        if (!ahead) continue;
        if (/^(Definition:|Attention:|Components:)/.test(ahead)) { isRealField = true; }
        break;
      }
      if (isRealField) {
        headers.push({
          index: i,
          segment: seg,
          position: parseInt(pos, 10),
          item: "",
          dataType: "",
          longName,
        });
      }
    }
  }

  // Second pass: extract descriptions
  for (let h = 0; h < headers.length; h++) {
    const header = headers[h]!;
    const startLine = header.index + 1;
    const endLine = h + 1 < headers.length ? headers[h + 1]!.index : Math.min(startLine + 50, lines.length);
    const section = lines.slice(startLine, endLine);

    const description = extractDescription(section);
    if (description) {
      const key = `${header.segment}.${header.position}`;
      fields.set(key, {
        segment: header.segment,
        position: header.position,
        item: header.item,
        dataType: header.dataType,
        longName: header.longName,
        description,
      });
    }
  }

  return fields;
}

const MAX_DESCRIPTION_LENGTH = 4000;
const SECTION_HEADING_RE = /^\d+[A-Z]?\.\d+(?:\.\d+)*\s+[A-Z]/;

export function extractDescription(sectionLines: string[]): string | null {
  let inComponents = false;
  let definitionFound = false;
  let inPreamble = false;
  const preambleParts: string[] = [];
  const descriptionParts: string[] = [];

  for (const line of sectionLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (definitionFound && descriptionParts.length > 0) {
        descriptionParts.push("");
      }
      inComponents = false;
      inPreamble = false;
      continue;
    }

    // Stop at section headings, attribute tables, segment headings, examples, or ch02A subsections
    if (definitionFound) {
      if (SECTION_HEADING_RE.test(trimmed)) break;
      if (ATTRIBUTE_TABLE_RE.test(trimmed)) break;
      if (SEGMENT_HEADING_RE.test(trimmed) && !trimmed.includes("....")) break;
      if (/^Examples?:/i.test(trimmed)) break;
      if (/^2\.A\.[\d.]+\s+/.test(trimmed)) break;
      // Bare section number on its own line (e.g., "8.8.9.2") — stop if we already
      // have description content, otherwise skip (it's noise between Definition: and text)
      if (/^\d+[A-Z]?(?:\.\d+){2,}\s*$/.test(trimmed)) {
        if (descriptionParts.length > 0) break;
        continue;
      }
      // Bare 5-digit item number on its own line (e.g., "00587")
      if (/^\d{5}\s*$/.test(trimmed)) continue;
    }

    // Skip component listings (multi-line blocks with <Type (DT)> ^ ... patterns)
    if (COMPONENTS_RE.test(trimmed) || trimmed.startsWith("<") || trimmed.startsWith("&")) {
      inComponents = true;
      inPreamble = false;
      continue;
    }
    if (inComponents) {
      // Continuation of component listing: contains angle brackets or ^ separators
      if (/[<>]/.test(trimmed) || /\^/.test(trimmed) || trimmed.startsWith("(")) {
        continue;
      }
      inComponents = false;
    }

    // Before Definition: is found, capture known preamble blocks (Attention:, Note:)
    if (!definitionFound && !inComponents) {
      if (/^(Attention|Note):/.test(trimmed)) {
        inPreamble = true;
        preambleParts.push(trimmed);
        continue;
      }
      if (inPreamble) {
        // Stop preamble at table titles or other structural elements
        if (COMP_TABLE_TITLE_RE.test(trimmed) || ATTRIBUTE_TABLE_RE.test(trimmed)) {
          inPreamble = false;
        } else {
          preambleParts.push(trimmed);
          continue;
        }
      }
    }

    // Check for Definition: marker
    const defMatch = trimmed.match(DEFINITION_RE);
    if (defMatch) {
      definitionFound = true;
      if (preambleParts.length > 0) {
        descriptionParts.push(...preambleParts);
      }
      const afterDef = trimmed.slice(defMatch[0].length).trim();
      if (afterDef) descriptionParts.push(afterDef);
      continue;
    }

    // If we already found Definition:, collect text
    if (definitionFound) {
      descriptionParts.push(trimmed);
      continue;
    }

    // Fallback for fields without "Definition:" marker:
    // After Components block, collect paragraph text that looks like a description
    if (!inComponents && descriptionParts.length === 0) {
      const looksLikeDescription = trimmed.startsWith("This field") ||
        trimmed.startsWith("This is ") ||
        trimmed.startsWith("The ") ||
        trimmed.startsWith("A ") ||
        trimmed.startsWith("An ") ||
        trimmed.startsWith("Contains ") ||
        trimmed.startsWith("Specifies ") ||
        trimmed.startsWith("Indicates ") ||
        trimmed.startsWith("From V") ||
        trimmed.startsWith("In ");
      if (looksLikeDescription) {
        definitionFound = true;
        descriptionParts.push(trimmed);
      }
    }
  }

  // If no Definition: was found but preamble was collected, use preamble as description
  if (descriptionParts.length === 0 && preambleParts.length > 0) {
    descriptionParts.push(...preambleParts);
  }

  if (descriptionParts.length === 0) return null;

  let description = descriptionParts
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s*Chapter \d+[A-Z]?:\s*Control\s*(?:[-\u2013]\s*Data Types)?\s*/g, " ")
    .replace(/\s+\d+(?:\.\w+){2,}\s*$|\s+\d+\.[A-Za-z]\w*(?:\.\w+)*\s*$/, "")
    .trim();

  if (!description) return null;

  // Safety net: truncate at sentence boundary if too long
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    const truncated = description.slice(0, MAX_DESCRIPTION_LENGTH);
    const lastPeriod = truncated.lastIndexOf(". ");
    description = lastPeriod > MAX_DESCRIPTION_LENGTH * 0.5
      ? truncated.slice(0, lastPeriod + 1)
      : truncated;
  }

  return description;
}

// Segment heading format in the actual definition sections (not TOC):
// "PID - Patient Identification Segment"
// "3.4.2 PID – Patient Identification Segment"
// Must contain a word that looks like a segment name followed by actual description text.
// TOC lines contain "...." dots — we exclude those.
const SEGMENT_HEADING_RE = /^(?:\d+[\.\d]*\s+)?([A-Z][A-Z0-9]{1,2}\d?)\s*[-\u2013]\s+(.+)/;

// "HL7 Attribute Table" marks the end of segment description
const ATTRIBUTE_TABLE_RE = /^HL7 Attribute Table/;

function parseSegmentDescriptions(text: string): Map<string, PdfSegmentDescription> {
  const lines = text.split("\n");
  const segments = new Map<string, PdfSegmentDescription>();

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i]!.trim();
    const match = trimmedLine.match(SEGMENT_HEADING_RE);
    if (!match) continue;

    const segName = match[1]!;
    let longName = match[2]!.trim();

    // Skip TOC lines (contain "...." dots)
    if (longName.includes("....")) continue;

    // Only match actual segment codes (2-3 uppercase letters/digits)
    if (!/^[A-Z][A-Z0-9]{1,2}$/.test(segName)) continue;

    // Filter out false positives: table references, message names, numbers
    if (/^\d/.test(longName)) continue;
    const longNameLower = longName.toLowerCase();
    if (longNameLower.includes("event ") && !longNameLower.includes("segment")) continue;

    // Must look like a segment definition — longName should contain a recognizable word
    // (not just a short abbreviation or code). Segment names are like "Patient Identification Segment"
    if (!/[a-z]/.test(longName)) continue; // All-caps abbreviations are likely not segment headings

    // Clean up long name: strip "Segment" / "Segment Definition" suffix
    longName = longName
      .replace(/\s*[Ss]egment\s*[Dd]efinition\s*$/i, "")
      .replace(/\s*[Ss]egment\s*$/i, "")
      .trim();

    // Extract description: text between heading and "HL7 Attribute Table" or field definitions
    const descParts: string[] = [];
    for (let j = i + 1; j < lines.length && j < i + 100; j++) {
      const line = lines[j]!.trim();
      if (!line) continue;
      if (ATTRIBUTE_TABLE_RE.test(line)) break;
      if (FIELD_HEADER_RE.test(line)) break;
      // Stop at next segment heading (that also passes our filters)
      const nextMatch = line.match(SEGMENT_HEADING_RE);
      if (nextMatch && /^[A-Z]{2,3}$/.test(nextMatch[1]!) && !nextMatch[2]!.includes("....") && /[a-z]/.test(nextMatch[2]!)) break;
      // Stop at "field definitions" marker
      if (/field definitions/i.test(line)) break;
      // Skip table column headers (single short words like "Status", "Chapter", "SEQ", "LEN")
      if (/^\w+$/.test(line) && line.length <= 10) continue;

      descParts.push(line);
    }

    const description = descParts.join(" ").replace(/\s+/g, " ").trim();

    // Use last-match-wins: actual definitions appear after TOC/contents entries in each chapter
    if (description.length > 20) {
      segments.set(segName, { name: segName, longName, description });
    }
  }

  return segments;
}

function parseAppendixTables(text: string): Map<string, PdfTable> {
  const lines = text.split("\n");
  const tables = new Map<string, PdfTable>();

  // Parse A.5 (alphabetic list) for table metadata: Type, Number, Name, Chapter
  // Format: "   HL7      0357        Message error condition codes                   2.15.5.3"
  //   or:   "   User     0181        MFN record-level error return                  8.5.3.4"
  const tableMeta = new Map<string, { name: string; type: string }>();
  let inA5 = false;

  for (const line of lines) {
    // Match actual section headings, not TOC entries (TOC entries contain "....")
    if (/HL7 AND USER.DEFINED TABLES.*ALPHABETIC/i.test(line) && !line.includes("....")) {
      inA5 = true;
      continue;
    }
    if (/HL7 AND USER.DEFINED TABLES.*NUMERIC/i.test(line) && !line.includes("....")) {
      inA5 = false;
    }
    if (!inA5) continue;

    // A.5 layout: Type (indented) + Table number + Name + Chapter ref
    // v2.5:   "   HL7      0357        Message error condition codes                   2.15.5.3"
    // v2.8.2: "HL7           0155          Accept/Application Acknowledgment...        2.C.2.103"
    // v2.8.2 names may start with "- " prefix (e.g., "- Insurance Company Contact Reason")
    const m = line.match(/^\s*(HL7|User)\s+(\d{4})\s+[-\u2013]?\s*(.+?)(?:\s{2,}[\d.A-Z]+[\.\d]*\s*$|\s*$)/);
    if (m) {
      const name = m[3]!.trim();
      if (name && !/^Type\s+Table/.test(name)) { // skip header row
        tableMeta.set(m[2]!, { type: m[1]!, name });
      }
    }
  }

  // Parse A.6 (numeric sort) for table values
  // Actual layout format (from pdftotext -layout):
  //   Header line: "Type                 Table Name"
  //     e.g.: "User                 Administrative Sex"
  //     e.g.: "HL7               Event type"
  //   Value lines: "          NNNN                                           CODE                Description"
  //     e.g.: "          0001                                           A                Ambiguous"
  // The key pattern: table number (4 digits) is indented, followed by large gap, then code, then description
  let currentTableName: string | null = null;
  let currentTableType: string | null = null;
  let lastTableNum: string | null = null;
  let inA6 = false;

  for (const line of lines) {
    // Match actual section heading, not TOC entry (TOC entries contain "....")
    if (/HL7 AND USER.DEFINED TABLES.*NUMERIC/i.test(line) && !line.includes("....")) {
      inA6 = true;
      continue;
    }
    // Stop at A.7 section (actual heading, not TOC)
    if (inA6 && /DATA ELEMENT NAMES/.test(line) && !line.includes("....")) break;
    if (inA6 && /^A\.7\b/.test(line.trim()) && !line.includes("....")) break;
    if (!inA6) continue;

    // Skip page noise lines and column headers
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^Type\s+Table\s+Name/.test(trimmed)) continue;
    if (/^Page\s/.test(trimmed)) continue;

    // Table header: "Type                 Table Name"
    // Starts at column 0 with "HL7" or "User"
    const headerMatch = line.match(/^(HL7|User)\s{2,}(.+\S)/);
    if (headerMatch) {
      currentTableType = headerMatch[1]!;
      currentTableName = headerMatch[2]!.trim();
      continue;
    }

    // Value line: indented, starts with 4-digit table number, then code + description
    // "          0001                                           A                Ambiguous"
    const valueMatch = line.match(/^\s+(\d{4})\s{2,}(\S+)\s{2,}(.+\S)/);
    if (valueMatch) {
      const tableNum = valueMatch[1]!;
      const code = valueMatch[2]!;
      const display = valueMatch[3]!.trim();

      if (!tables.has(tableNum)) {
        const meta = tableMeta.get(tableNum);
        tables.set(tableNum, {
          tableNumber: tableNum,
          name: meta?.name || currentTableName || "",
          type: meta?.type || currentTableType || "",
          values: [],
        });
      }
      tables.get(tableNum)!.values.push({ code, display });
      lastTableNum = tableNum;
      continue;
    }

    // Continuation line for multi-line descriptions (indented text without table number)
    // e.g.: "                                                                inpatient"
    // These follow a value line and should append to the last value's display
    if (/^\s{20,}\S/.test(line) && lastTableNum) {
      const table = tables.get(lastTableNum);
      if (table && table.values.length > 0) {
        table.values[table.values.length - 1]!.display += " " + trimmed;
      }
    }
  }

  return tables;
}

const VALID_USAGE_CODES = new Set(["R", "RE", "O", "C", "CE", "X", "B", "W"]);

// Matches "HL7 Attribute Table - PID - Patient Identification" (hyphen or en-dash)
const ATTR_TABLE_TITLE_RE = /HL7 Attribute Table\s*[-\u2013]\s*([A-Z][A-Z0-9]{1,2}\d?)\s*[-\u2013]/;

function parseAttributeTables(text: string): Map<string, PdfAttributeTableField[]> {
  const lines = text.split("\n");
  const result = new Map<string, PdfAttributeTableField[]>();

  let i = 0;
  while (i < lines.length) {
    const titleMatch = lines[i]!.match(ATTR_TABLE_TITLE_RE);
    if (!titleMatch) { i++; continue; }

    const segName = titleMatch[1]!;
    const isExample = /example/i.test(lines[i]!);
    i++;

    if (isExample || result.has(segName)) {
      // Skip example tables and duplicate segment tables
      i++;
      continue;
    }

    // Find header row containing "SEQ" and optionality column ("OPT", "USAGE", or "R/O")
    let optColStart = -1;
    let lenColStart = -1;
    let clenColStart = -1;
    const titleLineIndex = i - 1;
    const headerLimit = Math.min(i + 5, lines.length);
    for (; i < headerLimit; i++) {
      const line = lines[i]!;
      if (/\bSEQ\b/.test(line)) {
        if (/\bOPT\b/.test(line)) {
          optColStart = line.indexOf("OPT");
        } else if (/\bUSAGE\b/.test(line)) {
          optColStart = line.indexOf("USAGE");
        } else if (/\bR\/O\b/.test(line)) {
          optColStart = line.indexOf("R/O");
        }
        if (optColStart !== -1) {
          // Also capture LEN and C.LEN column positions
          const lenMatch = line.match(/\bLEN\b/);
          if (lenMatch) lenColStart = line.indexOf(lenMatch[0]);
          const clenMatch = line.match(/\bC\.LEN\b/);
          if (clenMatch) clenColStart = line.indexOf(clenMatch[0]);
          i++;
          break;
        }
      }
    }

    if (optColStart === -1) {
      console.warn(`  [attr-table] ${segName}: found title but no SEQ+OPT/USAGE header within ${headerLimit - titleLineIndex} lines`);
      for (let j = titleLineIndex + 1; j < Math.min(headerLimit, lines.length); j++) {
        console.warn(`    line: "${lines[j]}"`);
      }
      continue;
    }

    // Parse data rows
    const fields: PdfAttributeTableField[] = [];
    for (; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();

      if (!trimmed) continue;

      // Recalibrate on repeated header after page break
      if (/^\s*SEQ\b/.test(line) && (/\bOPT\b/.test(line) || /\bUSAGE\b/.test(line) || /\bR\/O\b/.test(line))) {
        optColStart = line.indexOf("OPT");
        if (optColStart === -1) optColStart = line.indexOf("USAGE");
        if (optColStart === -1) optColStart = line.indexOf("R/O");
        const lenMatch = line.match(/\bLEN\b/);
        lenColStart = lenMatch ? line.indexOf(lenMatch[0]) : -1;
        const clenMatch = line.match(/\bC\.LEN\b/);
        clenColStart = clenMatch ? line.indexOf(clenMatch[0]) : -1;
        continue;
      }

      // Stop at next attribute table, section heading, or field definition header
      if (ATTR_TABLE_TITLE_RE.test(trimmed)) break;
      if (FIELD_HEADER_RE.test(trimmed)) break;
      if (SECTION_HEADING_RE.test(trimmed)) break;

      // Data row: must start with SEQ (digits), allowing "1-n" or "1-N" range notation
      const seqMatch = trimmed.match(/^(\d{1,3})(?:-[nN])?\s/);
      if (!seqMatch) continue;
      const itemMatch = trimmed.match(/\b(\d{5})\b/);

      const position = parseInt(seqMatch[1]!, 10);
      const item = itemMatch ? itemMatch[1]! : "";

      // Extract OPT by column position from the header (wide window to handle misalignment)
      const optSlice = line.slice(Math.max(0, optColStart - 5), optColStart + 10).trim();
      // The slice may contain adjacent column data; find the valid usage code
      const usageToken = optSlice.split(/\s+/).find(t => VALID_USAGE_CODES.has(t));
      if (!usageToken) continue;

      // Extract LEN by column position: "N..M" (range) or "N" (single)
      let minLength: number | null = null;
      let maxLength: number | null = null;
      if (lenColStart !== -1) {
        const lenSlice = line.slice(Math.max(0, lenColStart - 3), lenColStart + 12).trim();
        // Split into tokens and find one matching range or number pattern
        for (const token of lenSlice.split(/\s+/)) {
          const rangeMatch = token.match(/^(\d+)\.\.(\d+)$/);
          if (rangeMatch) {
            minLength = parseInt(rangeMatch[1]!, 10);
            maxLength = parseInt(rangeMatch[2]!, 10);
            break;
          }
          if (/^\d+$/.test(token)) {
            minLength = parseInt(token, 10);
            maxLength = minLength;
            break;
          }
        }
      }

      // Extract C.LEN by column position: "N=" or "N#"
      let confLength: string | null = null;
      if (clenColStart !== -1) {
        const clenSlice = line.slice(Math.max(0, clenColStart - 3), clenColStart + 12).trim();
        for (const token of clenSlice.split(/\s+/)) {
          const clenMatch = token.match(/^\d+[=#]$/);
          if (clenMatch) { confLength = clenMatch[0]; break; }
        }
      }

      fields.push({ segment: segName, position, item, optionality: usageToken, minLength, maxLength, confLength });
    }

    if (fields.length > 0) {
      result.set(segName, fields);
    } else {
      console.warn(`  [attr-table] ${segName}: header found (opt@col ${optColStart}) but no data rows matched`);
    }
  }

  return result;
}

export async function parsePdfAttributeTables(pdfDir: string, cmd: string[]): Promise<Map<string, PdfAttributeTableField[]>> {
  const files = await readdir(pdfDir);
  const chapterFiles = files.filter(f => /CH\d+/i.test(f) && f.endsWith(".pdf")).sort();

  const allTables = new Map<string, PdfAttributeTableField[]>();

  for (const file of chapterFiles) {
    const pdfPath = join(pdfDir, file);
    const text = stripPageNoise(await extractPdfText(pdfPath, cmd, true));
    const tables = parseAttributeTables(text);
    for (const [segName, fields] of tables) {
      if (!allTables.has(segName)) {
        allTables.set(segName, fields);
      }
    }
  }

  return allTables;
}

// Matches datatype heading: "2.A.8 CNE – coded with no exceptions"
const DATATYPE_HEADING_RE = /^(?:2\.A\.\d+\s+)?([A-Z][A-Z0-9]{0,4})\s*[-\u2013]\s+(.+)/;

// Matches component heading: "2.A.8.3 Name of Coding System (ID)"
const COMPONENT_HEADING_RE = /^(?:2\.A\.[\d.]+\s+)?(.+?)\s+\(([A-Z][A-Z0-9]{0,4})\)\s*$/;

// Matches HL7 Component Table title
const COMP_TABLE_TITLE_RE = /HL7 Component Table\s*[-\u2013]\s*([A-Z][A-Z0-9]{0,4})\s*[-\u2013]/;

function parseDatatypeDescriptions(text: string): {
  datatypes: Map<string, PdfDatatypeDescription>;
  components: Map<string, PdfComponentDescription>;
  deprecatedComponents: Map<string, PdfDeprecatedComponent>;
} {
  const lines = text.split("\n");
  const datatypes = new Map<string, PdfDatatypeDescription>();
  const components = new Map<string, PdfComponentDescription>();
  const deprecatedComponents = new Map<string, PdfDeprecatedComponent>();

  // First pass: find all datatype and component heading positions
  const dtHeaders: { index: number; name: string; longName: string }[] = [];
  const compHeaders: { index: number; datatype: string; position: number; deprecated: boolean; longName: string }[] = [];

  let currentDt: string | null = null;
  let currentCompPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();

    // Check for datatype heading
    const dtMatch = trimmed.match(DATATYPE_HEADING_RE);
    if (dtMatch) {
      const name = dtMatch[1]!;
      const longName = dtMatch[2]!.trim();

      // Skip TOC lines
      if (longName.includes("....")) continue;
      // Must have lowercase (not all-caps abbreviation)
      if (!/[a-z]/.test(longName)) continue;
      // Must look like a datatype code (2-5 uppercase alphanumeric)
      if (!/^[A-Z][A-Z0-9]{0,4}$/.test(name)) continue;

      dtHeaders.push({ index: i, name, longName });
      currentDt = name;
      currentCompPos = 0;
      continue;
    }

    // Check for component heading (only within a datatype context)
    if (currentDt) {
      const compMatch = trimmed.match(COMPONENT_HEADING_RE);
      if (compMatch) {
        currentCompPos++;
        compHeaders.push({ index: i, datatype: currentDt, position: currentCompPos, deprecated: false, longName: compMatch[1]! });
      } else {
        // Deprecated/withdrawn components have headings without (DT) suffix:
        // "2.A.56.7 Degree" instead of "2.A.56.7 Degree (IS)"
        // These always have the 2.A.N.M prefix, so we can match on that.
        const deprecatedMatch = trimmed.match(/^2\.A\.\d+\.(\d+)\s+(.+)/);
        if (deprecatedMatch) {
          const pos = parseInt(deprecatedMatch[1]!, 10);
          currentCompPos = pos;
          compHeaders.push({ index: i, datatype: currentDt, position: currentCompPos, deprecated: true, longName: deprecatedMatch[2]!.trim() });
        }
      }
    }
  }

  // Second pass: extract datatype descriptions
  // In both v2.5 and v2.8.2, the "Definition:" block appears AFTER the component table,
  // before the first component heading. Use extractDescription() which handles Definition: markers.
  for (let d = 0; d < dtHeaders.length; d++) {
    const header = dtHeaders[d]!;
    const startLine = header.index + 1;
    const nextDtLine = d + 1 < dtHeaders.length ? dtHeaders[d + 1]!.index : lines.length;

    // Search from heading to first component heading (spanning over the component table)
    const firstCompLine = compHeaders.find(c => c.datatype === header.name)?.index ?? nextDtLine;
    const endLine = Math.min(firstCompLine, nextDtLine);

    const section = lines.slice(startLine, endLine);
    const description = extractDescription(section);
    if (description) {
      // Last-match-wins: actual definition appears after TOC entry
      datatypes.set(header.name, {
        name: header.name,
        longName: header.longName.replace(/\s*\(.*\)\s*$/, "").trim(),
        description,
      });
    }
  }

  // Third pass: extract component descriptions using extractDescription()
  for (let c = 0; c < compHeaders.length; c++) {
    const header = compHeaders[c]!;
    const startLine = header.index + 1;

    // End at next component, next datatype, or 50 lines max
    let endLine = Math.min(startLine + 50, lines.length);
    if (c + 1 < compHeaders.length) {
      endLine = Math.min(endLine, compHeaders[c + 1]!.index);
    }
    // Also end at next datatype heading
    const nextDt = dtHeaders.find(d => d.index > header.index);
    if (nextDt) endLine = Math.min(endLine, nextDt.index);

    const section = lines.slice(startLine, endLine);
    const description = extractDescription(section);
    const key = `${header.datatype}.${header.position}`;

    if (header.deprecated) {
      deprecatedComponents.set(key, {
        datatype: header.datatype,
        position: header.position,
        longName: header.longName,
        description,
      });
    } else if (description) {
      components.set(key, {
        datatype: header.datatype,
        position: header.position,
        description,
      });
    }
  }

  return { datatypes, components, deprecatedComponents };
}

function parseComponentTables(text: string): Map<string, PdfComponentTableField[]> {
  const lines = text.split("\n");
  const result = new Map<string, PdfComponentTableField[]>();

  let i = 0;
  while (i < lines.length) {
    const titleMatch = lines[i]!.match(COMP_TABLE_TITLE_RE);
    if (!titleMatch) { i++; continue; }

    const dtName = titleMatch[1]!;
    const isExample = /example/i.test(lines[i]!);
    i++;

    if (isExample || result.has(dtName)) {
      i++;
      continue;
    }

    // Find header row containing "SEQ" and "OPT"
    let optColStart = -1;
    let tblColStart = -1;
    const headerLimit = Math.min(i + 5, lines.length);
    for (; i < headerLimit; i++) {
      const line = lines[i]!;
      if (/\bSEQ\b/.test(line) && /\bOPT\b/.test(line)) {
        optColStart = line.indexOf("OPT");
        tblColStart = line.indexOf("TBL#");
        i++;
        break;
      }
    }

    if (optColStart === -1) continue;

    // Parse data rows
    const fields: PdfComponentTableField[] = [];
    for (; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();

      if (!trimmed) continue;

      // Recalibrate on repeated header after page break
      if (/^\s*SEQ\b/.test(line) && /\bOPT\b/.test(line)) {
        optColStart = line.indexOf("OPT");
        tblColStart = line.indexOf("TBL#");
        continue;
      }

      // Stop at next table title, section heading, or datatype heading
      if (COMP_TABLE_TITLE_RE.test(trimmed)) break;
      if (ATTR_TABLE_TITLE_RE.test(trimmed)) break;
      if (DATATYPE_HEADING_RE.test(trimmed) && !trimmed.includes("....") && /[a-z]/.test(trimmed)) break;
      if (COMPONENT_HEADING_RE.test(trimmed)) break;

      // Data row: must start with SEQ digits and contain a component name
      const seqMatch = trimmed.match(/^(\d{1,2})\s/);
      if (!seqMatch) continue;

      const position = parseInt(seqMatch[1]!, 10);

      // Extract OPT by column position
      const optSlice = line.slice(optColStart - 2, optColStart + 5).trim();
      const usageToken = optSlice.split(/\s+/).find(t => VALID_USAGE_CODES.has(t));
      if (!usageToken) continue;

      // Extract TBL# by column position (if TBL# column exists in header)
      let table: string | null = null;
      if (tblColStart >= 0) {
        const tblSlice = line.slice(tblColStart - 2, tblColStart + 8).trim();
        const tblMatch = tblSlice.match(/\b(\d{4})\b/);
        if (tblMatch) table = tblMatch[1]!;
      }

      fields.push({ datatype: dtName, position, optionality: usageToken, table });
    }

    if (fields.length > 0) {
      result.set(dtName, fields);
    }
  }

  return result;
}

async function findCh02aFile(pdfDir: string): Promise<string | null> {
  const files = await readdir(pdfDir);
  const ch02a = files.find(f => /CH0?2A/i.test(f) && f.endsWith(".pdf"));
  return ch02a ? join(pdfDir, ch02a) : null;
}

export async function parsePdfDatatypeDescriptions(pdfDir: string, cmd: string[]): Promise<{
  datatypes: Map<string, PdfDatatypeDescription>;
  components: Map<string, PdfComponentDescription>;
  deprecatedComponents: Map<string, PdfDeprecatedComponent>;
}> {
  const pdfPath = await findCh02aFile(pdfDir);
  if (!pdfPath) {
    console.warn("Warning: CH02A PDF not found, datatype descriptions will be empty");
    return { datatypes: new Map(), components: new Map(), deprecatedComponents: new Map() };
  }

  const text = stripPageNoise(await extractPdfText(pdfPath, cmd));
  return parseDatatypeDescriptions(text);
}

export async function parsePdfComponentTables(pdfDir: string, cmd: string[]): Promise<Map<string, PdfComponentTableField[]>> {
  const pdfPath = await findCh02aFile(pdfDir);
  if (!pdfPath) {
    console.warn("Warning: CH02A PDF not found, component tables will be empty");
    return new Map();
  }

  const text = stripPageNoise(await extractPdfText(pdfPath, cmd, true));
  return parseComponentTables(text);
}

/** Detect descriptions that are TOC listings, overview sections, or cross-references. */
function isLowQualitySegmentDescription(desc: string): boolean {
  // Starts with a section number like "5.3 ..." (TOC entry)
  if (/^\d+[\.\d]*\s/.test(desc)) return true;
  // Cross-reference: "documented in ... Chapter", "moved to Chapter"
  if (/documented in .{0,30}Chapter/i.test(desc)) return true;
  if (/moved to Chapter/i.test(desc)) return true;
  // Overview listing: multiple segment codes (e.g., "NK1 - Next of kin ... PV1 - ...")
  const segRefs = desc.match(/\b[A-Z][A-Z0-9]{1,2}\s*[-\u2013]\s+[A-Z]/g);
  if (segRefs && segRefs.length > 1) return true;
  // Repeated structural keywords from chapter intros
  if ((desc.match(/Segment Definition/gi) || []).length > 1) return true;
  if ((desc.match(/Static Definition/gi) || []).length > 1) return true;
  // Table listings: multiple "Table NNNN" references
  if ((desc.match(/\bTable\s+\d{4}\b/g) || []).length > 2) return true;
  return false;
}

export async function parsePdfDescriptions(pdfDir: string, cmd: string[]): Promise<{
  fields: Map<string, PdfFieldDescription>;
  segments: Map<string, PdfSegmentDescription>;
}> {
  const files = await readdir(pdfDir);
  const chapterFiles = files.filter(f => /CH\d+/i.test(f) && f.endsWith(".pdf")).sort();

  const allFields = new Map<string, PdfFieldDescription>();
  const allSegments = new Map<string, PdfSegmentDescription>();

  for (const file of chapterFiles) {
    const pdfPath = join(pdfDir, file);
    const text = stripPageNoise(await extractPdfText(pdfPath, cmd));

    const fieldDescs = parseFieldDescriptions(text);
    for (const [key, value] of fieldDescs) {
      if (!allFields.has(key)) allFields.set(key, value);
    }

    const segDescs = parseSegmentDescriptions(text);
    for (const [key, value] of segDescs) {
      const existing = allSegments.get(key);
      if (!existing) {
        allSegments.set(key, value);
      } else {
        const existingIsLow = isLowQualitySegmentDescription(existing.description);
        const newIsLow = isLowQualitySegmentDescription(value.description);
        if (existingIsLow && !newIsLow) {
          allSegments.set(key, value);
        } else if (!existingIsLow && newIsLow) {
          // Keep existing (it's better)
        } else {
          // Both are same quality — last-match-wins (later chapters
          // typically contain the actual segment definition section).
          allSegments.set(key, value);
        }
      }
    }
  }

  return { fields: allFields, segments: allSegments };
}

export async function parsePdfTables(pdfDir: string, cmd: string[]): Promise<Map<string, PdfTable>> {
  const files = await readdir(pdfDir);
  const appendixA = files.find(f => /Appendix[_\s]?A/i.test(f) && f.endsWith(".pdf"));

  if (!appendixA) {
    console.warn("Warning: AppendixA.pdf not found, tables will be empty");
    return new Map();
  }

  const pdfPath = join(pdfDir, appendixA);
  const text = stripPageNoise(await extractPdfText(pdfPath, cmd, true));
  return parseAppendixTables(text);
}

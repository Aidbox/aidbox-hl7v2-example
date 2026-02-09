import { XMLParser } from "fast-xml-parser";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { XsdField, XsdSegment, XsdSegmentField, XsdDatatype, XsdDatatypeComponent, XsdMessage, XsdMessageElement } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  isArray: (name) =>
    ["xsd:attributeGroup", "xsd:complexType", "xsd:element", "xsd:attribute"].includes(name),
});

function parseXml(text: string) {
  return parser.parse(text);
}

function getFixedAttr(attrs: any[], attrName: string): string | null {
  const attr = attrs.find((a: any) => a["@_name"] === attrName);
  return attr?.["@_fixed"] ?? null;
}

function parseCardinality(value: string): number | "unbounded" {
  return value === "unbounded" ? "unbounded" : parseInt(value, 10);
}

export async function parseXsdFields(xsdDir: string): Promise<Map<string, XsdField>> {
  const text = await Bun.file(join(xsdDir, "fields.xsd")).text();
  const result = parseXml(text);
  const attrGroups = result["xsd:schema"]["xsd:attributeGroup"] || [];

  const fields = new Map<string, XsdField>();

  for (const ag of attrGroups) {
    const name: string = ag["@_name"];
    const match = name.match(/^(\w+)\.(\d+)\.ATTRIBUTES$/);
    if (!match) continue;

    const segment = match[1]!;
    const position = parseInt(match[2]!, 10);
    const attrs = ag["xsd:attribute"] || [];

    const item = getFixedAttr(attrs, "Item");
    const dataType = getFixedAttr(attrs, "Type");
    const longName = getFixedAttr(attrs, "LongName");
    const maxLengthStr = getFixedAttr(attrs, "maxLength");
    const tableRaw = getFixedAttr(attrs, "Table");

    if (!item || !dataType || !longName) continue;

    const table = tableRaw ? tableRaw.replace(/^HL7/, "") : null;
    const key = `${segment}.${position}`;

    fields.set(key, {
      segment,
      position,
      item: item.padStart(5, "0"),
      dataType,
      longName,
      maxLength: maxLengthStr ? parseInt(maxLengthStr, 10) : null,
      table: table || null,
    });
  }

  return fields;
}

export async function parseXsdSegments(xsdDir: string): Promise<Map<string, XsdSegment>> {
  const text = await Bun.file(join(xsdDir, "segments.xsd")).text();
  const result = parseXml(text);
  const complexTypes = result["xsd:schema"]["xsd:complexType"] || [];

  const segments = new Map<string, XsdSegment>();

  for (const ct of complexTypes) {
    const name: string = ct["@_name"];
    // Match SEG.CONTENT but not SEG.N.CONTENT (those are field types)
    const match = name.match(/^([A-Z][A-Z0-9]{1,2})\.CONTENT$/);
    if (!match) continue;

    const segName = match[1]!;
    const elements = ct["xsd:sequence"]?.["xsd:element"] || [];
    const fields: XsdSegmentField[] = [];

    for (const el of elements) {
      const ref: string | undefined = el["@_ref"];
      if (!ref || !ref.includes(".")) continue;

      const fieldMatch = ref.match(/^(\w+)\.(\d+)$/);
      if (!fieldMatch) continue;

      fields.push({
        field: ref,
        position: parseInt(fieldMatch[2]!, 10),
        minOccurs: parseInt(el["@_minOccurs"] || "0", 10),
        maxOccurs: parseCardinality(el["@_maxOccurs"] || "1"),
      });
    }

    if (fields.length > 0) {
      segments.set(segName, { name: segName, fields });
    }
  }

  return segments;
}

export async function parseXsdDatatypes(xsdDir: string): Promise<Map<string, XsdDatatype>> {
  const text = await Bun.file(join(xsdDir, "datatypes.xsd")).text();
  const result = parseXml(text);
  const schema = result["xsd:schema"];
  const attrGroups = schema["xsd:attributeGroup"] || [];
  const complexTypes = schema["xsd:complexType"] || [];

  // First, collect component metadata from attributeGroups (XX.N.ATTRIBUTES)
  const componentMeta = new Map<string, { dataType: string; longName: string; maxLength: number | null }>();

  for (const ag of attrGroups) {
    const name: string = ag["@_name"];
    const match = name.match(/^(\w+)\.(\d+)\.ATTRIBUTES$/);
    if (!match) continue;

    const attrs = ag["xsd:attribute"] || [];
    const dataType = getFixedAttr(attrs, "Type");
    const longName = getFixedAttr(attrs, "LongName");
    const maxLengthStr = getFixedAttr(attrs, "maxLength");

    if (dataType && longName) {
      const key = `${match[1]!}.${match[2]!}`;
      componentMeta.set(key, {
        dataType,
        longName,
        maxLength: maxLengthStr ? parseInt(maxLengthStr, 10) : null,
      });
    }
  }

  // Then, find composite datatypes (complexType with xsd:sequence of component refs)
  const datatypes = new Map<string, XsdDatatype>();

  for (const ct of complexTypes) {
    const name: string = ct["@_name"];
    // Composite datatype: 2-3 letter name, no dots (not XX.CONTENT or XX.N.CONTENT)
    if (name.includes(".")) continue;

    const elements = ct["xsd:sequence"]?.["xsd:element"];
    if (!elements) continue;

    const components: XsdDatatypeComponent[] = [];

    for (const el of Array.isArray(elements) ? elements : [elements]) {
      const ref: string | undefined = el["@_ref"];
      if (!ref) continue;

      const compMatch = ref.match(/^(\w+)\.(\d+)$/);
      if (!compMatch) continue;

      const meta = componentMeta.get(ref);
      if (!meta) continue;

      components.push({
        component: ref,
        position: parseInt(compMatch[2]!, 10),
        dataType: meta.dataType,
        longName: meta.longName,
        maxLength: meta.maxLength,
      });
    }

    if (components.length > 0) {
      datatypes.set(name, { name, components });
    }
  }

  return datatypes;
}

export async function parseXsdMessages(xsdDir: string): Promise<Map<string, XsdMessage>> {
  const coreFiles = new Set(["fields.xsd", "segments.xsd", "datatypes.xsd"]);
  const files = await readdir(xsdDir);
  const xsdFiles = files.filter(f => f.endsWith(".xsd") && !coreFiles.has(f));

  const messages = new Map<string, XsdMessage>();

  for (const file of xsdFiles) {
    const text = await Bun.file(join(xsdDir, file)).text();
    const result = parseXml(text);
    const schema = result["xsd:schema"];
    if (!schema) continue;

    const complexTypes = schema["xsd:complexType"] || [];
    if (complexTypes.length === 0) continue;

    // Build a map of all group definitions: name -> elements
    const groupDefs = new Map<string, any[]>();
    let rootName: string | null = null;

    for (const ct of complexTypes) {
      const typeName: string = ct["@_name"];
      if (!typeName.endsWith(".CONTENT")) continue;

      const cleanName = typeName.replace(/\.CONTENT$/, "");
      const elements = ct["xsd:sequence"]?.["xsd:element"] || [];
      groupDefs.set(cleanName, Array.isArray(elements) ? elements : [elements]);

      // The root is the one without a dot after the message type prefix
      // e.g., "BAR_P01" is root, "BAR_P01.VISIT" is a group
      if (!cleanName.includes(".") || cleanName.split(".").length === 1) {
        // Simple name like "ACK" or message type like "BAR_P01"
        rootName = cleanName;
      } else {
        // Check if first part matches file name
        const msgName = file.replace(/\.xsd$/, "");
        if (cleanName === msgName) {
          rootName = cleanName;
        }
      }
    }

    // Fallback: root is the type matching the file name
    const msgName = file.replace(/\.xsd$/, "");
    if (!rootName) {
      rootName = groupDefs.has(msgName) ? msgName : null;
    }
    if (!rootName) continue;

    const buildElements = (rawElements: any[], visited = new Set<string>()): XsdMessageElement[] => {
      const result: XsdMessageElement[] = [];
      for (const el of rawElements) {
        const ref: string | undefined = el["@_ref"];
        if (!ref) continue;

        const minOccurs = parseInt(el["@_minOccurs"] || "0", 10);
        const maxOccurs = parseCardinality(el["@_maxOccurs"] || "1");

        // Groups are message-prefixed (e.g., "BAR_P01.VISIT"), segments are plain (e.g., "PID")
        const isGroup = groupDefs.has(ref) && ref !== rootName && !visited.has(ref);
        if (isGroup) {
          visited.add(ref);
          const nested = groupDefs.get(ref)!;
          result.push({
            group: ref,
            minOccurs,
            maxOccurs,
            elements: buildElements(nested, visited),
          });
        } else {
          result.push({ segment: ref, minOccurs, maxOccurs });
        }
      }
      return result;
    };

    const rootElements = groupDefs.get(rootName);
    if (rootElements) {
      messages.set(msgName, {
        name: msgName,
        elements: buildElements(rootElements),
      });
    }
  }

  return messages;
}

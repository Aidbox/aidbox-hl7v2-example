import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  XsdField, XsdSegment, XsdDatatype, XsdMessage,
  PdfAttributeTableField, PdfFieldDescription, PdfSegmentDescription, PdfTable,
  OutputField, OutputSegment, OutputDatatype, OutputTable,
} from "./types";

export interface MergeInput {
  xsdFields: Map<string, XsdField>;
  xsdSegments: Map<string, XsdSegment>;
  xsdDatatypes: Map<string, XsdDatatype>;
  xsdMessages: Map<string, XsdMessage>;
  pdfFields: Map<string, PdfFieldDescription>;
  pdfSegments: Map<string, PdfSegmentDescription>;
  pdfTables: Map<string, PdfTable>;
  pdfAttributeTables: Map<string, PdfAttributeTableField[]>;
}

export interface ValidationReport {
  fieldCount: number;
  fieldDescriptionCount: number;
  fieldDescriptionPercent: number;
  segmentCount: number;
  segmentDescriptionCount: number;
  segmentDescriptionPercent: number;
  fieldUsageCount: number;
  fieldUsagePercent: number;
  datatypeCount: number;
  messageCount: number;
  tableCount: number;
  tableValueCount: number;
  warnings: string[];
}

export async function mergeAndWrite(input: MergeInput, outputDir: string): Promise<ValidationReport> {
  await mkdir(outputDir, { recursive: true });
  const warnings: string[] = [];

  // 1. Build fields.json
  const fieldsOutput: Record<string, OutputField> = {};
  let fieldDescriptionCount = 0;

  for (const [key, xsd] of input.xsdFields) {
    const pdf = input.pdfFields.get(key);
    let description: string | null = null;

    if (pdf) {
      description = pdf.description;
      // Cross-validate: check item and dataType match
      if (pdf.item !== xsd.item) {
        warnings.push(`${key}: item mismatch — XSD="${xsd.item}" PDF="${pdf.item}"`);
      }
      if (pdf.dataType !== xsd.dataType) {
        warnings.push(`${key}: dataType mismatch — XSD="${xsd.dataType}" PDF="${pdf.dataType}"`);
      }
    }

    if (description) fieldDescriptionCount++;

    fieldsOutput[key] = {
      segment: xsd.segment,
      position: xsd.position,
      item: xsd.item,
      dataType: xsd.dataType,
      longName: xsd.longName,
      maxLength: xsd.maxLength,
      table: xsd.table,
      description,
    };
  }

  // 2. Build segments.json (with optionality from PDF attribute tables)
  const optionalityLookup = new Map<string, string>();
  for (const [, fields] of input.pdfAttributeTables) {
    for (const f of fields) {
      optionalityLookup.set(`${f.segment}.${f.position}`, f.optionality);
    }
  }

  const segmentsOutput: Record<string, OutputSegment> = {};
  let segmentDescriptionCount = 0;
  let fieldUsageCount = 0;

  for (const [name, xsd] of input.xsdSegments) {
    const pdf = input.pdfSegments.get(name);
    const longName = pdf?.longName || null;
    const description = pdf?.description || null;

    if (description) segmentDescriptionCount++;

    segmentsOutput[name] = {
      longName,
      description,
      fields: xsd.fields.map(f => {
        const optionality = optionalityLookup.get(f.field) ?? null;
        if (optionality) fieldUsageCount++;
        return {
          field: f.field,
          position: f.position,
          minOccurs: f.minOccurs,
          maxOccurs: f.maxOccurs,
          optionality,
        };
      }),
    };
  }

  // 3. Build datatypes.json
  const datatypesOutput: Record<string, OutputDatatype> = {};

  for (const [name, xsd] of input.xsdDatatypes) {
    datatypesOutput[name] = {
      components: xsd.components.map(c => ({
        component: c.component,
        position: c.position,
        dataType: c.dataType,
        longName: c.longName,
        maxLength: c.maxLength,
      })),
    };
  }

  // 4. Build messages.json (pass through from XSD)
  const messagesOutput: Record<string, { elements: XsdMessage["elements"] }> = {};

  for (const [name, xsd] of input.xsdMessages) {
    messagesOutput[name] = { elements: xsd.elements };
  }

  // 5. Build tables.json
  const tablesOutput: Record<string, OutputTable> = {};
  let tableValueCount = 0;

  for (const [num, table] of input.pdfTables) {
    tablesOutput[num] = {
      tableNumber: table.tableNumber,
      name: table.name,
      type: table.type,
      values: table.values,
    };
    tableValueCount += table.values.length;
  }

  // Write all files
  const writeJson = (filename: string, data: unknown) =>
    writeFile(join(outputDir, filename), JSON.stringify(data, null, 2) + "\n");

  await Promise.all([
    writeJson("fields.json", fieldsOutput),
    writeJson("segments.json", segmentsOutput),
    writeJson("datatypes.json", datatypesOutput),
    writeJson("messages.json", messagesOutput),
    writeJson("tables.json", tablesOutput),
  ]);

  const report: ValidationReport = {
    fieldCount: input.xsdFields.size,
    fieldDescriptionCount,
    fieldDescriptionPercent: Math.round((fieldDescriptionCount / input.xsdFields.size) * 1000) / 10,
    segmentCount: input.xsdSegments.size,
    segmentDescriptionCount,
    segmentDescriptionPercent: Math.round((segmentDescriptionCount / input.xsdSegments.size) * 1000) / 10,
    fieldUsageCount,
    fieldUsagePercent: Math.round((fieldUsageCount / input.xsdFields.size) * 1000) / 10,
    datatypeCount: input.xsdDatatypes.size,
    messageCount: input.xsdMessages.size,
    tableCount: input.pdfTables.size,
    tableValueCount,
    warnings,
  };

  return report;
}

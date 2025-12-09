#!/usr/bin/env bun
/**
 * HL7v2 Field Helpers Code Generator
 *
 * Generates TypeScript field accessors based on HL7v2 schema.
 * Only generates helpers for segments/fields used in configured message types.
 *
 * Usage:
 *   bun src/hl7v2/codegen.ts BAR_P01 ADT_A01 > src/hl7v2/fields.ts
 *
 * Also generates message-level type-safe builders:
 *   bun src/hl7v2/codegen.ts BAR_P01 --messages > src/hl7v2/messages.ts
 */

const SCHEMA_BASE = "./hl7v2/schema";

interface MessageElement {
  segment?: string;
  group?: string;
  minOccurs: string;
  maxOccurs: string;
}

interface MessageDef {
  [key: string]: { elements: MessageElement[] };
}

interface SegmentDef {
  fields: { field: string; minOccurs: string; maxOccurs: string }[];
}

interface FieldDef {
  dataType: string;
  longName: string;
}

interface DataTypeDef {
  components?: { dataType: string; minOccurs: string; maxOccurs: string }[];
}

// Primitive data types that don't have further components
const PRIMITIVE_TYPES = new Set([
  "ST", "TX", "FT", "NM", "SI", "ID", "IS", "DT", "TM", "DTM", "TS", "GTS", "NUL",
]);

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/_$/, "");
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(Bun.file(path).text() as unknown as string);
  } catch {
    return null;
  }
}

async function readJsonAsync<T>(path: string): Promise<T | null> {
  try {
    const text = await Bun.file(path).text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

class HL7v2CodeGen {
  private usedSegments = new Set<string>();
  private usedDataTypes = new Set<string>();
  private fieldDefs = new Map<string, FieldDef>();
  private dataTypeDefs = new Map<string, DataTypeDef>();
  private segmentDefs = new Map<string, SegmentDef>();
  private messageDefs = new Map<string, MessageDef>();
  private output: string[] = [];

  constructor(private messageTypes: string[]) {}

  async generate(): Promise<string> {
    // 1. Collect all segments from message definitions
    for (const msgType of this.messageTypes) {
      await this.collectSegmentsFromMessage(msgType);
    }

    // 2. Load segment definitions and collect data types
    for (const segmentName of this.usedSegments) {
      await this.loadSegment(segmentName);
    }

    // 3. Recursively load all data types
    await this.loadAllDataTypes();

    // 4. Generate output
    this.generateHeader();
    this.generateHelpers();

    return this.output.join("\n");
  }

  private async collectSegmentsFromMessage(msgType: string): Promise<void> {
    // Find the message file
    const files = await this.findMessageFile(msgType);
    if (!files) {
      console.error(`Warning: Message type ${msgType} not found`);
      return;
    }

    const msgDef = await readJsonAsync<MessageDef>(files);
    if (!msgDef) return;

    // Store the message definition for later use in message builder generation
    this.messageDefs.set(msgType, msgDef);

    // Recursively collect segments from message definition
    this.collectSegmentsFromDef(msgDef, msgType);
  }

  private async findMessageFile(msgType: string): Promise<string | null> {
    const path = `${SCHEMA_BASE}/messages/${msgType}.json`;
    const file = Bun.file(path);
    if (await file.exists()) {
      return path;
    }
    return null;
  }

  private collectSegmentsFromDef(def: MessageDef, rootKey: string): void {
    const processElements = (elements: MessageElement[]) => {
      for (const el of elements) {
        if (el.segment) {
          this.usedSegments.add(el.segment);
        }
        if (el.group && def[el.group]) {
          processElements(def[el.group].elements);
        }
      }
    };

    if (def[rootKey]) {
      processElements(def[rootKey].elements);
    }

    // Also process any group definitions at the top level
    for (const key of Object.keys(def)) {
      if (key !== rootKey && def[key].elements) {
        processElements(def[key].elements);
      }
    }
  }

  private async loadSegment(segmentName: string): Promise<void> {
    const path = `${SCHEMA_BASE}/segments/${segmentName}.json`;
    const segDef = await readJsonAsync<SegmentDef>(path);
    if (!segDef) return;

    this.segmentDefs.set(segmentName, segDef);

    // Load field definitions
    for (const field of segDef.fields) {
      const fieldPath = `${SCHEMA_BASE}/fields/${field.field}.json`;
      const fieldDef = await readJsonAsync<FieldDef>(fieldPath);
      if (fieldDef) {
        this.fieldDefs.set(field.field, fieldDef);
        this.usedDataTypes.add(fieldDef.dataType);
      }
    }
  }

  private async loadAllDataTypes(): Promise<void> {
    const toProcess = [...this.usedDataTypes];

    while (toProcess.length > 0) {
      const dt = toProcess.shift()!;
      if (this.dataTypeDefs.has(dt) || PRIMITIVE_TYPES.has(dt)) continue;

      const path = `${SCHEMA_BASE}/dataTypes/${dt}.json`;
      const dtDef = await readJsonAsync<DataTypeDef>(path);

      if (dtDef) {
        this.dataTypeDefs.set(dt, dtDef);

        // If complex type, load component definitions
        if (dtDef.components) {
          for (const comp of dtDef.components) {
            // Load the component definition (e.g., XPN.1.json)
            const compPath = `${SCHEMA_BASE}/dataTypes/${comp.dataType}.json`;
            const compDef = await readJsonAsync<FieldDef>(compPath);
            if (compDef) {
              this.fieldDefs.set(comp.dataType, compDef);
              if (!PRIMITIVE_TYPES.has(compDef.dataType)) {
                toProcess.push(compDef.dataType);
              }
            }
          }
        }
      }
    }
  }

  private generateHeader(): void {
    this.output.push(`// AUTO-GENERATED from hl7v2/schema - do not edit manually`);
    this.output.push(`// Generated for message types: ${this.messageTypes.join(", ")}`);
    this.output.push(`// Run: bun src/hl7v2/codegen.ts ${this.messageTypes.join(" ")}`);
    this.output.push(``);
    this.output.push(`import type { HL7v2Segment, FieldValue } from "./types";`);
    this.output.push(`import { getComponent, setComponent } from "./types";`);
    this.output.push(``);
  }

  private generateHelpers(): void {
    // Sort segments for consistent output
    const segments = [...this.usedSegments].sort();

    for (const segName of segments) {
      const segDef = this.segmentDefs.get(segName);
      if (!segDef) continue;

      this.output.push(`// ====== ${segName} Segment ======`);
      this.output.push(``);

      for (const field of segDef.fields) {
        this.generateFieldHelpers(segName, field.field);
      }

      // Generate fluent builder class
      this.generateFluentBuilder(segName, segDef);
    }
  }

  private generateFluentBuilder(segName: string, segDef: SegmentDef): void {
    this.output.push(`// ${segName} Fluent Builder`);
    this.output.push(`export class ${segName}Builder {`);
    this.output.push(`  private seg: HL7v2Segment = { segment: "${segName}", fields: {} };`);
    this.output.push(``);

    // Generate methods for each field
    for (const field of segDef.fields) {
      const fieldDef = this.fieldDefs.get(field.field);
      if (!fieldDef) continue;

      const fieldNum = parseInt(field.field.split(".")[1], 10);
      const fieldName = this.toCamelCase(fieldDef.longName);

      // Field-level method: set5_patientName
      this.output.push(`  /** ${field.field} - ${fieldDef.longName} */`);
      this.output.push(`  set${fieldNum}_${fieldName}(value: FieldValue): this {`);
      this.output.push(`    this.seg.fields[${fieldNum}] = value;`);
      this.output.push(`    return this;`);
      this.output.push(`  }`);
      this.output.push(``);

      // Component methods with field number prefix: set5_1_familyName
      const dtDef = this.dataTypeDefs.get(fieldDef.dataType);
      if (dtDef?.components) {
        this.generateFluentComponentMethods(fieldNum, dtDef, []);
      }
    }

    // Build method
    this.output.push(`  build(): HL7v2Segment {`);
    this.output.push(`    return this.seg;`);
    this.output.push(`  }`);
    this.output.push(`}`);
    this.output.push(``);
  }

  private generateFluentComponentMethods(
    fieldNum: number,
    dtDef: DataTypeDef,
    parentPath: number[]
  ): void {
    if (!dtDef.components) return;

    for (let i = 0; i < dtDef.components.length; i++) {
      const comp = dtDef.components[i];
      const compNum = i + 1;
      const compId = comp.dataType;
      const compDef = this.fieldDefs.get(compId);

      if (!compDef) continue;

      const path = [...parentPath, compNum];
      const compName = this.toCamelCase(compDef.longName);
      // Method name: set5_1_familyName or set5_1_1_surname for deeper nesting
      const methodName = `set${fieldNum}_${path.join("_")}_${compName}`;

      this.output.push(`  ${methodName}(value: string): this {`);
      this.output.push(`    setComponent(this.seg.fields, ${fieldNum}, value, ${path.join(", ")});`);
      this.output.push(`    return this;`);
      this.output.push(`  }`);
      this.output.push(``);

      // Recursively handle nested types
      const nestedDtDef = this.dataTypeDefs.get(compDef.dataType);
      if (nestedDtDef?.components) {
        this.generateFluentComponentMethods(fieldNum, nestedDtDef, path);
      }
    }
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .map((word, i) => {
        if (i === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join("");
  }

  private generateFieldHelpers(segName: string, fieldId: string): void {
    const fieldDef = this.fieldDefs.get(fieldId);
    if (!fieldDef) return;

    // Extract field number (e.g., "PID.5" -> 5)
    const fieldNum = parseInt(fieldId.split(".")[1], 10);
    const fieldName = toSnakeCase(fieldDef.longName);
    const funcName = `${segName}_${fieldNum}_${fieldName}`;

    // Generate field-level getter and setter
    this.output.push(`// ${fieldId} - ${fieldDef.longName} (${fieldDef.dataType})`);
    this.output.push(`export const ${funcName} = (seg: HL7v2Segment): FieldValue | undefined => seg.fields[${fieldNum}];`);
    this.output.push(`export const set_${funcName} = (seg: HL7v2Segment, value: FieldValue): void => { seg.fields[${fieldNum}] = value; };`);

    // If complex type, generate component helpers
    const dtDef = this.dataTypeDefs.get(fieldDef.dataType);
    if (dtDef?.components) {
      this.generateComponentHelpers(segName, fieldNum, fieldDef.dataType, dtDef, []);
    }

    this.output.push(``);
  }

  private generateComponentHelpers(
    segName: string,
    fieldNum: number,
    parentType: string,
    dtDef: DataTypeDef,
    parentPath: number[]
  ): void {
    if (!dtDef.components) return;

    for (let i = 0; i < dtDef.components.length; i++) {
      const comp = dtDef.components[i];
      const compNum = i + 1; // 1-indexed in HL7v2
      const compId = comp.dataType; // e.g., "XPN.1"
      const compDef = this.fieldDefs.get(compId);

      if (!compDef) continue;

      const path = [...parentPath, compNum];
      const compName = toSnakeCase(compDef.longName);
      const funcName = `${segName}_${fieldNum}_${path.join("_")}_${compName}`;

      // Getter
      this.output.push(
        `export const ${funcName} = (seg: HL7v2Segment): string | undefined => ` +
          `getComponent(seg.fields[${fieldNum}], ${path.join(", ")});`
      );
      // Setter
      this.output.push(
        `export const set_${funcName} = (seg: HL7v2Segment, value: string): void => ` +
          `setComponent(seg.fields, ${fieldNum}, value, ${path.join(", ")});`
      );

      // Recursively handle nested complex types (e.g., XPN.1 -> FN -> FN.1)
      const nestedDtDef = this.dataTypeDefs.get(compDef.dataType);
      if (nestedDtDef?.components) {
        this.generateComponentHelpers(segName, fieldNum, compDef.dataType, nestedDtDef, path);
      }
    }
  }

  /**
   * Generate message-level type-safe builders
   */
  async generateMessages(): Promise<string> {
    // 1. Collect all segments from message definitions (also stores messageDefs)
    for (const msgType of this.messageTypes) {
      await this.collectSegmentsFromMessage(msgType);
    }

    const output: string[] = [];

    output.push(`// AUTO-GENERATED from hl7v2/schema - do not edit manually`);
    output.push(`// Message builders for: ${this.messageTypes.join(", ")}`);
    output.push(`// Run: bun src/hl7v2/codegen.ts ${this.messageTypes.join(" ")} --messages`);
    output.push(``);
    output.push(`import type { HL7v2Segment, HL7v2Message } from "./types";`);
    output.push(`import {`);

    // Collect all segment builders needed
    const allSegments = new Set<string>();
    for (const msgType of this.messageTypes) {
      const msgDef = this.messageDefs.get(msgType);
      if (msgDef) {
        this.collectAllSegmentsFromDef(msgDef, msgType, allSegments);
      }
    }

    const sortedSegments = [...allSegments].sort();
    output.push(`  ${sortedSegments.map(s => `${s}Builder`).join(",\n  ")}`);
    output.push(`} from "./fields";`);
    output.push(``);

    // Generate interfaces and builders for each message type
    for (const msgType of this.messageTypes) {
      const msgDef = this.messageDefs.get(msgType);
      if (!msgDef) continue;

      this.generateMessageTypes(output, msgType, msgDef);
      this.generateMessageBuilder(output, msgType, msgDef);
    }

    return output.join("\n");
  }

  private collectAllSegmentsFromDef(def: MessageDef, rootKey: string, segments: Set<string>): void {
    const processElements = (elements: MessageElement[]) => {
      for (const el of elements) {
        if (el.segment) {
          segments.add(el.segment);
        }
        if (el.group && def[el.group]) {
          processElements(def[el.group].elements);
        }
      }
    };

    if (def[rootKey]) {
      processElements(def[rootKey].elements);
    }

    for (const key of Object.keys(def)) {
      if (key !== rootKey && def[key].elements) {
        processElements(def[key].elements);
      }
    }
  }

  private generateMessageTypes(output: string[], msgType: string, msgDef: MessageDef): void {
    const rootDef = msgDef[msgType];
    if (!rootDef) return;

    // Generate group interfaces first
    for (const [groupName, groupDef] of Object.entries(msgDef)) {
      if (groupName === msgType) continue;
      this.generateGroupInterface(output, msgType, groupName, groupDef, msgDef);
    }

    // Generate main message interface
    output.push(`/**`);
    output.push(` * ${msgType} Message Structure`);
    output.push(` */`);
    output.push(`export interface ${msgType}_Message {`);

    for (const el of rootDef.elements) {
      const isRequired = el.minOccurs !== "0";
      const isRepeating = el.maxOccurs === "unbounded" || parseInt(el.maxOccurs) > 1;
      const optionalMark = isRequired ? "" : "?";

      if (el.segment) {
        const fieldName = el.segment.toLowerCase();
        const typeName = `HL7v2Segment`;
        if (isRepeating) {
          output.push(`  ${fieldName}${optionalMark}: ${typeName}[];`);
        } else {
          output.push(`  ${fieldName}${optionalMark}: ${typeName};`);
        }
      } else if (el.group) {
        const fieldName = el.group.toLowerCase();
        const typeName = `${msgType}_${el.group}`;
        if (isRepeating) {
          output.push(`  ${fieldName}${optionalMark}: ${typeName}[];`);
        } else {
          output.push(`  ${fieldName}${optionalMark}: ${typeName};`);
        }
      }
    }

    output.push(`}`);
    output.push(``);
  }

  private generateGroupInterface(
    output: string[],
    msgType: string,
    groupName: string,
    groupDef: { elements: MessageElement[] },
    msgDef: MessageDef
  ): void {
    output.push(`export interface ${msgType}_${groupName} {`);

    for (const el of groupDef.elements) {
      const isRequired = el.minOccurs !== "0";
      const isRepeating = el.maxOccurs === "unbounded" || parseInt(el.maxOccurs) > 1;
      const optionalMark = isRequired ? "" : "?";

      if (el.segment) {
        const fieldName = el.segment.toLowerCase();
        const typeName = `HL7v2Segment`;
        if (isRepeating) {
          output.push(`  ${fieldName}${optionalMark}: ${typeName}[];`);
        } else {
          output.push(`  ${fieldName}${optionalMark}: ${typeName};`);
        }
      } else if (el.group) {
        const fieldName = el.group.toLowerCase();
        const typeName = `${msgType}_${el.group}`;
        if (isRepeating) {
          output.push(`  ${fieldName}${optionalMark}: ${typeName}[];`);
        } else {
          output.push(`  ${fieldName}${optionalMark}: ${typeName};`);
        }
      }
    }

    output.push(`}`);
    output.push(``);

    // Generate builder class for this group
    this.generateGroupBuilder(output, msgType, groupName, groupDef, msgDef);
  }

  private generateGroupBuilder(
    output: string[],
    msgType: string,
    groupName: string,
    groupDef: { elements: MessageElement[] },
    msgDef: MessageDef
  ): void {
    const builderName = `${msgType}_${groupName}Builder`;
    const typeName = `${msgType}_${groupName}`;

    output.push(`/**`);
    output.push(` * Builder for ${msgType} ${groupName} group`);
    output.push(` */`);
    output.push(`export class ${builderName} {`);
    output.push(`  private group: Partial<${typeName}> = {};`);
    output.push(``);

    for (const el of groupDef.elements) {
      const isRepeating = el.maxOccurs === "unbounded" || parseInt(el.maxOccurs) > 1;

      if (el.segment) {
        const fieldName = el.segment.toLowerCase();
        const segBuilderName = `${el.segment}Builder`;

        if (isRepeating) {
          output.push(`  /** Add ${el.segment} segment */`);
          output.push(`  add${el.segment}(segment: HL7v2Segment | ${segBuilderName} | ((builder: ${segBuilderName}) => ${segBuilderName})): this {`);
          output.push(`    let seg: HL7v2Segment;`);
          output.push(`    if (typeof segment === "function") {`);
          output.push(`      seg = segment(new ${segBuilderName}()).build();`);
          output.push(`    } else if (segment instanceof ${segBuilderName}) {`);
          output.push(`      seg = segment.build();`);
          output.push(`    } else {`);
          output.push(`      seg = segment;`);
          output.push(`    }`);
          output.push(`    if (!this.group.${fieldName}) this.group.${fieldName} = [];`);
          output.push(`    this.group.${fieldName}.push(seg);`);
          output.push(`    return this;`);
          output.push(`  }`);
        } else {
          output.push(`  /** Set ${el.segment} segment */`);
          output.push(`  ${fieldName}(segment: HL7v2Segment | ${segBuilderName} | ((builder: ${segBuilderName}) => ${segBuilderName})): this {`);
          output.push(`    if (typeof segment === "function") {`);
          output.push(`      this.group.${fieldName} = segment(new ${segBuilderName}()).build();`);
          output.push(`    } else if (segment instanceof ${segBuilderName}) {`);
          output.push(`      this.group.${fieldName} = segment.build();`);
          output.push(`    } else {`);
          output.push(`      this.group.${fieldName} = segment;`);
          output.push(`    }`);
          output.push(`    return this;`);
          output.push(`  }`);
        }
        output.push(``);
      } else if (el.group) {
        const nestedFieldName = el.group.toLowerCase();
        const nestedTypeName = `${msgType}_${el.group}`;
        const nestedBuilderName = `${nestedTypeName}Builder`;

        if (isRepeating) {
          output.push(`  /** Add ${el.group} group */`);
          output.push(`  add${el.group}(group: ${nestedTypeName} | ${nestedBuilderName} | ((builder: ${nestedBuilderName}) => ${nestedBuilderName})): this {`);
          output.push(`    let g: ${nestedTypeName};`);
          output.push(`    if (typeof group === "function") {`);
          output.push(`      g = group(new ${nestedBuilderName}()).build();`);
          output.push(`    } else if (group instanceof ${nestedBuilderName}) {`);
          output.push(`      g = group.build();`);
          output.push(`    } else {`);
          output.push(`      g = group;`);
          output.push(`    }`);
          output.push(`    if (!this.group.${nestedFieldName}) this.group.${nestedFieldName} = [];`);
          output.push(`    this.group.${nestedFieldName}.push(g);`);
          output.push(`    return this;`);
          output.push(`  }`);
        } else {
          output.push(`  /** Set ${el.group} group */`);
          output.push(`  ${nestedFieldName}(group: ${nestedTypeName} | ${nestedBuilderName} | ((builder: ${nestedBuilderName}) => ${nestedBuilderName})): this {`);
          output.push(`    if (typeof group === "function") {`);
          output.push(`      this.group.${nestedFieldName} = group(new ${nestedBuilderName}()).build();`);
          output.push(`    } else if (group instanceof ${nestedBuilderName}) {`);
          output.push(`      this.group.${nestedFieldName} = group.build();`);
          output.push(`    } else {`);
          output.push(`      this.group.${nestedFieldName} = group;`);
          output.push(`    }`);
          output.push(`    return this;`);
          output.push(`  }`);
        }
        output.push(``);
      }
    }

    output.push(`  /** Build the group */`);
    output.push(`  build(): ${typeName} {`);
    output.push(`    return this.group as ${typeName};`);
    output.push(`  }`);
    output.push(`}`);
    output.push(``);
  }

  private generateMessageBuilder(output: string[], msgType: string, msgDef: MessageDef): void {
    const rootDef = msgDef[msgType];
    if (!rootDef) return;

    // Collect required fields for validation
    const requiredFields: string[] = [];
    for (const el of rootDef.elements) {
      if (el.minOccurs !== "0") {
        const name = el.segment?.toLowerCase() || el.group?.toLowerCase();
        if (name) requiredFields.push(name);
      }
    }

    output.push(`/**`);
    output.push(` * Type-safe builder for ${msgType} messages`);
    output.push(` */`);
    output.push(`export class ${msgType}Builder {`);
    output.push(`  private msg: Partial<${msgType}_Message> = {};`);
    output.push(``);

    // Generate setter methods for each element
    for (const el of rootDef.elements) {
      const isRepeating = el.maxOccurs === "unbounded" || parseInt(el.maxOccurs) > 1;

      if (el.segment) {
        const fieldName = el.segment.toLowerCase();
        const builderName = `${el.segment}Builder`;

        if (isRepeating) {
          // Add method for repeating segments - accepts segment, builder, or callback
          output.push(`  /** Add ${el.segment} segment */`);
          output.push(`  add${el.segment}(segment: HL7v2Segment | ${builderName} | ((builder: ${builderName}) => ${builderName})): this {`);
          output.push(`    let seg: HL7v2Segment;`);
          output.push(`    if (typeof segment === "function") {`);
          output.push(`      seg = segment(new ${builderName}()).build();`);
          output.push(`    } else if (segment instanceof ${builderName}) {`);
          output.push(`      seg = segment.build();`);
          output.push(`    } else {`);
          output.push(`      seg = segment;`);
          output.push(`    }`);
          output.push(`    if (!this.msg.${fieldName}) this.msg.${fieldName} = [];`);
          output.push(`    this.msg.${fieldName}.push(seg);`);
          output.push(`    return this;`);
          output.push(`  }`);
        } else {
          // Set method for single segments - accepts segment, builder, or callback
          output.push(`  /** Set ${el.segment} segment */`);
          output.push(`  ${fieldName}(segment: HL7v2Segment | ${builderName} | ((builder: ${builderName}) => ${builderName})): this {`);
          output.push(`    if (typeof segment === "function") {`);
          output.push(`      this.msg.${fieldName} = segment(new ${builderName}()).build();`);
          output.push(`    } else if (segment instanceof ${builderName}) {`);
          output.push(`      this.msg.${fieldName} = segment.build();`);
          output.push(`    } else {`);
          output.push(`      this.msg.${fieldName} = segment;`);
          output.push(`    }`);
          output.push(`    return this;`);
          output.push(`  }`);
        }
        output.push(``);
      } else if (el.group) {
        const fieldName = el.group.toLowerCase();
        const groupTypeName = `${msgType}_${el.group}`;
        const groupBuilderName = `${groupTypeName}Builder`;

        if (isRepeating) {
          output.push(`  /** Add ${el.group} group */`);
          output.push(`  add${el.group}(group: ${groupTypeName} | ${groupBuilderName} | ((builder: ${groupBuilderName}) => ${groupBuilderName})): this {`);
          output.push(`    let g: ${groupTypeName};`);
          output.push(`    if (typeof group === "function") {`);
          output.push(`      g = group(new ${groupBuilderName}()).build();`);
          output.push(`    } else if (group instanceof ${groupBuilderName}) {`);
          output.push(`      g = group.build();`);
          output.push(`    } else {`);
          output.push(`      g = group;`);
          output.push(`    }`);
          output.push(`    if (!this.msg.${fieldName}) this.msg.${fieldName} = [];`);
          output.push(`    this.msg.${fieldName}.push(g);`);
          output.push(`    return this;`);
          output.push(`  }`);
        } else {
          output.push(`  /** Set ${el.group} group */`);
          output.push(`  ${fieldName}(group: ${groupTypeName} | ${groupBuilderName} | ((builder: ${groupBuilderName}) => ${groupBuilderName})): this {`);
          output.push(`    if (typeof group === "function") {`);
          output.push(`      this.msg.${fieldName} = group(new ${groupBuilderName}()).build();`);
          output.push(`    } else if (group instanceof ${groupBuilderName}) {`);
          output.push(`      this.msg.${fieldName} = group.build();`);
          output.push(`    } else {`);
          output.push(`      this.msg.${fieldName} = group;`);
          output.push(`    }`);
          output.push(`    return this;`);
          output.push(`  }`);
        }
        output.push(``);
      }
    }

    // Generate build method that converts to HL7v2Message (flat segment array)
    output.push(`  /**`);
    output.push(`   * Build the message as a flat array of segments (HL7v2Message)`);
    output.push(`   * @throws Error if required fields are missing`);
    output.push(`   */`);
    output.push(`  build(): HL7v2Message {`);

    // Validation
    if (requiredFields.length > 0) {
      output.push(`    // Validate required fields`);
      for (const field of requiredFields) {
        output.push(`    if (!this.msg.${field}) throw new Error("${msgType}: ${field} is required");`);
      }
      output.push(``);
    }

    output.push(`    const segments: HL7v2Message = [];`);
    output.push(``);

    // Flatten the message structure into segments array
    this.generateFlattenCode(output, rootDef.elements, msgDef, "this.msg");

    output.push(`    return segments;`);
    output.push(`  }`);
    output.push(``);

    // Also provide a method to get the structured message
    output.push(`  /** Get the structured message object */`);
    output.push(`  toStructured(): ${msgType}_Message {`);
    output.push(`    return this.msg as ${msgType}_Message;`);
    output.push(`  }`);
    output.push(`}`);
    output.push(``);
  }

  private generateFlattenCode(
    output: string[],
    elements: MessageElement[],
    msgDef: MessageDef,
    prefix: string
  ): void {
    for (const el of elements) {
      const isRepeating = el.maxOccurs === "unbounded" || parseInt(el.maxOccurs) > 1;

      if (el.segment) {
        const fieldName = el.segment.toLowerCase();
        const fieldPath = `${prefix}.${fieldName}`;

        if (isRepeating) {
          output.push(`    if (${fieldPath}) {`);
          output.push(`      for (const seg of ${fieldPath}) {`);
          output.push(`        segments.push(seg);`);
          output.push(`      }`);
          output.push(`    }`);
        } else {
          output.push(`    if (${fieldPath}) segments.push(${fieldPath});`);
        }
      } else if (el.group) {
        const fieldName = el.group.toLowerCase();
        const fieldPath = `${prefix}.${fieldName}`;
        const groupDef = msgDef[el.group];

        if (groupDef) {
          if (isRepeating) {
            output.push(`    if (${fieldPath}) {`);
            output.push(`      for (const group of ${fieldPath}) {`);
            this.generateFlattenCodeForGroup(output, groupDef.elements, msgDef, "group", "        ");
            output.push(`      }`);
            output.push(`    }`);
          } else {
            output.push(`    if (${fieldPath}) {`);
            output.push(`      const group = ${fieldPath};`);
            this.generateFlattenCodeForGroup(output, groupDef.elements, msgDef, "group", "      ");
            output.push(`    }`);
          }
        }
      }
    }
  }

  private generateFlattenCodeForGroup(
    output: string[],
    elements: MessageElement[],
    msgDef: MessageDef,
    prefix: string,
    indent: string
  ): void {
    for (const el of elements) {
      const isRepeating = el.maxOccurs === "unbounded" || parseInt(el.maxOccurs) > 1;

      if (el.segment) {
        const fieldName = el.segment.toLowerCase();
        const fieldPath = `${prefix}.${fieldName}`;

        if (isRepeating) {
          output.push(`${indent}if (${fieldPath}) {`);
          output.push(`${indent}  for (const seg of ${fieldPath}) {`);
          output.push(`${indent}    segments.push(seg);`);
          output.push(`${indent}  }`);
          output.push(`${indent}}`);
        } else {
          output.push(`${indent}if (${fieldPath}) segments.push(${fieldPath});`);
        }
      } else if (el.group) {
        const fieldName = el.group.toLowerCase();
        const fieldPath = `${prefix}.${fieldName}`;
        const groupDef = msgDef[el.group];

        if (groupDef) {
          if (isRepeating) {
            output.push(`${indent}if (${fieldPath}) {`);
            output.push(`${indent}  for (const subgroup of ${fieldPath}) {`);
            this.generateFlattenCodeForGroup(output, groupDef.elements, msgDef, "subgroup", indent + "    ");
            output.push(`${indent}  }`);
            output.push(`${indent}}`);
          } else {
            output.push(`${indent}if (${fieldPath}) {`);
            output.push(`${indent}  const subgroup = ${fieldPath};`);
            this.generateFlattenCodeForGroup(output, groupDef.elements, msgDef, "subgroup", indent + "  ");
            output.push(`${indent}}`);
          }
        }
      }
    }
  }
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const generateMessages = args.includes("--messages");
  const messageTypes = args.filter((arg) => !arg.startsWith("--"));

  if (messageTypes.length === 0) {
    console.error("Usage: bun src/hl7v2/codegen.ts <MESSAGE_TYPE> [MESSAGE_TYPE...]");
    console.error("       bun src/hl7v2/codegen.ts <MESSAGE_TYPE> --messages");
    console.error("");
    console.error("Examples:");
    console.error("  bun src/hl7v2/codegen.ts BAR_P01 > src/hl7v2/fields.ts");
    console.error("  bun src/hl7v2/codegen.ts BAR_P01 --messages > src/hl7v2/messages.ts");
    process.exit(1);
  }

  const gen = new HL7v2CodeGen(messageTypes);

  if (generateMessages) {
    const output = await gen.generateMessages();
    console.log(output);
  } else {
    const output = await gen.generate();
    console.log(output);
  }
}

main().catch(console.error);

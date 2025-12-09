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
  "ST", "TX", "FT", "NM", "SI", "ID", "IS", "DT", "TM", "DTM", "TS", "GTS", "NUL", "varies",
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
    this.generateDataTypeInterfaces();
    this.generateConversionFunction();
    this.generateSegmentBuilders();

    return this.output.join("\n");
  }

  private async collectSegmentsFromMessage(msgType: string): Promise<void> {
    const path = `${SCHEMA_BASE}/messages/${msgType}.json`;
    const file = Bun.file(path);
    if (!(await file.exists())) {
      console.error(`Warning: Message type ${msgType} not found`);
      return;
    }

    const msgDef = await readJsonAsync<MessageDef>(path);
    if (!msgDef) return;

    this.messageDefs.set(msgType, msgDef);
    this.collectSegmentsFromDef(msgDef, msgType);
  }

  private collectSegmentsFromDef(def: MessageDef, rootKey: string): void {
    const processElements = (elements: MessageElement[]) => {
      for (const el of elements) {
        if (el.segment) {
          this.usedSegments.add(el.segment);
        }
        if (el.group) {
          const groupDef = def[el.group];
          if (groupDef) {
            processElements(groupDef.elements);
          }
        }
      }
    };

    if (def[rootKey]) {
      processElements(def[rootKey].elements);
    }

    for (const key of Object.keys(def)) {
      if (key !== rootKey && def[key]?.elements) {
        processElements(def[key].elements);
      }
    }
  }

  private async loadSegment(segmentName: string): Promise<void> {
    const path = `${SCHEMA_BASE}/segments/${segmentName}.json`;
    const segDef = await readJsonAsync<SegmentDef>(path);
    if (!segDef) return;

    this.segmentDefs.set(segmentName, segDef);

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

        if (dtDef.components) {
          for (const comp of dtDef.components) {
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
    this.output.push(`import { getComponent } from "./types";`);
    this.output.push(``);
  }

  private generateDataTypeInterfaces(): void {
    this.output.push(`// ====== DataType Interfaces ======`);
    this.output.push(``);

    // Sort datatypes for consistent output
    const sortedTypes = [...this.dataTypeDefs.keys()].sort();

    for (const dtName of sortedTypes) {
      const dtDef = this.dataTypeDefs.get(dtName);
      if (!dtDef?.components) continue;

      this.output.push(`/** ${dtName} DataType */`);
      this.output.push(`export interface ${dtName} {`);

      for (let i = 0; i < dtDef.components.length; i++) {
        const comp = dtDef.components[i]!;
        const compNum = i + 1;
        const compDef = this.fieldDefs.get(comp.dataType);
        if (!compDef) continue;

        const fieldName = this.toCamelCase(compDef.longName);
        const nestedDtDef = this.dataTypeDefs.get(compDef.dataType);
        const typeName = nestedDtDef ? compDef.dataType : "string";

        this.output.push(`  /** ${comp.dataType} - ${compDef.longName} */`);
        this.output.push(`  ${fieldName}__${compNum}?: ${typeName};`);
      }

      this.output.push(`}`);
      this.output.push(``);
    }
  }

  private generateConversionFunction(): void {
    this.output.push(`// ====== Conversion Functions ======`);
    this.output.push(``);
    this.output.push(`/** Convert a record object to FieldValue */`);
    this.output.push(`function toFieldValue(obj: Record<string, unknown> | null | undefined): FieldValue | undefined {`);
    this.output.push(`  if (obj == null) return undefined;`);
    this.output.push(`  const result: { [key: number]: FieldValue } = {};`);
    this.output.push(`  for (const [key, value] of Object.entries(obj)) {`);
    this.output.push(`    if (value == null) continue;`);
    this.output.push(`    const match = key.match(/__(\\\d+)$/);`);
    this.output.push(`    if (!match || !match[1]) continue;`);
    this.output.push(`    const idx = parseInt(match[1], 10);`);
    this.output.push(`    if (typeof value === "string") {`);
    this.output.push(`      result[idx] = value;`);
    this.output.push(`    } else if (typeof value === "object") {`);
    this.output.push(`      const nested = toFieldValue(value as Record<string, unknown>);`);
    this.output.push(`      if (nested !== undefined) result[idx] = nested;`);
    this.output.push(`    }`);
    this.output.push(`  }`);
    this.output.push(`  return Object.keys(result).length > 0 ? result : undefined;`);
    this.output.push(`}`);
    this.output.push(``);
  }

  private generateSegmentBuilders(): void {
    const segments = [...this.usedSegments].sort();

    for (const segName of segments) {
      const segDef = this.segmentDefs.get(segName);
      if (!segDef) continue;

      this.output.push(`// ====== ${segName} Segment ======`);
      this.output.push(``);

      // Generate helper getter functions
      this.generateSegmentHelpers(segName, segDef);

      this.output.push(`export class ${segName}Builder {`);
      this.output.push(`  private seg: HL7v2Segment = { segment: "${segName}", fields: {} };`);
      this.output.push(``);

      for (const field of segDef.fields) {
        const fieldDef = this.fieldDefs.get(field.field);
        if (!fieldDef) continue;

        const fieldNumStr = field.field.split(".")[1];
        if (!fieldNumStr) continue;
        const fieldNum = parseInt(fieldNumStr, 10);
        const fieldName = this.toCamelCase(fieldDef.longName);
        const isRepeating = field.maxOccurs === "unbounded" || parseInt(field.maxOccurs) > 1;
        const dtDef = this.dataTypeDefs.get(fieldDef.dataType);
        const isPrimitive = PRIMITIVE_TYPES.has(fieldDef.dataType);

        // Use segment name in lowercase for method prefix
        const segLower = segName.toLowerCase();

        if (isPrimitive) {
          // Primitive field - direct string value
          this.output.push(`  /** ${field.field} - ${fieldDef.longName} */`);
          this.output.push(`  set_${segLower}${fieldNum}_${fieldName}(value: string | null | undefined): this {`);
          this.output.push(`    if (value != null) this.seg.fields[${fieldNum}] = value;`);
          this.output.push(`    return this;`);
          this.output.push(`  }`);
          this.output.push(``);
        } else if (dtDef) {
          // Complex field - record object
          const typeName = fieldDef.dataType;

          if (isRepeating) {
            // Repeating field: set accepts array, add adds single item
            this.output.push(`  /** ${field.field} - ${fieldDef.longName} (set all values) */`);
            this.output.push(`  set_${segLower}${fieldNum}_${fieldName}(values: ${typeName}[] | null | undefined): this {`);
            this.output.push(`    if (values == null) return this;`);
            this.output.push(`    const arr: FieldValue[] = [];`);
            this.output.push(`    for (const v of values) {`);
            this.output.push(`      const fv = toFieldValue(v as Record<string, unknown>);`);
            this.output.push(`      if (fv !== undefined) arr.push(fv);`);
            this.output.push(`    }`);
            this.output.push(`    if (arr.length > 0) this.seg.fields[${fieldNum}] = arr;`);
            this.output.push(`    return this;`);
            this.output.push(`  }`);
            this.output.push(``);

            this.output.push(`  /** ${field.field} - ${fieldDef.longName} (add single value) */`);
            this.output.push(`  add_${segLower}${fieldNum}_${fieldName}(value: ${typeName} | null | undefined): this {`);
            this.output.push(`    if (value == null) return this;`);
            this.output.push(`    const fv = toFieldValue(value as Record<string, unknown>);`);
            this.output.push(`    if (fv !== undefined) {`);
            this.output.push(`      const existing = this.seg.fields[${fieldNum}];`);
            this.output.push(`      if (Array.isArray(existing)) {`);
            this.output.push(`        existing.push(fv);`);
            this.output.push(`      } else {`);
            this.output.push(`        this.seg.fields[${fieldNum}] = [fv];`);
            this.output.push(`      }`);
            this.output.push(`    }`);
            this.output.push(`    return this;`);
            this.output.push(`  }`);
            this.output.push(``);
          } else {
            // Non-repeating complex field
            this.output.push(`  /** ${field.field} - ${fieldDef.longName} */`);
            this.output.push(`  set_${segLower}${fieldNum}_${fieldName}(value: ${typeName} | null | undefined): this {`);
            this.output.push(`    const fv = toFieldValue(value as Record<string, unknown>);`);
            this.output.push(`    if (fv !== undefined) this.seg.fields[${fieldNum}] = fv;`);
            this.output.push(`    return this;`);
            this.output.push(`  }`);
            this.output.push(``);
          }
        }
      }

      this.output.push(`  build(): HL7v2Segment {`);
      this.output.push(`    return this.seg;`);
      this.output.push(`  }`);
      this.output.push(`}`);
      this.output.push(``);
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

  private generateSegmentHelpers(segName: string, segDef: SegmentDef): void {
    for (const field of segDef.fields) {
      const fieldDef = this.fieldDefs.get(field.field);
      if (!fieldDef) continue;

      const fieldNumStr = field.field.split(".")[1];
      if (!fieldNumStr) continue;
      const fieldNum = parseInt(fieldNumStr, 10);
      const fieldSnake = toSnakeCase(fieldDef.longName);
      const dtDef = this.dataTypeDefs.get(fieldDef.dataType);
      const isPrimitive = PRIMITIVE_TYPES.has(fieldDef.dataType);

      if (isPrimitive) {
        // Primitive field getter: SEGMENT_N_name
        const fnName = `${segName}_${fieldNum}_${fieldSnake}`;
        this.output.push(`/** Get ${field.field} - ${fieldDef.longName} */`);
        this.output.push(`export function ${fnName}(seg: HL7v2Segment): string | undefined {`);
        this.output.push(`  const val = seg.fields[${fieldNum}];`);
        this.output.push(`  if (typeof val === "string") return val;`);
        this.output.push(`  if (Array.isArray(val) && typeof val[0] === "string") return val[0];`);
        this.output.push(`  return undefined;`);
        this.output.push(`}`);
        this.output.push(``);
      } else if (dtDef?.components) {
        // Complex field - generate getters for each component
        this.generateComponentHelpers(segName, fieldNum, fieldDef.longName, dtDef, []);
      }
    }
  }

  private generateComponentHelpers(
    segName: string,
    fieldNum: number,
    fieldName: string,
    dtDef: DataTypeDef,
    parentPath: number[]
  ): void {
    if (!dtDef.components) return;

    for (let i = 0; i < dtDef.components.length; i++) {
      const comp = dtDef.components[i]!;
      const compNum = i + 1;
      const compDef = this.fieldDefs.get(comp.dataType);
      if (!compDef) continue;

      const compPath = [...parentPath, compNum];
      const nestedDtDef = this.dataTypeDefs.get(compDef.dataType);
      const isNestedPrimitive = PRIMITIVE_TYPES.has(compDef.dataType);

      // Build function name: SEGMENT_FIELD_COMP1_COMP2_..._name
      const fieldSnake = toSnakeCase(fieldName);
      const compSnake = toSnakeCase(compDef.longName);
      const pathStr = compPath.join("_");
      const fnName = `${segName}_${fieldNum}_${pathStr}_${compSnake}`;

      // Build path expression for getComponent
      const pathArgs = compPath.join(", ");

      this.output.push(`/** Get ${segName}.${fieldNum}.${compPath.join(".")} - ${compDef.longName} */`);
      this.output.push(`export function ${fnName}(seg: HL7v2Segment): string | undefined {`);
      this.output.push(`  const field = seg.fields[${fieldNum}];`);
      this.output.push(`  return getComponent(field, ${pathArgs});`);
      this.output.push(`}`);
      this.output.push(``);

      // Recursively generate for nested complex types
      if (!isNestedPrimitive && nestedDtDef?.components) {
        this.generateComponentHelpers(segName, fieldNum, fieldName, nestedDtDef, compPath);
      }
    }
  }

  /**
   * Generate message-level type-safe builders
   */
  async generateMessages(): Promise<string> {
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
        if (el.group) {
          const groupDef = def[el.group];
          if (groupDef) {
            processElements(groupDef.elements);
          }
        }
      }
    };

    if (def[rootKey]) {
      processElements(def[rootKey].elements);
    }

    for (const key of Object.keys(def)) {
      if (key !== rootKey && def[key]?.elements) {
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
        if (isRepeating) {
          output.push(`  ${fieldName}${optionalMark}: HL7v2Segment[];`);
        } else {
          output.push(`  ${fieldName}${optionalMark}: HL7v2Segment;`);
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
        if (isRepeating) {
          output.push(`  ${fieldName}${optionalMark}: HL7v2Segment[];`);
        } else {
          output.push(`  ${fieldName}${optionalMark}: HL7v2Segment;`);
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

    output.push(`export class ${builderName} {`);
    output.push(`  private group: Partial<${typeName}> = {};`);
    output.push(``);

    for (const el of groupDef.elements) {
      const isRepeating = el.maxOccurs === "unbounded" || parseInt(el.maxOccurs) > 1;

      if (el.segment) {
        const fieldName = el.segment.toLowerCase();
        const segBuilderName = `${el.segment}Builder`;

        if (isRepeating) {
          output.push(`  add${el.segment}(segment: HL7v2Segment | ${segBuilderName} | ((builder: ${segBuilderName}) => ${segBuilderName})): this {`);
          output.push(`    let seg: HL7v2Segment;`);
          output.push(`    if (typeof segment === "function") seg = segment(new ${segBuilderName}()).build();`);
          output.push(`    else if (segment instanceof ${segBuilderName}) seg = segment.build();`);
          output.push(`    else seg = segment;`);
          output.push(`    if (!this.group.${fieldName}) this.group.${fieldName} = [];`);
          output.push(`    this.group.${fieldName}.push(seg);`);
          output.push(`    return this;`);
          output.push(`  }`);
        } else {
          output.push(`  ${fieldName}(segment: HL7v2Segment | ${segBuilderName} | ((builder: ${segBuilderName}) => ${segBuilderName})): this {`);
          output.push(`    if (typeof segment === "function") this.group.${fieldName} = segment(new ${segBuilderName}()).build();`);
          output.push(`    else if (segment instanceof ${segBuilderName}) this.group.${fieldName} = segment.build();`);
          output.push(`    else this.group.${fieldName} = segment;`);
          output.push(`    return this;`);
          output.push(`  }`);
        }
        output.push(``);
      } else if (el.group) {
        const nestedFieldName = el.group.toLowerCase();
        const nestedTypeName = `${msgType}_${el.group}`;
        const nestedBuilderName = `${nestedTypeName}Builder`;

        if (isRepeating) {
          output.push(`  add${el.group}(group: ${nestedTypeName} | ${nestedBuilderName} | ((builder: ${nestedBuilderName}) => ${nestedBuilderName})): this {`);
          output.push(`    let g: ${nestedTypeName};`);
          output.push(`    if (typeof group === "function") g = group(new ${nestedBuilderName}()).build();`);
          output.push(`    else if (group instanceof ${nestedBuilderName}) g = group.build();`);
          output.push(`    else g = group;`);
          output.push(`    if (!this.group.${nestedFieldName}) this.group.${nestedFieldName} = [];`);
          output.push(`    this.group.${nestedFieldName}.push(g);`);
          output.push(`    return this;`);
          output.push(`  }`);
        } else {
          output.push(`  ${nestedFieldName}(group: ${nestedTypeName} | ${nestedBuilderName} | ((builder: ${nestedBuilderName}) => ${nestedBuilderName})): this {`);
          output.push(`    if (typeof group === "function") this.group.${nestedFieldName} = group(new ${nestedBuilderName}()).build();`);
          output.push(`    else if (group instanceof ${nestedBuilderName}) this.group.${nestedFieldName} = group.build();`);
          output.push(`    else this.group.${nestedFieldName} = group;`);
          output.push(`    return this;`);
          output.push(`  }`);
        }
        output.push(``);
      }
    }

    output.push(`  build(): ${typeName} { return this.group as ${typeName}; }`);
    output.push(`}`);
    output.push(``);
  }

  private generateMessageBuilder(output: string[], msgType: string, msgDef: MessageDef): void {
    const rootDef = msgDef[msgType];
    if (!rootDef) return;

    const requiredFields: string[] = [];
    for (const el of rootDef.elements) {
      if (el.minOccurs !== "0") {
        const name = el.segment?.toLowerCase() || el.group?.toLowerCase();
        if (name) requiredFields.push(name);
      }
    }

    output.push(`export class ${msgType}Builder {`);
    output.push(`  private msg: Partial<${msgType}_Message> = {};`);
    output.push(``);

    for (const el of rootDef.elements) {
      const isRepeating = el.maxOccurs === "unbounded" || parseInt(el.maxOccurs) > 1;

      if (el.segment) {
        const fieldName = el.segment.toLowerCase();
        const builderName = `${el.segment}Builder`;

        if (isRepeating) {
          output.push(`  add${el.segment}(segment: HL7v2Segment | ${builderName} | ((builder: ${builderName}) => ${builderName})): this {`);
          output.push(`    let seg: HL7v2Segment;`);
          output.push(`    if (typeof segment === "function") seg = segment(new ${builderName}()).build();`);
          output.push(`    else if (segment instanceof ${builderName}) seg = segment.build();`);
          output.push(`    else seg = segment;`);
          output.push(`    if (!this.msg.${fieldName}) this.msg.${fieldName} = [];`);
          output.push(`    this.msg.${fieldName}.push(seg);`);
          output.push(`    return this;`);
          output.push(`  }`);
        } else {
          output.push(`  ${fieldName}(segment: HL7v2Segment | ${builderName} | ((builder: ${builderName}) => ${builderName})): this {`);
          output.push(`    if (typeof segment === "function") this.msg.${fieldName} = segment(new ${builderName}()).build();`);
          output.push(`    else if (segment instanceof ${builderName}) this.msg.${fieldName} = segment.build();`);
          output.push(`    else this.msg.${fieldName} = segment;`);
          output.push(`    return this;`);
          output.push(`  }`);
        }
        output.push(``);
      } else if (el.group) {
        const fieldName = el.group.toLowerCase();
        const groupTypeName = `${msgType}_${el.group}`;
        const groupBuilderName = `${groupTypeName}Builder`;

        if (isRepeating) {
          output.push(`  add${el.group}(group: ${groupTypeName} | ${groupBuilderName} | ((builder: ${groupBuilderName}) => ${groupBuilderName})): this {`);
          output.push(`    let g: ${groupTypeName};`);
          output.push(`    if (typeof group === "function") g = group(new ${groupBuilderName}()).build();`);
          output.push(`    else if (group instanceof ${groupBuilderName}) g = group.build();`);
          output.push(`    else g = group;`);
          output.push(`    if (!this.msg.${fieldName}) this.msg.${fieldName} = [];`);
          output.push(`    this.msg.${fieldName}.push(g);`);
          output.push(`    return this;`);
          output.push(`  }`);
        } else {
          output.push(`  ${fieldName}(group: ${groupTypeName} | ${groupBuilderName} | ((builder: ${groupBuilderName}) => ${groupBuilderName})): this {`);
          output.push(`    if (typeof group === "function") this.msg.${fieldName} = group(new ${groupBuilderName}()).build();`);
          output.push(`    else if (group instanceof ${groupBuilderName}) this.msg.${fieldName} = group.build();`);
          output.push(`    else this.msg.${fieldName} = group;`);
          output.push(`    return this;`);
          output.push(`  }`);
        }
        output.push(``);
      }
    }

    output.push(`  build(): HL7v2Message {`);
    if (requiredFields.length > 0) {
      for (const field of requiredFields) {
        output.push(`    if (!this.msg.${field}) throw new Error("${msgType}: ${field} is required");`);
      }
    }
    output.push(`    const segments: HL7v2Message = [];`);
    this.generateFlattenCode(output, rootDef.elements, msgDef, "this.msg");
    output.push(`    return segments;`);
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
          output.push(`    if (${fieldPath}) for (const seg of ${fieldPath}) segments.push(seg);`);
        } else {
          output.push(`    if (${fieldPath}) segments.push(${fieldPath});`);
        }
      } else if (el.group) {
        const fieldName = el.group.toLowerCase();
        const fieldPath = `${prefix}.${fieldName}`;
        const groupDef = msgDef[el.group];

        if (groupDef) {
          if (isRepeating) {
            output.push(`    if (${fieldPath}) for (const group of ${fieldPath}) {`);
            this.generateFlattenCodeForGroup(output, groupDef.elements, msgDef, "group", "      ");
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
          output.push(`${indent}if (${fieldPath}) for (const seg of ${fieldPath}) segments.push(seg);`);
        } else {
          output.push(`${indent}if (${fieldPath}) segments.push(${fieldPath});`);
        }
      } else if (el.group) {
        const fieldName = el.group.toLowerCase();
        const fieldPath = `${prefix}.${fieldName}`;
        const groupDef = msgDef[el.group];

        if (groupDef) {
          if (isRepeating) {
            output.push(`${indent}if (${fieldPath}) for (const subgroup of ${fieldPath}) {`);
            this.generateFlattenCodeForGroup(output, groupDef.elements, msgDef, "subgroup", indent + "  ");
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

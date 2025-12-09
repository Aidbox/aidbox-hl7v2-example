// HL7v2 Message Representation Types
// Based on ADR: spec/hl7v2.adr.md

/**
 * Recursive type for field values:
 * - string: primitive value
 * - FieldValue[]: repeating field
 * - Record<number, FieldValue>: complex type with components
 */
export type FieldValue = string | FieldValue[] | { [key: number]: FieldValue };

/**
 * A single HL7v2 segment with numeric field keys
 */
export interface HL7v2Segment {
  segment: string;
  fields: Record<number, FieldValue>;
}

/**
 * An HL7v2 message is an array of segments
 */
export type HL7v2Message = HL7v2Segment[];

/**
 * Find a segment by name in a message
 */
export function findSegment(msg: HL7v2Message, name: string): HL7v2Segment | undefined {
  return msg.find(s => s.segment === name);
}

/**
 * Find all segments by name in a message
 */
export function findSegments(msg: HL7v2Message, name: string): HL7v2Segment[] {
  return msg.filter(s => s.segment === name);
}

/**
 * Get a component from a field value
 * Handles arrays (repeating fields) by returning first element
 */
export function getComponent(field: FieldValue | undefined, ...path: number[]): string | undefined {
  if (field === undefined) return undefined;

  let current: FieldValue | undefined = field;

  // If array, take first element
  if (Array.isArray(current)) {
    current = current[0];
  }

  for (const idx of path) {
    if (current === undefined || typeof current === 'string') return undefined;
    if (Array.isArray(current)) {
      current = current[0];
    }
    if (current !== undefined && typeof current === 'object' && !Array.isArray(current)) {
      current = current[idx];
    }
  }

  if (typeof current === 'string') return current;
  if (Array.isArray(current) && current[0] !== undefined) return getComponent(current[0]);
  if (current !== undefined && typeof current === 'object' && !Array.isArray(current)) {
    // Return first subcomponent for nested complex types
    return getComponent(current[1]);
  }
  return undefined;
}

/**
 * Set a component value in a field
 * Creates intermediate objects as needed
 * Handles arrays (repeating fields) by targeting first element
 */
export function setComponent(
  fields: Record<number, FieldValue>,
  fieldNum: number,
  value: string,
  ...componentPath: number[]
): void {
  if (componentPath.length === 0) {
    fields[fieldNum] = value;
    return;
  }

  // Initialize field if needed
  if (fields[fieldNum] === undefined) {
    fields[fieldNum] = {};
  }

  let current: FieldValue = fields[fieldNum]!;

  // If array, work with first element
  if (Array.isArray(current)) {
    if (current.length === 0) {
      current.push({});
    }
    current = current[0]!;
  }

  // Navigate/create path except last element
  for (let i = 0; i < componentPath.length - 1; i++) {
    const idx = componentPath[i];
    if (idx === undefined) continue;
    if (typeof current === 'string') {
      throw new Error('Cannot set component on string value');
    }
    if (Array.isArray(current)) {
      if (current.length === 0) current.push({});
      current = current[0]!;
    }
    if (typeof current === 'object' && !Array.isArray(current)) {
      if (current[idx] === undefined) {
        current[idx] = {};
      }
      current = current[idx]!;
    }
  }

  // Set final value
  const lastIdx = componentPath[componentPath.length - 1];
  if (lastIdx !== undefined && typeof current === 'object' && !Array.isArray(current)) {
    current[lastIdx] = value;
  }
}

// AUTO-GENERATED - HL7v2 Core Types
// Generated for: BAR_P01, ORU_R01, VXU_V04

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
 * Get a component from a field value
 */
export function getComponent(field: FieldValue | undefined, ...path: number[]): string | undefined {
  if (field === undefined) return undefined;
  let current: FieldValue | undefined = field;
  if (Array.isArray(current)) current = current[0];
  for (const idx of path) {
    if (current === undefined || typeof current === 'string') return undefined;
    if (Array.isArray(current)) current = current[0];
    if (current !== undefined && typeof current === 'object' && !Array.isArray(current)) {
      current = current[idx];
    }
  }
  if (typeof current === 'string') return current;
  if (Array.isArray(current) && current[0] !== undefined) return getComponent(current[0]);
  if (current !== undefined && typeof current === 'object' && !Array.isArray(current)) {
    return getComponent(current[1]);
  }
  return undefined;
}

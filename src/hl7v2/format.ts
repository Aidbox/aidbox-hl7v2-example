/**
 * HL7v2 Message Formatter
 * Serializes HL7v2Message to pipe-delimited string format
 */

import type { HL7v2Message, HL7v2Segment, FieldValue } from "./types";

export const DEFAULT_FIELD_SEP = "|";
export const DEFAULT_ENCODING_CHARS = "^~\\&";
export const DEFAULT_SEGMENT_SEP = "\r";

export interface FormatOptions {
  /** Field separator (default: |) */
  fieldSep?: string;
  /** Encoding characters: component^repetition~escape\subcomponent& (default: ^~\&) */
  encodingChars?: string;
  /** Segment separator (default: \r) */
  segmentSep?: string;
}

/**
 * Format a single field value to string
 */
function formatFieldValue(
  value: FieldValue,
  componentSep: string,
  subcomponentSep: string,
  repetitionSep: string
): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    // Repeating field
    return value
      .map((v) => formatFieldValue(v, componentSep, subcomponentSep, repetitionSep))
      .join(repetitionSep);
  }

  // Complex type with components
  const components: string[] = [];
  const keys = Object.keys(value).map(Number).sort((a, b) => a - b);
  const maxKey = keys.length > 0 ? Math.max(...keys) : 0;

  for (let i = 1; i <= maxKey; i++) {
    const compValue = value[i];
    if (compValue === undefined) {
      components.push("");
    } else if (typeof compValue === "string") {
      components.push(compValue);
    } else if (typeof compValue === "object" && !Array.isArray(compValue)) {
      // Subcomponents
      const subcomponents: string[] = [];
      const subKeys = Object.keys(compValue).map(Number).sort((a, b) => a - b);
      const maxSubKey = subKeys.length > 0 ? Math.max(...subKeys) : 0;

      for (let j = 1; j <= maxSubKey; j++) {
        const subValue = compValue[j];
        if (subValue === undefined) {
          subcomponents.push("");
        } else if (typeof subValue === "string") {
          subcomponents.push(subValue);
        } else {
          subcomponents.push(formatFieldValue(subValue, componentSep, subcomponentSep, repetitionSep));
        }
      }
      components.push(subcomponents.join(subcomponentSep));
    } else {
      components.push(formatFieldValue(compValue, componentSep, subcomponentSep, repetitionSep));
    }
  }

  // Trim trailing empty components
  while (components.length > 0 && components[components.length - 1] === "") {
    components.pop();
  }

  return components.join(componentSep);
}

/**
 * Format a segment to pipe-delimited string
 */
function formatSegment(
  segment: HL7v2Segment,
  fieldSep: string,
  componentSep: string,
  subcomponentSep: string,
  repetitionSep: string
): string {
  const parts: string[] = [segment.segment];
  const keys = Object.keys(segment.fields).map(Number).sort((a, b) => a - b);

  // Special handling for MSH segment
  if (segment.segment === "MSH") {
    // MSH.1 is the field separator itself (part of the segment header)
    // MSH.2 is encoding characters
    const encodingChars = segment.fields[2];
    parts.push(typeof encodingChars === "string" ? encodingChars : DEFAULT_ENCODING_CHARS);

    // Continue from field 3
    const maxKey = keys.length > 0 ? Math.max(...keys) : 2;
    for (let i = 3; i <= maxKey; i++) {
      const value = segment.fields[i];
      if (value === undefined) {
        parts.push("");
      } else {
        parts.push(formatFieldValue(value, componentSep, subcomponentSep, repetitionSep));
      }
    }
  } else {
    // Non-MSH segments
    const maxKey = keys.length > 0 ? Math.max(...keys) : 0;
    for (let i = 1; i <= maxKey; i++) {
      const value = segment.fields[i];
      if (value === undefined) {
        parts.push("");
      } else {
        parts.push(formatFieldValue(value, componentSep, subcomponentSep, repetitionSep));
      }
    }
  }

  // Trim trailing empty fields
  while (parts.length > 1 && parts[parts.length - 1] === "") {
    parts.pop();
  }

  return parts.join(fieldSep);
}

/**
 * Format an HL7v2 message to pipe-delimited string
 *
 * @param message - The HL7v2 message to format
 * @param options - Optional format options (fieldSep, encodingChars, segmentSep)
 * @returns Pipe-delimited string representation
 *
 * @example
 * const msg = formatMessage(message);
 * // MSH|^~\&|HOSPITAL_APP|HOSPITAL_FAC|...
 * // PID|1||12345678^^^HOSP^MR||Smith^John^Robert||...
 *
 * // With custom delimiters
 * const msg = formatMessage(message, { segmentSep: "\n" });
 */
export function formatMessage(message: HL7v2Message, options: FormatOptions = {}): string {
  if (message.length === 0) return "";

  // Get separators from options or MSH segment or defaults
  const msh = message.find((s) => s.segment === "MSH");
  const fieldSep = options.fieldSep ?? (msh?.fields[1] as string | undefined) ?? DEFAULT_FIELD_SEP;
  const encodingChars = options.encodingChars ?? (msh?.fields[2] as string | undefined) ?? DEFAULT_ENCODING_CHARS;
  const segmentSep = options.segmentSep ?? DEFAULT_SEGMENT_SEP;

  const componentSep = encodingChars[0] ?? "^";
  const repetitionSep = encodingChars[1] ?? "~";
  const escapeSep = encodingChars[2] ?? "\\";
  const subcomponentSep = encodingChars[3] ?? "&";

  return message
    .map((seg) => formatSegment(seg, fieldSep, componentSep, subcomponentSep, repetitionSep))
    .join(segmentSep);
}

/**
 * Format a single segment to pipe-delimited string
 *
 * @param segment - The segment to format
 * @param fieldSep - Field separator (default: |)
 * @param encodingChars - Encoding characters (default: ^~\&)
 */
export function formatSingleSegment(
  segment: HL7v2Segment,
  fieldSep = DEFAULT_FIELD_SEP,
  encodingChars = DEFAULT_ENCODING_CHARS
): string {
  const componentSep = encodingChars[0] ?? "^";
  const repetitionSep = encodingChars[1] ?? "~";
  const subcomponentSep = encodingChars[3] ?? "&";

  return formatSegment(segment, fieldSep, componentSep, subcomponentSep, repetitionSep);
}

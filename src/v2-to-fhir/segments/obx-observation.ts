/**
 * HL7v2 OBX Segment to FHIR Observation Mapping
 * Based on: HL7 v2.5.1 OBX segment specification
 */

import type { OBX, CE } from "../../hl7v2/generated/fields";
import type {
  Observation,
  CodeableConcept,
  Quantity,
  Range,
  Ratio,
} from "../../fhir/hl7-fhir-r4-core";
import { normalizeSystem } from "../code-mapping/coding-systems";
import { convertCEToCodeableConcept } from "../datatypes/ce-codeableconcept";

// ============================================================================
// Status Mapping
// ============================================================================

/**
 * Map OBX-11 Observation Result Status to FHIR Observation.status
 *
 * HL7 v2 Table 0085 (Observation Result Status):
 * - F = Final result
 * - B = Result available (was B for batch)
 * - V = Result available (verified)
 * - U = Result available (unverified)
 * - P = Preliminary
 * - R = Results entered - not verified
 * - S = Partial results
 * - I = Specimen in lab; results pending
 * - O = Order detail description only
 * - C = Record coming over is a correction
 * - A = Amended based on adjustments
 * - D = Deletes the OBX record
 * - W = Post original as wrong
 * - X = Results cannot be obtained
 * - N = Not asked; used to affirmatively document we did not ask
 */
export function mapOBXStatusToFHIR(
  status: string | undefined,
): Observation["status"] {
  if (!status) return "unknown";

  switch (status.toUpperCase()) {
    case "F":
    case "B":
    case "V":
    case "U":
      return "final";
    case "P":
    case "R":
    case "S":
      return "preliminary";
    case "I":
    case "O":
      return "registered";
    case "C":
      return "corrected";
    case "A":
      return "amended";
    case "D":
    case "W":
      return "entered-in-error";
    case "X":
      return "cancelled";
    default:
      return "unknown";
  }
}

// ============================================================================
// Reference Range Parsing
// ============================================================================

export interface ParsedReferenceRange {
  low?: { value: number; unit?: string };
  high?: { value: number; unit?: string };
  text?: string;
}

/**
 * Parse OBX-7 Reference Range string
 * Examples: "3.5-5.5", ">60", "<5", "negative", "normal"
 */
export function parseReferenceRange(
  range: string | undefined,
): ParsedReferenceRange {
  if (!range) return {};

  const result: ParsedReferenceRange = {};

  // Try to parse simple range like "3.5-5.5" or "70-99"
  const rangeMatch = range.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    result.low = { value: parseFloat(rangeMatch[1]) };
    result.high = { value: parseFloat(rangeMatch[2]) };
    return result;
  }

  // Try to parse comparator range like ">60" or "<5"
  const comparatorMatch = range.match(/^([<>]=?)\s*([\d.]+)$/);
  if (comparatorMatch && comparatorMatch[1] && comparatorMatch[2]) {
    const comparator = comparatorMatch[1];
    const value = parseFloat(comparatorMatch[2]);
    result.text = range;

    if (comparator.startsWith(">")) {
      result.low = { value };
    } else {
      result.high = { value };
    }
    return result;
  }

  // Text-only range
  result.text = range;
  return result;
}

// ============================================================================
// Structured Numeric (SN) Parsing
// ============================================================================

export interface ParsedStructuredNumeric {
  type: "quantity" | "range" | "ratio" | "string";
  value?: number;
  comparator?: "<" | "<=" | ">=" | ">";
  low?: number;
  high?: number;
  numerator?: number;
  denominator?: number;
  raw?: string;
}

/**
 * Parse SN (Structured Numeric) value
 * Format: <comparator>^<num1>^<separator>^<num2>
 * Examples:
 * - "^90" → plain number
 * - ">^90" → comparator + number
 * - "^10^-^20" → range
 * - "^1^:^128" → ratio
 */
export function parseStructuredNumeric(sn: string): ParsedStructuredNumeric {
  if (!sn) return { type: "string", raw: sn };

  const parts = sn.split("^");

  // Plain number: "^90"
  if (parts.length === 2 && parts[0] === "" && parts[1]) {
    const value = parseFloat(parts[1]);
    if (!isNaN(value)) {
      return { type: "quantity", value };
    }
  }

  // Comparator + number: ">^90", "<^5", ">=^100", "<=^50"
  if (parts.length === 2 && parts[0] && parts[1]) {
    const comparatorMatch = parts[0].match(/^([<>]=?)$/);
    if (comparatorMatch) {
      const value = parseFloat(parts[1]);
      if (!isNaN(value)) {
        return {
          type: "quantity",
          value,
          comparator: comparatorMatch[1] as "<" | "<=" | ">=" | ">",
        };
      }
    }
  }

  // Range: "^10^-^20"
  if (parts.length === 4 && parts[0] === "" && parts[2] === "-" && parts[1] && parts[3]) {
    const low = parseFloat(parts[1]);
    const high = parseFloat(parts[3]);
    if (!isNaN(low) && !isNaN(high)) {
      return { type: "range", low, high };
    }
  }

  // Ratio: "^1^:^128"
  if (parts.length === 4 && parts[0] === "" && parts[2] === ":" && parts[1] && parts[3]) {
    const numerator = parseFloat(parts[1]);
    const denominator = parseFloat(parts[3]);
    if (!isNaN(numerator) && !isNaN(denominator)) {
      return { type: "ratio", numerator, denominator };
    }
  }

  // Fallback to string
  return { type: "string", raw: sn };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert HL7v2 DTM to FHIR dateTime
 */
function convertDTMToDateTime(dtm: string | undefined): string | undefined {
  if (!dtm) return undefined;

  const year = dtm.substring(0, 4);
  const month = dtm.substring(4, 6);
  const day = dtm.substring(6, 8);
  const hour = dtm.substring(8, 10) || "00";
  const minute = dtm.substring(10, 12) || "00";
  const second = dtm.substring(12, 14) || "00";

  if (dtm.length <= 4) return year;
  if (dtm.length <= 6) return `${year}-${month}`;
  if (dtm.length <= 8) return `${year}-${month}-${day}`;

  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

/**
 * Convert HL7v2 DTM to FHIR date
 */
function convertDTMToDate(dtm: string | undefined): string | undefined {
  if (!dtm) return undefined;

  const year = dtm.substring(0, 4);
  const month = dtm.substring(4, 6);
  const day = dtm.substring(6, 8);

  if (dtm.length <= 4) return year;
  if (dtm.length <= 6) return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

/**
 * Convert HL7v2 TM to FHIR time
 */
function convertTMToTime(tm: string | undefined): string | undefined {
  if (!tm) return undefined;

  const hour = tm.substring(0, 2);
  const minute = tm.substring(2, 4) || "00";
  const second = tm.substring(4, 6) || "00";

  return `${hour}:${minute}:${second}`;
}

/**
 * Parse coded value from OBX-5 string (e.g., "260385009^Negative^SCT")
 */
function parseCodedValue(value: string): CodeableConcept {
  const parts = value.split("^");
  const code = parts[0];
  const display = parts[1];
  const system = normalizeSystem(parts[2]);

  return {
    coding: [{ code, display, system }],
    text: display,
  };
}

/**
 * Get interpretation display text for abnormal flag code
 */
function getInterpretationDisplay(code: string): string {
  const displays: Record<string, string> = {
    H: "High",
    L: "Low",
    A: "Abnormal",
    AA: "Critical abnormal",
    HH: "Critical high",
    LL: "Critical low",
    N: "Normal",
    "<": "Below absolute low-off instrument scale",
    ">": "Above absolute high-off instrument scale",
    I: "Intermediate",
    MS: "Moderately susceptible",
    R: "Resistant",
    S: "Susceptible",
    VS: "Very susceptible",
    POS: "Positive",
    NEG: "Negative",
    IND: "Indeterminate",
  };

  return displays[code.toUpperCase()] || code;
}

// ============================================================================
// Main Converter Function
// ============================================================================
/**
 * Convert OBX segment to FHIR Observation
 *
 * @param obx - The OBX segment to convert
 * @param obrFillerOrderNumber - The filler order number from parent OBR (for deterministic ID)
 * @param options - Optional conversion options including pre-resolved code
 */
export function convertOBXToObservation(
  obx: OBX,
  obrFillerOrderNumber: string,
): Observation {
  // Generate deterministic ID: {OBR-3}-obx-{OBX-1}[-{OBX-4}]
  let id = `${obrFillerOrderNumber.toLowerCase()}-obx-${obx.$1_setIdObx || "0"}`;
  if (obx.$4_observationSubId) {
    id += `-${obx.$4_observationSubId.toLowerCase()}`;
  }
  id = id.replace(/[^a-z0-9-]/g, "-");

  const code = convertCEToCodeableConcept(obx.$3_observationIdentifier) ?? { text: "Unknown" };

  const observation: Observation = {
    resourceType: "Observation",
    id,
    status: mapOBXStatusToFHIR(obx.$11_observationResultStatus as string),
    code,
  };

  // OBX-14: Date/Time of Observation → effectiveDateTime
  if (obx.$14_observationDateTime) {
    observation.effectiveDateTime = convertDTMToDateTime(
      obx.$14_observationDateTime,
    );
  }

  // Parse value based on OBX-2 Value Type
  const valueType = obx.$2_valueType?.toUpperCase();
  const values = obx.$5_observationValue;
  const unit = obx.$6_unit?.$1_code;

  if (values && values.length > 0 && values[0]) {
    switch (valueType) {
      case "NM": {
        // Numeric
        const numValue = parseFloat(values[0]);
        if (!isNaN(numValue)) {
          observation.valueQuantity = {
            value: numValue,
            unit,
          };
        }
        break;
      }

      case "ST":
      case "TX": {
        // String / Text
        observation.valueString = values.join("\n");
        break;
      }

      case "CE":
      case "CWE": {
        // Coded Entry
        observation.valueCodeableConcept = parseCodedValue(values[0]);
        break;
      }

      case "DT": {
        // Date
        observation.valueDateTime = convertDTMToDate(values[0]);
        break;
      }

      case "TS": {
        // Timestamp
        observation.valueDateTime = convertDTMToDateTime(values[0]);
        break;
      }

      case "TM": {
        // Time
        observation.valueTime = convertTMToTime(values[0]);
        break;
      }

      case "SN": {
        // Structured Numeric
        const parsed = parseStructuredNumeric(values[0]);

        switch (parsed.type) {
          case "quantity":
            observation.valueQuantity = {
              value: parsed.value,
              comparator: parsed.comparator,
              unit,
            };
            break;

          case "range":
            observation.valueRange = {
              low: { value: parsed.low, unit },
              high: { value: parsed.high, unit },
            };
            break;

          case "ratio":
            observation.valueRatio = {
              numerator: { value: parsed.numerator },
              denominator: { value: parsed.denominator },
            };
            break;

          case "string":
          default:
            observation.valueString = parsed.raw || values[0];
            break;
        }
        break;
      }

      default:
        // Fallback to string for unknown types
        observation.valueString = values.join("\n");
        break;
    }
  }

  // OBX-8: Abnormal Flags → interpretation
  if (obx.$8_abnormalFlags && obx.$8_abnormalFlags.length > 0) {
    observation.interpretation = obx.$8_abnormalFlags.map((flag) => ({
      coding: [
        {
          code: flag,
          display: getInterpretationDisplay(flag),
          system:
            "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
        },
      ],
    }));
  }

  // OBX-7: Reference Range → referenceRange
  if (obx.$7_referencesRange) {
    const parsed = parseReferenceRange(obx.$7_referencesRange);
    const refRangeItem: NonNullable<Observation["referenceRange"]>[number] = {};

    if (parsed.low) {
      refRangeItem.low = { value: parsed.low.value, unit };
    }
    if (parsed.high) {
      refRangeItem.high = { value: parsed.high.value, unit };
    }
    if (parsed.text) {
      refRangeItem.text = parsed.text;
    }

    observation.referenceRange = [refRangeItem];
  }

  return observation;
}

import type { Quantity } from "../../fhir/hl7-fhir-r4-core";

/**
 * Converts NM (Numeric) to positiveInt.
 *
 * Mapping:
 * - NM value -> $value (positive integer)
 * - Returns undefined if negative
 */
export function convertNMToPositiveInt(nm: string | undefined): number | undefined {
  if (!nm) return undefined;

  const value = parseFloat(nm);
  if (isNaN(value)) return undefined;

  // Must be positive
  if (value < 0) return undefined;

  // Return as integer
  return Math.floor(value);
}

/**
 * Converts NM (Numeric) to Quantity.
 *
 * Mapping:
 * - NM value -> value (decimal)
 */
export function convertNMToQuantity(nm: string | undefined): Quantity | undefined {
  if (!nm) return undefined;

  const value = parseFloat(nm);
  if (isNaN(value)) return undefined;

  return {
    value,
  };
}

/**
 * Converts NM (Numeric) to Quantity with Length of Stay units (days).
 *
 * Mapping:
 * - NM value -> value
 * - unit = "days"
 * - system = "http://unitsofmeasure.org/"
 * - code = "d"
 */
export function convertNMToQuantityLengthOfStay(nm: string | undefined): Quantity | undefined {
  if (!nm) return undefined;

  const value = parseFloat(nm);
  if (isNaN(value)) return undefined;

  // Must be positive for length of stay
  if (value < 0) return undefined;

  return {
    value,
    unit: "days",
    system: "http://unitsofmeasure.org",
    code: "d",
  };
}

/**
 * Converts NM (Numeric) to decimal.
 *
 * Mapping:
 * - NM value -> decimal
 */
export function convertNMToDecimal(nm: string | undefined): number | undefined {
  if (!nm) return undefined;

  const value = parseFloat(nm);
  if (isNaN(value)) return undefined;

  return value;
}

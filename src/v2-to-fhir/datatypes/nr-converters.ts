import type { Range } from "../../fhir/hl7-fhir-r4-core";

/** NR (Numeric Range) datatype */
export interface NR {
  /** NR.1 - Low Value */
  $1_low?: string;
  /** NR.2 - High Value */
  $2_high?: string;
}

/**
 * Converts NR (Numeric Range) to FHIR Range.
 *
 * Mapping:
 * - NR.1 (Low Value) -> low.value (decimal)
 * - NR.2 (High Value) -> high.value (decimal)
 */
export function convertNRToRange(nr: NR | undefined): Range | undefined {
  if (!nr) return undefined;
  if (!nr.$1_low && !nr.$2_high) return undefined;

  const range: Range = {};

  if (nr.$1_low) {
    const lowValue = parseFloat(nr.$1_low);
    if (!isNaN(lowValue)) {
      range.low = { value: lowValue };
    }
  }

  if (nr.$2_high) {
    const highValue = parseFloat(nr.$2_high);
    if (!isNaN(highValue)) {
      range.high = { value: highValue };
    }
  }

  // Return undefined if neither value parsed successfully
  if (!range.low && !range.high) return undefined;

  return range;
}

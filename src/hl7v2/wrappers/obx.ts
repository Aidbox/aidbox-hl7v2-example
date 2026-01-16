/**
 * Wrapper for fromOBX that fixes SN (Structured Numeric) value parsing.
 *
 * The HL7v2 parser treats `^` as a component separator, but in SN values
 * the caret is part of the data format (e.g., ">^90" means "greater than 90").
 * This wrapper reconstructs SN values from the raw parsed components.
 */

import type { HL7v2Segment } from "../generated/types";
import type { OBX } from "../generated/fields";
import { fromOBX as fromOBXGenerated } from "../generated/fields";

/**
 * Reconstruct SN (Structured Numeric) value from parsed components.
 * SN uses caret (^) as internal separator, which gets incorrectly split by the parser.
 *
 * Examples:
 * - {1: ">", 2: "90"} → ">^90" (greater than 90)
 * - {1: "", 2: "10", 3: "-", 4: "20"} → "^10^-^20" (range 10-20)
 * - {1: "", 2: "1", 3: ":", 4: "128"} → "^1^:^128" (ratio 1:128)
 */
function reconstructSNValue(rawField: unknown): string | undefined {
  if (!rawField) return undefined;
  if (typeof rawField === "string") return rawField;

  if (typeof rawField === "object" && rawField !== null) {
    const obj = rawField as Record<string, string>;
    const parts: string[] = [];
    let i = 1;
    let val = obj[i];
    while (val !== undefined) {
      parts.push(val);
      i++;
      val = obj[i];
    }
    return parts.join("^");
  }

  return undefined;
}

/**
 * Parse OBX segment with proper SN value handling.
 *
 * This wrapper calls the generated fromOBX function, then fixes SN values
 * that were incorrectly parsed due to the caret being treated as a component separator.
 */
export function fromOBX(segment: HL7v2Segment): OBX {
  const obx = fromOBXGenerated(segment);

  if (obx.$2_valueType?.toUpperCase() === "SN") {
    const rawField = segment.fields[5];
    const reconstructed = reconstructSNValue(rawField);
    if (reconstructed) {
      obx.$5_observationValue = [reconstructed];
    }
  }

  return obx;
}

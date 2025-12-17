import type { CX } from "../../hl7v2/generated/fields";

/**
 * Converts CX (Extended Composite ID with Check Digit) to string.
 *
 * Mapping:
 * - CX.1 (ID Number) -> string
 */
export function convertCXToString(cx: CX | undefined): string | undefined {
  if (!cx) return undefined;

  return cx.$1_value;
}

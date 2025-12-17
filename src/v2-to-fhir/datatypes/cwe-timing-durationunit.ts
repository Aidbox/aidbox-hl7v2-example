import type { CWE } from "../../hl7v2/generated/fields";

/** Duration unit codes for Timing.repeat.durationUnit */
export type DurationUnit = "s" | "min" | "h" | "d" | "wk" | "mo" | "a";

/**
 * Converts CWE (Coded with Exceptions) to Timing duration unit code.
 *
 * Mapping:
 * - CWE.1 (Identifier) -> repeat.durationUnit (code)
 *
 * The durationUnit is limited to a required set of UCUM units:
 * s (seconds), min (minutes), h (hours), d (days), wk (weeks), mo (months), a (years)
 */
export function convertCWEToDurationUnit(cwe: CWE | undefined): DurationUnit | undefined {
  if (!cwe) return undefined;

  const code = cwe.$1_code;
  if (!code) return undefined;

  const validUnits: DurationUnit[] = ["s", "min", "h", "d", "wk", "mo", "a"];
  if (validUnits.includes(code as DurationUnit)) {
    return code as DurationUnit;
  }

  return undefined;
}

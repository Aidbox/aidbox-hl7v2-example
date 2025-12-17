import type { Timing, CodeableConcept } from "../../fhir/hl7-fhir-r4-core";

/** RI (Repeat Interval) datatype */
export interface RI {
  /** RI.1 - Repeat Pattern */
  $1_repeatPattern?: string;
  /** RI.2 - Explicit Time Interval */
  $2_explicitTimeInterval?: string;
}

/**
 * Converts RI (Repeat Interval) to Timing.
 *
 * Mapping:
 * - RI.1 (Repeat Pattern) -> code (CodeableConcept)
 * - RI.2 (Explicit Time Interval) -> repeat.timeOfDay[] (format: HHMM,HHMM,...)
 */
export function convertRIToTiming(ri: RI | undefined): Timing | undefined {
  if (!ri) return undefined;
  if (!ri.$1_repeatPattern && !ri.$2_explicitTimeInterval) return undefined;

  const timing: Timing = {};

  if (ri.$1_repeatPattern) {
    timing.code = {
      coding: [{ code: ri.$1_repeatPattern }],
    } as CodeableConcept;
  }

  if (ri.$2_explicitTimeInterval) {
    // Parse HHMM,HHMM format into time values (HH:MM:SS)
    const times = ri.$2_explicitTimeInterval.split(",");
    const timeOfDay: string[] = [];

    for (const time of times) {
      const trimmed = time.trim();
      if (trimmed.length >= 4) {
        // Convert HHMM to HH:MM:SS format
        const hours = trimmed.substring(0, 2);
        const minutes = trimmed.substring(2, 4);
        const seconds = trimmed.length >= 6 ? trimmed.substring(4, 6) : "00";
        timeOfDay.push(`${hours}:${minutes}:${seconds}`);
      }
    }

    if (timeOfDay.length > 0) {
      timing.repeat = {
        timeOfDay,
      };
    }
  }

  return timing;
}

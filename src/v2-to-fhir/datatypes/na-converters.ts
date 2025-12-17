import type { SampledData } from "../../fhir/hl7-fhir-r4-core";

/** NA (Numeric Array) datatype - represents an array of numeric values */
export interface NA {
  /** NA.1 - Value1 */
  $1_value1?: string;
  /** NA.2 - Value2 */
  $2_value2?: string;
  /** NA.3 - Value3 */
  $3_value3?: string;
  /** NA.4 - Value4 */
  $4_value4?: string;
}

/**
 * Converts NA (Numeric Array) to SampledData.
 *
 * Mapping:
 * - dimensions = number of values in the array
 * - data = values joined with "^"
 *
 * Note: For full guidance on how to populate FHIR SampledData from HL7v2 Numeric Array,
 * see the Observations - NA to SampledData section in the Implementation Considerations chapter.
 */
export function convertNAToSampledData(na: NA | undefined): Partial<SampledData> | undefined {
  if (!na) return undefined;

  // Collect all non-empty values
  const values: string[] = [];
  if (na.$1_value1) values.push(na.$1_value1);
  if (na.$2_value2) values.push(na.$2_value2);
  if (na.$3_value3) values.push(na.$3_value3);
  if (na.$4_value4) values.push(na.$4_value4);

  if (values.length === 0) return undefined;

  // Return partial SampledData - origin and period must be provided by caller
  return {
    dimensions: values.length,
    data: values.join(" "),
  };
}

/**
 * Converts array of numeric values to SampledData.
 * Alternative for when values come as string array rather than NA object.
 */
export function convertNumericArrayToSampledData(values: string[] | undefined): Partial<SampledData> | undefined {
  if (!values || values.length === 0) return undefined;

  const filtered = values.filter(v => v !== undefined && v !== "");

  if (filtered.length === 0) return undefined;

  return {
    dimensions: filtered.length,
    data: filtered.join(" "),
  };
}

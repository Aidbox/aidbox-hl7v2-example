/**
 * Converts DTM (Date/Time) to FHIR dateTime.
 *
 * Mapping:
 * - DTM.1 -> dateTime
 *
 * Note: HL7v2 DTM format (YYYYMMDDHHMMSS.SSSS[+/-ZZZZ]) may need conversion
 * to FHIR format (YYYY-MM-DDTHH:MM:SS.sss+zz:zz). This basic implementation
 * returns the value as-is; format conversion should be handled separately.
 */
export function convertDTMToDateTime(dtm: string | undefined): string | undefined {
  if (!dtm) return undefined;

  return dtm;
}

/** Partial Annotation data for time field */
export interface AnnotationTimeData {
  time: string;
}

/**
 * Converts DTM (Date/Time) to Annotation time data.
 *
 * Mapping:
 * - DTM -> time (dateTime)
 *
 * This returns data that can be merged into an Annotation.
 * The Annotation's required `text` field must be set separately.
 */
export function convertDTMToAnnotationTime(dtm: string | undefined): AnnotationTimeData | undefined {
  if (!dtm) return undefined;

  return {
    time: dtm,
  };
}

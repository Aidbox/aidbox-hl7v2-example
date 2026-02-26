/**
 * Converts HL7v2 DTM (YYYYMMDDHHMMSS) to FHIR dateTime (YYYY-MM-DDTHH:MM:SSZ).
 * Handles partial dates: YYYY, YYYY-MM, YYYY-MM-DD, full datetime.
 */
export function convertDTMToDateTime(dtm: string | undefined): string | undefined {
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

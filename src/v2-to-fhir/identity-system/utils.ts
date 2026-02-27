/**
 * Sanitize a string for use as a FHIR resource ID.
 * Lowercases and replaces non-alphanumeric characters (except hyphens) with hyphens.
 */
export const sanitizeForId = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9-]/g, "-");

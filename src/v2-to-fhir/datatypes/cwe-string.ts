import type { CWE } from "../../hl7v2/generated/fields";

/**
 * Converts CWE (Coded with Exceptions) to string.
 *
 * Mapping:
 * - CWE.9 (Original Text) -> string (if valued)
 * - CWE.2 (Text) -> string (if CWE.9 NOT valued)
 */
export function convertCWEToString(cwe: CWE | undefined): string | undefined {
  if (!cwe) return undefined;

  return cwe.$9_originalText ?? cwe.$2_text;
}

import type { CWE } from "../../hl7v2/generated/fields";

/**
 * Converts CWE (Coded with Exceptions) to URI.
 *
 * Mapping:
 * - CWE.1 (Identifier) -> uri
 * - CWE.4 (Alternate Identifier) -> uri (if CWE.1 NOT valued)
 */
export function convertCWEToUri(cwe: CWE | undefined): string | undefined {
  if (!cwe) return undefined;

  return cwe.$1_code ?? cwe.$4_altCode;
}

/**
 * HL7 v2.8.2 CX Datatype Authority Rules (from Section 2.A.14):
 *
 * At least one of CX.4, CX.9, or CX.10 must be populated:
 * - CX.4 (Assigning Authority) is required if neither CX.9 nor CX.10 are populated
 * - CX.9 (Assigning Jurisdiction) is required if neither CX.4 nor CX.10 are populated
 * - CX.10 (Assigning Agency/Department) is required if neither CX.4 nor CX.9 are populated
 *
 * All three may be valued. If values in CX.9 and/or CX.10 conflict with CX.4,
 * the Message Profile defines precedence. Without a profile, conflicts are errors.
 *
 * These components serve different semantic purposes:
 * - CX.4: Assigning Authority (HD type) - organization/system that assigned the ID
 * - CX.9: Assigning Jurisdiction (CWE type) - geo-political body
 * - CX.10: Assigning Agency/Department (CWE type) - organization unit
 *
 * Ref: https://www.hl7.eu/HL7v2x/v282/std282/ch02a.html#Heading158
 */

import type { CX, HD, CWE } from "../hl7v2/generated/fields";
import type { Encounter } from "../fhir/hl7-fhir-r4-core";

export type EncounterIdentifierResult = {
  identifier?: Encounter["identifier"];
  error?: string;
};

/**
 * Builds an Encounter identifier from PV1-19 (Visit Number).
 * Enforces HL7 v2.8.2 CX authority requirements.
 */
export function buildEncounterIdentifier(
  visitNumber: CX | undefined,
): EncounterIdentifierResult {
  if (!visitNumber) {
    return {
      error: "PV1-19 (Visit Number) is required but missing",
    };
  }

  const value = visitNumber.$1_value?.trim();
  if (!value) {
    return {
      error: "PV1-19 (Visit Number) value is required but missing",
    };
  }

  // Extract authority from CX.4, CX.9, CX.10
  const cx4Authority = extractHDAuthority(visitNumber.$4_system);
  const cx9Authority = extractCWEAuthority(visitNumber.$9_jurisdiction);
  const cx10Authority = extractCWEAuthority(visitNumber.$10_department);

  const authorities = [cx4Authority, cx9Authority, cx10Authority].filter(
    (a): a is string => a !== null,
  );

  if (authorities.length === 0) {
    return {
      error:
        "PV1-19 authority is required: CX.4, CX.9, or CX.10 must be populated (HL7 v2.8.2)",
    };
  }

  // Check for conflicts
  const uniqueAuthorities = [...new Set(authorities)];
  if (uniqueAuthorities.length > 1) {
    return {
      error:
        "PV1-19 has conflicting authority values in CX.4/9/10; Message Profile required to resolve precedence",
    };
  }

  const system = uniqueAuthorities[0];

  return {
    identifier: [
      {
        system,
        value,
        type: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0203",
              code: "VN",
              display: "Visit Number",
            },
          ],
        },
      },
    ],
  };
}

/**
 * Extracts authority string from HD (Hierarchic Designator) type.
 * Returns null if empty/whitespace.
 */
function extractHDAuthority(hd: HD | undefined): string | null {
  if (!hd) return null;

  // Prefer Universal ID (HD.2), fall back to Namespace ID (HD.1)
  const value = hd.$2_system?.trim() || hd.$1_namespace?.trim();
  return value || null;
}

/**
 * Extracts authority string from CWE (Coded with Exceptions) type.
 * Returns null if empty/whitespace.
 */
function extractCWEAuthority(cwe: CWE | undefined): string | null {
  if (!cwe) return null;

  // Use coding system (CWE.3) if available, otherwise use code (CWE.1)
  const value = cwe.$3_system?.trim() || cwe.$1_code?.trim();
  return value || null;
}

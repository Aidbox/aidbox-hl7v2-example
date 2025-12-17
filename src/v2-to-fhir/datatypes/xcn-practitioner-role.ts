/**
 * HL7v2 XCN to FHIR PractitionerRole Mapping
 * Based on: HL7 Data Type - FHIR R4_ XCN[PractitionerRole]
 *
 * Note: PractitionerRole requires a reference to a Practitioner resource.
 * This converter creates the PractitionerRole structure with identifier from XCN.1.
 * The practitioner reference should be populated separately once the Practitioner resource is created.
 */

import type { XCN } from "../../hl7v2/generated/fields";
import type { PractitionerRole, Identifier, Extension } from "../../fhir/hl7-fhir-r4-core";
import { convertHDToUri } from "./hd-converters";

// ============================================================================
// Extension URLs
// ============================================================================

const CHECK_DIGIT_URL = "http://hl7.org/fhir/StructureDefinition/identifier-checkDigit";
const CHECK_DIGIT_SCHEME_URL = "http://hl7.org/fhir/StructureDefinition/namingsystem-checkDigit";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build identifier from XCN fields
 */
function buildIdentifier(xcn: XCN): Identifier | undefined {
  if (!xcn.$1_value) return undefined;

  const identifier: Identifier = {
    value: xcn.$1_value,
  };

  // XCN.9: Assigning Authority -> system
  const system = convertHDToUri(xcn.$9_system);
  if (system) {
    identifier.system = system;
  }

  // XCN.13: Identifier Type Code -> type
  if (xcn.$13_type) {
    identifier.type = {
      coding: [{ code: xcn.$13_type }],
    };
  }

  // Build extensions for check digit
  const extensions: Extension[] = [];

  // XCN.11: Check Digit
  if (xcn.$11_checkDigit) {
    extensions.push({
      url: CHECK_DIGIT_URL,
      valueString: xcn.$11_checkDigit,
    });
  }

  // XCN.12: Check Digit Scheme
  if (xcn.$12_checkDigitScheme) {
    extensions.push({
      url: CHECK_DIGIT_SCHEME_URL,
      valueString: xcn.$12_checkDigitScheme,
    });
  }

  if (extensions.length > 0) {
    identifier.extension = extensions;
  }

  return identifier;
}

// ============================================================================
// Main Converter Function
// ============================================================================

/**
 * Convert HL7v2 XCN (Extended Composite ID Number and Name for Persons) to FHIR PractitionerRole
 *
 * Creates a PractitionerRole with identifier from XCN.1 and assigning authority from XCN.9.
 * The practitioner reference should be populated separately once the Practitioner resource is created.
 *
 * Mapping:
 * - XCN.1          -> identifier.value
 * - XCN.9          -> identifier.system (via HD[uri])
 * - XCN.11         -> identifier.extension (checkDigit)
 * - XCN.12         -> identifier.extension (checkDigitScheme)
 * - XCN.13         -> identifier.type.coding.code
 *
 * Note: Name data (XCN.2-6, XCN.10, XCN.17-21) should be mapped to the referenced Practitioner resource.
 */
export function convertXCNToPractitionerRole(
  xcn: XCN | undefined
): PractitionerRole | undefined {
  if (!xcn) return undefined;

  const identifier = buildIdentifier(xcn);

  if (!identifier) return undefined;

  return {
    resourceType: "PractitionerRole",
    identifier: [identifier],
  };
}

/**
 * Convert array of XCN to array of PractitionerRole
 */
export function convertXCNArrayToPractitionerRoles(
  xcns: XCN[] | undefined
): PractitionerRole[] | undefined {
  if (!xcns || xcns.length === 0) return undefined;

  const roles: PractitionerRole[] = [];

  for (const xcn of xcns) {
    const role = convertXCNToPractitionerRole(xcn);
    if (role) roles.push(role);
  }

  return roles.length > 0 ? roles : undefined;
}

export default convertXCNToPractitionerRole;

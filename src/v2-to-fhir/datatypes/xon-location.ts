/**
 * HL7v2 XON to FHIR Location Mapping
 * Based on: HL7 Data Type - FHIR R4_ XON[Location]
 */

import type { XON } from "../../hl7v2/generated/fields";
import type { Location, Identifier, Extension, Coding } from "../../fhir/hl7-fhir-r4-core";
import { convertHDToUri } from "./hd-converters";

// ============================================================================
// Extension URLs
// ============================================================================

const CHECK_DIGIT_URL = "http://hl7.org/fhir/StructureDefinition/identifier-checkDigit";
const CHECK_DIGIT_SCHEME_URL = "http://hl7.org/fhir/StructureDefinition/namingsystem-checkDigit";
const LOCATION_NAME_TYPE_URL = "http://hl7.org/fhir/StructureDefinition/location-nameType";
const IDENTIFIER_TYPE_SYSTEM = "http://terminology.hl7.org/CodeSystem/v2-0203";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build identifier from XON fields
 */
function buildIdentifier(xon: XON): Identifier | undefined {
  // XON.10 takes precedence over XON.3
  const value = xon.$10_organizationId || xon.$3_value;

  if (!value) return undefined;

  const identifier: Identifier = {
    value,
  };

  // XON.6: Assigning Authority -> system
  const system = convertHDToUri(xon.$6_system);
  if (system) {
    identifier.system = system;
  }

  // XON.7: Identifier Type Code -> type
  if (xon.$7_type) {
    identifier.type = {
      coding: [
        {
          system: IDENTIFIER_TYPE_SYSTEM,
          code: xon.$7_type,
        },
      ],
    };
  }

  // Build extensions for check digit
  const extensions: Extension[] = [];

  // XON.4: Check Digit
  if (xon.$4_checkDigit) {
    extensions.push({
      url: CHECK_DIGIT_URL,
      valueString: xon.$4_checkDigit,
    });
  }

  // XON.5: Check Digit Scheme
  if (xon.$5_checkDigitScheme) {
    extensions.push({
      url: CHECK_DIGIT_SCHEME_URL,
      valueString: xon.$5_checkDigitScheme,
    });
  }

  if (extensions.length > 0) {
    identifier.extension = extensions;
  }

  return identifier;
}

/**
 * Build location extensions from XON.2 (Name Type Code)
 */
function buildExtensions(xon: XON): Extension[] | undefined {
  if (!xon.$2_nameType) return undefined;

  return [
    {
      url: LOCATION_NAME_TYPE_URL,
      valueCoding: {
        code: xon.$2_nameType,
      } as Coding,
    },
  ];
}

// ============================================================================
// Main Converter Function
// ============================================================================

/**
 * Convert HL7v2 XON (Extended Composite Name and Identification Number for Organizations) to FHIR Location
 *
 * Mapping:
 * - XON.1          -> name
 * - XON.2          -> extension (location name type)
 * - XON.3          -> identifier.value (if XON.10 not valued)
 * - XON.4          -> identifier.extension (checkDigit)
 * - XON.5          -> identifier.extension (checkDigitScheme)
 * - XON.6          -> identifier.system (via HD[uri])
 * - XON.7          -> identifier.type.coding.code
 * - XON.10         -> identifier.value
 */
export function convertXONToLocation(xon: XON | undefined): Location | undefined {
  if (!xon) return undefined;

  const identifier = buildIdentifier(xon);

  // Need at least name or identifier
  if (!xon.$1_name && !identifier) return undefined;

  const extension = buildExtensions(xon);

  return {
    resourceType: "Location",
    ...(xon.$1_name && { name: xon.$1_name }),
    ...(identifier && { identifier: [identifier] }),
    ...(extension && { extension }),
  };
}

/**
 * Convert array of XON to array of Location
 */
export function convertXONArrayToLocations(
  xons: XON[] | undefined
): Location[] | undefined {
  if (!xons || xons.length === 0) return undefined;

  const locations: Location[] = [];

  for (const xon of xons) {
    const location = convertXONToLocation(xon);
    if (location) locations.push(location);
  }

  return locations.length > 0 ? locations : undefined;
}

export default convertXONToLocation;

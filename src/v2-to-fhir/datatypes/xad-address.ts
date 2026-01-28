/**
 * HL7v2 XAD to FHIR Address Mapping
 * Based on: HL7 Data Type - FHIR R4_ XAD[Address]
 */

import type { XAD } from "../../hl7v2/generated/fields";
import type { Address, Extension, Period } from "../../fhir/hl7-fhir-r4-core";
import { convertSADToAddress } from "./sad-address";
import { convertDRToPeriod } from "./dr-datetime";
import type { MappingError } from "../../code-mapping/mapping-errors";

// ============================================================================
// Address Type Code Mappings (HL7 Table 0190)
// ============================================================================

const ADDRESS_TYPE_MAP: Record<string, Address["type"]> = {
  M: "postal",   // Mailing
  SH: "postal",  // Shipping
};

const ADDRESS_USE_MAP: Record<string, Address["use"]> = {
  BA: "billing",  // Bad address
  BI: "billing",  // Billing Address
  C: "temp",      // Current Or Temporary
  B: "work",      // Firm/Business
  H: "home",      // Home
  O: "work",      // Office/Business
};

// ============================================================================
// Code System for HL7 Table 0190 (Address Type)
// ============================================================================

const ADDRESS_TYPE_V2_SYSTEM = "http://terminology.hl7.org/CodeSystem/v2-0190";

// ============================================================================
// Extension URLs
// ============================================================================

const ISO_AD_USE_URL = "http://hl7.org/fhir/StructureDefinition/iso21090-AD-use";
const ADDRESS_TYPE_URL = "http://terminology.hl7.org/CodeSystem/v2-0190";
const CENSUS_TRACT_URL = "http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-censusTract";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build period from XAD.12, XAD.13, XAD.14
 * XAD.13/14 take precedence over XAD.12
 */
function buildPeriod(xad: XAD): Period | undefined {
  const hasExplicitDates = xad.$13_start || xad.$14_end;

  if (hasExplicitDates) {
    const period: Period = {};
    if (xad.$13_start) period.start = xad.$13_start;
    if (xad.$14_end) period.end = xad.$14_end;
    return period;
  }

  return convertDRToPeriod(xad.$12_period);
}

/**
 * Build extensions from XAD.7 (Address Type) and XAD.10 (Census Tract)
 */
function buildExtensions(xad: XAD): Extension[] | undefined {
  const extensions: Extension[] = [];

  // XAD.7 = HV -> iso21090-AD-use extension
  if (xad.$7_type?.toUpperCase() === "HV") {
    extensions.push({
      url: ISO_AD_USE_URL,
      valueCode: "HV",
    });
  }

  // XAD.7 -> address type extension (for all values)
  if (xad.$7_type) {
    extensions.push({
      url: ADDRESS_TYPE_URL,
      valueCodeableConcept: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0190",
            code: xad.$7_type,
          },
        ],
      },
    });
  }

  // XAD.10 -> Census Tract extension
  if (xad.$10_censusTract) {
    extensions.push({
      url: CENSUS_TRACT_URL,
      valueString: xad.$10_censusTract,
    });
  }

  return extensions.length > 0 ? extensions : undefined;
}

// ============================================================================
// Address Type Mapping with Error Support
// ============================================================================

/**
 * Result type for XAD.7 Address Type mapping.
 * Returns either valid FHIR type/use values or a mapping error.
 */
export type AddressTypeResult =
  | {
      type?: Address["type"];
      use?: Address["use"];
      error?: never;
    }
  | { type?: never; use?: never; error: MappingError };

/**
 * Map XAD.7 Address Type to FHIR Address.type and Address.use.
 * Returns a result object instead of throwing, allowing collection of mapping errors.
 *
 * When the address type is not in the standard mapping tables (ADDRESS_TYPE_MAP,
 * ADDRESS_USE_MAP), returns a mapping error that can be used to create a Task
 * for manual resolution.
 *
 * Known address types that map to FHIR:
 * - Type mappings: M -> postal, SH -> postal
 * - Use mappings: BA -> billing, BI -> billing, C -> temp, B -> work, H -> home, O -> work
 * - Special: HV -> extension only (no type/use, handled separately)
 *
 * @param addressType - The XAD.7 Address Type value
 */
export function mapAddressTypeToFHIRWithResult(
  addressType: string | undefined,
): AddressTypeResult {
  // No address type provided - this is valid (address without type)
  if (!addressType) {
    return {};
  }

  const normalizedCode = addressType.toUpperCase();

  // Check if it maps to type
  const type = ADDRESS_TYPE_MAP[normalizedCode];
  if (type) {
    return { type };
  }

  // Check if it maps to use
  const use = ADDRESS_USE_MAP[normalizedCode];
  if (use) {
    return { use };
  }

  // HV is a special case - it only creates an extension, not type/use
  // This is valid and not a mapping error
  if (normalizedCode === "HV") {
    return {};
  }

  // Unknown address type - return mapping error
  return {
    error: {
      localCode: normalizedCode,
      localDisplay: `XAD.7 Address Type: ${addressType}`,
      localSystem: ADDRESS_TYPE_V2_SYSTEM,
      mappingType: "address-type",
    },
  };
}

// ============================================================================
// Main Converter Function
// ============================================================================

/**
 * Convert HL7v2 XAD (Extended Address) to FHIR Address
 *
 * Mapping:
 * - XAD.1 (SAD)        -> line[0-2] via SAD[Address]
 * - XAD.2              -> line[3]
 * - XAD.3              -> city
 * - XAD.4              -> state
 * - XAD.5              -> postalCode
 * - XAD.6              -> country
 * - XAD.7              -> type (M,SH) or use (BA,BI,C,B,H,O) + extensions
 * - XAD.9              -> district
 * - XAD.10             -> extension (census tract)
 * - XAD.12/13/14       -> period
 * - XAD.19             -> line[4]
 */
export function convertXADToAddress(xad: XAD | undefined): Address | undefined {
  if (!xad) return undefined;

  // Build address lines
  const line: string[] = [];

  // XAD.1: SAD -> lines 0-2
  const sadAddress = convertSADToAddress(xad.$1_line1);
  if (sadAddress?.line) {
    line.push(...sadAddress.line);
  }

  // XAD.2: Other Designation -> line[3]
  if (xad.$2_line2) {
    line.push(xad.$2_line2);
  }

  // XAD.19: Addressee -> line[4] (Note: XAD interface may not have this field)
  // The generated type doesn't include XAD.19, so we skip it

  // Check if we have any data
  const hasData =
    line.length > 0 ||
    xad.$3_city ||
    xad.$4_state ||
    xad.$5_postalCode ||
    xad.$6_country ||
    xad.$9_district;

  if (!hasData) return undefined;

  // XAD.7: Address Type -> type or use
  const addressTypeCode = xad.$7_type?.toUpperCase();
  const type = addressTypeCode ? ADDRESS_TYPE_MAP[addressTypeCode] : undefined;
  const use = addressTypeCode ? ADDRESS_USE_MAP[addressTypeCode] : undefined;

  // Build period
  const period = buildPeriod(xad);

  // Build extensions
  const extension = buildExtensions(xad);

  return {
    ...(line.length > 0 && { line }),
    ...(xad.$3_city && { city: xad.$3_city }),
    ...(xad.$4_state && { state: xad.$4_state }),
    ...(xad.$5_postalCode && { postalCode: xad.$5_postalCode }),
    ...(xad.$6_country && { country: xad.$6_country }),
    ...(xad.$9_district && { district: xad.$9_district }),
    ...(type && { type }),
    ...(use && { use }),
    ...(period && { period }),
    ...(extension && { extension }),
  };
}

/**
 * Convert array of XAD to array of Address
 */
export function convertXADArrayToAddresses(
  xads: XAD[] | undefined
): Address[] | undefined {
  if (!xads || xads.length === 0) return undefined;

  const addresses: Address[] = [];

  for (const xad of xads) {
    const address = convertXADToAddress(xad);
    if (address) addresses.push(address);
  }

  return addresses.length > 0 ? addresses : undefined;
}

// ============================================================================
// XAD Conversion with Mapping Support
// ============================================================================

/**
 * Result type for XAD conversion with mapping support.
 * Returns an Address (possibly with unknown type removed) plus any mapping error.
 * Unlike other converters, address conversion does NOT fail on mapping errors -
 * we still return the address but without the invalid type/use, and collect the error.
 */
export interface XADConversionResult {
  address: Address | undefined;
  error?: MappingError;
}

/**
 * Convert XAD to Address with mapping error support.
 *
 * This version:
 * 1. Converts all standard XAD fields to Address
 * 2. Attempts to map XAD.7 address type to FHIR type/use
 * 3. If mapping fails, still returns address (without type/use) but includes error
 *
 * Use this function when you want to collect mapping errors for Task creation
 * while still producing a usable Address resource.
 */
export function convertXADWithMappingSupport(
  xad: XAD | undefined,
): XADConversionResult {
  if (!xad) {
    return { address: undefined };
  }

  // Build address lines
  const line: string[] = [];

  // XAD.1: SAD -> lines 0-2
  const sadAddress = convertSADToAddress(xad.$1_line1);
  if (sadAddress?.line) {
    line.push(...sadAddress.line);
  }

  // XAD.2: Other Designation -> line[3]
  if (xad.$2_line2) {
    line.push(xad.$2_line2);
  }

  // Check if we have any data
  const hasData =
    line.length > 0 ||
    xad.$3_city ||
    xad.$4_state ||
    xad.$5_postalCode ||
    xad.$6_country ||
    xad.$9_district;

  if (!hasData) {
    return { address: undefined };
  }

  // XAD.7: Address Type -> type or use (with error support)
  const typeResult = mapAddressTypeToFHIRWithResult(xad.$7_type);

  // Build period
  const period = buildPeriod(xad);

  // Build extensions
  const extension = buildExtensions(xad);

  const address: Address = {
    ...(line.length > 0 && { line }),
    ...(xad.$3_city && { city: xad.$3_city }),
    ...(xad.$4_state && { state: xad.$4_state }),
    ...(xad.$5_postalCode && { postalCode: xad.$5_postalCode }),
    ...(xad.$6_country && { country: xad.$6_country }),
    ...(xad.$9_district && { district: xad.$9_district }),
    ...(typeResult.type && { type: typeResult.type }),
    ...(typeResult.use && { use: typeResult.use }),
    ...(period && { period }),
    ...(extension && { extension }),
  };

  return {
    address,
    error: typeResult.error,
  };
}

/**
 * Result type for array XAD conversion with mapping support.
 */
export interface XADArrayConversionResult {
  addresses: Address[] | undefined;
  errors: MappingError[];
}

/**
 * Convert array of XAD to array of Address with mapping error support.
 *
 * Collects all mapping errors from all addresses. Errors are deduplicated by
 * localCode since the same invalid address type appearing multiple times
 * should only create one Task.
 */
export function convertXADArrayWithMappingSupport(
  xads: XAD[] | undefined,
): XADArrayConversionResult {
  if (!xads || xads.length === 0) {
    return { addresses: undefined, errors: [] };
  }

  const addresses: Address[] = [];
  const errors: MappingError[] = [];
  const seenErrorCodes = new Set<string>();

  for (const xad of xads) {
    const result = convertXADWithMappingSupport(xad);

    if (result.address) {
      addresses.push(result.address);
    }

    // Collect unique errors (deduplicate by localCode)
    if (result.error && !seenErrorCodes.has(result.error.localCode)) {
      seenErrorCodes.add(result.error.localCode);
      errors.push(result.error);
    }
  }

  return {
    addresses: addresses.length > 0 ? addresses : undefined,
    errors,
  };
}

export default convertXADToAddress;

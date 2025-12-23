import type { HD } from "../../hl7v2/generated/fields";
import type { Reference, Period } from "../../fhir/hl7-fhir-r4-core";
import { convertCNNToPractitioner, type CNN } from "./cnn-practitioner";
import { convertHDToIdentifiers } from "./hd-converters";

const LOCATION_PHYSICAL_TYPE_SYSTEM = "http://terminology.hl7.org/CodeSystem/location-physical-type";

/** NDL (Name with Date and Location) datatype */
export interface NDL {
  /** NDL.1 - Name */
  $1_name?: CNN;
  /** NDL.2 - Start Date/time */
  $2_startDateTime?: string;
  /** NDL.3 - End Date/time */
  $3_endDateTime?: string;
  /** NDL.4 - Point of Care */
  $4_pointOfCare?: string;
  /** NDL.5 - Room */
  $5_room?: string;
  /** NDL.6 - Bed */
  $6_bed?: string;
  /** NDL.7 - Facility */
  $7_facility?: HD;
  /** NDL.8 - Location Status */
  $8_locationStatus?: string;
  /** NDL.9 - Patient Location Type */
  $9_patientLocationType?: string;
  /** NDL.10 - Building */
  $10_building?: string;
  /** NDL.11 - Floor */
  $11_floor?: string;
}

/** Partial Location data for NDL */
export interface NDLLocationData {
  identifier?: { value: string }[];
  mode?: "instance" | "kind";
  physicalType?: {
    coding: { system: string; code: string }[];
  };
  status?: string;
}

/** PractitionerRole data from NDL */
export interface NDLPractitionerRoleData {
  /** Reference to Practitioner (from NDL.1) */
  practitioner?: Reference;
  /** Period (from NDL.2-3) */
  period?: Period;
  /** Location hierarchy */
  locations?: NDLLocationData[];
}

/**
 * Creates a physical type CodeableConcept.
 */
function createPhysicalType(code: string) {
  return {
    coding: [
      {
        system: LOCATION_PHYSICAL_TYPE_SYSTEM,
        code,
      },
    ],
  };
}

/**
 * Converts NDL (Name with Date and Location) to PractitionerRole data.
 *
 * Mapping:
 * - NDL.1 (Name) -> practitioner reference (via CNN[Practitioner])
 * - NDL.2 (Start Date/time) -> period.start
 * - NDL.3 (End Date/time) -> period.end
 * - NDL.4-11 -> locations array with physical types
 *
 * Note: The actual Practitioner resource must be created separately from NDL.1.
 */
export function convertNDLToPractitionerRole(ndl: NDL | undefined): NDLPractitionerRoleData | undefined {
  if (!ndl) return undefined;

  const result: NDLPractitionerRoleData = {};

  // Convert name to practitioner reference indicator
  // Note: In actual use, the Practitioner would need to be created first
  if (ndl.$1_name) {
    const practitioner = convertCNNToPractitioner(ndl.$1_name);
    if (practitioner) {
      // Mark that there's a practitioner reference (actual reference would be set by caller)
      result.practitioner = {} as Reference;
    }
  }

  // Set period from start/end dates
  if (ndl.$2_startDateTime || ndl.$3_endDateTime) {
    result.period = {};
    if (ndl.$2_startDateTime) {
      result.period.start = ndl.$2_startDateTime;
    }
    if (ndl.$3_endDateTime) {
      result.period.end = ndl.$3_endDateTime;
    }
  }

  // Build locations array
  const locations: NDLLocationData[] = [];

  // Point of Care
  if (ndl.$4_pointOfCare) {
    const loc: NDLLocationData = {
      identifier: [{ value: ndl.$4_pointOfCare }],
      mode: "instance",
      physicalType: createPhysicalType("poc"),
    };
    if (ndl.$8_locationStatus) loc.status = ndl.$8_locationStatus;
    locations.push(loc);
  }

  // Room
  if (ndl.$5_room) {
    const loc: NDLLocationData = {
      identifier: [{ value: ndl.$5_room }],
      mode: "instance",
      physicalType: createPhysicalType("ro"),
    };
    if (ndl.$8_locationStatus) loc.status = ndl.$8_locationStatus;
    locations.push(loc);
  }

  // Bed
  if (ndl.$6_bed) {
    const loc: NDLLocationData = {
      identifier: [{ value: ndl.$6_bed }],
      mode: "instance",
      physicalType: createPhysicalType("bd"),
    };
    if (ndl.$8_locationStatus) loc.status = ndl.$8_locationStatus;
    locations.push(loc);
  }

  // Facility (from HD)
  if (ndl.$7_facility) {
    const identifiers = convertHDToIdentifiers(ndl.$7_facility);
    if (identifiers && identifiers.length > 0) {
      const loc: NDLLocationData = {
        identifier: identifiers.map((id) => ({ value: id.value || "" })),
        mode: "instance",
        physicalType: createPhysicalType("si"),
      };
      if (ndl.$8_locationStatus) loc.status = ndl.$8_locationStatus;
      locations.push(loc);
    }
  }

  // Building
  if (ndl.$10_building) {
    const loc: NDLLocationData = {
      identifier: [{ value: ndl.$10_building }],
      mode: "instance",
      physicalType: createPhysicalType("bu"),
    };
    if (ndl.$8_locationStatus) loc.status = ndl.$8_locationStatus;
    locations.push(loc);
  }

  // Floor
  if (ndl.$11_floor) {
    const loc: NDLLocationData = {
      identifier: [{ value: ndl.$11_floor }],
      mode: "instance",
      physicalType: createPhysicalType("lvl"),
    };
    if (ndl.$8_locationStatus) loc.status = ndl.$8_locationStatus;
    locations.push(loc);
  }

  if (locations.length > 0) {
    result.locations = locations;
  }

  // Return undefined if nothing was converted
  if (!result.practitioner && !result.period && !result.locations) {
    return undefined;
  }

  return result;
}

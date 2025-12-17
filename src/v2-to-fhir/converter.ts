/**
 * HL7v2 to FHIR Converter
 * Converts HL7v2 messages (ADT^A08) to FHIR Transaction Bundle
 */

import { parseMessage } from "@atomic-ehr/hl7v2";
import type { HL7v2Message, HL7v2Segment } from "../hl7v2/generated/types";
import {
  fromMSH,
  fromPID,
  type MSH,
  type PID,
  type CX,
  type XPN,
  type XAD,
  type XTN,
  type CE,
} from "../hl7v2/generated/fields";
import type {
  Patient,
  Identifier,
  HumanName,
  Address,
  ContactPoint,
  CodeableConcept,
  Coding,
  Meta,
} from "../fhir/hl7-fhir-r4-core";

// ============================================================================
// Types
// ============================================================================

export interface Bundle {
  resourceType: "Bundle";
  type: "transaction";
  entry: BundleEntry[];
}

export interface BundleEntry {
  resource: Patient;
  request: {
    method: "PUT";
    url: string;
  };
}

// ============================================================================
// Code Systems
// ============================================================================

const IDENTIFIER_TYPE_SYSTEM = "http://terminology.hl7.org/CodeSystem/v2-0203";
const MARITAL_STATUS_SYSTEM = "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus";
const LANGUAGE_SYSTEM = "urn:ietf:bcp:47";

const IDENTIFIER_TYPES: Record<string, { code: string; display: string; text: string }> = {
  MR: { code: "MR", display: "Medical record number", text: "Medical record number" },
  SS: { code: "SS", display: "Social Security number", text: "Social Security number" },
  PE: { code: "PE", display: "Living Subject Enterprise Number", text: "Living Subject Enterprise Number" },
  PI: { code: "PI", display: "Patient internal identifier", text: "Patient internal identifier" },
};

// ============================================================================
// Helper Functions
// ============================================================================

function findSegment(message: HL7v2Message, name: string): HL7v2Segment | undefined {
  return message.find(s => s.segment === name);
}

function mapGender(gender: string | undefined): Patient["gender"] {
  switch (gender?.toUpperCase()) {
    case "M": return "male";
    case "F": return "female";
    case "O": return "other";
    case "U": return "unknown";
    default: return undefined;
  }
}

function capitalizeFirst(str: string | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ============================================================================
// Datatype Converters
// ============================================================================

function convertCXToIdentifier(cx: CX | undefined, typeOverride?: string): Identifier | undefined {
  if (!cx?.$1_value) return undefined;

  const typeCode = typeOverride || cx.$5_type || "MR";
  const typeInfo = IDENTIFIER_TYPES[typeCode];

  const identifier: Identifier = {
    value: cx.$1_value,
  };

  if (typeInfo) {
    identifier.type = {
      text: typeInfo.text,
      coding: [{
        code: typeInfo.code,
        system: IDENTIFIER_TYPE_SYSTEM,
        display: typeInfo.display,
      }],
    };
  }

  if (cx.$4_system?.$1_namespace) {
    identifier.system = typeCode;
    identifier.assigner = {
      identifier: { value: cx.$4_system.$1_namespace },
    };
  }

  return identifier;
}

function convertXPNToHumanName(xpn: XPN | undefined): HumanName | undefined {
  if (!xpn) return undefined;

  const family = xpn.$1_family?.$1_family;
  const given = xpn.$2_given;
  const middle = xpn.$3_additionalGiven;

  if (!family && !given) return undefined;

  const givenNames: string[] = [];
  if (given) givenNames.push(capitalizeFirst(given));
  if (middle) givenNames.push(capitalizeFirst(middle));

  const textParts: string[] = [];
  if (givenNames.length > 0) textParts.push(...givenNames);
  if (family) textParts.push(capitalizeFirst(family));

  return {
    family: capitalizeFirst(family),
    given: givenNames.length > 0 ? givenNames : undefined,
    text: textParts.join(" ") || undefined,
  };
}

function convertXADToAddress(xad: XAD | undefined): Address | undefined {
  if (!xad) return undefined;

  const line1 = xad.$1_line1?.$1_line;
  const city = xad.$3_city;
  const state = xad.$4_state;
  const postalCode = xad.$5_postalCode;
  const country = xad.$6_country;

  if (!line1 && !city) return undefined;

  const textParts: string[] = [];
  if (line1) textParts.push(line1);
  if (city) textParts.push(city);
  if (state) textParts.push(state);
  if (postalCode) textParts.push(postalCode);
  if (country) textParts.push(country);

  return {
    line: line1 ? [line1] : undefined,
    city,
    state,
    postalCode,
    country,
    text: textParts.join(", ") || undefined,
  };
}

function convertXTNToContactPoint(xtn: XTN | undefined): ContactPoint | undefined {
  if (!xtn) return undefined;

  const value = xtn.$1_value;
  if (!value) return undefined;

  const useCode = xtn.$2_use;
  let use: ContactPoint["use"];
  switch (useCode?.toUpperCase()) {
    case "PRN": use = "home"; break;
    case "WPN": use = "work"; break;
    case "ORN": use = "old"; break;
    default: use = "home";
  }

  const equipmentType = xtn.$3_system;
  let system: ContactPoint["system"] = "phone";
  switch (equipmentType?.toUpperCase()) {
    case "PH": system = "phone"; break;
    case "FX": system = "fax"; break;
    case "Internet": system = "email"; break;
    default: system = "phone";
  }

  return {
    value,
    system,
    use,
  };
}

// ============================================================================
// Segment Converters
// ============================================================================

function extractMetaTags(msh: MSH): Coding[] {
  const tags: Coding[] = [];

  // Message Control ID
  if (msh.$10_messageControlId) {
    tags.push({
      code: msh.$10_messageControlId,
      system: "urn:aidbox:hl7v2:message-id",
    });
  }

  // Message Type (ADT^A08 -> ADT_A08)
  if (msh.$9_messageType) {
    const code = msh.$9_messageType.$1_code;
    const event = msh.$9_messageType.$2_event;
    if (code && event) {
      tags.push({
        code: `${code}_${event}`,
        system: "urn:aidbox:hl7v2:message-type",
      });
    }
  }

  return tags;
}

function convertPIDToPatient(pid: PID, meta: Meta): Patient {
  const patient: Patient = {
    resourceType: "Patient",
    meta,
  };

  // PID-2: Patient ID (PE identifier) -> Patient.id
  if (pid.$2_patientId?.$1_value) {
    patient.id = pid.$2_patientId.$1_value;
  }

  // Collect identifiers
  const identifiers: Identifier[] = [];

  // PID-3: Patient Identifier List (MR, etc.)
  if (pid.$3_identifier) {
    for (const cx of pid.$3_identifier) {
      const identifier = convertCXToIdentifier(cx);
      if (identifier) {
        identifiers.push(identifier);

        // Add sender tag from MR identifier's assigning authority
        if (cx.$5_type === "MR" && cx.$4_system?.$1_namespace) {
          const senderTag: Coding = {
            code: cx.$4_system.$1_namespace.toLowerCase(),
            system: "urn:aidbox:hl7v2:sender",
          };
          if (!meta.tag?.some(t => t.system === senderTag.system)) {
            meta.tag?.push(senderTag);
          }
        }
      }
    }
  }

  // PID-19: SSN
  if (pid.$19_ssnNumberPatient) {
    identifiers.push({
      value: pid.$19_ssnNumberPatient,
      type: {
        text: IDENTIFIER_TYPES.SS.text,
        coding: [{
          code: IDENTIFIER_TYPES.SS.code,
          system: IDENTIFIER_TYPE_SYSTEM,
          display: IDENTIFIER_TYPES.SS.display,
        }],
      },
    });
  }

  // PID-2 as PE identifier
  if (pid.$2_patientId) {
    const peIdentifier = convertCXToIdentifier(pid.$2_patientId, "PE");
    if (peIdentifier) {
      identifiers.push(peIdentifier);
    }
  }

  if (identifiers.length > 0) {
    patient.identifier = identifiers;
  }

  // PID-5: Patient Name
  if (pid.$5_name && pid.$5_name.length > 0) {
    const names: HumanName[] = [];
    for (const xpn of pid.$5_name) {
      const name = convertXPNToHumanName(xpn);
      if (name) names.push(name);
    }
    if (names.length > 0) {
      patient.name = names;
    }
  }

  // PID-8: Gender
  patient.gender = mapGender(pid.$8_gender);

  // PID-11: Address
  if (pid.$11_address && pid.$11_address.length > 0) {
    const addresses: Address[] = [];
    for (const xad of pid.$11_address) {
      const address = convertXADToAddress(xad);
      if (address) addresses.push(address);
    }
    if (addresses.length > 0) {
      patient.address = addresses;
    }
  }

  // PID-13: Home Phone
  if (pid.$13_homePhone && pid.$13_homePhone.length > 0) {
    const telecoms: ContactPoint[] = [];
    for (const xtn of pid.$13_homePhone) {
      const telecom = convertXTNToContactPoint(xtn);
      if (telecom) telecoms.push(telecom);
    }
    if (telecoms.length > 0) {
      patient.telecom = telecoms;
    }
  }

  // PID-15: Primary Language -> communication
  if (pid.$15_language) {
    const langCode = pid.$15_language.$1_code;
    const langText = pid.$15_language.$2_text;
    if (langCode || langText) {
      patient.communication = [{
        language: {
          coding: [{
            code: langCode || langText,
            system: LANGUAGE_SYSTEM,
            display: langText || langCode,
          }],
          text: langText || langCode,
        },
        preferred: true,
      }];
    }
  }

  // PID-16: Marital Status
  if (pid.$16_maritalStatus?.$1_code) {
    patient.maritalStatus = {
      coding: [{
        code: pid.$16_maritalStatus.$1_code,
        system: MARITAL_STATUS_SYSTEM,
      }],
    };
  }

  return patient;
}

// ============================================================================
// Main Converter Function
// ============================================================================

/**
 * Convert HL7v2 message to FHIR Transaction Bundle
 */
export function convertToFHIR(message: string): Bundle {
  // Parse HL7v2 message
  const parsed = parseMessage(message);

  // Extract MSH segment
  const mshSegment = findSegment(parsed, "MSH");
  if (!mshSegment) {
    throw new Error("MSH segment not found");
  }
  const msh = fromMSH(mshSegment);

  // Extract PID segment
  const pidSegment = findSegment(parsed, "PID");
  if (!pidSegment) {
    throw new Error("PID segment not found");
  }
  const pid = fromPID(pidSegment);

  // Create meta with tags
  const meta: Meta = {
    tag: extractMetaTags(msh),
  };

  // Convert PID to Patient
  const patient = convertPIDToPatient(pid, meta);

  if (!patient.id) {
    throw new Error("Patient ID (from PID-2) is required");
  }

  // Create Bundle with single PUT entry
  const entries: BundleEntry[] = [
    {
      resource: patient,
      request: {
        method: "PUT",
        url: `/Patient/${patient.id}`,
      },
    },
  ];

  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };
}

export default convertToFHIR;

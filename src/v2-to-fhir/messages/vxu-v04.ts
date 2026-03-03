/**
 * DESIGN PROTOTYPE: 2026-02-23-vxu-design-final.md
 *
 * HL7v2 VXU_V04 Message to FHIR Bundle Converter
 *
 * VXU_V04 - Unsolicited Vaccination Record Update
 *
 * Creates:
 * - Immunization from each ORDER group (ORC + RXA + RXR)
 * - Practitioner[] from RXA-10 (AP) and ORC-12 (OP)
 * - Observation[] from PERSON_OBSERVATION OBX (patient-level)
 * - Patient (draft if not found)
 * - Encounter from PV1 (optional, config-driven)
 *
 * Conversion flow:
 * 1. Parse MSH, PID, PV1 (reuse ORU patterns)
 * 2. Extract PERSON_OBSERVATION OBX -> standalone Observations
 * 3. Group ORDER segments (ORC+RXA+RXR+OBX)
 * 4. Convert each ORDER -> Immunization:
 *    a. RXA -> base Immunization fields
 *    b. RXR -> route
 *    c. ORDER OBX -> CDC IIS fields (applyOrderOBXFields)
 *    d. RXA-9 -> primarySource/reportOrigin (interpretRXA9Source)
 * 5. Build transaction bundle
 */

import type { HL7v2Message, HL7v2Segment } from "../../hl7v2/generated/types";
import { findSegment, findAllSegments, type ConversionResult } from "../converter";
import {
  fromMSH,
  fromPID,
  fromPV1,
  fromORC,
  type MSH,
  type PID,
  type PV1,
  type ORC,
  type OBX,
  type RXA,
  type RXR,
  type EI,
} from "../../hl7v2/generated/fields";
import { fromOBX, groupVXUOrders, extractPersonObservations } from "../../hl7v2/wrappers";
import type { VXUOrderGroup } from "../../hl7v2/wrappers";
import type {
  Bundle,
  BundleEntry,
  Immunization,
  Observation,
  Patient,
  Encounter,
  Coding,
  Meta,
  Reference,
} from "../../fhir/hl7-fhir-r4-core";
import { convertPIDToPatient } from "../segments/pid-patient";
import { convertRXAToImmunization } from "../segments/rxa-immunization";
import type { SenderContext } from "../../code-mapping/concept-map";
import type { ConverterContext } from "../converter-context";
import type { Hl7v2ToFhirConfig } from "../config";
import type { PatientLookupFn, EncounterLookupFn } from "../aidbox-lookups";
import type { PatientIdResolver } from "../identity-system/patient-id";
import { applyOrderOBXFields, interpretRXA9Source } from "../cdc-iis-ig";
import { createBundleEntry } from "../fhir-bundle";
import { sanitizeForId } from "../identity-system/utils";

// ============================================================================
// Immunization ID Generation
// ============================================================================

/**
 * Generate a deterministic Immunization resource ID from ORDER group identifiers.
 *
 * Three-level fallback:
 * 1. ORC-3 (filler order number) with authority scoping — preferred
 * 2. ORC-2 (placer order number) with authority scoping — when ORC-3 empty
 * 3. Natural-key fallback — patient + vaccine + administration date
 *
 * Paths 1-2 use authority scoping (EI.2 namespace or EI.3 system) to prevent
 * cross-sender ID collisions. The `inject-authority-into-orc3` preprocessor ensures
 * authority is populated when the sender omits it.
 *
 * Path 3 exists because ORC is optional in HL7 v2.3.1 and v2.4 (became required in v2.5).
 * ORC-less VXU messages are spec-compliant for those versions. The natural key
 * (patient + vaccine + datetime) is idempotent across messages — the same immunization
 * event in two different messages produces the same FHIR resource ID.
 *
 * @param orc - Parsed ORC segment (undefined when ORC absent from ORDER group)
 * @param mshNamespace - Sender identification from MSH-3/MSH-4 (scopes IDs per sender)
 * @param patientId - FHIR Patient resource ID (already resolved before ORDER processing)
 * @param cvxCode - RXA-5.1 vaccine code (required field, always present)
 * @param adminDateTime - RXA-3 administration date/time (required, converter errors if empty)
 */
export function generateImmunizationId(
  orc: ORC | undefined,
  mshNamespace: string,
  patientId: string,
  cvxCode: string,
  adminDateTime: string,
): string {
  if (orc) {
    const idFromFiller = buildImmunizationIdFromEI(orc.$3_fillerOrderNumber);
    if (idFromFiller) {
      return idFromFiller;
    }

    const idFromPlacer = buildImmunizationIdFromEI(orc.$2_placerOrderNumber);
    if (idFromPlacer) {
      return idFromPlacer;
    }
  }

  return sanitizeForId(`${mshNamespace}-${patientId}-${cvxCode}-${adminDateTime}`);
}

/**
 * Build a sanitized ID from an EI (Entity Identifier) field.
 *
 * Uses `{authority}-{value}` format (authority first) per design. This differs from
 * ORM's `buildIdFromEI` which uses `{value}-{namespace}` — the formats are intentionally
 * different because VXU IDs are authority-scoped via preprocessor injection while ORM IDs
 * use namespace as a disambiguating suffix.
 */
function buildImmunizationIdFromEI(ei: EI | undefined): string | undefined {
  const value = ei?.$1_value?.trim();
  if (!value) {
    return undefined;
  }

  const authority = ei?.$2_namespace?.trim() || ei?.$3_system?.trim();
  const raw = authority ? `${authority}-${value}` : value;
  return sanitizeForId(raw);
}

// ============================================================================
// Main Converter Function
// ============================================================================

/**
 * Convert HL7v2 VXU_V04 message to FHIR Transaction Bundle
 *
 * Message Structure (in scope):
 * MSH - Message Header (1) - required
 * PID - Patient Identification (1) - required
 * PV1 - Patient Visit (0..1) - optional
 * PERSON_OBSERVATION (0..*):
 *   OBX - Observation (1) -> standalone Observation
 * ORDER (0..*):
 *   ORC - Common Order (0..1) - optional per C1 (real-world senders may omit)
 *   RXA - Administration (1) - required
 *   RXR - Route (0..1) - optional
 *   OBSERVATION (0..*):
 *     OBX - Observation (1) -> enriched into Immunization fields (CDC IIS)
 *     NTE - Notes (0..*) - not mapped (informational only)
 */
export async function convertVXU_V04(
  parsed: HL7v2Message,
  context: ConverterContext,
): Promise<ConversionResult> {
  // TODO: Implementation steps:
  //
  // 1. Parse MSH -> sender context, meta tags
  //    (reuse pattern from ORU)
  //
  // 2. Parse PID -> patient lookup/draft creation
  //    (reuse handlePatient from ORU)
  //
  // 3. Parse PV1 (optional) -> encounter handling
  //    (reuse handleEncounter from ORU, config key "VXU-V04")
  //
  // 4. Extract PERSON_OBSERVATION OBX -> standalone Observations
  //    (use existing LOINC resolution pipeline)
  //
  // 5. Group ORDER segments
  //    const orderGroups = groupVXUOrders(parsed);
  //
  // 6. For each ORDER group:
  //    a. Parse ORC, RXA, RXR segments
  //    b. Convert to base Immunization via convertRXAToImmunization()
  //    c. Apply CDC IIS ORDER OBX fields: applyOrderOBXFields(group.obxSegments)
  //    d. Apply RXA-9 NIP001: interpretRXA9Source(rxa.$9_administrationNotes)
  //    e. Link patient/encounter references, add meta tags
  //    f. Collect Immunization + Practitioner entries
  //
  // 7. Build transaction bundle with all entries
  //
  // 8. Return ConversionResult

  // Placeholder return -- will be replaced during implementation
  return {
    messageUpdate: {
      status: "error",
      error: "VXU_V04 converter not yet implemented",
    },
  };
}

export default convertVXU_V04;

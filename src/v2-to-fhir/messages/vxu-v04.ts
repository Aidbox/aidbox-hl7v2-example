/**
 * DESIGN PROTOTYPE: 2026-02-23-vxu-support.md
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
 * 4. Convert each ORDER -> base Immunization
 * 5. Apply CDC IIS enrichment (ORDER OBX -> Immunization fields, RXA-9 NIP001)
 * 6. Build transaction bundle
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
} from "../../hl7v2/generated/fields";
import { fromOBX } from "../../hl7v2/wrappers";
import type {
  Bundle,
  BundleEntry,
  Immunization,
  Observation,
  Patient,
  Encounter,
  Coding,
  Meta,
  Resource,
  Reference,
} from "../../fhir/hl7-fhir-r4-core";
import { convertPIDToPatient } from "../segments/pid-patient";
import { convertRXAToImmunization } from "../segments/rxa-immunization";
import type { RXA, RXR } from "../../hl7v2/generated/fields";
import type { SenderContext } from "../../code-mapping/concept-map";
import type { ConverterContext } from "../converter-context";
import type { Hl7v2ToFhirConfig } from "../config";
import type { PatientLookupFn, EncounterLookupFn } from "../aidbox-lookups";
import type { PatientIdResolver } from "../identity-system/patient-id";
import { cdcIisEnrichment } from "../ig-enrichment/cdc-iis-enrichment";

// ============================================================================
// Types
// ============================================================================

interface VXUOrderGroup {
  orc?: HL7v2Segment; // Optional per C1: real-world senders may omit ORC
  rxa: HL7v2Segment;
  rxr?: HL7v2Segment;
  observations: Array<{ obx: HL7v2Segment; ntes: HL7v2Segment[] }>;
}

// ============================================================================
// MSH Parsing (shared with ORU -- TODO: extract to shared module)
// ============================================================================

// TODO: The parseMSH, extractMetaTags, extractSenderTag, addSenderTagToMeta,
// createBundleEntry functions are duplicated from oru-r01.ts.
// Extract to a shared module (e.g., src/v2-to-fhir/shared/converter-helpers.ts)
// as part of implementation.

function extractMetaTags(msh: MSH): Coding[] {
  // TODO: Same as oru-r01.ts extractMetaTags
  return [];
}

function createBundleEntry(
  resource: Resource,
  method: "PUT" | "POST" = "PUT",
): BundleEntry {
  // TODO: Same as oru-r01.ts createBundleEntry
  const resourceType = resource.resourceType;
  const id = (resource as { id?: string }).id;
  return {
    resource,
    request: {
      method,
      url: id ? `${resourceType}/${id}` : `${resourceType}`,
    },
  };
}

// ============================================================================
// ORDER Group Extraction
// ============================================================================

/**
 * Group VXU_V04 segments into ORDER groups.
 *
 * Each ORDER starts with ORC or RXA (whichever appears first in the group).
 * Per C1: real-world senders may omit ORC entirely. RXA without preceding
 * ORC is a valid group.
 *
 * Contains RXA (required), optional ORC, optional RXR, and optional OBX.
 *
 * Segments before the first ORC or RXA are not part of any ORDER group
 * (PERSON_OBSERVATION OBX are handled separately).
 */
function groupVXUOrders(_message: HL7v2Message): VXUOrderGroup[] {
  // TODO: Implement:
  // Walk through segments sequentially:
  // - On ORC: start new group (or attach to current if no RXA yet)
  // - On RXA: start new group if no current group, or attach to current
  // - On RXR: attach to current group (optional)
  // - On OBX after RXA: start observation entry in current group
  // - On NTE after OBX: attach to current observation
  // - Segments before first ORC/RXA are PERSON_OBSERVATION (handled separately)
  return [];
}

/**
 * Extract PERSON_OBSERVATION OBX segments (before first ORC or RXA).
 * These are patient-level observations, not order-specific.
 * Per C1: first ORDER may start with RXA instead of ORC.
 */
function extractPersonObservations(_message: HL7v2Message): HL7v2Segment[] {
  // TODO: Implement:
  // Collect OBX segments that appear before the first ORC or RXA segment
  return [];
}

// ============================================================================
// Patient Handling (reuse ORU pattern)
// ============================================================================

// TODO: handlePatient -- same as ORU
// Lookup or create draft patient (active=false)
// Uses shared patient resolution from converter context

// ============================================================================
// Encounter Handling (reuse ORU pattern)
// ============================================================================

// TODO: handleEncounter -- same as ORU
// Config-driven PV1 policy (VXU-V04: PV1 optional)
// Missing/invalid PV1: skip Encounter, set warning

// ============================================================================
// PERSON_OBSERVATION Processing
// ============================================================================

// TODO: processPersonObservations
// Convert each PERSON_OBSERVATION OBX to standalone Observation
// Use existing convertOBXToObservationResolving from oru-r01.ts
// These OBX segments go through normal LOINC resolution (mapping_error + Task)

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
  //    c. Link patient reference
  //    d. Link encounter reference (if present)
  //    e. Add meta tags
  //    f. Collect Immunization + Practitioner entries
  //
  // 7. Build initial ConversionResult with bundle
  //
  // 8. Apply CDC IIS enrichment:
  //    result = cdcIisEnrichment.enrich(parsed, result, senderContext);
  //    If enrichment returns error -> return error result
  //
  // 9. Add draft patient/encounter entries to bundle
  //
  // 10. Return final ConversionResult

  // Placeholder return -- will be replaced during implementation
  return {
    messageUpdate: {
      status: "error",
      error: "VXU_V04 converter not yet implemented",
    },
  };
}

export default convertVXU_V04;

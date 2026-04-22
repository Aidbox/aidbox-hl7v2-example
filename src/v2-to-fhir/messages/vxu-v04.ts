/**
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
 *    b. RXR -> route/site
 *    c. ORDER OBX -> CDC IIS fields (applyOrderOBXFields)
 *    d. RXA-9 -> primarySource/reportOrigin (interpretRXA9Source)
 * 5. Build transaction bundle
 */

import type { HL7v2Message } from "../../hl7v2/generated/types";
import { findSegment, type ConversionResult } from "../converter";
import {
  fromPID, fromORC, fromRXA, fromRXR,
  type PID, type ORC, type RXA, type EI,
} from "../../hl7v2/generated/fields";
import { fromOBX, groupVXUOrders, extractPersonObservations } from "../../hl7v2/wrappers";
import type { VXUOrderGroup } from "../../hl7v2/wrappers";
import type { Meta, Reference } from "../../fhir/hl7-fhir-r4-core";
import type { DomainResource } from "../../fhir/hl7-fhir-r4-core/DomainResource";
import { convertRXAToImmunization } from "../segments/rxa-immunization";
import type { ConverterContext } from "../converter-context";
import { applyOrderOBXFields, interpretRXA9Source } from "../cdc-iis-ig";
import { sanitizeForId } from "../identity-system/utils";
import { parseMSH, addSenderTagToMeta } from "../segments/msh-parsing";
import { handlePatient, extractSenderTag } from "../segments/pid-patient";
import { parsePV1, handleEncounter } from "../segments/pv1-encounter";
import { convertOBXToObservationResolving } from "../segments/obx-observation";
import { buildMappingErrorResult, type MappingError } from "../../code-mapping/mapping-errors";

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

function parsePIDSegment(message: HL7v2Message): PID {
  const pidSegment = findSegment(message, "PID");
  if (!pidSegment) {
    throw new Error("PID segment is required for VXU_V04 messages");
  }
  return fromPID(pidSegment);
}

interface ProcessOrderGroupResult {
  entries: DomainResource[];
  error?: string;
}

/**
 * Process a single ORDER group into Immunization + performer bundle entries.
 *
 * Steps per group:
 * 1. Parse ORC/RXA/RXR segments
 * 2. Generate deterministic Immunization ID (ORC-3 → ORC-2 → natural key)
 * 3. Convert RXA+RXR+ORC to base Immunization
 * 4. Apply CDC IIS ORDER OBX fields
 * 5. Apply CDC IIS RXA-9 NIP001 source
 * 6. Link Encounter reference, add meta tags
 * 7. Collect entries
 */
function processOrderGroup(
  group: VXUOrderGroup,
  mshNamespace: string,
  patientId: string,
  patientRef: Reference<"Patient">,
  encounterRef: Reference<"Encounter"> | null,
  baseMeta: Meta,
): ProcessOrderGroupResult {
  const orc = group.orc ? fromORC(group.orc) : undefined;
  const rxa = fromRXA(group.rxa);
  const rxr = group.rxr ? fromRXR(group.rxr) : undefined;

  // ID generation needs CVX code and admin datetime from RXA
  const cvxCode = rxa.$5_administeredCode?.$1_code || "";
  const adminDateTime = rxa.$3_startAdministrationDateTime || "";
  const immunizationId = generateImmunizationId(orc, mshNamespace, patientId, cvxCode, adminDateTime);

  // Convert RXA+RXR+ORC to base Immunization
  const rxaResult = convertRXAToImmunization(rxa, rxr, orc, immunizationId, patientRef);
  if ("error" in rxaResult) {
    return { entries: [], error: rxaResult.error };
  }

  const { immunization, performerResources } = rxaResult;

  // Apply CDC IIS ORDER OBX fields
  const obxSegments = group.observations.map((obs) => obs.obx);
  if (obxSegments.length > 0) {
    const obxResult = applyOrderOBXFields(obxSegments);
    if ("error" in obxResult) {
      return { entries: [], error: obxResult.error };
    }
    Object.assign(immunization, obxResult.fields);
  }

  // Apply CDC IIS RXA-9 NIP001 source
  const sourceResult = interpretRXA9Source(rxa.$9_administrationNotes);
  immunization.primarySource = sourceResult.primarySource;
  if (sourceResult.reportOrigin) {
    immunization.reportOrigin = sourceResult.reportOrigin;
  }

  // Link Encounter reference
  if (encounterRef) {
    immunization.encounter = encounterRef;
  }

  // Add meta tags
  immunization.meta = { ...immunization.meta, ...baseMeta };

  const entries: DomainResource[] = [immunization, ...performerResources];

  return { entries };
}

interface PersonObservationResult {
  entries: DomainResource[];
  mappingErrors: MappingError[];
}

/**
 * Process PERSON_OBSERVATION OBX segments into standalone Observations.
 *
 * Uses the standard LOINC resolution pipeline (same as ORU OBX).
 * The order number for ID generation uses a synthetic prefix since
 * person observations are not part of any ORDER group.
 *
 * NTE segments from person observations are not mapped — the LOINC resolution
 * pipeline (convertOBXToObservationResolving) doesn't accept NTEs, and the
 * design treats person-level NTEs as informational only.
 */
async function processPersonObservations(
  message: HL7v2Message,
  senderContext: { sendingApplication: string; sendingFacility: string },
  patientRef: Reference<"Patient">,
  baseMeta: Meta,
  messageControlId: string,
): Promise<PersonObservationResult> {
  const personObs = extractPersonObservations(message);
  if (personObs.length === 0) {
    return { entries: [], mappingErrors: [] };
  }

  const entries: DomainResource[] = [];
  const mappingErrors: MappingError[] = [];
  const orderNumber = `${messageControlId}-person-obs`;

  for (const obsGroup of personObs) {
    const obx = fromOBX(obsGroup.obx);
    const result = await convertOBXToObservationResolving(obx, orderNumber, senderContext);

    if (result.errors) {
      mappingErrors.push(...result.errors);
      continue;
    }

    const observation = result.observation;
    observation.subject = patientRef;
    observation.meta = { ...observation.meta, ...baseMeta };
    entries.push(observation);
  }

  return { entries, mappingErrors };
}

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
  const { resolvePatientId, lookupPatient, lookupEncounter, config } = context;

  // 1. Parse MSH → sender context + meta tags
  const { msh, senderContext, baseMeta } = parseMSH(parsed, "VXU_V04");
  const mshNamespace = `${senderContext.sendingApplication}-${senderContext.sendingFacility}`;
  const messageControlId = msh.$10_messageControlId || "unknown";

  // 2. Parse PID → patient lookup/draft creation
  const pid = parsePIDSegment(parsed);
  const senderTag = extractSenderTag(pid);
  addSenderTagToMeta(baseMeta, senderTag);

  const patientResult = await handlePatient(
    pid,
    baseMeta,
    lookupPatient,
    resolvePatientId,
    context.patientPolicy,
  );
  if ("error" in patientResult) {
    return { messageUpdate: { status: "conversion_error", error: patientResult.error } };
  }
  const { patientRef, patient } = patientResult;

  // 3. Parse PV1 (optional) → encounter handling
  const pv1 = parsePV1(parsed);
  const encounterResult = await handleEncounter(
    pv1, patientRef, baseMeta, senderContext, lookupEncounter, config, "VXU-V04",
  );
  if (encounterResult.error) {
    return {
      messageUpdate: { status: "conversion_error", error: encounterResult.error, patient: patientRef },
    };
  }
  const { encounterRef, encounter, patientClassTask } = encounterResult;

  // 4. Extract PERSON_OBSERVATION OBX → standalone Observations
  const personObsResult = await processPersonObservations(
    parsed, senderContext, patientRef, baseMeta, messageControlId,
  );
  const allMappingErrors: MappingError[] = [...personObsResult.mappingErrors];

  // 5. Group ORDER segments
  const groupResult = groupVXUOrders(parsed);
  if ("error" in groupResult) {
    // Omit patient ref: bundle not submitted yet, Patient doesn't exist in Aidbox
    return {
      messageUpdate: { status: "conversion_error", error: groupResult.error },
    };
  }

  // Extract patient ID — handlePatient always sets reference on the success path
  const patientId = (patientRef.reference ?? "").replace("Patient/", "");

  // 6. Process each ORDER group
  const orderEntries: DomainResource[] = [];
  for (const group of groupResult.groups) {
    const result = processOrderGroup(
      group, mshNamespace, patientId, patientRef, encounterRef, baseMeta,
    );
    if (result.error) {
      // Omit patient ref: bundle not submitted yet, Patient doesn't exist in Aidbox
      return {
        messageUpdate: { status: "conversion_error", error: result.error },
      };
    }
    orderEntries.push(...result.entries);
  }

  // Check for mapping errors before collecting entries
  if (allMappingErrors.length > 0) {
    return buildMappingErrorResult(senderContext, allMappingErrors);
  }

  // 7. Collect entries
  const entries: DomainResource[] = [];
  if (patient) entries.push(patient);
  if (encounter) entries.push(encounter);
  entries.push(...personObsResult.entries);
  entries.push(...orderEntries);
  if (patientClassTask) entries.push(patientClassTask);

  // 8. Return ConversionResult
  if (encounterResult.warning) {
    return {
      entries,
      messageUpdate: { status: "warning", error: encounterResult.warning, patient: patientRef },
    };
  }

  return {
    entries,
    messageUpdate: { status: "processed", patient: patientRef },
  };
}

export default convertVXU_V04;

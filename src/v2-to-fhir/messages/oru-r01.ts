/**
 * HL7v2 ORU_R01 Message to FHIR Bundle Converter
 *
 * ORU_R01 - Unsolicited Observation Result
 *
 * Creates:
 * - DiagnosticReport from OBR
 * - Observation[] from OBX[]
 * - Specimen from SPM (or OBR-15 fallback)
 */

import type { HL7v2Message, HL7v2Segment } from "../../hl7v2/generated/types";
import { findSegment, findAllSegments, type ConversionResult } from "../converter";
import {
  fromMSH,
  fromPID,
  fromPV1,
  fromOBR,
  fromNTE,
  fromSPM,
  type MSH,
  type PID,
  type PV1,
  type OBR,
  type OBX,
  type NTE,
  type SPM,
} from "../../hl7v2/generated/fields";
import { fromOBX } from "../../hl7v2/wrappers";
import type {
  Bundle,
  BundleEntry,
  DiagnosticReport,
  Observation,
  Specimen,
  Patient,
  Encounter,
  Coding,
  Meta,
  Resource,
  Reference,
} from "../../fhir/hl7-fhir-r4-core";
import { getResourceWithETag, NotFoundError } from "../../aidbox";
import { convertPIDToPatient } from "../segments/pid-patient";
import { convertPV1WithMappingSupport } from "../segments/pv1-encounter";
import { convertOBRWithMappingSupport } from "../segments/obr-diagnosticreport";
import { convertOBXWithMappingSupportAsync } from "../segments/obx-observation";
import { convertNTEsToAnnotation } from "../segments/nte-annotation";
import {
  buildCodeableConcept,
  LoincResolutionError,
  resolveToLoinc,
  type SenderContext,
} from "../../code-mapping/concept-map";
import {
  buildMappingErrorResult,
  type MappingError,
} from "../../code-mapping/mapping-errors";
import {
  composeMappingTask,
  composeTaskBundleEntry,
} from "../../code-mapping/mapping-task";
import { hl7v2ToFhirConfig } from "../config";

/**
 * Function type for looking up a Patient by ID.
 * Returns the Patient if found, or null if not found.
 */
export type PatientLookupFn = (patientId: string) => Promise<Patient | null>;

/**
 * Default patient lookup function using Aidbox.
 * Returns null on 404 (not found), throws on other errors.
 */
export async function defaultPatientLookup(
  patientId: string,
): Promise<Patient | null> {
  try {
    const { resource } = await getResourceWithETag<Patient>("Patient", patientId);
    return resource;
  } catch (error) {
    if (error instanceof NotFoundError) {
      return null;
    }
    throw error;
  }
}

/**
 * Function type for looking up an Encounter by ID.
 * Returns the Encounter if found, or null if not found.
 */
export type EncounterLookupFn = (encounterId: string) => Promise<Encounter | null>;

/**
 * Default encounter lookup function using Aidbox.
 * Returns null on 404 (not found), throws on other errors.
 */
export async function defaultEncounterLookup(
  encounterId: string,
): Promise<Encounter | null> {
  try {
    const { resource } = await getResourceWithETag<Encounter>("Encounter", encounterId);
    return resource;
  } catch (error) {
    if (error instanceof NotFoundError) {
      return null;
    }
    throw error;
  }
}

/**
 * Extract patient ID from PID segment.
 * Tries PID-2 first, then falls back to PID-3.1 (first identifier).
 *
 * Design note: PID-2 was deprecated in HL7 v2.4+ in favor of PID-3, but many
 * legacy systems still use PID-2. We check PID-2 first for backward compatibility
 * with older message formats.
 *
 * DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity.md
 * This entire function will be removed and replaced with resolvePatientId() call.
 * The call site in handlePatient() (line ~554) becomes:
 *
 *   const patientIdResult = await resolvePatientId(
 *     pid.$3_identifier ?? [],       // PID-3 after preprocessing (merge-pid2-into-pid3 already ran)
 *   );                               // resolvePatientId injected from converter.ts (no algorithm knowledge here)
 *   if ('error' in patientIdResult) {
 *     throw new Error(`Patient ID selection failed: ${patientIdResult.error}`);
 *   }
 *   const patientId = patientIdResult.id;
 *
 * handlePatient() signature will gain `resolvePatientId: PatientIdResolver` (instead of mpiClient: MpiClient).
 * Config access changes from config["ORU-R01"] to config.messages["ORU-R01"].
 * Import: import { type PatientIdResolver } from "../id-generation";
 * END DESIGN PROTOTYPE
 */
function extractPatientId(pid: PID): string {
  if (pid.$2_patientId?.$1_value) {
    return pid.$2_patientId.$1_value;
  }
  if (pid.$3_identifier?.[0]?.$1_value) {
    return pid.$3_identifier[0].$1_value;
  }
  throw new Error("Patient ID (PID-2 or PID-3) is required");
}

/**
 * Create a draft patient from PID segment with active=false.
 * Draft patients are unverified and will be updated when ADT message arrives.
 *
 * Note: If a patient was previously created via ADT and then deleted, receiving
 * an ORU message will recreate them as a new draft patient. This is intentional -
 * we treat it as a new patient since the previous record no longer exists.
 */
function createDraftPatient(pid: PID, patientId: string, baseMeta: Meta): Patient {
  const patient = convertPIDToPatient(pid);
  patient.id = patientId;
  patient.active = false;
  patient.meta = { ...patient.meta, ...baseMeta };
  return patient;
}

/**
 * Result type for OBX conversion with both status and LOINC resolution.
 * Can return an Observation or mapping errors (both status and/or LOINC).
 */
export type OBXResolutionResult =
  | { observation: Observation; errors?: never }
  | { observation?: never; errors: MappingError[] };

/**
 * Convert OBX to Observation with both status mapping and LOINC resolution.
 *
 * This function:
 * 1. Attempts to resolve OBX-11 status using ConceptMap lookup
 * 2. Attempts to resolve LOINC code from OBX-3
 * 3. Collects all errors from both operations
 * 4. Returns observation only if BOTH succeed, otherwise returns all errors
 *
 * @returns Either an Observation (on success) or an array of mapping errors
 */
export async function convertOBXToObservationResolving(
  obx: OBX,
  orderNumber: string,
  senderContext: SenderContext,
): Promise<OBXResolutionResult> {
  const errors: MappingError[] = [];

  // Try OBX-11 status resolution
  const obxResult = await convertOBXWithMappingSupportAsync(obx, orderNumber, senderContext);
  if (obxResult.error) {
    errors.push(obxResult.error);
  }

  // TODO refactor: probably, it should happen inside convertOBXWithMappingSupportAsync, because it already returns an object with an error field
  // Try LOINC code resolution
  let loincResolution: Awaited<ReturnType<typeof resolveToLoinc>> | undefined;
  try {
    loincResolution = await resolveToLoinc(obx.$3_observationIdentifier, senderContext);
  } catch (error) {
    if (error instanceof LoincResolutionError) {
      errors.push({
        localCode: error.localCode || "",
        localDisplay: error.localDisplay,
        localSystem: error.localSystem,
        mappingType: "observation-code-loinc",
      });
    } else {
      throw error;
    }
  }

  // If any errors occurred, return them all
  if (errors.length > 0) {
    return { errors };
  }

  // Both succeeded - build the final observation
  const observation = obxResult.observation!;
  observation.code = buildCodeableConcept(loincResolution!);

  return { observation };
}

interface OBRGroup {
  obr: HL7v2Segment;
  observations: Array<{
    obx: HL7v2Segment;
    ntes: HL7v2Segment[];
  }>;
  specimens: HL7v2Segment[];
}

interface ParsedMSH {
  msh: MSH;
  senderContext: SenderContext;
  baseMeta: Meta;
}

/**
 * Extract meta tags from MSH segment
 */
function extractMetaTags(msh: MSH): Coding[] {
  const tags: Coding[] = [];

  if (msh.$10_messageControlId) {
    tags.push({
      code: msh.$10_messageControlId,
      system: "urn:aidbox:hl7v2:message-id",
    });
  }

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

/**
 * Extract sender tag from PID-3 (MR identifier's assigning authority).
 * Returns undefined if no MR identifier with assigning authority is found.
 */
function extractSenderTag(pid: PID): Coding | undefined {
  if (!pid.$3_identifier) return undefined;

  for (const cx of pid.$3_identifier) {
    if (cx.$5_type === "MR" && cx.$4_system?.$1_namespace) {
      return {
        code: cx.$4_system.$1_namespace.toLowerCase(),
        system: "urn:aidbox:hl7v2:sender",
      };
    }
  }

  return undefined;
}

/**
 * Add sender tag to meta if not already present.
 */
function addSenderTagToMeta(meta: Meta, senderTag: Coding | undefined): void {
  if (!senderTag || !meta.tag) return;

  const hasSenderTag = meta.tag.some((t) => t.system === senderTag.system);
  if (!hasSenderTag) {
    meta.tag.push(senderTag);
  }
}

/**
 * Create a bundle entry for a resource
 */
function createBundleEntry(
  resource: Resource,
  method: "PUT" | "POST" = "PUT",
): BundleEntry {
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


/**
 * Group segments by OBR parent
 * Each OBR creates a group with its following OBX, NTE, and SPM segments
 */
function groupSegmentsByOBR(message: HL7v2Message): OBRGroup[] {
  const groups: OBRGroup[] = [];
  let currentGroup: OBRGroup | null = null;
  let currentObservation: { obx: HL7v2Segment; ntes: HL7v2Segment[] } | null =
    null;

  for (const segment of message) {
    switch (segment.segment) {
      case "OBR":
        // Start a new group
        if (currentObservation && currentGroup) {
          currentGroup.observations.push(currentObservation);
        }
        currentObservation = null;

        currentGroup = {
          obr: segment,
          observations: [],
          specimens: [],
        };
        groups.push(currentGroup);
        break;

      case "OBX":
        // Add previous observation to group
        if (currentObservation && currentGroup) {
          currentGroup.observations.push(currentObservation);
        }
        currentObservation = { obx: segment, ntes: [] };
        break;

      case "NTE":
        // Attach to current observation
        if (currentObservation) {
          currentObservation.ntes.push(segment);
        }
        break;

      case "SPM":
        // Attach to current group
        if (currentGroup) {
          currentGroup.specimens.push(segment);
        }
        break;
    }
  }

  // Don't forget the last observation
  if (currentObservation && currentGroup) {
    currentGroup.observations.push(currentObservation);
  }

  return groups;
}

/**
 * Convert SPM segment to FHIR Specimen
 */
function convertSPMToSpecimen(
  spm: SPM,
  orderNumber: string,
  index: number,
): Specimen {
  // Generate ID: {orderNumber}-specimen-{index}
  const id = `${orderNumber.toLowerCase()}-specimen-${index}`.replace(
    /[^a-z0-9-]/g,
    "-",
  );

  const specimen: Specimen = {
    resourceType: "Specimen",
    id,
  };

  // SPM-4: Specimen Type
  if (spm.$4_specimenType) {
    specimen.type = {
      coding: [
        {
          code: spm.$4_specimenType.$1_code,
          display: spm.$4_specimenType.$2_text,
        },
      ],
      text: spm.$4_specimenType.$2_text,
    };
  }

  // SPM-17: Specimen Collection Date/Time
  if (spm.$17_specimenCollection) {
    const collectionTime = spm.$17_specimenCollection;
    if (collectionTime.$1_start) {
      specimen.collection = {
        collectedDateTime: convertDTMToDateTime(collectionTime.$1_start),
      };
    }
  }

  // SPM-18: Specimen Received Date/Time
  if (spm.$18_specimenReceived) {
    specimen.receivedTime = convertDTMToDateTime(spm.$18_specimenReceived);
  }

  return specimen;
}

/**
 * Create Specimen from OBR-15 (fallback for older versions)
 */
function createSpecimenFromOBR15(
  obr: OBR,
  orderNumber: string,
): Specimen | undefined {
  if (!obr.$15_specimenSource) return undefined;

  const sps = obr.$15_specimenSource;
  const id = `${orderNumber.toLowerCase()}-specimen-obr15`.replace(
    /[^a-z0-9-]/g,
    "-",
  );

  const specimen: Specimen = {
    resourceType: "Specimen",
    id,
  };

  // SPS.1: Specimen Source Name
  if (sps.$1_specimen) {
    specimen.type = {
      coding: [
        {
          code: sps.$1_specimen.$1_code,
          display: sps.$1_specimen.$2_text,
        },
      ],
      text: sps.$1_specimen.$2_text,
    };
  }

  return specimen;
}

/**
 * Convert HL7v2 DTM to FHIR dateTime
 */
function convertDTMToDateTime(dtm: string | undefined): string | undefined {
  if (!dtm) return undefined;

  const year = dtm.substring(0, 4);
  const month = dtm.substring(4, 6);
  const day = dtm.substring(6, 8);
  const hour = dtm.substring(8, 10) || "00";
  const minute = dtm.substring(10, 12) || "00";
  const second = dtm.substring(12, 14) || "00";

  if (dtm.length <= 4) return year;
  if (dtm.length <= 6) return `${year}-${month}`;
  if (dtm.length <= 8) return `${year}-${month}-${day}`;

  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

function parseMSH(message: HL7v2Message): ParsedMSH {
  const mshSegment = findSegment(message, "MSH");
  if (!mshSegment) {
    throw new Error("MSH segment not found in ORU_R01 message");
  }

  const msh = fromMSH(mshSegment);

  const sendingApplication = msh.$3_sendingApplication?.$1_namespace;
  const sendingFacility = msh.$4_sendingFacility?.$1_namespace;

  if (!sendingApplication || !sendingFacility) {
    throw new Error(
      `MSH-3 (sending application) and MSH-4 (sending facility) are required. ` +
        `Got: MSH-3="${sendingApplication || ""}", MSH-4="${sendingFacility || ""}"`,
    );
  }

  const senderContext: SenderContext = { sendingApplication, sendingFacility };

  const baseMeta: Meta = {
    tag: extractMetaTags(msh),
  };

  return { msh, senderContext, baseMeta };
}

function validateOBRPresence(message: HL7v2Message): void {
  const obrSegments = findAllSegments(message, "OBR");
  if (obrSegments.length === 0) {
    throw new Error("OBR segment not found in ORU_R01 message");
  }
}

/**
 * Parse and validate PID segment from ORU_R01 message.
 * PID is required for ORU_R01 - throws if missing.
 */
function parsePID(message: HL7v2Message): PID {
  const pidSegment = findSegment(message, "PID");
  if (!pidSegment) {
    throw new Error("PID segment is required for ORU_R01 messages");
  }
  return fromPID(pidSegment);
}

interface PatientHandlingResult {
  patientRef: Reference<"Patient">;
  patientEntry: BundleEntry | null;
}

/**
 * Create a conditional bundle entry for draft Patient creation.
 * Uses POST with If-None-Exist to prevent race conditions when multiple
 * ORU messages for the same non-existent patient arrive simultaneously.
 *
 * If the patient already exists (created by a concurrent message), the
 * server will return the existing patient instead of creating a duplicate.
 */
function createConditionalPatientEntry(patient: Patient): BundleEntry {
  const patientId = patient.id;
  return {
    resource: patient,
    request: {
      method: "POST",
      url: "Patient",
      ifNoneExist: `_id=${patientId}`,
    },
  };
}

/**
 * Handle patient lookup and draft creation for ORU_R01.
 *
 * - Extracts patient ID from PID-2 or PID-3.1
 * - Looks up existing patient (does NOT update - ADT is source of truth)
 * - Creates draft patient with active=false if not found
 *
 * Race condition handling: Uses POST with If-None-Exist to ensure only one
 * draft patient is created even if multiple ORU messages for the same
 * non-existent patient arrive simultaneously.
 */
// DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity.md
// handlePatient() signature will gain `resolvePatientId: PatientIdResolver` (instead of mpiClient: MpiClient):
//   async function handlePatient(
//     pid: PID,
//     baseMeta: Meta,
//     lookupPatient: PatientLookupFn,
//     resolvePatientId: PatientIdResolver,  // NEW: injected resolver (no algorithm knowledge here)
//   ): Promise<PatientHandlingResult>
//
// convertORU_R01 public signature will also gain resolvePatientId (last param):
//   export async function convertORU_R01(
//     parsed: HL7v2Message,
//     lookupPatient: PatientLookupFn = defaultPatientLookup,
//     lookupEncounter: EncounterLookupFn = defaultEncounterLookup,
//     resolvePatientId: PatientIdResolver,  // NEW — no default; converter.ts always passes it
//   ): Promise<ConversionResult>
//
// resolvePatientId is passed from convertORU_R01 → handlePatient → resolvePatientId(ids).
// converter.ts creates the resolver as a closure and passes it to convertORU_R01.
// handleEncounter does not need resolvePatientId — encounter identity is via PV1-19, not PID.
// END DESIGN PROTOTYPE
async function handlePatient(
  pid: PID,
  baseMeta: Meta,
  lookupPatient: PatientLookupFn,
): Promise<PatientHandlingResult> {
  // DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity.md
  // Replace this call with selectPatientId() — see extractPatientId() JSDoc above for details.
  // END DESIGN PROTOTYPE
  const patientId = extractPatientId(pid);
  const patientRef = { reference: `Patient/${patientId}` } as Reference<"Patient">;

  const existingPatient = await lookupPatient(patientId);

  if (existingPatient) {
    return { patientRef, patientEntry: null };
  }

  const draftPatient = createDraftPatient(pid, patientId, baseMeta);
  const patientEntry = createConditionalPatientEntry(draftPatient);

  return { patientRef, patientEntry };
}

/**
 * Parse PV1 segment from ORU_R01 message.
 * PV1 is optional for ORU_R01 - returns undefined if missing.
 */
function parsePV1(message: HL7v2Message): PV1 | undefined {
  const pv1Segment = findSegment(message, "PV1");
  if (!pv1Segment) {
    return undefined;
  }
  return fromPV1(pv1Segment);
}


interface EncounterHandlingResult {
  encounterRef: Reference<"Encounter"> | null;
  encounterEntry: BundleEntry | null;
  patientClassTaskEntry?: BundleEntry;
  warning?: string;
  error?: string;
}

/**
 * Create a conditional bundle entry for draft Encounter creation.
 * Uses POST with If-None-Exist to prevent race conditions when multiple
 * ORU messages for the same non-existent encounter arrive simultaneously.
 */
function createConditionalEncounterEntry(encounter: Encounter): BundleEntry {
  const encounterId = encounter.id;
  return {
    resource: encounter,
    request: {
      method: "POST",
      url: "Encounter",
      ifNoneExist: `_id=${encounterId}`,
    },
  };
}

/**
 * Handle encounter lookup and draft creation for ORU_R01.
 *
 * Config-driven PV1 policy:
 * - If PV1 required (config) and missing/invalid → error, processing stops
 * - If PV1 not required and missing/invalid → warning, skip Encounter, continue clinical data
 * - If PV1 present and valid → create/lookup Encounter with strict identifier
 *
 * Patient class mapping errors:
 * - Do NOT block the message (ORU clinical data is prioritized)
 * - Create Task for tracking, use fallback class (AMB)
 *
 * Race condition handling: Uses POST with If-None-Exist to ensure only one
 * draft encounter is created even if multiple ORU messages for the same
 * non-existent encounter arrive simultaneously.
 */
async function handleEncounter(
  pv1: PV1 | undefined,
  patientRef: Reference<"Patient">,
  baseMeta: Meta,
  senderContext: SenderContext,
  lookupEncounter: EncounterLookupFn,
): Promise<EncounterHandlingResult> {
  const config = hl7v2ToFhirConfig();
  const pv1Required = config["ORU-R01"]?.converter?.PV1?.required ?? false;

  if (!pv1) {
    if (pv1Required) {
      return {
        encounterRef: null,
        encounterEntry: null,
        error: "PV1 segment is required for ORU-R01 but missing",
      };
    }
    return { encounterRef: null, encounterEntry: null };
  }

  const result = await convertPV1WithMappingSupport(pv1, senderContext);

  if (result.identifierError) {
    if (pv1Required) {
      return { encounterRef: null, encounterEntry: null, error: result.identifierError };
    }
    return { encounterRef: null, encounterEntry: null, warning: result.identifierError };
  }

  const encounter = result.encounter;
  const encounterId = encounter.id!;
  const encounterRef = { reference: `Encounter/${encounterId}` } as Reference<"Encounter">;

  const existingEncounter = await lookupEncounter(encounterId);
  if (existingEncounter) {
    return { encounterRef, encounterEntry: null };
  }

  encounter.status = "unknown";
  encounter.subject = patientRef;
  encounter.meta = { ...encounter.meta, ...baseMeta };

  const encounterEntry = createConditionalEncounterEntry(encounter);

  let patientClassTaskEntry: BundleEntry | undefined;
  if (result.mappingError) {
    const task = composeMappingTask(senderContext, result.mappingError);
    patientClassTaskEntry = composeTaskBundleEntry(task);
  }

  return { encounterRef, encounterEntry, patientClassTaskEntry };
}

function getOrderNumber(obr: OBR): string {
  // Prefer OBR-3 (Filler Order Number), fallback to OBR-2 (Placer Order Number)
  const fillerOrderNumber = obr.$3_fillerOrderNumber?.$1_value;
  if (fillerOrderNumber) {
    return fillerOrderNumber;
  }

  const placerOrderNumber = obr.$2_placerOrderNumber?.$1_value;
  if (placerOrderNumber) {
    return placerOrderNumber;
  }

  throw new Error(
    "Either OBR-3 (Filler Order Number) or OBR-2 (Placer Order Number) is required for deterministic ID generation",
  );
}

interface ProcessObservationsResult {
  observations: Observation[];
  mappingErrors: MappingError[];
}

async function processObservations(
  observationGroups: OBRGroup["observations"],
  orderNumber: string,
  senderContext: SenderContext,
  baseMeta: Meta,
): Promise<ProcessObservationsResult> {
  const observations: Observation[] = [];
  const mappingErrors: MappingError[] = [];

  for (const obsGroup of observationGroups) {
    const obx = fromOBX(obsGroup.obx);

    const result = await convertOBXToObservationResolving(
      obx,
      orderNumber,
      senderContext,
    );

    // Check for mapping errors (can be multiple: status + LOINC)
    if (result.errors) {
      mappingErrors.push(...result.errors);
      continue;
    }

    const observation = result.observation;
    observation.meta = { ...observation.meta, ...baseMeta };

    if (obsGroup.ntes.length > 0) {
      const ntes = obsGroup.ntes.map((seg) => fromNTE(seg));
      const annotation = convertNTEsToAnnotation(ntes);
      if (annotation) {
        observation.note = [annotation];
      }
    }

    observations.push(observation);
  }

  return { observations, mappingErrors };
}

function processSpecimens(
  specimenSegments: HL7v2Segment[],
  obr: OBR,
  orderNumber: string,
  baseMeta: Meta,
): Specimen[] {
  const specimens: Specimen[] = [];

  if (specimenSegments.length > 0) {
    for (const [index, segment] of specimenSegments.entries()) {
      const spm = fromSPM(segment);
      const specimen = convertSPMToSpecimen(spm, orderNumber, index + 1);
      specimen.meta = { ...specimen.meta, ...baseMeta };
      specimens.push(specimen);
    }
  } else {
    const specimen = createSpecimenFromOBR15(obr, orderNumber);
    if (specimen) {
      specimen.meta = { ...specimen.meta, ...baseMeta };
      specimens.push(specimen);
    }
  }

  return specimens;
}

function linkSpecimensToResources(
  specimens: Specimen[],
  diagnosticReport: DiagnosticReport,
  observations: Observation[],
): void {
  const firstSpecimen = specimens[0];
  if (!firstSpecimen) return;

  diagnosticReport.specimen = specimens.map(
    (s) => ({ reference: `Specimen/${s.id}` }) as Reference<"Specimen">,
  );

  const firstSpecimenRef = {
    reference: `Specimen/${firstSpecimen.id}`,
  } as Reference<"Specimen">;

  for (const obs of observations) {
    obs.specimen = firstSpecimenRef;
  }
}

/**
 * Link patient reference to all resources in an OBR group.
 */
function linkPatientToResources(
  patientRef: Reference<"Patient">,
  diagnosticReport: DiagnosticReport,
  observations: Observation[],
  specimens: Specimen[],
): void {
  diagnosticReport.subject = patientRef;

  for (const obs of observations) {
    obs.subject = patientRef;
  }

  for (const spec of specimens) {
    spec.subject = patientRef;
  }
}

/**
 * Link encounter reference to DiagnosticReport and Observations.
 * Specimen does not have an encounter field in FHIR R4.
 */
function linkEncounterToResources(
  encounterRef: Reference<"Encounter"> | null,
  diagnosticReport: DiagnosticReport,
  observations: Observation[],
): void {
  if (!encounterRef) return;

  diagnosticReport.encounter = encounterRef;

  for (const obs of observations) {
    obs.encounter = encounterRef;
  }
}

function buildBundleEntries(
  diagnosticReport: DiagnosticReport,
  observations: Observation[],
  specimens: Specimen[],
): BundleEntry[] {
  return [
    createBundleEntry(diagnosticReport),
    ...observations.map((obs) => createBundleEntry(obs)),
    ...specimens.map((spec) => createBundleEntry(spec)),
  ];
}

interface ProcessOBRGroupResult {
  entries: BundleEntry[];
  mappingErrors: MappingError[];
}

async function processOBRGroup(
  group: OBRGroup,
  senderContext: SenderContext,
  baseMeta: Meta,
  patientRef: Reference<"Patient">,
  encounterRef: Reference<"Encounter"> | null,
): Promise<ProcessOBRGroupResult> {
  const obr = fromOBR(group.obr);
  const orderNumber = getOrderNumber(obr);

  const obrResult = await convertOBRWithMappingSupport(obr, senderContext);

  // Collect OBR status mapping error if present
  const mappingErrors: MappingError[] = [];
  if (obrResult.error) {
    mappingErrors.push(obrResult.error);
    // Cannot proceed without a valid DiagnosticReport status
    // Return empty entries with the mapping error
    return { entries: [], mappingErrors };
  }

  const diagnosticReport = obrResult.diagnosticReport;
  diagnosticReport.meta = { ...diagnosticReport.meta, ...baseMeta };
  diagnosticReport.result = [];

  const { observations, mappingErrors: obxMappingErrors } = await processObservations(
    group.observations,
    orderNumber,
    senderContext,
    baseMeta,
  );

  mappingErrors.push(...obxMappingErrors);

  diagnosticReport.result = observations.map(
    (obs) =>
      ({ reference: `Observation/${obs.id}` }) as Reference<"Observation">,
  );

  const specimens = processSpecimens(
    group.specimens,
    obr,
    orderNumber,
    baseMeta,
  );

  linkSpecimensToResources(specimens, diagnosticReport, observations);
  linkPatientToResources(patientRef, diagnosticReport, observations, specimens);
  linkEncounterToResources(encounterRef, diagnosticReport, observations);

  const entries = buildBundleEntries(diagnosticReport, observations, specimens);
  return { entries, mappingErrors };
}

/**
 * Convert HL7v2 ORU_R01 message to FHIR Transaction Bundle
 *
 * Message Structure:
 * MSH - Message Header (1)
 * PID - Patient Identification (1) - required
 * PV1 - Patient Visit (0..1) - optional
 * { OBR - Observation Request (1)
 *   { OBX - Observation Result (0..*)
 *     NTE - Notes and Comments (0..*)
 *   }
 *   SPM - Specimen (0..*)
 * }
 *
 * Patient Handling:
 * - PID segment is required - error if missing
 * - Looks up existing Patient by ID (does NOT update - ADT is source of truth)
 * - Creates draft Patient with active=false if not found
 * - Links all resources to Patient
 *
 * Encounter Handling (config-driven PV1 policy):
 * - PV1 required/optional determined by config["ORU-R01"].converter.PV1.required
 * - If PV1 valid: creates/looks up Encounter with strict HL7 v2.8.2 authority validation
 * - If PV1 not required and missing/invalid: skip Encounter, set status=warning
 * - If PV1 required and missing/invalid: set status=error, no bundle submitted
 * - Links DiagnosticReport and Observation to Encounter when present
 */
export async function convertORU_R01(
  parsed: HL7v2Message,
  lookupPatient: PatientLookupFn = defaultPatientLookup,
  lookupEncounter: EncounterLookupFn = defaultEncounterLookup,
): Promise<ConversionResult> {
  const { senderContext, baseMeta } = parseMSH(parsed);
  validateOBRPresence(parsed);

  const pid = parsePID(parsed);

  // Add sender tag from PID-3 (MR identifier's assigning authority)
  const senderTag = extractSenderTag(pid);
  addSenderTagToMeta(baseMeta, senderTag);

  const { patientRef, patientEntry } = await handlePatient(
    pid,
    baseMeta,
    lookupPatient,
  );

  const pv1 = parsePV1(parsed);
  const encounterResult = await handleEncounter(
    pv1,
    patientRef,
    baseMeta,
    senderContext,
    lookupEncounter,
  );

  // PV1 required and invalid → hard error, no bundle
  if (encounterResult.error) {
    return {
      messageUpdate: {
        status: "error",
        error: encounterResult.error,
        patient: patientRef,
      },
    };
  }

  const { encounterRef, encounterEntry, patientClassTaskEntry } = encounterResult;

  const obrGroups = groupSegmentsByOBR(parsed);

  const entries: BundleEntry[] = [];
  const allMappingErrors: MappingError[] = [];

  for (const group of obrGroups) {
    const { entries: groupEntries, mappingErrors } = await processOBRGroup(
      group,
      senderContext,
      baseMeta,
      patientRef,
      encounterRef,
    );
    entries.push(...groupEntries);
    allMappingErrors.push(...mappingErrors);
  }

  if (allMappingErrors.length > 0) {
    return buildMappingErrorResult(senderContext, allMappingErrors);
  }

  // Include draft patient in bundle if created
  if (patientEntry) {
    entries.unshift(patientEntry);
  }

  // Include draft encounter in bundle if created
  if (encounterEntry) {
    entries.unshift(encounterEntry);
  }

  // Include patient class mapping task for tracking (does not block message)
  if (patientClassTaskEntry) {
    entries.push(patientClassTaskEntry);
  }

  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };

  // PV1 not required but invalid → warning, submit clinical data without Encounter
  if (encounterResult.warning) {
    return {
      bundle,
      messageUpdate: {
        status: "warning",
        error: encounterResult.warning,
        patient: patientRef,
      },
    };
  }

  return {
    bundle,
    messageUpdate: {
      status: "processed",
      patient: patientRef,
    },
  };
}

export default convertORU_R01;

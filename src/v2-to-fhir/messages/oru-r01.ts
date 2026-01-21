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
import type { ConversionResult } from "../converter";
import {
  fromMSH,
  fromPID,
  fromOBR,
  fromNTE,
  fromSPM,
  type MSH,
  type PID,
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
  Coding,
  Meta,
  Resource,
  Reference,
  Task,
  TaskInput,
} from "../../fhir/hl7-fhir-r4-core";
import { getResourceWithETag, NotFoundError } from "../../aidbox";
import { convertPIDToPatient } from "../segments/pid-patient";
import type { UnmappedCode } from "../../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import { convertOBRToDiagnosticReport } from "../segments/obr-diagnosticreport";
import { convertOBXToObservation } from "../segments/obx-observation";
import { convertNTEsToAnnotation } from "../segments/nte-annotation";
import {
  buildCodeableConcept,
  LoincResolutionError,
  resolveToLoinc,
  fetchConceptMap,
  generateConceptMapId,
  type SenderContext,
} from "../../code-mapping/concept-map";
import { simpleHash } from "../../utils/string";

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
 * Extract patient ID from PID segment.
 * Tries PID-2 first, then falls back to PID-3.1 (first identifier).
 *
 * Design note: PID-2 was deprecated in HL7 v2.4+ in favor of PID-3, but many
 * legacy systems still use PID-2. We check PID-2 first for backward compatibility
 * with older message formats.
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

export async function convertOBXToObservationResolving(
  obx: OBX,
  obrFillerOrderNumber: string,
  senderContext: SenderContext,
): Promise<Observation> {
  const resolution = await resolveToLoinc(
    obx.$3_observationIdentifier,
    senderContext,
    fetchConceptMap,
  );
  const resolvedCode = buildCodeableConcept(resolution);
  const observation = convertOBXToObservation(obx, obrFillerOrderNumber);
  observation.code = resolvedCode;
  return observation;
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

function findSegment(
  message: HL7v2Message,
  name: string,
): HL7v2Segment | undefined {
  return message.find((s) => s.segment === name);
}

function findAllSegments(message: HL7v2Message, name: string): HL7v2Segment[] {
  return message.filter((s) => s.segment === name);
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
 * Create a bundle entry for a Task (conditional create - skips if exists)
 */
function createTaskBundleEntry(task: Task): BundleEntry {
  return {
    resource: task,
    request: {
      method: "POST",
      url: "Task",
      ifNoneExist: `_id=${task.id}`,
    },
  };
}

function generateMappingTaskId(
  conceptMapId: string,
  localSystem: string,
  localCode: string,
): string {
  const systemHash = simpleHash(localSystem);
  const codeHash = simpleHash(localCode);
  return `map-${conceptMapId}-${systemHash}-${codeHash}`;
}

function createMappingTask(
  sender: SenderContext,
  error: LoincResolutionError,
): Task {
  const conceptMapId = generateConceptMapId(sender);
  const taskId = generateMappingTaskId(
    conceptMapId,
    error.localSystem || "",
    error.localCode || "",
  );

  const inputs: TaskInput[] = [
    {
      type: { text: "Sending application" },
      valueString: sender.sendingApplication,
    },
    {
      type: { text: "Sending facility" },
      valueString: sender.sendingFacility,
    },
    { type: { text: "Local code" }, valueString: error.localCode || "" },
    { type: { text: "Local display" }, valueString: error.localDisplay || "" },
    { type: { text: "Local system" }, valueString: error.localSystem || "" },
  ];

  const now = new Date().toISOString();

  return {
    resourceType: "Task",
    id: taskId,
    status: "requested",
    intent: "order",
    code: {
      coding: [
        {
          system: "http://example.org/task-codes",
          code: "local-to-loinc-mapping",
          display: "Local code to LOINC mapping",
        },
      ],
      text: "Map local lab code to LOINC",
    },
    authoredOn: now,
    lastModified: now,
    requester: { display: "ORU Processor" },
    owner: { display: "Mapping Team" },
    input: inputs,
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
  fillerOrderNumber: string,
  index: number,
): Specimen {
  // Generate ID: {OBR-3}-specimen-{index}
  const id = `${fillerOrderNumber.toLowerCase()}-specimen-${index}`.replace(
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
  fillerOrderNumber: string,
): Specimen | undefined {
  if (!obr.$15_specimenSource) return undefined;

  const sps = obr.$15_specimenSource;
  const id = `${fillerOrderNumber.toLowerCase()}-specimen-obr15`.replace(
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
 * Handle patient lookup and draft creation for ORU_R01.
 *
 * - Extracts patient ID from PID-2 or PID-3.1
 * - Looks up existing patient (does NOT update - ADT is source of truth)
 * - Creates draft patient with active=false if not found
 *
 * Race condition note: If two ORU messages for the same non-existent patient
 * arrive simultaneously, both will PUT the same draft patient. This is acceptable
 * because draft patients are temporary placeholders that ADT will overwrite with
 * authoritative data.
 */
async function handlePatient(
  pid: PID,
  baseMeta: Meta,
  lookupPatient: PatientLookupFn,
): Promise<PatientHandlingResult> {
  const patientId = extractPatientId(pid);
  const patientRef = { reference: `Patient/${patientId}` } as Reference<"Patient">;

  const existingPatient = await lookupPatient(patientId);

  if (existingPatient) {
    return { patientRef, patientEntry: null };
  }

  const draftPatient = createDraftPatient(pid, patientId, baseMeta);
  const patientEntry = createBundleEntry(draftPatient);

  return { patientRef, patientEntry };
}

function getFillerOrderNumber(obr: OBR): string {
  if (!obr.$3_fillerOrderNumber?.$1_value) {
    throw new Error(
      "OBR-3 (Filler Order Number) is required for deterministic ID generation",
    );
  }
  return obr.$3_fillerOrderNumber.$1_value;
}

interface ProcessObservationsResult {
  observations: Observation[];
  mappingErrors: LoincResolutionError[];
}

async function processObservations(
  observationGroups: OBRGroup["observations"],
  fillerOrderNumber: string,
  senderContext: SenderContext,
  baseMeta: Meta,
): Promise<ProcessObservationsResult> {
  const observations: Observation[] = [];
  const mappingErrors: LoincResolutionError[] = [];

  for (const obsGroup of observationGroups) {
    const obx = fromOBX(obsGroup.obx);

    let observation: Observation;
    try {
      observation = await convertOBXToObservationResolving(
        obx,
        fillerOrderNumber,
        senderContext,
      );
    } catch (error) {
      if (error instanceof LoincResolutionError) {
        mappingErrors.push(error);
        continue;
      }
      throw error;
    }

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
  fillerOrderNumber: string,
  baseMeta: Meta,
): Specimen[] {
  const specimens: Specimen[] = [];

  if (specimenSegments.length > 0) {
    for (const [index, segment] of specimenSegments.entries()) {
      const spm = fromSPM(segment);
      const specimen = convertSPMToSpecimen(spm, fillerOrderNumber, index + 1);
      specimen.meta = { ...specimen.meta, ...baseMeta };
      specimens.push(specimen);
    }
  } else {
    const specimen = createSpecimenFromOBR15(obr, fillerOrderNumber);
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
  mappingErrors: LoincResolutionError[];
}

async function processOBRGroup(
  group: OBRGroup,
  senderContext: SenderContext,
  baseMeta: Meta,
  patientRef: Reference<"Patient">,
): Promise<ProcessOBRGroupResult> {
  const obr = fromOBR(group.obr);
  const fillerOrderNumber = getFillerOrderNumber(obr);

  const diagnosticReport = convertOBRToDiagnosticReport(obr);
  diagnosticReport.meta = { ...diagnosticReport.meta, ...baseMeta };
  diagnosticReport.result = [];

  const { observations, mappingErrors } = await processObservations(
    group.observations,
    fillerOrderNumber,
    senderContext,
    baseMeta,
  );

  diagnosticReport.result = observations.map(
    (obs) =>
      ({ reference: `Observation/${obs.id}` }) as Reference<"Observation">,
  );

  const specimens = processSpecimens(
    group.specimens,
    obr,
    fillerOrderNumber,
    baseMeta,
  );

  linkSpecimensToResources(specimens, diagnosticReport, observations);
  linkPatientToResources(patientRef, diagnosticReport, observations, specimens);

  const entries = buildBundleEntries(diagnosticReport, observations, specimens);
  return { entries, mappingErrors };
}

/**
 * Convert HL7v2 ORU_R01 message to FHIR Transaction Bundle
 *
 * Message Structure:
 * MSH - Message Header (1)
 * PID - Patient Identification (1) - required
 * PV1 - Patient Visit (1) - optional
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
 */
export async function convertORU_R01(
  parsed: HL7v2Message,
  lookupPatient: PatientLookupFn = defaultPatientLookup,
): Promise<ConversionResult> {
  const { senderContext, baseMeta } = parseMSH(parsed);
  validateOBRPresence(parsed);

  const pid = parsePID(parsed);
  const { patientRef, patientEntry } = await handlePatient(
    pid,
    baseMeta,
    lookupPatient,
  );

  const obrGroups = groupSegmentsByOBR(parsed);

  const entries: BundleEntry[] = [];
  const allMappingErrors: LoincResolutionError[] = [];

  for (const group of obrGroups) {
    const { entries: groupEntries, mappingErrors } = await processOBRGroup(
      group,
      senderContext,
      baseMeta,
      patientRef,
    );
    entries.push(...groupEntries);
    allMappingErrors.push(...mappingErrors);
  }

  if (allMappingErrors.length > 0) {
    return buildMappingErrorResult(senderContext, allMappingErrors, patientRef, patientEntry);
  }

  // Include draft patient in bundle if created
  if (patientEntry) {
    entries.unshift(patientEntry);
  }

  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };

  return {
    bundle,
    messageUpdate: {
      status: "processed",
      patient: patientRef,
    },
  };
}

function buildMappingErrorResult(
  senderContext: SenderContext,
  mappingErrors: LoincResolutionError[],
  patientRef: Reference<"Patient">,
  patientEntry: BundleEntry | null,
): ConversionResult {
  const conceptMapId = generateConceptMapId(senderContext);
  const seenTaskIds = new Set<string>();
  const entries: BundleEntry[] = [];

  if (patientEntry) {
    entries.push(patientEntry);
  }
  const unmappedCodes: UnmappedCode[] = [];

  for (const error of mappingErrors) {
    if (!error.localCode || !error.localSystem) continue;

    const taskId = generateMappingTaskId(
      conceptMapId,
      error.localSystem,
      error.localCode,
    );

    if (seenTaskIds.has(taskId)) continue;
    seenTaskIds.add(taskId);

    const task = createMappingTask(senderContext, error);
    entries.push(createTaskBundleEntry(task));

    unmappedCodes.push({
      localCode: error.localCode,
      localDisplay: error.localDisplay,
      localSystem: error.localSystem,
      mappingTask: { reference: `Task/${taskId}` },
    });
  }

  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };

  return {
    bundle,
    messageUpdate: {
      status: "mapping_error",
      unmappedCodes,
      patient: patientRef,
    },
  };
}

export default convertORU_R01;

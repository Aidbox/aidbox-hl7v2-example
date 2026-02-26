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
  fromPID,
  fromOBR,
  fromNTE,
  fromSPM,
  type PID,
  type OBR,
  type SPM,
} from "../../hl7v2/generated/fields";
import { fromOBX } from "../../hl7v2/wrappers";
import type {
  Bundle,
  BundleEntry,
  DiagnosticReport,
  Observation,
  Specimen,
  Meta,
  Reference,
} from "../../fhir/hl7-fhir-r4-core";
import { convertNTEsToAnnotation } from "../segments/nte-annotation";
import {
  buildMappingErrorResult,
  type MappingError,
} from "../../code-mapping/mapping-errors";
import type { SenderContext } from "../../code-mapping/concept-map";
import { convertOBRWithMappingSupport } from "../segments/obr-diagnosticreport";
import type { ConverterContext } from "../converter-context";

import { parseMSH, addSenderTagToMeta } from "../segments/msh-parsing";
import { handlePatient, extractSenderTag } from "../segments/pid-patient";
import { parsePV1, handleEncounter } from "../segments/pv1-encounter";
import { createBundleEntry } from "../fhir-bundle";
import { convertOBXToObservationResolving } from "../segments/obx-observation";
import { convertDTMToDateTime } from "../datatypes/dtm-datetime";

// Re-export for backwards compatibility (OBXResolutionResult was exported from this module)
export type { OBXResolutionResult } from "../segments/obx-observation";

interface OBRGroup {
  obr: HL7v2Segment;
  observations: Array<{
    obx: HL7v2Segment;
    ntes: HL7v2Segment[];
  }>;
  specimens: HL7v2Segment[];
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

function validateOBRPresence(message: HL7v2Message): void {
  const obrSegments = findAllSegments(message, "OBR");
  if (obrSegments.length === 0) {
    throw new Error("OBR segment not found in ORU_R01 message");
  }
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

  const mappingErrors: MappingError[] = [];
  if (obrResult.error) {
    mappingErrors.push(obrResult.error);
    return { entries: [], mappingErrors };
  }

  const diagnosticReport = obrResult.diagnosticReport;
  diagnosticReport.meta = { ...diagnosticReport.meta, ...baseMeta };
  diagnosticReport.result = [];

  const { observations, mappingErrors: obxMappingErrors } =
    await processObservations(
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
 * - PV1 required/optional determined by config.messages?.["ORU-R01"].converter.PV1.required
 * - If PV1 valid: creates/looks up Encounter with strict HL7 v2.8.2 authority validation
 * - If PV1 not required and missing/invalid: skip Encounter, set status=warning
 * - If PV1 required and missing/invalid: set status=error, no bundle submitted
 * - Links DiagnosticReport and Observation to Encounter when present
 */
export async function convertORU_R01(
  parsed: HL7v2Message,
  context: ConverterContext,
): Promise<ConversionResult> {
  const { resolvePatientId, lookupPatient, lookupEncounter, config } = context;
  const { senderContext, baseMeta } = parseMSH(parsed, "ORU_R01");
  validateOBRPresence(parsed);

  const pid = parsePID(parsed);

  const senderTag = extractSenderTag(pid);
  addSenderTagToMeta(baseMeta, senderTag);

  const patientResult = await handlePatient(
    pid,
    baseMeta,
    lookupPatient,
    resolvePatientId,
  );

  if ("error" in patientResult) {
    return {
      messageUpdate: { status: "error", error: patientResult.error },
    };
  }

  const { patientRef, patientEntry } = patientResult;

  const pv1 = parsePV1(parsed);
  const encounterResult = await handleEncounter(
    pv1,
    patientRef,
    baseMeta,
    senderContext,
    lookupEncounter,
    config,
    "ORU-R01",
  );

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

  if (patientEntry) {
    entries.unshift(patientEntry);
  }

  if (encounterEntry) {
    entries.unshift(encounterEntry);
  }

  if (patientClassTaskEntry) {
    entries.push(patientClassTaskEntry);
  }

  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };

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

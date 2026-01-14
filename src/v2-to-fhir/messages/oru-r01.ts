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

import { parseMessage } from "@atomic-ehr/hl7v2";
import type { HL7v2Message, HL7v2Segment } from "../../hl7v2/generated/types";
import {
  fromMSH,
  fromOBR,
  fromNTE,
  fromSPM,
  type MSH,
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
  Coding,
  Meta,
  Resource,
  Reference,
} from "../../fhir/hl7-fhir-r4-core";
import { convertOBRToDiagnosticReport } from "../segments/obr-diagnosticreport";
import { convertOBXToObservation } from "../segments/obx-observation";
import { convertNTEsToAnnotation } from "../segments/nte-annotation";
import {
  buildCodeableConcept,
  LoincResolutionError,
  MappingErrorCollection,
  resolveToLoinc,
  type SenderContext,
} from "../code-mapping/conceptmap-lookup";

export async function convertOBXToObservationResolving(
  obx: OBX,
  obrFillerOrderNumber: string,
  senderContext: SenderContext,
): Promise<Observation> {
  const resolution = await resolveToLoinc(
    obx.$3_observationIdentifier,
    senderContext,
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
  if (spm.$17_specimenCollectionDateTime) {
    const collectionTime = spm.$17_specimenCollectionDateTime;
    if (collectionTime.$1_rangeStartDatetime) {
      specimen.collection = {
        collectedDateTime: convertDTMToDateTime(
          collectionTime.$1_rangeStartDatetime,
        ),
      };
    }
  }

  // SPM-18: Specimen Received Date/Time
  if (spm.$18_specimenReceivedDateTime) {
    specimen.receivedTime = convertDTMToDateTime(
      spm.$18_specimenReceivedDateTime,
    );
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
  if (sps.$1_specimenSourceName) {
    specimen.type = {
      coding: [
        {
          code: sps.$1_specimenSourceName.$1_code,
          display: sps.$1_specimenSourceName.$2_text,
        },
      ],
      text: sps.$1_specimenSourceName.$2_text,
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

function getFillerOrderNumber(obr: OBR): string {
  if (!obr.$3_fillerOrderNumber?.$1_value) {
    throw new Error(
      "OBR-3 (Filler Order Number) is required for deterministic ID generation",
    );
  }
  return obr.$3_fillerOrderNumber.$1_value;
}

async function processObservations(
  observationGroups: OBRGroup["observations"],
  fillerOrderNumber: string,
  senderContext: SenderContext,
  baseMeta: Meta,
): Promise<Observation[]> {
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

  if (mappingErrors.length > 0) {
    throw new MappingErrorCollection(
      mappingErrors,
      senderContext.sendingApplication,
      senderContext.sendingFacility,
    );
  }

  return observations;
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

async function processOBRGroup(
  group: OBRGroup,
  senderContext: SenderContext,
  baseMeta: Meta,
): Promise<BundleEntry[]> {
  const obr = fromOBR(group.obr);
  const fillerOrderNumber = getFillerOrderNumber(obr);

  const diagnosticReport = convertOBRToDiagnosticReport(obr);
  diagnosticReport.meta = { ...diagnosticReport.meta, ...baseMeta };
  diagnosticReport.result = [];

  const observations = await processObservations(
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

  return buildBundleEntries(diagnosticReport, observations, specimens);
}

/**
 * Convert HL7v2 ORU_R01 message to FHIR Transaction Bundle
 *
 * Message Structure:
 * MSH - Message Header (1)
 * PID - Patient Identification (1) - optional
 * PV1 - Patient Visit (1) - optional
 * { OBR - Observation Request (1)
 *   { OBX - Observation Result (0..*)
 *     NTE - Notes and Comments (0..*)
 *   }
 *   SPM - Specimen (0..*)
 * }
 */
export async function convertORU_R01(message: string): Promise<Bundle> {
  const parsed = parseMessage(message);

  const { senderContext, baseMeta } = parseMSH(parsed);
  validateOBRPresence(parsed);

  const obrGroups = groupSegmentsByOBR(parsed);

  const entries: BundleEntry[] = [];
  for (const group of obrGroups) {
    const groupEntries = await processOBRGroup(group, senderContext, baseMeta);
    entries.push(...groupEntries);
  }

  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };
}

export default convertORU_R01;

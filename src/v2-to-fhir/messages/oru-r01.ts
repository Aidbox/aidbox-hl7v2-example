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
  fromOBX,
  fromNTE,
  fromSPM,
  type MSH,
  type OBR,
  type OBX,
  type NTE,
  type SPM,
} from "../../hl7v2/generated/fields";
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

/**
 * Reconstruct SN (Structured Numeric) value from parsed components
 * SN uses caret (^) as internal separator, which gets split by the parser
 */
function reconstructSNValue(rawField: unknown): string | undefined {
  if (!rawField) return undefined;
  if (typeof rawField === "string") return rawField;
  if (typeof rawField === "object" && rawField !== null) {
    // Reconstruct from components: {1: ">", 2: "90"} -> ">^90"
    const obj = rawField as Record<string, string>;
    const parts: string[] = [];
    let i = 1;
    while (obj[i] !== undefined) {
      parts.push(obj[i]);
      i++;
    }
    return parts.join("^");
  }
  return undefined;
}

// ============================================================================
// Types
// ============================================================================

interface OBRGroup {
  obr: HL7v2Segment;
  observations: Array<{
    obx: HL7v2Segment;
    ntes: HL7v2Segment[];
  }>;
  specimens: HL7v2Segment[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function findSegment(
  message: HL7v2Message,
  name: string
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
  method: "PUT" | "POST" = "PUT"
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
  index: number
): Specimen {
  // Generate ID: {OBR-3}-specimen-{index}
  const id = `${fillerOrderNumber.toLowerCase()}-specimen-${index}`.replace(
    /[^a-z0-9-]/g,
    "-"
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
          collectionTime.$1_rangeStartDatetime
        ),
      };
    }
  }

  // SPM-18: Specimen Received Date/Time
  if (spm.$18_specimenReceivedDateTime) {
    specimen.receivedTime = convertDTMToDateTime(spm.$18_specimenReceivedDateTime);
  }

  return specimen;
}

/**
 * Create Specimen from OBR-15 (fallback for older versions)
 */
function createSpecimenFromOBR15(
  obr: OBR,
  fillerOrderNumber: string
): Specimen | undefined {
  if (!obr.$15_specimenSource) return undefined;

  const sps = obr.$15_specimenSource;
  const id = `${fillerOrderNumber.toLowerCase()}-specimen-obr15`.replace(
    /[^a-z0-9-]/g,
    "-"
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

// ============================================================================
// Main Converter Function
// ============================================================================

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
export function convertORU_R01(message: string): Bundle {
  const parsed = parseMessage(message);

  // =========================================================================
  // Extract and Validate MSH
  // =========================================================================

  const mshSegment = findSegment(parsed, "MSH");
  if (!mshSegment) {
    throw new Error("MSH segment not found in ORU_R01 message");
  }
  const msh = fromMSH(mshSegment);
  const messageControlId = msh.$10_messageControlId;

  // Create base meta with tags
  const baseMeta: Meta = {
    tag: extractMetaTags(msh),
  };

  // =========================================================================
  // Validate OBR presence
  // =========================================================================

  const obrSegments = findAllSegments(parsed, "OBR");
  if (obrSegments.length === 0) {
    throw new Error("OBR segment not found in ORU_R01 message");
  }

  // =========================================================================
  // Group Segments by OBR
  // =========================================================================

  const obrGroups = groupSegmentsByOBR(parsed);

  // =========================================================================
  // Process Each OBR Group
  // =========================================================================

  const entries: BundleEntry[] = [];

  for (const group of obrGroups) {
    const obr = fromOBR(group.obr);

    // Validate OBR-3 (Filler Order Number)
    if (!obr.$3_fillerOrderNumber?.$1_value) {
      throw new Error(
        "OBR-3 (Filler Order Number) is required for deterministic ID generation"
      );
    }

    const fillerOrderNumber = obr.$3_fillerOrderNumber.$1_value;

    // -----------------------------------------------------------------------
    // Convert OBR → DiagnosticReport
    // -----------------------------------------------------------------------

    const diagnosticReport = convertOBRToDiagnosticReport(obr);
    diagnosticReport.meta = { ...diagnosticReport.meta, ...baseMeta };

    // Initialize result array for observations
    diagnosticReport.result = [];

    // -----------------------------------------------------------------------
    // Convert OBX[] → Observation[]
    // -----------------------------------------------------------------------

    const observations: Observation[] = [];

    for (const obsGroup of group.observations) {
      const obx = fromOBX(obsGroup.obx);

      // Fix SN values that were incorrectly parsed (caret is component separator in SN)
      if (obx.$2_valueType?.toUpperCase() === "SN") {
        const rawField = (obsGroup.obx as { fields: Record<number, unknown> }).fields[5];
        const reconstructed = reconstructSNValue(rawField);
        if (reconstructed) {
          obx.$5_observationValue = [reconstructed];
        }
      }

      const observation = convertOBXToObservation(obx, fillerOrderNumber);
      observation.meta = { ...observation.meta, ...baseMeta };

      // Convert NTE[] → note
      if (obsGroup.ntes.length > 0) {
        const ntes = obsGroup.ntes.map((seg) => fromNTE(seg));
        const annotation = convertNTEsToAnnotation(ntes);
        if (annotation) {
          observation.note = [annotation];
        }
      }

      observations.push(observation);

      // Add reference to DiagnosticReport.result
      diagnosticReport.result.push({
        reference: `Observation/${observation.id}`,
      } as Reference<"Observation">);
    }

    // -----------------------------------------------------------------------
    // Convert SPM[] → Specimen[] (or use OBR-15 fallback)
    // -----------------------------------------------------------------------

    const specimens: Specimen[] = [];

    if (group.specimens.length > 0) {
      // Use SPM segments
      for (let i = 0; i < group.specimens.length; i++) {
        const spm = fromSPM(group.specimens[i]);
        const specimen = convertSPMToSpecimen(spm, fillerOrderNumber, i + 1);
        specimen.meta = { ...specimen.meta, ...baseMeta };
        specimens.push(specimen);
      }
    } else {
      // Fallback to OBR-15
      const specimen = createSpecimenFromOBR15(obr, fillerOrderNumber);
      if (specimen) {
        specimen.meta = { ...specimen.meta, ...baseMeta };
        specimens.push(specimen);
      }
    }

    // Link specimens to DiagnosticReport and Observations
    if (specimens.length > 0) {
      diagnosticReport.specimen = specimens.map(
        (s) =>
          ({
            reference: `Specimen/${s.id}`,
          }) as Reference<"Specimen">
      );

      // Link first specimen to all observations
      const specimenRef = { reference: `Specimen/${specimens[0].id}` };
      for (const obs of observations) {
        obs.specimen = specimenRef as Reference<"Specimen">;
      }
    }

    // -----------------------------------------------------------------------
    // Add to Bundle Entries
    // -----------------------------------------------------------------------

    // Add DiagnosticReport
    entries.push(createBundleEntry(diagnosticReport));

    // Add Observations
    for (const obs of observations) {
      entries.push(createBundleEntry(obs));
    }

    // Add Specimens
    for (const spec of specimens) {
      entries.push(createBundleEntry(spec));
    }
  }

  // =========================================================================
  // Build Transaction Bundle
  // =========================================================================

  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };

  return bundle;
}

export default convertORU_R01;

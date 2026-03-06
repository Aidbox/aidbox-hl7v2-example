/**
 * VXU_V04 message structure wrapper.
 *
 * Corrects two gaps in @atomic-ehr/hl7v2's v2.5 message structures:
 * 1. PERSON_OBSERVATION group (added in v2.8.2) is missing — extracted by position
 * 2. ORC is marked required [1..1] in ORDER per v2.5 spec, but real-world senders omit it
 *
 * Provides VXUOrderGroup (with optional ORC), groupVXUOrders(), and extractPersonObservations().
 */

import type { HL7v2Message, HL7v2Segment } from "../generated/types";

export interface VXUOrderGroup {
  orc?: HL7v2Segment;
  rxa: HL7v2Segment;
  rxr?: HL7v2Segment;
  observations: Array<{ obx: HL7v2Segment; ntes: HL7v2Segment[] }>;
}

/** Builder type used during grouping — rxa starts optional, confirmed before flush. */
interface VXUOrderGroupBuilder {
  orc?: HL7v2Segment;
  rxa?: HL7v2Segment;
  rxr?: HL7v2Segment;
  observations: Array<{ obx: HL7v2Segment; ntes: HL7v2Segment[] }>;
}

/**
 * Group VXU_V04 flat segment list into ORDER groups.
 *
 * Walks segments sequentially, starting a new ORDER group on ORC or RXA
 * (whichever appears). ORC is optional — RXA without a preceding ORC is a
 * valid group. RXR and OBX+NTE are collected into the current group.
 *
 * Returns an error string if an ORC is not followed by an RXA before the
 * next ORC/RXA or end of message.
 *
 * Segments before the first ORC/RXA (MSH, PID, PV1, person-level OBX) are
 * skipped — use extractPersonObservations() for patient-level OBX.
 */
export function groupVXUOrders(
  message: HL7v2Message,
): { groups: VXUOrderGroup[] } | { error: string } {
  const groups: VXUOrderGroup[] = [];
  let currentGroup: VXUOrderGroupBuilder | null = null;
  let currentObservation: { obx: HL7v2Segment; ntes: HL7v2Segment[] } | null = null;
  let orderRegionStarted = false;

  for (const segment of message) {
    switch (segment.segment) {
      case "ORC": {
        const flushed = flushGroup(currentGroup, currentObservation);
        if ("error" in flushed) return flushed;
        if (flushed.group) groups.push(flushed.group);

        currentObservation = null;
        orderRegionStarted = true;
        currentGroup = { orc: segment, observations: [] };
        break;
      }

      case "RXA": {
        if (currentGroup && !currentGroup.rxa) {
          // ORC already started this group, attach RXA
          currentGroup.rxa = segment;
        } else {
          // Either no current group or current group already has RXA — start new group
          const flushed = flushGroup(currentGroup, currentObservation);
          if ("error" in flushed) return flushed;
          if (flushed.group) groups.push(flushed.group);

          currentObservation = null;
          orderRegionStarted = true;
          currentGroup = { rxa: segment, observations: [] };
        }
        break;
      }

      case "RXR": {
        if (currentGroup?.rxa && !currentGroup.rxr) {
          currentGroup.rxr = segment;
        }
        break;
      }

      case "OBX": {
        if (!orderRegionStarted || !currentGroup?.rxa) break;

        if (currentObservation) {
          currentGroup.observations.push(currentObservation);
        }
        currentObservation = { obx: segment, ntes: [] };
        break;
      }

      case "NTE": {
        if (currentObservation) {
          currentObservation.ntes.push(segment);
        }
        break;
      }
    }
  }

  // Flush final group
  const flushed = flushGroup(currentGroup, currentObservation);
  if ("error" in flushed) return flushed;
  if (flushed.group) groups.push(flushed.group);

  return { groups };
}

type FlushResult = { group: VXUOrderGroup | null } | { error: string };

/**
 * Finalize a pending ORDER group into a VXUOrderGroup.
 * Returns the completed group (or null if nothing to flush), or an error
 * if the group has ORC but no RXA.
 */
function flushGroup(
  builder: VXUOrderGroupBuilder | null,
  pendingObservation: { obx: HL7v2Segment; ntes: HL7v2Segment[] } | null,
): FlushResult {
  if (!builder) return { group: null };

  if (!builder.rxa) {
    if (builder.orc) {
      return { error: "ORDER group requires RXA segment" };
    }
    // Unreachable: builder is always created with orc or rxa
    return { group: null };
  }

  const observations = pendingObservation
    ? [...builder.observations, pendingObservation]
    : builder.observations;

  return { group: { ...builder, rxa: builder.rxa, observations } };
}

/**
 * Extract PERSON_OBSERVATION OBX segments (before the first ORC or RXA).
 *
 * These are patient-level observations (e.g., disease history) that appear
 * before the ORDER region. Per CDC IIS IG practice, not base HL7v2 v2.5.
 * Returns OBX segments with their trailing NTE segments.
 */
export function extractPersonObservations(
  message: HL7v2Message,
): Array<{ obx: HL7v2Segment; ntes: HL7v2Segment[] }> {
  const observations: Array<{ obx: HL7v2Segment; ntes: HL7v2Segment[] }> = [];
  let currentObservation: { obx: HL7v2Segment; ntes: HL7v2Segment[] } | null = null;

  for (const segment of message) {
    if (segment.segment === "ORC" || segment.segment === "RXA") {
      break;
    }

    if (segment.segment === "OBX") {
      if (currentObservation) {
        observations.push(currentObservation);
      }
      currentObservation = { obx: segment, ntes: [] };
    } else if (segment.segment === "NTE" && currentObservation) {
      currentObservation.ntes.push(segment);
    }
  }

  if (currentObservation) {
    observations.push(currentObservation);
  }

  return observations;
}

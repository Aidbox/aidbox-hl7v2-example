/**
 * HL7v2 ORM_O01 Message to FHIR Bundle Converter
 *
 * ORM_O01 - General Order Message
 *
 * Creates:
 * - ServiceRequest from ORC + OBR (diagnostic/lab/radiology orders)
 * - MedicationRequest from ORC + RXO (pharmacy/medication orders)
 * - Condition from DG1
 * - Observation from OBX (supporting observations, no LOINC resolution)
 * - Coverage from IN1
 *
 * Supports multiple ORDER groups per message with independent order types.
 */

import type { HL7v2Message, HL7v2Segment } from "../../hl7v2/generated/types";
import type { ORC, PV1, EI } from "../../hl7v2/generated/fields";
import { fromORC } from "../../hl7v2/generated/fields";
import { sanitizeForId } from "../identity-system/utils";

// ============================================================================
// Order Grouping Types
// ============================================================================

export interface ORMOrderGroup {
  orc: HL7v2Segment;
  orderChoice?: HL7v2Segment;
  orderChoiceType: "OBR" | "RXO" | "unknown";
  ntes: HL7v2Segment[];
  dg1s: HL7v2Segment[];
  observations: Array<{ obx: HL7v2Segment; ntes: HL7v2Segment[] }>;
}

// ============================================================================
// Order Grouping
// ============================================================================

/**
 * Group ORM message segments by ORC boundaries.
 *
 * Each ORC starts a new ORDER group. Segments between ORCs belong to
 * the current group. The ORDER_CHOICE type is detected by scanning for
 * the first OBR or RXO segment within the group.
 *
 * NTE placement: NTEs after an OBX attach to that observation;
 * NTEs after OBR/RXO (before any OBX) attach as order-level notes.
 *
 * Only processes segments after the first ORC (PID, PV1, IN1 etc.
 * are handled separately by the main converter).
 */
export function groupORMOrders(message: HL7v2Message): ORMOrderGroup[] {
  const groups: ORMOrderGroup[] = [];
  let currentGroup: ORMOrderGroup | null = null;
  let currentObservation: { obx: HL7v2Segment; ntes: HL7v2Segment[] } | null = null;
  let firstOrcSeen = false;

  for (const segment of message) {
    switch (segment.segment) {
      case "ORC": {
        // Flush pending observation from previous group
        if (currentObservation && currentGroup) {
          currentGroup.observations.push(currentObservation);
          currentObservation = null;
        }

        firstOrcSeen = true;
        currentGroup = {
          orc: segment,
          orderChoiceType: "unknown",
          ntes: [],
          dg1s: [],
          observations: [],
        };
        groups.push(currentGroup);
        break;
      }

      case "OBR": {
        if (!firstOrcSeen || !currentGroup) break;
        if (!currentGroup.orderChoice) {
          currentGroup.orderChoice = segment;
          currentGroup.orderChoiceType = "OBR";
        }
        break;
      }

      case "RXO": {
        if (!firstOrcSeen || !currentGroup) break;
        if (!currentGroup.orderChoice) {
          currentGroup.orderChoice = segment;
          currentGroup.orderChoiceType = "RXO";
        }
        break;
      }

      case "NTE": {
        if (!firstOrcSeen || !currentGroup) break;
        if (currentObservation) {
          // NTE after OBX -> observation-level note
          currentObservation.ntes.push(segment);
        } else {
          // NTE before any OBX -> order-level note
          currentGroup.ntes.push(segment);
        }
        break;
      }

      case "DG1": {
        if (!firstOrcSeen || !currentGroup) break;
        currentGroup.dg1s.push(segment);
        break;
      }

      case "OBX": {
        if (!firstOrcSeen || !currentGroup) break;
        // Flush previous observation
        if (currentObservation) {
          currentGroup.observations.push(currentObservation);
        }
        currentObservation = { obx: segment, ntes: [] };
        break;
      }
    }
  }

  // Flush last pending observation
  if (currentObservation && currentGroup) {
    currentGroup.observations.push(currentObservation);
  }

  return groups;
}

// ============================================================================
// Order Number Resolution
// ============================================================================

export interface OrderNumberResult {
  orderNumber: string;
  error?: never;
}

export interface OrderNumberError {
  orderNumber?: never;
  error: string;
}

/**
 * Resolve the deterministic order number for an ORDER group.
 *
 * Priority:
 * 1. ORC-2 (Placer Order Number) - EI.1, optionally suffixed with -EI.2 when namespace present
 * 2. OBR-2 (Placer Order Number) fallback - only for OBR-based orders, same format
 * 3. Reject with error if neither provides a usable identifier
 *
 * @param orc - Parsed ORC segment
 * @param obrPlacerOrderNumber - OBR-2 Placer Order Number (only for OBR-based orders)
 */
export function resolveOrderNumber(
  orc: ORC,
  obrPlacerOrderNumber?: EI,
): OrderNumberResult | OrderNumberError {
  const orcId = buildIdFromEI(orc.$2_placerOrderNumber);
  if (orcId) {
    return { orderNumber: orcId };
  }

  if (obrPlacerOrderNumber) {
    const obrId = buildIdFromEI(obrPlacerOrderNumber);
    if (obrId) {
      return { orderNumber: obrId };
    }
  }

  return { error: "No usable order number: ORC-2 empty and OBR-2 empty (or not applicable)" };
}

/**
 * Build a sanitized ID string from an EI (Entity Identifier) field.
 *
 * Uses EI.1 as the base. If EI.2 (namespace) is present and different
 * from EI.1, appends it as a suffix: `{EI.1}-{EI.2}`.
 */
function buildIdFromEI(ei: EI | undefined): string | undefined {
  const value = ei?.$1_value?.trim();
  if (!value) return undefined;

  const namespace = ei?.$2_namespace?.trim();
  const namespaceDiffers = namespace && namespace !== value;

  const raw = namespaceDiffers ? `${value}-${namespace}` : value;
  return sanitizeForId(raw);
}

// ============================================================================
// Empty PV1 Detection
// ============================================================================

/**
 * Detect whether a PV1 segment has no meaningful clinical content.
 *
 * An empty PV1 (e.g., `PV1|`) has no PV1-2 (patient class) and no PV1-19
 * (visit number). Such segments are treated as absent by the ORM converter
 * to avoid generating spurious warnings.
 */
export function isEmptyPV1(pv1: PV1): boolean {
  const hasPatientClass = pv1.$2_class !== undefined && pv1.$2_class !== "";
  const hasVisitNumber = pv1.$19_visitNumber?.$1_value !== undefined
    && pv1.$19_visitNumber.$1_value !== "";

  return !hasPatientClass && !hasVisitNumber;
}

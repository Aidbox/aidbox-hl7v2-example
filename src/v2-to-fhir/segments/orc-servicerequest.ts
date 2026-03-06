/**
 * HL7v2 ORC Segment to FHIR ServiceRequest Mapping
 * Based on: HL7 Segment - FHIR R4_ ORC[ServiceRequest] - ORC.csv
 *
 * Builds a partial ServiceRequest from ORC fields. The caller merges
 * OBR or RXO fields on top and sets subject/encounter references.
 */

import type { ORC, XCN } from "../../hl7v2/generated/fields";
import type {
  ServiceRequest,
  Identifier,
  Reference,
} from "../../fhir/hl7-fhir-r4-core";
import { convertEIToTypedIdentifier, convertEIToIdentifierExtension } from "../datatypes/ei-coding";
import { convertCWEToCodeableConcept } from "../datatypes/cwe-codeableconcept";
import { convertXCNToPractitioner } from "../datatypes/xcn-practitioner";
import { convertDTMToDateTime } from "../datatypes/dtm-datetime";
import type { MappingError } from "../../code-mapping/mapping-errors";
import {
  generateConceptMapId,
  translateCode,
  type SenderContext,
} from "../../code-mapping/concept-map";

// ============================================================================
// ORC-5 Order Status -> FHIR request-status (HL7 Table 0038)
// ============================================================================

const ORDER_STATUS_MAP: Record<string, ServiceRequest["status"]> = {
  CA: "revoked",
  CM: "completed",
  DC: "revoked",
  ER: "entered-in-error",
  HD: "on-hold",
  IP: "active",
  RP: "revoked",
  SC: "active",
};

const ORDER_STATUS_V2_SYSTEM = "http://terminology.hl7.org/CodeSystem/v2-0038";

// ============================================================================
// ORC-1 Order Control Code -> FHIR request-status (HL7 Table 0119)
// ============================================================================

const ORDER_CONTROL_STATUS_MAP: Record<string, ServiceRequest["status"]> = {
  NW: "active",
  CA: "active",
  OC: "revoked",
  DC: "revoked",
  HD: "active",
  OH: "on-hold",
  HR: "on-hold",
  CR: "revoked",
  DR: "revoked",
};

// ============================================================================
// Valid FHIR request-status codes for ConceptMap validation
// ============================================================================

const VALID_REQUEST_STATUSES: ServiceRequest["status"][] = [
  "draft",
  "active",
  "on-hold",
  "revoked",
  "completed",
  "entered-in-error",
  "unknown",
];

// ============================================================================
// Status Resolution
// ============================================================================

export interface OrderStatusResult {
  status: ServiceRequest["status"];
  mappingError?: MappingError;
}

/**
 * Resolve ORC-based order status to FHIR request-status.
 *
 * Three-tier resolution:
 * 1. ORC-5 valued + in ORDER_STATUS_MAP (Table 0038) -> use it
 * 2. ORC-5 valued + NOT in standard map -> ConceptMap lookup via orc-status.
 *    On failure, return mapping error.
 * 3. ORC-5 empty -> use ORDER_CONTROL_STATUS_MAP from ORC-1 (Table 0119)
 * 4. Neither yields a mapping -> "unknown"
 */
export async function resolveOrderStatus(
  orc: ORC,
  senderContext: SenderContext,
): Promise<OrderStatusResult> {
  const orderStatus = orc.$5_orderStatus?.toString().trim() || undefined;

  if (orderStatus) {
    const uppercaseStatus = orderStatus.toUpperCase();

    // Tier 1: standard map
    const standardMapping = ORDER_STATUS_MAP[uppercaseStatus];
    if (standardMapping) {
      return { status: standardMapping };
    }

    // Tier 2: ConceptMap lookup for non-standard values
    const conceptMapId = generateConceptMapId(senderContext, "orc-status");
    const translateResult = await translateCode(conceptMapId, orderStatus, ORDER_STATUS_V2_SYSTEM);

    if (translateResult.status === "found" && translateResult.coding.code) {
      const resolvedStatus = translateResult.coding.code as ServiceRequest["status"];
      if (VALID_REQUEST_STATUSES.includes(resolvedStatus)) {
        return { status: resolvedStatus };
      }
    }

    // No mapping found for non-standard ORC-5 -> return mapping error
    return {
      status: "unknown",
      mappingError: {
        localCode: orderStatus,
        localDisplay: `ORC-5 Order Status: ${orderStatus}`,
        localSystem: ORDER_STATUS_V2_SYSTEM,
        mappingType: "orc-status",
      },
    };
  }

  // Tier 3: ORC-5 empty -> fall back to ORC-1
  const orderControl = orc.$1_orderControl?.toString().trim() || undefined;
  if (orderControl) {
    const controlMapping = ORDER_CONTROL_STATUS_MAP[orderControl.toUpperCase()];
    if (controlMapping) {
      return { status: controlMapping };
    }
  }

  // Tier 4: neither yields a mapping
  return { status: "unknown" };
}

// ============================================================================
// Requester Reference Builder
// ============================================================================

/**
 * Build a display-only Reference<Practitioner> from the first XCN in the array.
 * Uses inline display reference for consistency with existing converters.
 */
export function buildRequesterReference(xcns: XCN[] | undefined): Reference<"Practitioner"> | undefined {
  if (!xcns || xcns.length === 0) return undefined;

  const xcn = xcns[0]!;
  const practitioner = convertXCNToPractitioner(xcn);
  if (!practitioner) return undefined;

  const name = practitioner.name?.[0];
  const displayParts: string[] = [];
  if (name) {
    if (name.prefix) displayParts.push(...name.prefix);
    if (name.given) displayParts.push(...name.given);
    if (name.family) displayParts.push(name.family);
    if (name.suffix) displayParts.push(...name.suffix);
  }

  const ref: Reference<"Practitioner"> = {};

  if (practitioner.identifier?.[0]) {
    ref.identifier = practitioner.identifier[0];
  }

  if (displayParts.length > 0) {
    ref.display = displayParts.join(" ");
  }

  // Need at least identifier or display to be useful
  if (!ref.identifier && !ref.display) return undefined;

  return ref;
}

// ============================================================================
// Main Converter Function
// ============================================================================

export interface ORCServiceRequestResult {
  serviceRequest: Partial<ServiceRequest>;
  mappingError?: MappingError;
}

/**
 * Build partial ServiceRequest from ORC segment.
 *
 * Returns base ServiceRequest with status, intent, identifiers, requester, etc.
 * Caller merges OBR fields on top and sets subject/encounter references.
 *
 * Field Mappings:
 * - ORC-1 -> status (fallback when ORC-5 empty), authoredOn condition
 * - ORC-2 -> identifier[PLAC]
 * - ORC-3 -> identifier[FILL]
 * - ORC-4 -> requisition (EI -> Identifier)
 * - ORC-5 -> status (primary source)
 * - ORC-9 -> authoredOn (only when ORC-1 = "NW")
 * - ORC-12 -> requester (display reference)
 * - ORC-29 -> locationCode (CWE -> CodeableConcept)
 */
export async function convertORCToServiceRequest(
  orc: ORC,
  senderContext: SenderContext,
): Promise<ORCServiceRequestResult> {
  const statusResult = await resolveOrderStatus(orc, senderContext);

  const serviceRequest: Partial<ServiceRequest> = {
    status: statusResult.status,
    intent: "order",
  };

  // ORC-2: Placer Order Number -> identifier[PLAC]
  // ORC-3: Filler Order Number -> identifier[FILL]
  const identifiers: Identifier[] = [];
  const placerIdentifier = convertEIToTypedIdentifier(orc.$2_placerOrderNumber, "PLAC");
  if (placerIdentifier) identifiers.push(placerIdentifier);

  const fillerIdentifier = convertEIToTypedIdentifier(orc.$3_fillerOrderNumber, "FILL");
  if (fillerIdentifier) identifiers.push(fillerIdentifier);

  if (identifiers.length > 0) {
    serviceRequest.identifier = identifiers;
  }

  // ORC-4: Placer Group Number -> requisition (EI -> Identifier)
  const requisition = convertEIToIdentifierExtension(orc.$4_placerGroupNumber);
  if (requisition) {
    serviceRequest.requisition = requisition;
  }

  // ORC-9: Date/Time of Transaction -> authoredOn (only when ORC-1 = "NW")
  const orderControl = orc.$1_orderControl?.toString().trim().toUpperCase();
  if (orderControl === "NW" && orc.$9_transactionDateTime) {
    serviceRequest.authoredOn = convertDTMToDateTime(orc.$9_transactionDateTime);
  }

  // ORC-12: Ordering Provider -> requester (display reference)
  const requester = buildRequesterReference(orc.$12_orderingProvider);
  if (requester) {
    serviceRequest.requester = requester;
  }

  // ORC-29: Order Type -> locationCode (CWE -> CodeableConcept)
  if (orc.$29_orderType) {
    const locationCode = convertCWEToCodeableConcept(orc.$29_orderType);
    if (locationCode) {
      serviceRequest.locationCode = [locationCode];
    }
  }

  return {
    serviceRequest,
    mappingError: statusResult.mappingError,
  };
}

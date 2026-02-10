/**
 * HL7v2 OBR Segment to FHIR DiagnosticReport Mapping
 * Based on: HL7 v2.5.1 OBR segment specification
 */

import type { OBR, CE, EI, NDL, XCN } from "../../hl7v2/generated/fields";
import type {
  DiagnosticReport,
  CodeableConcept,
  Reference,
} from "../../fhir/hl7-fhir-r4-core";
import { convertCEToCodeableConcept } from "../datatypes/ce-codeableconcept";
import { normalizeSystem } from "../code-mapping/coding-systems";
import type { MappingError } from "../../code-mapping/mapping-errors";
import {
  generateConceptMapId,
  translateCode,
  type SenderContext,
} from "../../code-mapping/concept-map";

// ============================================================================
// Status Validation and Mapping
// ============================================================================

/**
 * OBR-25 Result Status to FHIR DiagnosticReport.status mapping
 *
 * HL7 v2 Table 0123 (Result Status):
 * - O = Order received; specimen not yet received
 * - I = No results available; specimen received, procedure incomplete
 * - S = No results available; procedure scheduled
 * - P = Preliminary
 * - A = Some results available (partial)
 * - R = Results stored; not yet verified
 * - N = Results not finalized
 * - C = Correction to results (corrected)
 * - M = Modified results
 * - F = Final results
 * - X = No results available; order cancelled
 */
const OBR25_STATUS_MAP: Record<string, DiagnosticReport["status"]> = {
  O: "registered",
  I: "registered",
  S: "registered",
  P: "preliminary",
  A: "partial",
  R: "partial",
  N: "partial",
  C: "corrected",
  M: "corrected",
  F: "final",
  X: "cancelled",
};

const VALID_OBR25_STATUSES = Object.keys(OBR25_STATUS_MAP).join(", ");

/**
 * Result type for OBR-25 status mapping.
 * Returns either a valid FHIR status or a mapping error.
 */
export type OBRStatusResult =
  | { status: DiagnosticReport["status"]; error?: never }
  | { status?: never; error: MappingError };

/**
 * Map OBR-25 Result Status to FHIR DiagnosticReport.status.
 * Returns a result object instead of throwing, allowing collection of mapping errors.
 */
export function mapOBRStatusToFHIRWithResult(
  status: string | undefined
): OBRStatusResult {
  if (status === undefined || !(status.toUpperCase() in OBR25_STATUS_MAP)) {
    return {
      error: {
        localCode: status || "undefined",
        localDisplay: `OBR-25 status: ${status ?? "missing"}`,
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0123",
        // DESIGN PROTOTYPE: 2026-02-02-mapping-labels-design-analysis.md
        // Keep only `mappingType`; labels should come from the mapping registry.
        mappingType: "obr-status",
        sourceFieldLabel: "OBR-25",
        targetFieldLabel: "DiagnosticReport.status",
      },
    };
  }
  return { status: OBR25_STATUS_MAP[status.toUpperCase()]! };
}

/**
 * Map OBR-25 Result Status to FHIR DiagnosticReport.status.
 * Throws Error if status is missing or invalid (e.g., Y, Z).
 *
 * @deprecated Use mapOBRStatusToFHIRWithResult for new code.
 * This function is kept for backward compatibility.
 */
export function mapOBRStatusToFHIR(
  status: string | undefined
): DiagnosticReport["status"] {
  if (status === undefined || !(status.toUpperCase() in OBR25_STATUS_MAP)) {
    const statusDesc = status === undefined ? "missing" : `"${status}"`;
    throw new Error(
      `Invalid OBR-25 Result Status: ${statusDesc}. Must be one of: ${VALID_OBR25_STATUSES}`,
    );
  }
  return OBR25_STATUS_MAP[status.toUpperCase()]!;
}

// ============================================================================
// Helper Functions
// ============================================================================

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

/**
 * Convert HL7v2 DTM to FHIR instant (for issued field)
 */
function convertDTMToInstant(dtm: string | undefined): string | undefined {
  if (!dtm) return undefined;

  const year = dtm.substring(0, 4);
  const month = dtm.substring(4, 6) || "01";
  const day = dtm.substring(6, 8) || "01";
  const hour = dtm.substring(8, 10) || "00";
  const minute = dtm.substring(10, 12) || "00";
  const second = dtm.substring(12, 14) || "00";

  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

/**
 * Generate deterministic ID from EI (Entity Identifier)
 * Converts to lowercase and replaces invalid characters
 */
function generateIdFromEI(ei: EI | undefined): string | undefined {
  if (!ei?.$1_value) return undefined;

  return ei.$1_value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

/**
 * Convert CE/CWE to CodeableConcept with LOINC system normalization
 */
function convertServiceToCodeableConcept(
  service: CE | undefined
): CodeableConcept | undefined {
  if (!service) return undefined;

  const codings: CodeableConcept["coding"] = [];

  // Primary coding
  if (service.$1_code) {
    codings.push({
      code: service.$1_code,
      display: service.$2_text,
      system: normalizeSystem(service.$3_system),
    });
  }

  // Alternate coding (often LOINC)
  if (service.$4_altCode) {
    codings.push({
      code: service.$4_altCode,
      display: service.$5_altDisplay,
      system: normalizeSystem(service.$6_altSystem),
    });
  }

  if (codings.length === 0) return undefined;

  return {
    coding: codings,
    text: service.$2_text || service.$5_altDisplay,
  };
}

// ============================================================================
// Main Converter Function
// ============================================================================

/**
 * Convert OBR segment to FHIR DiagnosticReport
 *
 * Field mappings:
 * - OBR-3 (Filler Order Number) or OBR-2 (Placer Order Number) → id (deterministic)
 * - OBR-4 (Universal Service ID) → code
 * - OBR-7 (Observation Date/Time) → effectiveDateTime
 * - OBR-22 (Results Report/Status Change) → issued
 * - OBR-25 (Result Status) → status
 */
export function convertOBRToDiagnosticReport(obr: OBR): DiagnosticReport {
  const id = generateIdFromEI(obr.$3_fillerOrderNumber) 
          ?? generateIdFromEI(obr.$2_placerOrderNumber);

  const diagnosticReport: DiagnosticReport = {
    resourceType: "DiagnosticReport",
    id,
    status: mapOBRStatusToFHIR(obr.$25_resultStatus),
    code: convertServiceToCodeableConcept(obr.$4_service) || {
      text: "Unknown",
    },
  };

  // OBR-7: Observation Date/Time → effectiveDateTime
  if (obr.$7_observationDateTime) {
    diagnosticReport.effectiveDateTime = convertDTMToDateTime(
      obr.$7_observationDateTime
    );
  }

  // OBR-22: Results Report/Status Change → issued
  if (obr.$22_resultsRptStatusChngDateTime) {
    diagnosticReport.issued = convertDTMToInstant(
      obr.$22_resultsRptStatusChngDateTime
    );
  }

  return diagnosticReport;
}

/**
 * Result type for OBR conversion with mapping support.
 * Returns either a DiagnosticReport or a mapping error for the status field.
 */
export type OBRConversionResult =
  | { diagnosticReport: DiagnosticReport; error?: never }
  | { diagnosticReport?: never; error: MappingError };

/**
 * Valid FHIR DiagnosticReport status codes for validation
 * Must match VALID_DIAGNOSTIC_REPORT_STATUS in code-mapping/validation.ts
 */
const VALID_FHIR_DR_STATUSES: DiagnosticReport["status"][] = [
  "registered",
  "partial",
  "preliminary",
  "final",
  "amended",
  "corrected",
  "appended",
  "cancelled",
  "entered-in-error",
  "unknown",
];

/**
 * Resolve OBR-25 status to FHIR DiagnosticReport.status.
 *
 * Resolution algorithm:
 * 1. Check hardcoded OBR25_STATUS_MAP for standard HL7v2 status codes
 * 2. If not found, lookup in sender-specific ConceptMap via $translate
 * 3. If no mapping found, return error for Task creation
 */
async function resolveOBRStatus(
  status: string | undefined,
  sender: SenderContext,
): Promise<OBRStatusResult> {
  // Normalize empty/whitespace-only strings to undefined
  const normalizedStatus = status?.trim() || undefined;

  // First try hardcoded mappings for standard codes
  if (normalizedStatus !== undefined && normalizedStatus.toUpperCase() in OBR25_STATUS_MAP) {
    return { status: OBR25_STATUS_MAP[normalizedStatus.toUpperCase()]! };
  }

  // If status is undefined/empty, return error immediately (no ConceptMap lookup for missing status)
  if (normalizedStatus === undefined) {
    return {
      error: {
        localCode: "undefined",
        localDisplay: "OBR-25 status: missing",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0123",
        mappingType: "obr-status",
        sourceFieldLabel: "OBR-25",
        targetFieldLabel: "DiagnosticReport.status",
      },
    };
  }

  // Try ConceptMap lookup for non-standard status codes
  const conceptMapId = generateConceptMapId(sender, "obr-status");
  const localSystem = "http://terminology.hl7.org/CodeSystem/v2-0123";

  const translateResult = await translateCode(conceptMapId, normalizedStatus, localSystem);

  if (translateResult.status === "found" && translateResult.coding.code) {
    const resolvedStatus = translateResult.coding
      .code as DiagnosticReport["status"];
    // Validate the resolved status is a valid FHIR status
    if (VALID_FHIR_DR_STATUSES.includes(resolvedStatus)) {
      return { status: resolvedStatus };
    }
  }

  // No mapping found - return error for Task creation
  return {
    error: {
      localCode: normalizedStatus,
      localDisplay: `OBR-25 status: ${normalizedStatus}`,
      localSystem,
      mappingType: "obr-status",
      sourceFieldLabel: "OBR-25",
      targetFieldLabel: "DiagnosticReport.status",
    },
  };
}

/**
 * Convert OBR segment to FHIR DiagnosticReport with mapping error support.
 *
 * This version checks ConceptMap for sender-specific OBR-25 status mappings.
 * Use this when processing messages where Task resolution may have added custom mappings.
 *
 * Resolution algorithm for OBR-25 status:
 * 1. Check hardcoded OBR25_STATUS_MAP for standard HL7v2 status codes
 * 2. If not found, lookup in sender-specific ConceptMap via $translate
 * 3. If no mapping found, return error for Task creation
 *
 * Field mappings:
 * - OBR-3 (Filler Order Number) or OBR-2 (Placer Order Number) → id (deterministic)
 * - OBR-4 (Universal Service ID) → code
 * - OBR-7 (Observation Date/Time) → effectiveDateTime
 * - OBR-22 (Results Report/Status Change) → issued
 * - OBR-25 (Result Status) → status (returns error if invalid)
 */
export async function convertOBRWithMappingSupport(
  obr: OBR,
  sender: SenderContext,
): Promise<OBRConversionResult> {
  const id =
    generateIdFromEI(obr.$3_fillerOrderNumber) ??
    generateIdFromEI(obr.$2_placerOrderNumber);

  const statusResult = await resolveOBRStatus(obr.$25_resultStatus, sender);

  if (statusResult.error) {
    return { error: statusResult.error };
  }

  const diagnosticReport: DiagnosticReport = {
    resourceType: "DiagnosticReport",
    id,
    status: statusResult.status,
    code: convertServiceToCodeableConcept(obr.$4_service) || {
      text: "Unknown",
    },
  };

  // OBR-7: Observation Date/Time → effectiveDateTime
  if (obr.$7_observationDateTime) {
    diagnosticReport.effectiveDateTime = convertDTMToDateTime(
      obr.$7_observationDateTime,
    );
  }

  // OBR-22: Results Report/Status Change → issued
  if (obr.$22_resultsRptStatusChngDateTime) {
    diagnosticReport.issued = convertDTMToInstant(
      obr.$22_resultsRptStatusChngDateTime,
    );
  }

  return { diagnosticReport };
}

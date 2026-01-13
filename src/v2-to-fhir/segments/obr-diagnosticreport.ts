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

// ============================================================================
// Status Mapping
// ============================================================================

/**
 * Map OBR-25 Result Status to FHIR DiagnosticReport.status
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
export function mapOBRStatusToFHIR(
  status: string | undefined
): DiagnosticReport["status"] {
  if (!status) return "unknown";

  switch (status.toUpperCase()) {
    case "O":
    case "I":
    case "S":
      return "registered";
    case "P":
      return "preliminary";
    case "A":
    case "R":
    case "N":
      return "partial";
    case "C":
    case "M":
      return "corrected";
    case "F":
      return "final";
    case "X":
      return "cancelled";
    default:
      return "unknown";
  }
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
 * Generate deterministic ID from EI (OBR-3 Filler Order Number)
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
 * - OBR-3 (Filler Order Number) → id (deterministic)
 * - OBR-4 (Universal Service ID) → code
 * - OBR-7 (Observation Date/Time) → effectiveDateTime
 * - OBR-22 (Results Report/Status Change) → issued
 * - OBR-25 (Result Status) → status
 */
export function convertOBRToDiagnosticReport(obr: OBR): DiagnosticReport {
  const id = generateIdFromEI(obr.$3_fillerOrderNumber);

  const diagnosticReport: DiagnosticReport = {
    resourceType: "DiagnosticReport",
    id,
    status: mapOBRStatusToFHIR(obr.$25_resultStatus as string),
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

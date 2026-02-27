/**
 * RXA + RXR + ORC → FHIR Immunization Segment Converter
 *
 * Converts RXA (Pharmacy/Treatment Administration), RXR (Route),
 * and ORC (Common Order) segments into a base FHIR Immunization resource.
 *
 * This is the core V2-to-FHIR IG mapping. CDC IIS-specific enrichment
 * (ORDER OBX, RXA-9 NIP001) is handled separately by cdc-iis-enrichment.ts.
 *
 * ID generation is the message converter's responsibility (matches ORU pattern).
 * The message converter computes the ID and passes it here.
 */

import type { RXA, RXR, ORC, CE } from "../../hl7v2/generated/fields";
import type {
  Immunization,
  CodeableConcept,
  Quantity,
  Reference,
} from "../../fhir/hl7-fhir-r4-core";
import type { BundleEntry } from "../../fhir/hl7-fhir-r4-core";
import { convertCEToCodeableConcept } from "../datatypes/ce-codeableconcept";
import { convertDTMToDateTime, convertDTMToDate } from "../datatypes/dtm-datetime";
import { normalizeSystem } from "../code-mapping/coding-systems";

export interface RXAConversionResult {
  immunization: Immunization;
  performerEntries: BundleEntry[];
}

/**
 * Derive Immunization.status from RXA-20 (Completion Status) and RXA-21 (Action Code).
 *
 * RXA-21=D overrides RXA-20 (entered-in-error).
 * RXA-20: CP/PA/empty → completed, RE/NA → not-done.
 */
export function deriveImmunizationStatus(
  completionStatus: string | undefined,
  actionCode: string | undefined,
): Immunization["status"] {
  if (actionCode?.toUpperCase() === "D") {
    return "entered-in-error";
  }

  switch (completionStatus?.toUpperCase()) {
    case "RE":
    case "NA":
      return "not-done";
    case "CP":
    case "PA":
    case undefined:
    case "":
      return "completed";
    default:
      return "completed";
  }
}

/**
 * Normalize coding systems in a CodeableConcept (e.g., "CVX" → FHIR URI).
 * Returns a new CodeableConcept with normalized systems.
 */
function normalizeCodeableConceptSystems(cc: CodeableConcept): CodeableConcept {
  if (!cc.coding) return cc;

  return {
    ...cc,
    coding: cc.coding.map((coding) => ({
      ...coding,
      ...(coding.system && { system: normalizeSystem(coding.system) }),
    })),
  };
}

/**
 * Build doseQuantity from RXA-6 (numeric amount) and RXA-7 (unit CE).
 *
 * RXA-6 has been preprocessed: "999" cleared, embedded units extracted.
 * After preprocessing, RXA-6 is either empty (omit doseQuantity) or a valid number.
 */
function buildDoseQuantity(amount: string | undefined, unit: CE | undefined): Quantity | undefined {
  if (!amount) return undefined;

  const numericValue = parseFloat(amount);
  if (isNaN(numericValue)) return undefined;

  const quantity: Quantity = { value: numericValue };

  if (unit) {
    const unitDisplay = unit.$2_text || unit.$1_code;
    if (unitDisplay) {
      quantity.unit = unitDisplay;
    }
    if (unit.$1_code && unit.$3_system) {
      quantity.code = unit.$1_code;
      quantity.system = normalizeSystem(unit.$3_system);
    }
  }

  return quantity;
}

/**
 * Derive Immunization.recorded from ORC-9 (primary) with RXA-22 fallback.
 *
 * Rule: ORC-9 ?? (RXA-21=A ? RXA-22 : undefined)
 * RXA-22 is only used as fallback when RXA-21=A (action code "Add"),
 * because system entry timestamp is only meaningful for new records.
 * Uniform rule regardless of ORC presence.
 */
function deriveRecordedDate(orc: ORC | undefined, rxa: RXA): string | undefined {
  const orcDateTime = convertDTMToDateTime(orc?.$9_transactionDateTime);
  if (orcDateTime) return orcDateTime;

  const isAddAction = rxa.$21_actionCodeRxa?.toUpperCase() === "A";
  if (isAddAction) {
    return convertDTMToDateTime(rxa.$22_systemEntryDateTime);
  }

  return undefined;
}

/**
 * Convert RXA + RXR + ORC to base FHIR Immunization.
 *
 * This is the core segment converter. CDC IIS-specific enrichment
 * (ORDER OBX mapping, RXA-9 NIP001) is applied separately.
 *
 * @param rxa - Pharmacy/Treatment Administration segment
 * @param rxr - Optional: Pharmacy/Treatment Route segment
 * @param orc - Optional: Common Order segment (absent in some real-world senders)
 * @param immunizationId - Pre-computed deterministic ID from the message converter
 * @param patientReference - Patient reference from the message converter
 */
export function convertRXAToImmunization(
  rxa: RXA,
  _rxr: RXR | undefined,
  orc: ORC | undefined,
  immunizationId: string,
  patientReference: Reference<"Patient">,
): RXAConversionResult | { error: string } {
  // RXA-3: occurrenceDateTime (required)
  const occurrenceDateTime = convertDTMToDateTime(rxa.$3_startAdministrationDateTime);
  if (!occurrenceDateTime) {
    return { error: "RXA-3 (Date/Time Start of Administration) is required but missing or empty" };
  }

  // RXA-5: vaccineCode (required)
  const rawVaccineCode = convertCEToCodeableConcept(rxa.$5_administeredCode);
  if (!rawVaccineCode) {
    return { error: "RXA-5 (Administered Code) is required but missing or empty" };
  }
  const vaccineCode = normalizeCodeableConceptSystems(rawVaccineCode);

  // RXA-20/21: status
  const status = deriveImmunizationStatus(rxa.$20_completionStatus, rxa.$21_actionCodeRxa);

  const immunization: Immunization = {
    resourceType: "Immunization",
    id: immunizationId,
    status,
    vaccineCode,
    patient: patientReference,
    occurrenceDateTime,
  };

  // RXA-6/7: doseQuantity (after preprocessor normalization)
  const doseQuantity = buildDoseQuantity(rxa.$6_administeredAmount, rxa.$7_administeredUnit);
  if (doseQuantity) {
    immunization.doseQuantity = doseQuantity;
  }

  // RXA-15: lotNumber (first value if repeating)
  if (rxa.$15_lotNumber?.[0]) {
    immunization.lotNumber = rxa.$15_lotNumber[0];
  }

  // RXA-16: expirationDate (first value if repeating)
  if (rxa.$16_expiration?.[0]) {
    immunization.expirationDate = convertDTMToDate(rxa.$16_expiration[0]);
  }

  // RXA-20=PA: partially administered → isSubpotent
  if (rxa.$20_completionStatus?.toUpperCase() === "PA") {
    immunization.isSubpotent = true;
  }

  // RXA-18: statusReason (only when status=not-done)
  if (status === "not-done" && rxa.$18_substanceTreatmentRefusalReason?.length) {
    const statusReasonCC = convertCEToCodeableConcept(rxa.$18_substanceTreatmentRefusalReason[0]);
    if (statusReasonCC) {
      immunization.statusReason = normalizeCodeableConceptSystems(statusReasonCC);
    }
  }

  // RXA-19: reasonCode (indication — repeating)
  if (rxa.$19_indication?.length) {
    const reasonCodes = rxa.$19_indication
      .map((ce) => convertCEToCodeableConcept(ce))
      .filter((cc): cc is CodeableConcept => cc !== undefined)
      .map(normalizeCodeableConceptSystems);
    if (reasonCodes.length > 0) {
      immunization.reasonCode = reasonCodes;
    }
  }

  // recorded: ORC-9 ?? (RXA-21=A ? RXA-22 : undefined)
  const recordedDate = deriveRecordedDate(orc, rxa);
  if (recordedDate) {
    immunization.recorded = recordedDate;
  }

  // Performers will be added by Task 12
  const performerEntries: BundleEntry[] = [];

  return { immunization, performerEntries };
}

/**
 * DESIGN PROTOTYPE: 2026-02-23-vxu-support.md
 *
 * RXA + RXR + ORC → FHIR Immunization Segment Converter
 *
 * Converts RXA (Pharmacy/Treatment Administration), RXR (Route),
 * and ORC (Common Order) segments into a base FHIR Immunization resource.
 *
 * This is the core V2-to-FHIR IG mapping. CDC IIS-specific enrichment
 * (ORDER OBX, RXA-9 NIP001) is handled separately by cdc-iis-enrichment.ts.
 *
 * NOTE: RXA and RXR types may need to be generated via `bun run regenerate-hl7v2`.
 * If not available in generated types, define minimal interfaces here.
 */

import type { RXA, RXR, ORC, XCN, CE, CWE } from "../../hl7v2/generated/fields";
import type {
  Immunization,
  ImmunizationPerformer,
  CodeableConcept,
  Quantity,
  Identifier,
  Reference,
} from "../../fhir/hl7-fhir-r4-core";
import { convertCEToCodeableConcept } from "../datatypes/ce-codeableconcept";
import { convertXCNToPractitioner } from "../datatypes/xcn-practitioner";
import type { BundleEntry } from "../../fhir/hl7-fhir-r4-core";


// ============================================================================
// Status Derivation
// ============================================================================

/**
 * Derive Immunization.status from RXA-20 (Completion Status) and RXA-21 (Action Code).
 *
 * RXA-21=D overrides RXA-20 (entered-in-error).
 * RXA-20: CP/PA/empty -> completed, RE/NA -> not-done.
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

// ============================================================================
// DTM Conversion
// ============================================================================

// TODO: Extract shared DTM conversion to a common module
// (duplicated across pid-patient.ts, obx-observation.ts, pv1-encounter.ts, oru-r01.ts)
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

function convertDTMToDate(dtm: string | undefined): string | undefined {
  if (!dtm) return undefined;
  const year = dtm.substring(0, 4);
  const month = dtm.substring(4, 6);
  const day = dtm.substring(6, 8);
  if (dtm.length <= 4) return year;
  if (dtm.length <= 6) return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate deterministic Immunization ID from ORC-3 (filler) or ORC-2 (placer).
 *
 * Format: sanitize("{authority}-{value}")
 * Authority comes from EI.2 (namespace) or EI.3 (universal ID).
 * Value comes from EI.1.
 *
 * Requires authority to be present (preprocessor injects from MSH if missing).
 */
export function generateImmunizationId(orc: ORC): string | { error: string } {
  // TODO: Implement:
  // 1. Prefer ORC-3 (filler), fallback to ORC-2 (placer)
  // 2. Extract authority from EI.2 or EI.3
  // 3. Extract value from EI.1
  // 4. Validate both are present
  // 5. Return sanitized ID or error

  const filler = orc.$3_fillerOrderNumber;
  const placer = orc.$2_placerOrderNumber;
  const ei = filler ?? placer;

  if (!ei?.$1_value) {
    return { error: "Either ORC-3 (Filler Order Number) or ORC-2 (Placer Order Number) is required for Immunization ID" };
  }

  const authority = ei.$2_namespace || ei.$3_system;
  if (!authority) {
    return { error: "ORC-3/ORC-2 authority (EI.2 or EI.3) is required for deterministic Immunization ID generation" };
  }

  const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return sanitize(`${authority}-${ei.$1_value}`);
}

// ============================================================================
// Identifier Creation
// ============================================================================

function createOrderIdentifiers(orc: ORC): Identifier[] {
  // TODO: Implement:
  // - ORC-2 -> identifier with type=PLAC
  // - ORC-3 -> identifier with type=FILL
  return [];
}

// ============================================================================
// Performer Creation
// ============================================================================

export interface PerformerResult {
  performer: ImmunizationPerformer;
  practitionerEntry?: BundleEntry;
}

/**
 * Create Immunization.performer from XCN with function code.
 * Also creates a Practitioner resource for the bundle.
 *
 * @param xcn - Provider from RXA-10 or ORC-12
 * @param functionCode - "AP" (Administering Provider) or "OP" (Ordering Provider)
 */
export function createPerformer(
  _xcn: XCN,
  _functionCode: "AP" | "OP",
): PerformerResult | undefined {
  // TODO: Implement:
  // 1. Convert XCN to Practitioner via convertXCNToPractitioner
  // 2. Generate deterministic Practitioner ID from XCN.1 + XCN.9
  // 3. Build ImmunizationPerformer with function code and actor reference
  // 4. Return performer + BundleEntry for the Practitioner resource
  return undefined;
}

// ============================================================================
// Main Converter Function
// ============================================================================

export interface RXAConversionResult {
  immunization: Immunization;
  performerEntries: BundleEntry[];
}

/**
 * Convert RXA + RXR + ORC to base FHIR Immunization.
 *
 * This is the core segment converter. CDC IIS-specific enrichment
 * (ORDER OBX mapping, RXA-9 NIP001) is applied separately.
 *
 * ID generation is the message converter's responsibility (matches ORU pattern
 * where getOrderNumber() lives in oru-r01.ts, not obr-diagnosticreport.ts).
 * The message converter computes the ID from ORC-3/ORC-2 or the MSH fallback
 * and passes it here.
 *
 * @param rxa - Pharmacy/Treatment Administration segment
 * @param rxr - Optional: Pharmacy/Treatment Route segment
 * @param orc - Optional: Common Order segment (absent in some real-world senders per C1)
 * @param immunizationId - Pre-computed deterministic ID from the message converter
 */
export function convertRXAToImmunization(
  rxa: RXA,
  rxr: RXR | undefined,
  orc: ORC | undefined,
  immunizationId: string,
): RXAConversionResult | { error: string } {
  // TODO: Implementation steps:
  //
  // 1. ID is pre-computed by message converter (no longer generated here)

  // 2. Derive status from RXA-20/21
  const status = deriveImmunizationStatus(rxa.$20_completionStatus, rxa.$21_actionCodeRxa);

  // 3. Build vaccineCode from RXA-5
  const vaccineCode = convertCEToCodeableConcept(rxa.$5_administeredCode);
  if (!vaccineCode) {
    return { error: "RXA-5 (Administered Code) is required but missing or empty" };
  }

  // 4. Build base Immunization
  const immunization: Immunization = {
    resourceType: "Immunization",
    id: immunizationId,
    status,
    vaccineCode,
    patient: { reference: "Patient/placeholder" } as Reference<"Patient">,
    occurrenceDateTime: convertDTMToDateTime(rxa.$3_startAdministrationDateTime),
  };

  // 5. Dose quantity from RXA-6/7
  // TODO: if (rxa.$6_administeredAmount && rxa.$6_administeredAmount !== "999") {
  //   immunization.doseQuantity = { value: parseFloat(rxa.$6_administeredAmount) };
  //   if (rxa.$7_administeredUnit) { ... unit ... }
  // }

  // 6. Lot number from RXA-15 (first value)
  // TODO: if (rxa.$15_lotNumber?.[0]) {
  //   immunization.lotNumber = rxa.$15_lotNumber[0];
  // }

  // 7. Expiration date from RXA-16 (first value)
  // TODO: if (rxa.$16_expiration?.[0]) {
  //   immunization.expirationDate = convertDTMToDate(rxa.$16_expiration[0]);
  // }

  // 8. Status reason from RXA-18 (when status=not-done)
  // TODO: if (status === "not-done" && rxa.$18_substanceTreatmentRefusalReason) { ... }

  // 9. Reason code from RXA-19
  // TODO: if (rxa.$19_indication) { ... }

  // 10. Subpotent flag for PA (Partially Administered)
  // TODO: if (rxa.$20_completionStatus?.toUpperCase() === "PA") {
  //   immunization.isSubpotent = true;
  // }

  // 11. Recorded date: ORC-9 primary, RXA-22 fallback when RXA-21=A
  //     Authoritative rule: ORC-9 ?? (RXA-21=A ? RXA-22 : undefined)
  //     Works uniformly regardless of ORC presence (ORC-9 simply unavailable when ORC absent)
  // TODO: const recorded = orc?.$9_transactionDateTime
  //   ?? (rxa.$21_actionCodeRxa?.toUpperCase() === "A" ? rxa.$22_systemEntryDateTime : undefined);
  // if (recorded) immunization.recorded = convertDTMToDateTime(recorded);

  // 12. Route from RXR-1
  // TODO: if (rxr?.$1_route) {
  //   immunization.route = convertCEToCodeableConcept(rxr.$1_route);
  // }

  // 13. Site from RXR-2
  // TODO: if (rxr?.$2_administrationSite) {
  //   immunization.site = convertCWEToCodeableConcept(rxr.$2_administrationSite);
  // }

  // 14. Identifiers from ORC-2/3 (only when ORC present)
  // TODO: if (orc) immunization.identifier = createOrderIdentifiers(orc);

  // 15. Performers from RXA-10 (AP) and ORC-12 (OP)
  const performerEntries: BundleEntry[] = [];
  // TODO: Build performers, collect Practitioner bundle entries

  return { immunization, performerEntries };
}

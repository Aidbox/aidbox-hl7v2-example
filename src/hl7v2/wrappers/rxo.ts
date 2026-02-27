/**
 * Manual RXO segment wrapper.
 *
 * RXO is not in the generated HL7v2 types because ORM_O01 was retired after v2.5.1
 * and the generator targets v2.8.2. This wrapper provides the RXO interface and parser
 * for fields needed by the RXO->MedicationRequest IG mapping (REQ-RXO-1).
 */

import type { CE, CWE, XCN } from "../generated/fields";
import type { FieldValue, HL7v2Segment } from "../generated/types";
import { getComponent } from "../generated/types";

export interface RXO {
  /** RXO-1: Requested Give Code (CE) */
  $1_requestedGiveCode?: CE;
  /** RXO-2: Requested Give Amount - Minimum (NM) */
  $2_requestedGiveAmountMin?: string;
  /** RXO-3: Requested Give Amount - Maximum (NM) */
  $3_requestedGiveAmountMax?: string;
  /** RXO-4: Requested Give Units (CE) */
  $4_requestedGiveUnits?: CE;
  /** RXO-5: Requested Dosage Form (CE) */
  $5_requestedDosageForm?: CE;
  /** RXO-9: Allow Substitutions (ID) */
  $9_allowSubstitutions?: string;
  /** RXO-11: Requested Dispense Amount (NM) */
  $11_requestedDispenseAmount?: string;
  /** RXO-12: Requested Dispense Units (CE) */
  $12_requestedDispenseUnits?: CE;
  /** RXO-13: Number Of Refills (NM) */
  $13_numberOfRefills?: string;
  /** RXO-14: Ordering Provider's DEA Number (XCN) */
  $14_orderingProviderDea?: XCN[];
  /** RXO-18: Requested Give Strength (NM) */
  $18_requestedGiveStrength?: string;
  /** RXO-19: Requested Give Strength Units (CE) */
  $19_requestedGiveStrengthUnits?: CE;
  /** RXO-25: Requested Drug Strength Volume (NM) */
  $25_requestedDrugStrengthVolume?: string;
  /** RXO-26: Requested Drug Strength Volume Units (CWE) */
  $26_requestedDrugStrengthVolumeUnits?: CWE;
}

/**
 * Parse a FieldValue as CE (Coded Element) with components 1-6.
 * Mirrors the generated fromCE logic.
 */
function parseCE(fv: FieldValue | undefined): CE | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_code: fv };
  if (Array.isArray(fv)) return parseCE(fv[0]);

  const result: CE = {};
  const obj = fv as Record<number, FieldValue>;
  const code = getComponent(obj[1]);
  if (code !== undefined) result.$1_code = code;
  const text = getComponent(obj[2]);
  if (text !== undefined) result.$2_text = text;
  const system = getComponent(obj[3]);
  if (system !== undefined) result.$3_system = system;
  const altCode = getComponent(obj[4]);
  if (altCode !== undefined) result.$4_altCode = altCode;
  const altDisplay = getComponent(obj[5]);
  if (altDisplay !== undefined) result.$5_altDisplay = altDisplay;
  const altSystem = getComponent(obj[6]);
  if (altSystem !== undefined) result.$6_altSystem = altSystem;
  return result;
}

/**
 * Parse a FieldValue as CWE (Coded With Exceptions) with components 1-9.
 * Mirrors the generated fromCWE logic.
 */
function parseCWE(fv: FieldValue | undefined): CWE | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_code: fv };
  if (Array.isArray(fv)) return parseCWE(fv[0]);

  const result: CWE = {};
  const obj = fv as Record<number, FieldValue>;
  const code = getComponent(obj[1]);
  if (code !== undefined) result.$1_code = code;
  const text = getComponent(obj[2]);
  if (text !== undefined) result.$2_text = text;
  const system = getComponent(obj[3]);
  if (system !== undefined) result.$3_system = system;
  const altCode = getComponent(obj[4]);
  if (altCode !== undefined) result.$4_altCode = altCode;
  const altDisplay = getComponent(obj[5]);
  if (altDisplay !== undefined) result.$5_altDisplay = altDisplay;
  const altSystem = getComponent(obj[6]);
  if (altSystem !== undefined) result.$6_altSystem = altSystem;
  const version = getComponent(obj[7]);
  if (version !== undefined) result.$7_version = version;
  const altVersion = getComponent(obj[8]);
  if (altVersion !== undefined) result.$8_altVersion = altVersion;
  const originalText = getComponent(obj[9]);
  if (originalText !== undefined) result.$9_originalText = originalText;
  return result;
}

/**
 * Parse a FieldValue as XCN (Extended Composite ID Number and Name for Persons).
 * Simplified parser covering components 1-7 which is sufficient for provider identification.
 */
function parseXCN(fv: FieldValue | undefined): XCN | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_value: fv };
  if (Array.isArray(fv)) return parseXCN(fv[0]);

  const result: XCN = {};
  const obj = fv as Record<number, FieldValue>;
  const value = getComponent(obj[1]);
  if (value !== undefined) result.$1_value = value;
  const family = getComponent(obj[2]);
  if (family !== undefined) result.$2_family = { $1_family: family };
  const given = getComponent(obj[3]);
  if (given !== undefined) result.$3_given = given;
  const additionalGiven = getComponent(obj[4]);
  if (additionalGiven !== undefined) result.$4_additionalGiven = additionalGiven;
  const suffix = getComponent(obj[5]);
  if (suffix !== undefined) result.$5_suffix = suffix;
  const prefix = getComponent(obj[6]);
  if (prefix !== undefined) result.$6_prefix = prefix;
  const qualification = getComponent(obj[7]);
  if (qualification !== undefined) result.$7_qualification = qualification;
  return result;
}

/**
 * Parse a repeating XCN field (field may contain a single XCN or an array of repeats).
 */
function parseXCNRepeating(fv: FieldValue | undefined): XCN[] | undefined {
  if (fv === undefined) return undefined;
  if (Array.isArray(fv)) {
    const parsed = fv.map((v) => parseXCN(v)).filter((v): v is XCN => v !== undefined);
    return parsed.length > 0 ? parsed : undefined;
  }
  const single = parseXCN(fv);
  return single ? [single] : undefined;
}

/** Parse an RXO segment from raw HL7v2 segment data. */
export function fromRXO(segment: HL7v2Segment): RXO {
  const result: RXO = {};
  const f = segment.fields;

  const requestedGiveCode = parseCE(f[1]);
  if (requestedGiveCode) result.$1_requestedGiveCode = requestedGiveCode;

  const giveAmountMin = getComponent(f[2]);
  if (giveAmountMin !== undefined) result.$2_requestedGiveAmountMin = giveAmountMin;

  const giveAmountMax = getComponent(f[3]);
  if (giveAmountMax !== undefined) result.$3_requestedGiveAmountMax = giveAmountMax;

  const giveUnits = parseCE(f[4]);
  if (giveUnits) result.$4_requestedGiveUnits = giveUnits;

  const dosageForm = parseCE(f[5]);
  if (dosageForm) result.$5_requestedDosageForm = dosageForm;

  const allowSubstitutions = getComponent(f[9]);
  if (allowSubstitutions !== undefined) result.$9_allowSubstitutions = allowSubstitutions;

  const dispenseAmount = getComponent(f[11]);
  if (dispenseAmount !== undefined) result.$11_requestedDispenseAmount = dispenseAmount;

  const dispenseUnits = parseCE(f[12]);
  if (dispenseUnits) result.$12_requestedDispenseUnits = dispenseUnits;

  const numberOfRefills = getComponent(f[13]);
  if (numberOfRefills !== undefined) result.$13_numberOfRefills = numberOfRefills;

  const orderingProviderDea = parseXCNRepeating(f[14]);
  if (orderingProviderDea) result.$14_orderingProviderDea = orderingProviderDea;

  const giveStrength = getComponent(f[18]);
  if (giveStrength !== undefined) result.$18_requestedGiveStrength = giveStrength;

  const giveStrengthUnits = parseCE(f[19]);
  if (giveStrengthUnits) result.$19_requestedGiveStrengthUnits = giveStrengthUnits;

  const drugStrengthVolume = getComponent(f[25]);
  if (drugStrengthVolume !== undefined) result.$25_requestedDrugStrengthVolume = drugStrengthVolume;

  const drugStrengthVolumeUnits = parseCWE(f[26]);
  if (drugStrengthVolumeUnits) result.$26_requestedDrugStrengthVolumeUnits = drugStrengthVolumeUnits;

  return result;
}

import type { CWE } from "../../hl7v2/generated/fields";
import type { Quantity } from "../../fhir/hl7-fhir-r4-core";

export interface CQ {
  $1_quantity?: number;
  $2_units?: CWE;
}

export function convertCQToQuantity(cq: CQ | undefined): Quantity | undefined {
  if (!cq) return undefined;
  if (cq.$1_quantity === undefined && !cq.$2_units) return undefined;

  return {
    ...(cq.$1_quantity !== undefined && { value: cq.$1_quantity }),
    ...(cq.$2_units?.$2_text && { unit: cq.$2_units.$2_text }),
    ...(cq.$2_units?.$3_system && { system: cq.$2_units.$3_system }),
    ...(cq.$2_units?.$1_code && { code: cq.$2_units.$1_code }),
  };
}

export function convertCQToDecimal(cq: CQ | undefined): number | undefined {
  return cq?.$1_quantity;
}

export function convertCQToUnsignedInt(cq: CQ | undefined): number | undefined {
  if (cq?.$1_quantity === undefined) return undefined;
  return Math.max(0, Math.floor(cq.$1_quantity));
}

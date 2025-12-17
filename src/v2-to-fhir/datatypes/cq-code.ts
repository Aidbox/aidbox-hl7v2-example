import type { CWE } from "../../hl7v2/generated/fields";

export interface CQ {
  $1_quantity?: number;
  $2_units?: CWE;
}

export function convertCQToCode(cq: CQ | undefined): string | undefined {
  if (!cq) return undefined;
  return cq.$2_units?.$1_code;
}

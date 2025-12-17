import type { CWE } from "../../hl7v2/generated/fields";
import type { Quantity } from "../../fhir/hl7-fhir-r4-core";

export function convertCWEToQuantity(cwe: CWE | undefined): Quantity | undefined {
  if (!cwe) return undefined;

  const unit = cwe.$2_text || cwe.$1_code;
  if (!unit) return undefined;

  const hasCodeAndSystem = cwe.$1_code && cwe.$3_system;

  return {
    unit,
    ...(hasCodeAndSystem && { code: cwe.$1_code }),
    ...(hasCodeAndSystem && { system: cwe.$3_system }),
  };
}

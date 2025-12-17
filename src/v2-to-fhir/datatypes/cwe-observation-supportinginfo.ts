import type { CWE } from "../../hl7v2/generated/fields";
import type { CodeableConcept, Coding, Observation } from "../../fhir/hl7-fhir-r4-core";

export interface CWEToObservationSupportingInfoOptions {
  code: CodeableConcept;
}

export function convertCWEToObservationSupportingInfo(
  cwe: CWE | undefined,
  options: CWEToObservationSupportingInfoOptions
): Observation | undefined {
  if (!cwe) return undefined;

  const codings: Coding[] = [];

  if (cwe.$1_code || cwe.$2_text) {
    codings.push({
      ...(cwe.$1_code && { code: cwe.$1_code }),
      ...(cwe.$2_text && { display: cwe.$2_text }),
      ...(cwe.$3_system && { system: cwe.$3_system }),
    });
  }

  if (cwe.$4_altCode || cwe.$5_altDisplay) {
    codings.push({
      ...(cwe.$4_altCode && { code: cwe.$4_altCode }),
      ...(cwe.$5_altDisplay && { display: cwe.$5_altDisplay }),
      ...(cwe.$6_altSystem && { system: cwe.$6_altSystem }),
    });
  }

  if (codings.length === 0) return undefined;

  const valueCodeableConcept: CodeableConcept = {
    coding: codings,
  };

  return {
    resourceType: "Observation",
    code: options.code,
    status: "final",
    valueCodeableConcept,
  };
}

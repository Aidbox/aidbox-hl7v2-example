import type { CWE } from "../../hl7v2/generated/fields";
import type { CodeableConcept, Coding } from "../../fhir/hl7-fhir-r4-core";

export type CF = CWE;

export function convertCFToCodeableConcept(cf: CF | undefined): CodeableConcept | undefined {
  if (!cf) return undefined;

  const codings: Coding[] = [];

  if (cf.$1_code || cf.$2_text) {
    codings.push({
      ...(cf.$1_code && { code: cf.$1_code }),
      ...(cf.$2_text && { display: cf.$2_text }),
      ...(cf.$3_system && { system: cf.$3_system }),
      ...(cf.$7_version && { version: cf.$7_version }),
    });
  }

  if (cf.$4_altCode || cf.$5_altDisplay) {
    codings.push({
      ...(cf.$4_altCode && { code: cf.$4_altCode }),
      ...(cf.$5_altDisplay && { display: cf.$5_altDisplay }),
      ...(cf.$6_altSystem && { system: cf.$6_altSystem }),
      ...(cf.$8_altVersion && { version: cf.$8_altVersion }),
    });
  }

  if (codings.length === 0) return undefined;

  return {
    coding: codings,
    ...(cf.$9_originalText ? { text: cf.$9_originalText } : cf.$2_text && { text: cf.$2_text }),
  };
}

import type { CNE } from "../../hl7v2/generated/fields";
import type { CodeableConcept, Coding } from "../../fhir/hl7-fhir-r4-core";

export function convertCNEToCodeableConcept(cne: CNE | undefined): CodeableConcept | undefined {
  if (!cne) return undefined;

  const codings: Coding[] = [];

  if (cne.$1_code || cne.$2_text) {
    codings.push({
      ...(cne.$1_code && { code: cne.$1_code }),
      ...(cne.$2_text && { display: cne.$2_text }),
      ...(cne.$3_system && { system: cne.$3_system }),
      ...(cne.$7_version && { version: cne.$7_version }),
    });
  }

  if (cne.$4_altCode || cne.$5_altDisplay) {
    codings.push({
      ...(cne.$4_altCode && { code: cne.$4_altCode }),
      ...(cne.$5_altDisplay && { display: cne.$5_altDisplay }),
      ...(cne.$6_altSystem && { system: cne.$6_altSystem }),
      ...(cne.$8_altVersion && { version: cne.$8_altVersion }),
    });
  }

  if (codings.length === 0) return undefined;

  return {
    coding: codings,
    ...(cne.$9_originalText ? { text: cne.$9_originalText } : cne.$2_text && { text: cne.$2_text }),
  };
}

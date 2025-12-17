import type { CWE } from "../../hl7v2/generated/fields";
import type { Identifier, Organization } from "../../fhir/hl7-fhir-r4-core";

export function convertCWEToOrganization(cwe: CWE | undefined): Organization | undefined {
  if (!cwe) return undefined;

  const name = cwe.$2_text || cwe.$9_originalText;

  let identifier: Identifier | undefined;
  if (cwe.$1_code) {
    identifier = {
      value: cwe.$1_code,
      ...(cwe.$3_system && { system: cwe.$3_system }),
    };
  }

  if (!name && !identifier) return undefined;

  return {
    resourceType: "Organization",
    ...(name && { name }),
    ...(identifier && { identifier: [identifier] }),
  };
}

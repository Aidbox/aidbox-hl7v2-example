import type { Practitioner, HumanName, Identifier } from "../../fhir/hl7-fhir-r4-core";

export interface CNN {
  $1_id?: string;
  $2_family?: string;
  $3_given?: string;
  $4_additionalGiven?: string;
  $5_suffix?: string;
  $6_prefix?: string;
  $7_degree?: string;
  $8_sourceTable?: string;
  $9_assigningAuthorityNamespace?: string;
  $10_assigningAuthorityUniversalId?: string;
  $11_assigningAuthorityUniversalIdType?: string;
}

export function convertCNNToPractitioner(cnn: CNN | undefined): Practitioner | undefined {
  if (!cnn) return undefined;

  const hasName = cnn.$2_family || cnn.$3_given;
  const hasId = cnn.$1_id;

  if (!hasName && !hasId) return undefined;

  const practitioner: Practitioner = {
    resourceType: "Practitioner",
  };

  if (hasId) {
    const identifier: Identifier = {
      value: cnn.$1_id,
    };
    practitioner.identifier = [identifier];
  }

  if (hasName) {
    const given: string[] = [];
    if (cnn.$3_given) given.push(cnn.$3_given);
    if (cnn.$4_additionalGiven) given.push(cnn.$4_additionalGiven);

    const suffix: string[] = [];
    if (cnn.$5_suffix) suffix.push(cnn.$5_suffix);
    if (cnn.$7_degree) suffix.push(cnn.$7_degree);

    const name: HumanName = {
      ...(cnn.$2_family && { family: cnn.$2_family }),
      ...(given.length > 0 && { given }),
      ...(cnn.$6_prefix && { prefix: [cnn.$6_prefix] }),
      ...(suffix.length > 0 && { suffix }),
    };

    practitioner.name = [name];
  }

  return practitioner;
}

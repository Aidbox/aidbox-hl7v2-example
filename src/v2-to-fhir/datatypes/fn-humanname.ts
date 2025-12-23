import type { FN } from "../../hl7v2/generated/fields";
import type { HumanName, Extension } from "../../fhir/hl7-fhir-r4-core";

export function convertFNToHumanName(fn: FN | undefined): HumanName | undefined {
  if (!fn) return undefined;
  if (!fn.$1_family) return undefined;

  const extensions: Extension[] = [];

  if (fn.$2_ownPrefix) {
    extensions.push({
      url: "http://hl7.org/fhir/StructureDefinition/humanname-own-prefix",
      valueString: fn.$2_ownPrefix,
    });
  }

  if (fn.$3_ownFamily) {
    extensions.push({
      url: "http://hl7.org/fhir/StructureDefinition/humanname-own-name",
      valueString: fn.$3_ownFamily,
    });
  }

  if (fn.$4_partnerPrefix) {
    extensions.push({
      url: "http://hl7.org/fhir/StructureDefinition/humanname-partner-prefix",
      valueString: fn.$4_partnerPrefix,
    });
  }

  if (fn.$5_partnerFamily) {
    extensions.push({
      url: "http://hl7.org/fhir/StructureDefinition/humanname-partner-name",
      valueString: fn.$5_partnerFamily,
    });
  }

  const result: HumanName = {
    family: fn.$1_family,
  };

  if (extensions.length > 0) {
    (result as any)._family = { extension: extensions };
  }

  return result;
}

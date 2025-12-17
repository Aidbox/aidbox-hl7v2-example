import type { Extension } from "../../fhir/hl7-fhir-r4-core";

const SUBID_EXTENSION_URL = "http://hl7.org/fhir/StructureDefinition/observation-v2-subid";

/** OG (Observation Grouper) datatype */
export interface OG {
  /** OG.1 - Original Sub-Identifier */
  $1_originalSubIdentifier?: string;
  /** OG.2 - Group */
  $2_group?: string;
  /** OG.3 - Sequence */
  $3_sequence?: string;
  /** OG.4 - Identifier */
  $4_identifier?: string;
}

/**
 * Converts OG (Observation Grouper) to Observation subidentifier extension.
 *
 * Mapping:
 * - OG.1 (Original Sub-Identifier) -> extension.valueString (original-sub-identifier)
 * - OG.2 (Group) -> extension.valueDecimal (group)
 * - OG.3 (Sequence) -> extension.valueDecimal (sequence)
 * - OG.4 (Identifier) -> extension.valueString (identifier)
 *
 * All are nested within observation-v2-subid extension.
 */
export function convertOGToExtension(og: OG | undefined): Extension | undefined {
  if (!og) return undefined;
  if (!og.$1_originalSubIdentifier && !og.$2_group && !og.$3_sequence && !og.$4_identifier) {
    return undefined;
  }

  const subExtensions: Extension[] = [];

  if (og.$1_originalSubIdentifier) {
    subExtensions.push({
      url: "original-sub-identifier",
      valueString: og.$1_originalSubIdentifier,
    });
  }

  if (og.$2_group) {
    const groupValue = parseFloat(og.$2_group);
    if (!isNaN(groupValue)) {
      subExtensions.push({
        url: "group",
        valueDecimal: groupValue,
      });
    }
  }

  if (og.$3_sequence) {
    const seqValue = parseFloat(og.$3_sequence);
    if (!isNaN(seqValue)) {
      subExtensions.push({
        url: "sequence",
        valueDecimal: seqValue,
      });
    }
  }

  if (og.$4_identifier) {
    subExtensions.push({
      url: "identifier",
      valueString: og.$4_identifier,
    });
  }

  if (subExtensions.length === 0) return undefined;

  return {
    url: SUBID_EXTENSION_URL,
    extension: subExtensions,
  };
}

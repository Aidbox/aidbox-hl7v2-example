import type { CWE } from "../../hl7v2/generated/fields";
import type { Identifier, Extension, Element } from "../../fhir/hl7-fhir-r4-core";
import { convertCWEToCodeableConcept } from "./cwe-codeableconcept";

const STATE_QUALIFIER_EXTENSION_URL = "http://hl7.org/fhir/StructureDefinition/identifier-state-qualifier";

/** PLN (Practitioner License or Other ID Number) datatype */
export interface PLN {
  /** PLN.1 - ID Number */
  $1_idNumber?: string;
  /** PLN.2 - Type of ID Number */
  $2_idType?: CWE;
  /** PLN.3 - State/other Qualifying Information */
  $3_stateQualifier?: string;
  /** PLN.4 - Expiration Date */
  $4_expirationDate?: string;
}

/** Extended Identifier with _value extension support */
export interface IdentifierWithExtensions extends Identifier {
  _value?: Element;
}

/**
 * Converts PLN (Practitioner License or Other ID Number) to Identifier.
 *
 * Mapping:
 * - PLN.1 (ID Number) -> value
 * - PLN.2 (Type of ID Number) -> type (CWE[CodeableConcept])
 * - PLN.3 (State/other Qualifying Information) -> extension
 * - PLN.4 (Expiration Date) -> period.end
 */
export function convertPLNToIdentifier(pln: PLN | undefined): IdentifierWithExtensions | undefined {
  if (!pln) return undefined;
  if (!pln.$1_idNumber) return undefined;

  const identifier: IdentifierWithExtensions = {
    value: pln.$1_idNumber,
  };

  if (pln.$2_idType) {
    identifier.type = convertCWEToCodeableConcept(pln.$2_idType);
  }

  if (pln.$3_stateQualifier) {
    // Add state qualifier as extension
    const ext: Extension = {
      url: STATE_QUALIFIER_EXTENSION_URL,
      valueString: pln.$3_stateQualifier,
    };
    identifier.extension = [ext];
  }

  if (pln.$4_expirationDate) {
    // Convert expiration date (DT format: YYYYMMDD)
    identifier.period = {
      end: pln.$4_expirationDate,
    };
  }

  return identifier;
}

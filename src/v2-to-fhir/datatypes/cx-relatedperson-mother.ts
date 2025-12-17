import type { CX } from "../../hl7v2/generated/fields";
import type { Identifier, CodeableConcept, Period } from "../../fhir/hl7-fhir-r4-core";

/** Result of CX to RelatedPerson-Mother conversion (partial RelatedPerson data) */
export interface RelatedPersonMotherData {
  identifier?: Identifier;
  relationship: CodeableConcept;
}

const MOTHER_RELATIONSHIP_SYSTEM = "http://terminology.hl7.org/CodeSystem/v3-RoleCode";
const MOTHER_RELATIONSHIP_CODE = "MTH";

/**
 * Converts CX (Extended Composite ID) to RelatedPerson-Mother data.
 *
 * This creates partial RelatedPerson data for representing a mother relationship.
 * The result includes:
 * - identifier from CX fields
 * - relationship code "MTH" (mother)
 *
 * Note: The patient reference must be set separately.
 *
 * Mapping:
 * - CX.1 (ID Number) -> identifier.value
 * - CX.4 (Assigning Authority) -> identifier.system
 * - CX.5 (Identifier Type Code) -> identifier.type.coding.code
 * - CX.7 (Effective Date) -> identifier.period.start
 * - CX.8 (Expiration Date) -> identifier.period.end
 * - Fixed: relationship.coding[0].code = "MTH"
 * - Fixed: relationship.coding[0].system = "http://terminology.hl7.org/CodeSystem/v3-RoleCode"
 */
export function convertCXToRelatedPersonMother(cx: CX | undefined): RelatedPersonMotherData | undefined {
  if (!cx) return undefined;
  if (!cx.$1_value) return undefined;

  const result: RelatedPersonMotherData = {
    relationship: {
      coding: [
        {
          system: MOTHER_RELATIONSHIP_SYSTEM,
          code: MOTHER_RELATIONSHIP_CODE,
        },
      ],
    },
  };

  // Build identifier
  const identifier: Identifier = {
    value: cx.$1_value,
  };

  // Map assigning authority (HD) to system
  if (cx.$4_system) {
    const system = cx.$4_system.$2_system ?? cx.$4_system.$1_namespace;
    if (system) {
      identifier.system = system;
    }
  }

  // Map identifier type code
  if (cx.$5_type) {
    identifier.type = {
      coding: [{ code: cx.$5_type }],
    };
  }

  // Map period (effective and expiration dates)
  if (cx.$7_start || cx.$8_end) {
    const period: Period = {};
    if (cx.$7_start) period.start = cx.$7_start;
    if (cx.$8_end) period.end = cx.$8_end;
    identifier.period = period;
  }

  result.identifier = identifier;

  return result;
}

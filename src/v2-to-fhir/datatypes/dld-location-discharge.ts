import type { DLD } from "../../hl7v2/generated/fields";
import type { CodeableConcept } from "../../fhir/hl7-fhir-r4-core";

/** Partial Location data for discharge location */
export interface LocationDischargeData {
  type?: CodeableConcept;
}

/**
 * Converts DLD (Discharge to Location and Date) to Location type data.
 *
 * Mapping:
 * - DLD.1 (Discharge to Location) -> type (CodeableConcept)
 * - DLD.2 (Effective Date) -> not mapped (use PV1-45 if available separately)
 *
 * Note: DLD.1 is typically a CWE in HL7v2 spec, but may be simplified to string
 * in some implementations. This function handles it as a code value.
 */
export function convertDLDToLocationDischarge(dld: DLD | undefined): LocationDischargeData | undefined {
  if (!dld) return undefined;
  if (!dld.$1_location) return undefined;

  return {
    type: {
      coding: [
        {
          code: dld.$1_location,
        },
      ],
    },
  };
}

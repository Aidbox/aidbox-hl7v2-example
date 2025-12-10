import type { Account } from "../fhir/hl7-fhir-r4-core/Account";
import type { Condition } from "../fhir/hl7-fhir-r4-core/Condition";
import type { Coverage } from "../fhir/hl7-fhir-r4-core/Coverage";
import type { Encounter } from "../fhir/hl7-fhir-r4-core/Encounter";
import type { Organization } from "../fhir/hl7-fhir-r4-core/Organization";
import type { Patient } from "../fhir/hl7-fhir-r4-core/Patient";
import type { Practitioner } from "../fhir/hl7-fhir-r4-core/Practitioner";
import type { Procedure } from "../fhir/hl7-fhir-r4-core/Procedure";
import type { RelatedPerson } from "../fhir/hl7-fhir-r4-core/RelatedPerson";

/**
 * Input bundle for BAR message generation
 */
export interface BarMessageInput {
  // Required resources
  patient: Patient;
  account: Account;

  // Usually required
  encounter?: Encounter | null;
  coverages?: Coverage[] | null;

  // Guarantor info
  guarantor?: RelatedPerson | Patient | null;

  // Optional resources
  conditions?: Condition[] | null;
  procedures?: Procedure[] | null;
  practitioners?: Map<string, Practitioner> | null;
  organizations?: Map<string, Organization> | null;

  // Message metadata
  messageControlId: string;
  triggerEvent: "P01" | "P05" | "P06"; // Add | Update | End
  sendingApplication?: string | null;
  sendingFacility?: string | null;
  receivingApplication?: string | null;
  receivingFacility?: string | null;
}

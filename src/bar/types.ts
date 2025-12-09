/**
 * FHIR Resource Types for BAR Message Generation
 * Simplified types based on FHIR R4 resources needed for BAR messages
 */

// Common FHIR types
export interface Reference {
  reference?: string;
  display?: string;
}

export interface Identifier {
  system?: string;
  value?: string;
  type?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
}

export interface CodeableConcept {
  coding?: Array<{ system?: string; code?: string; display?: string }>;
  text?: string;
}

export interface Period {
  start?: string;
  end?: string;
}

export interface HumanName {
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
}

export interface Address {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ContactPoint {
  system?: string; // phone | fax | email | pager | url | sms | other
  value?: string;
  use?: string; // home | work | temp | old | mobile
}

// FHIR Resources

export interface Patient {
  resourceType: "Patient";
  id?: string;
  identifier?: Identifier[];
  name?: HumanName[];
  birthDate?: string;
  gender?: string;
  address?: Address[];
  telecom?: ContactPoint[];
}

export interface Account {
  resourceType: "Account";
  id?: string;
  identifier?: Identifier[];
  status?: string;
  type?: CodeableConcept;
  servicePeriod?: Period;
  guarantor?: Array<{
    party: Reference;
    onHold?: boolean;
    period?: Period;
  }>;
}

export interface Encounter {
  resourceType: "Encounter";
  id?: string;
  identifier?: Identifier[];
  status?: string;
  class?: { code?: string; display?: string };
  type?: CodeableConcept[];
  period?: Period;
  location?: Array<{
    location: Reference;
    physicalType?: CodeableConcept;
  }>;
  participant?: Array<{
    type?: CodeableConcept[];
    individual?: Reference;
  }>;
}

export interface Coverage {
  resourceType: "Coverage";
  id?: string;
  identifier?: Identifier[];
  status?: string;
  type?: CodeableConcept;
  subscriber?: Reference;
  subscriberId?: string;
  beneficiary?: Reference;
  relationship?: CodeableConcept;
  period?: Period;
  payor?: Reference[];
  class?: Array<{
    type: CodeableConcept;
    value: string;
    name?: string;
  }>;
  order?: number;
}

export interface RelatedPerson {
  resourceType: "RelatedPerson";
  id?: string;
  identifier?: Identifier[];
  patient?: Reference;
  relationship?: CodeableConcept[];
  name?: HumanName[];
  telecom?: ContactPoint[];
  address?: Address[];
}

export interface Organization {
  resourceType: "Organization";
  id?: string;
  identifier?: Identifier[];
  name?: string;
  address?: Address[];
  telecom?: ContactPoint[];
}

export interface Practitioner {
  resourceType: "Practitioner";
  id?: string;
  identifier?: Identifier[];
  name?: HumanName[];
}

export interface Condition {
  resourceType: "Condition";
  id?: string;
  code?: CodeableConcept;
  category?: CodeableConcept[];
  clinicalStatus?: CodeableConcept;
  onsetDateTime?: string;
  recordedDate?: string;
}

export interface Procedure {
  resourceType: "Procedure";
  id?: string;
  code?: CodeableConcept;
  status?: string;
  performedDateTime?: string;
  performedPeriod?: Period;
  performer?: Array<{
    actor: Reference;
  }>;
}

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

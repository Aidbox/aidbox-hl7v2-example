/**
 * BAR Message Generator
 * Generates BAR^P01/P05/P06 messages from FHIR resources
 *
 * Based on spec/fhir-to-bar.md mapping:
 * - MSH: Message routing metadata
 * - EVN: Account event (start/update/end)
 * - PID: Patient (+ Account.identifier for PID-18)
 * - PV1/PV2: Encounter (visit context)
 * - GT1: Account.guarantor or RelatedPerson
 * - IN1/IN2/IN3: Coverage (+ Organization as payor)
 * - DG1: Condition (diagnoses)
 * - PR1: Procedure
 */

import type { HL7v2Message, HL7v2Segment } from "../hl7v2/types";
import {
  MSHBuilder,
  EVNBuilder,
  PIDBuilder,
  PV1Builder,
  GT1Builder,
  IN1Builder,
  DG1Builder,
  PR1Builder,
} from "../hl7v2/fields";
import type {
  BarMessageInput,
  Patient,
  Account,
  Encounter,
  Coverage,
  RelatedPerson,
  Condition,
  Procedure,
  HumanName,
  Address,
  Organization,
  CodeableConcept,
} from "./types";

/**
 * Format date string to HL7v2 timestamp format (YYYYMMDD or YYYYMMDDHHmmss)
 */
function formatHL7Date(dateStr: string | undefined): string {
  if (!dateStr) return "";
  // Remove dashes and colons, handle ISO format
  return dateStr.replace(/[-:T]/g, "").replace(/\.\d+Z?$/, "").substring(0, 14);
}

/**
 * Get current timestamp in HL7v2 format
 */
function nowHL7(): string {
  return formatHL7Date(new Date().toISOString());
}

/**
 * Map FHIR gender to HL7v2 sex (Table 0001)
 */
function mapGender(gender: string | undefined): string {
  switch (gender) {
    case "male":
      return "M";
    case "female":
      return "F";
    case "other":
      return "O";
    case "unknown":
      return "U";
    default:
      return "";
  }
}

/**
 * Map FHIR encounter class to HL7v2 patient class (Table 0004)
 */
function mapPatientClass(encounterClass: { code?: string } | undefined): string {
  if (!encounterClass?.code) return "";
  switch (encounterClass.code) {
    case "IMP":
    case "ACUTE":
    case "NONAC":
      return "I"; // Inpatient
    case "AMB":
    case "OBSENC":
      return "O"; // Outpatient
    case "EMER":
      return "E"; // Emergency
    case "PRENC":
      return "P"; // Preadmit
    default:
      return encounterClass.code;
  }
}

/**
 * Get first identifier value from array
 */
function getIdentifierValue(identifiers: { value?: string }[] | undefined): string {
  return identifiers?.[0]?.value ?? "";
}

/**
 * Get the first HumanName from array
 */
function getFirstName(names: HumanName[] | undefined): HumanName | undefined {
  return names?.[0];
}

/**
 * Get the first Address from array
 */
function getFirstAddress(addresses: Address[] | undefined): Address | undefined {
  return addresses?.[0];
}

/**
 * Get code from CodeableConcept
 */
function getCode(concept: CodeableConcept | undefined): { code: string; display: string; system: string } {
  const coding = concept?.coding?.[0];
  return {
    code: coding?.code ?? "",
    display: coding?.display ?? concept?.text ?? "",
    system: mapCodingSystem(coding?.system),
  };
}

/**
 * Map FHIR coding system to HL7v2 coding system name
 */
function mapCodingSystem(system: string | undefined): string {
  if (!system) return "";
  if (system.includes("icd-10")) return "ICD10";
  if (system.includes("icd-9")) return "I9C";
  if (system.includes("cpt")) return "CPT";
  if (system.includes("snomed")) return "SCT";
  if (system.includes("loinc")) return "LN";
  return system;
}

/**
 * Map FHIR relationship code to HL7v2 guarantor type (Table 0063)
 */
function mapGuarantorRelationship(relationship: CodeableConcept | undefined): string {
  const code = relationship?.coding?.[0]?.code;
  if (!code) return "SE"; // Default to self
  switch (code.toUpperCase()) {
    case "SELF":
      return "SE";
    case "SPOUSE":
    case "SPS":
      return "SP";
    case "PARENT":
    case "PRN":
    case "MTH":
    case "FTH":
      return "PA";
    case "CHILD":
    case "CHD":
      return "CH";
    case "SIBLING":
    case "SIB":
      return "SB";
    case "GUARD":
      return "GD";
    default:
      return "OT"; // Other
  }
}

/**
 * Build MSH segment
 */
function buildMSH(input: BarMessageInput): HL7v2Segment {
  const timestamp = nowHL7();
  return new MSHBuilder()
    .set1_fieldSeparator("|")
    .set2_encodingCharacters("^~\\&")
    .set3_sendingApplication(input.sendingApplication ?? "FHIR_APP")
    .set4_sendingFacility(input.sendingFacility ?? "FHIR_FAC")
    .set5_receivingApplication(input.receivingApplication ?? "BILLING_APP")
    .set6_receivingFacility(input.receivingFacility ?? "BILLING_FAC")
    .set7_dateTimeOfMessage(timestamp)
    .set9_1_messageCode("BAR")
    .set9_2_triggerEvent(input.triggerEvent)
    .set9_3_messageStructure(`BAR_${input.triggerEvent}`)
    .set10_messageControlId(input.messageControlId)
    .set11_1_processingId("P")
    .set12_1_versionId("2.5.1")
    .build();
}

/**
 * Build EVN segment
 * EVN-2 is semantically important:
 * - P01: account start time
 * - P05: time of update
 * - P06: account end time
 */
function buildEVN(input: BarMessageInput): HL7v2Segment {
  const account = input.account;
  let eventDateTime: string;

  if (input.triggerEvent === "P01") {
    eventDateTime = formatHL7Date(account.servicePeriod?.start) || nowHL7();
  } else if (input.triggerEvent === "P06") {
    eventDateTime = formatHL7Date(account.servicePeriod?.end) || nowHL7();
  } else {
    eventDateTime = nowHL7();
  }

  return new EVNBuilder()
    .set1_eventTypeCode(input.triggerEvent)
    .set2_recordedDateTime(eventDateTime)
    .set6_eventOccurred(eventDateTime)
    .build();
}

/**
 * Build PID segment from Patient + Account
 *
 * Key mappings:
 * - PID-3: Patient.identifier[] (MRN)
 * - PID-5: Patient.name[]
 * - PID-7: Patient.birthDate
 * - PID-8: Patient.gender
 * - PID-11: Patient.address[]
 * - PID-13: Patient.telecom[]
 * - PID-18: Account.identifier (account number - not in Patient!)
 */
function buildPID(patient: Patient, account: Account): HL7v2Segment {
  const name = getFirstName(patient.name);
  const address = getFirstAddress(patient.address);
  const phone = patient.telecom?.find((t) => t.system === "phone");
  const patientId = getIdentifierValue(patient.identifier);
  const accountId = getIdentifierValue(account.identifier);

  const builder = new PIDBuilder().set1_setIdPid("1");

  // PID-3: Patient Identifier List (MRN)
  if (patientId) {
    builder
      .set3_1_idNumber(patientId)
      .set3_5_identifierTypeCode("MR");
  }

  // PID-5: Patient Name
  if (name) {
    if (name.family) builder.set5_1_1_surname(name.family);
    if (name.given?.[0]) builder.set5_2_givenName(name.given[0]);
    if (name.given?.[1]) builder.set5_3_secondAndFurtherGivenNamesOrInitialsThereof(name.given[1]);
  }

  // PID-7: Date of Birth
  if (patient.birthDate) {
    builder.set7_dateTimeOfBirth(formatHL7Date(patient.birthDate));
  }

  // PID-8: Administrative Sex
  if (patient.gender) {
    builder.set8_administrativeSex(mapGender(patient.gender));
  }

  // PID-11: Patient Address
  if (address) {
    if (address.line?.[0]) builder.set11_1_1_streetOrMailingAddress(address.line[0]);
    if (address.city) builder.set11_3_city(address.city);
    if (address.state) builder.set11_4_stateOrProvince(address.state);
    if (address.postalCode) builder.set11_5_zipOrPostalCode(address.postalCode);
    if (address.country) builder.set11_6_country(address.country);
  }

  // PID-13: Phone Number - Home
  if (phone?.value) {
    builder.set13_1_telephoneNumber(phone.value);
  }

  // PID-18: Patient Account Number (from Account, not Patient!)
  if (accountId) {
    builder.set18_1_idNumber(accountId);
  }

  return builder.build();
}

/**
 * Build PV1 segment from Encounter
 *
 * Key mappings:
 * - PV1-2: Encounter.class
 * - PV1-3: Encounter.location[].location
 * - PV1-19: Encounter.identifier[] (visit number)
 * - PV1-44: Encounter.period.start (admit date)
 * - PV1-45: Encounter.period.end (discharge date)
 */
function buildPV1(encounter: Encounter): HL7v2Segment {
  const builder = new PV1Builder().set1_setIdPv1("1");

  // PV1-2: Patient Class
  builder.set2_patientClass(mapPatientClass(encounter.class));

  // PV1-3: Assigned Patient Location
  const location = encounter.location?.[0];
  if (location?.location?.display) {
    builder.set3_1_pointOfCare(location.location.display);
  }

  // PV1-19: Visit Number
  const visitId = getIdentifierValue(encounter.identifier);
  if (visitId) {
    builder.set19_1_idNumber(visitId);
  }

  // PV1-44: Admit Date/Time
  if (encounter.period?.start) {
    builder.set44_admitDateTime(formatHL7Date(encounter.period.start));
  }

  // PV1-45: Discharge Date/Time
  if (encounter.period?.end) {
    builder.set45_dischargeDateTime(formatHL7Date(encounter.period.end));
  }

  return builder.build();
}

/**
 * Build GT1 segment from RelatedPerson or Patient (if self-guarantor)
 *
 * Key mappings:
 * - GT1-2: Guarantor Number
 * - GT1-3: Guarantor Name
 * - GT1-5: Guarantor Address
 * - GT1-6: Guarantor Phone
 * - GT1-10: Guarantor Type (relationship)
 */
function buildGT1(guarantor: RelatedPerson | Patient, setId: number = 1): HL7v2Segment {
  const name = getFirstName(guarantor.name);
  const address = getFirstAddress(guarantor.address);
  const phone = guarantor.telecom?.find((t) => t.system === "phone");
  const guarantorId = getIdentifierValue(guarantor.identifier);

  const builder = new GT1Builder().set1_setIdGt1(String(setId));

  // GT1-2: Guarantor Number
  if (guarantorId) {
    builder.set2_1_idNumber(guarantorId);
  }

  // GT1-3: Guarantor Name
  if (name) {
    if (name.family) builder.set3_1_1_surname(name.family);
    if (name.given?.[0]) builder.set3_2_givenName(name.given[0]);
  }

  // GT1-5: Guarantor Address
  if (address) {
    if (address.line?.[0]) builder.set5_1_1_streetOrMailingAddress(address.line[0]);
    if (address.city) builder.set5_3_city(address.city);
    if (address.state) builder.set5_4_stateOrProvince(address.state);
    if (address.postalCode) builder.set5_5_zipOrPostalCode(address.postalCode);
    if (address.country) builder.set5_6_country(address.country);
  }

  // GT1-6: Guarantor Phone Number
  if (phone?.value) {
    builder.set6_1_telephoneNumber(phone.value);
  }

  // GT1-10: Guarantor Type
  if (guarantor.resourceType === "Patient") {
    builder.set10_guarantorType("SE"); // Self
  } else {
    const relationship = (guarantor as RelatedPerson).relationship?.[0];
    builder.set10_guarantorType(mapGuarantorRelationship(relationship));
  }

  return builder.build();
}

/**
 * Build IN1 segment from Coverage
 *
 * Key mappings:
 * - IN1-1: Set ID (1=primary, 2=secondary, ...)
 * - IN1-2: Insurance Plan ID (Coverage.class or Coverage.type)
 * - IN1-3: Insurance Company ID (Coverage.payor.identifier)
 * - IN1-4: Insurance Company Name (Organization.name from payor)
 * - IN1-8: Group Number (Coverage.class[group])
 * - IN1-12: Plan Effective Date
 * - IN1-13: Plan Expiration Date
 * - IN1-17: Insured's Relationship to Patient
 * - IN1-36: Policy Number (Coverage.subscriberId)
 */
function buildIN1(
  coverage: Coverage,
  setId: number,
  payorOrg?: Organization
): HL7v2Segment {
  const builder = new IN1Builder().set1_setIdIn1(String(setId));

  // IN1-2: Insurance Plan ID (from Coverage.type)
  const planCode = getCode(coverage.type);
  if (planCode.code) {
    builder.set2_1_identifier(planCode.code);
    if (planCode.display) builder.set2_2_text(planCode.display);
  }

  // IN1-3: Insurance Company ID (from payor)
  const payorId = payorOrg?.identifier?.[0]?.value ?? coverage.payor?.[0]?.reference;
  if (payorId) {
    builder.set3_1_idNumber(payorId);
  }

  // IN1-4: Insurance Company Name
  if (payorOrg?.name) {
    builder.set4_1_organizationName(payorOrg.name);
  } else if (coverage.payor?.[0]?.display) {
    builder.set4_1_organizationName(coverage.payor[0].display);
  }

  // IN1-8: Group Number (from Coverage.class with type=group)
  const groupClass = coverage.class?.find(
    (c) => c.type?.coding?.[0]?.code === "group"
  );
  if (groupClass?.value) {
    builder.set8_groupNumber(groupClass.value);
  }

  // IN1-9: Group Name
  if (groupClass?.name) {
    builder.set9_1_organizationName(groupClass.name);
  }

  // IN1-12: Plan Effective Date
  if (coverage.period?.start) {
    builder.set12_planEffectiveDate(formatHL7Date(coverage.period.start));
  }

  // IN1-13: Plan Expiration Date
  if (coverage.period?.end) {
    builder.set13_planExpirationDate(formatHL7Date(coverage.period.end));
  }

  // IN1-17: Insured's Relationship to Patient
  const relationship = getCode(coverage.relationship);
  if (relationship.code) {
    builder.set17_1_identifier(relationship.code);
    if (relationship.display) builder.set17_2_text(relationship.display);
  }

  // IN1-36: Policy Number / Subscriber ID
  if (coverage.subscriberId) {
    builder.set36_policyNumber(coverage.subscriberId);
  }

  return builder.build();
}

/**
 * Build DG1 segment from Condition
 *
 * Key mappings:
 * - DG1-1: Set ID
 * - DG1-3: Diagnosis Code (Condition.code)
 * - DG1-5: Diagnosis Date/Time
 * - DG1-6: Diagnosis Type
 * - DG1-15: Diagnosis Priority
 */
function buildDG1(condition: Condition, setId: number): HL7v2Segment {
  const code = getCode(condition.code);
  const category = getCode(condition.category?.[0]);

  const builder = new DG1Builder().set1_setIdDg1(String(setId));

  // DG1-2: Diagnosis Coding Method (deprecated but some systems use it)
  if (code.system) {
    builder.set2_diagnosisCodingMethod(code.system);
  }

  // DG1-3: Diagnosis Code
  if (code.code) {
    builder.set3_1_identifier(code.code);
    if (code.display) builder.set3_2_text(code.display);
    if (code.system) builder.set3_3_nameOfCodingSystem(code.system);
  }

  // DG1-5: Diagnosis Date/Time
  const diagDate = condition.recordedDate ?? condition.onsetDateTime;
  if (diagDate) {
    builder.set5_diagnosisDateTime(formatHL7Date(diagDate));
  }

  // DG1-6: Diagnosis Type (A=admitting, W=working, F=final)
  if (category.code) {
    builder.set6_diagnosisType(category.code);
  }

  // DG1-15: Diagnosis Priority (1=primary)
  builder.set15_diagnosisPriority(String(setId));

  return builder.build();
}

/**
 * Build PR1 segment from Procedure
 *
 * Key mappings:
 * - PR1-1: Set ID
 * - PR1-3: Procedure Code
 * - PR1-5: Procedure Date/Time
 * - PR1-6: Procedure Functional Type
 */
function buildPR1(procedure: Procedure, setId: number): HL7v2Segment {
  const code = getCode(procedure.code);

  const builder = new PR1Builder().set1_setIdPr1(String(setId));

  // PR1-2: Procedure Coding Method (deprecated)
  if (code.system) {
    builder.set2_procedureCodingMethod(code.system);
  }

  // PR1-3: Procedure Code
  if (code.code) {
    builder.set3_1_identifier(code.code);
    if (code.display) builder.set3_2_text(code.display);
    if (code.system) builder.set3_3_nameOfCodingSystem(code.system);
  }

  // PR1-5: Procedure Date/Time
  const procDate = procedure.performedDateTime ?? procedure.performedPeriod?.start;
  if (procDate) {
    builder.set5_procedureDateTime(formatHL7Date(procDate));
  }

  return builder.build();
}

/**
 * Generate a BAR message from FHIR resources
 *
 * @param input - Bundle of FHIR resources and message metadata
 * @returns HL7v2 BAR message as array of segments
 *
 * Message structure (BAR^P01/P05):
 * MSH - Message Header
 * EVN - Event Type
 * PID - Patient Identification
 * [PV1] - Patient Visit
 * {DG1} - Diagnosis (repeating)
 * {PR1} - Procedure (repeating)
 * {GT1} - Guarantor (repeating)
 * {IN1} - Insurance (repeating)
 */
export function generateBarMessage(input: BarMessageInput): HL7v2Message {
  const segments: HL7v2Message = [];

  // Required segments
  segments.push(buildMSH(input));
  segments.push(buildEVN(input));
  segments.push(buildPID(input.patient, input.account));

  // PV1 if encounter provided
  if (input.encounter) {
    segments.push(buildPV1(input.encounter));
  }

  // DG1 segments for conditions
  if (input.conditions?.length) {
    input.conditions.forEach((condition, idx) => {
      segments.push(buildDG1(condition, idx + 1));
    });
  }

  // PR1 segments for procedures
  if (input.procedures?.length) {
    input.procedures.forEach((procedure, idx) => {
      segments.push(buildPR1(procedure, idx + 1));
    });
  }

  // GT1 for guarantor
  if (input.guarantor) {
    segments.push(buildGT1(input.guarantor, 1));
  }

  // IN1 segments for coverages
  if (input.coverages?.length) {
    // Sort by order (primary first)
    const sortedCoverages = [...input.coverages].sort(
      (a, b) => (a.order ?? 1) - (b.order ?? 1)
    );

    sortedCoverages.forEach((coverage, idx) => {
      // Try to resolve payor organization
      const payorRef = coverage.payor?.[0]?.reference;
      const payorOrg = payorRef ? input.organizations?.get(payorRef) : undefined;
      segments.push(buildIN1(coverage, idx + 1, payorOrg));
    });
  }

  return segments;
}

// Re-export types for convenience
export type { BarMessageInput } from "./types";

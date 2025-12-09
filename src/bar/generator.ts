/**
 * BAR Message Generator
 * Generates BAR^P01/P05/P06 messages from FHIR resources
 */

import type { HL7v2Message } from "../hl7v2/types";
import type {
  MSHBuilder,
  EVNBuilder,
  PIDBuilder,
  PV1Builder,
  GT1Builder,
  IN1Builder,
  DG1Builder,
  PR1Builder,
} from "../hl7v2/fields";
import {
  BAR_P01Builder,
  type BAR_P01_VISITBuilder,
} from "../hl7v2/messages";
import type {
  BarMessageInput,
  Encounter,
  Coverage,
  RelatedPerson,
  Condition,
  Procedure,
  HumanName,
  Address,
  Organization,
  CodeableConcept,
  Patient,
} from "./types";

// ============================================================================
// Helper functions
// ============================================================================

function formatHL7Date(dateStr: string | undefined): string {
  if (!dateStr) return "";
  return dateStr.replace(/[-:T]/g, "").replace(/\.\d+Z?$/, "").substring(0, 14);
}

function nowHL7(): string {
  return formatHL7Date(new Date().toISOString());
}

function mapGender(gender: string | undefined): string {
  switch (gender) {
    case "male": return "M";
    case "female": return "F";
    case "other": return "O";
    case "unknown": return "U";
    default: return "";
  }
}

function mapPatientClass(encounterClass: { code?: string } | undefined): string {
  if (!encounterClass?.code) return "";
  switch (encounterClass.code) {
    case "IMP":
    case "ACUTE":
    case "NONAC": return "I";
    case "AMB":
    case "OBSENC": return "O";
    case "EMER": return "E";
    case "PRENC": return "P";
    default: return encounterClass.code;
  }
}

function getIdentifierValue(identifiers: { value?: string }[] | undefined): string {
  return identifiers?.[0]?.value ?? "";
}

function getFirstName(names: HumanName[] | undefined): HumanName | undefined {
  return names?.[0];
}

function getFirstAddress(addresses: Address[] | undefined): Address | undefined {
  return addresses?.[0];
}

function getCode(concept: CodeableConcept | undefined): { code: string; display: string; system: string } {
  const coding = concept?.coding?.[0];
  return {
    code: coding?.code ?? "",
    display: coding?.display ?? concept?.text ?? "",
    system: mapCodingSystem(coding?.system),
  };
}

function mapCodingSystem(system: string | undefined): string {
  if (!system) return "";
  if (system.includes("icd-10")) return "ICD10";
  if (system.includes("icd-9")) return "I9C";
  if (system.includes("cpt")) return "CPT";
  if (system.includes("snomed")) return "SCT";
  if (system.includes("loinc")) return "LN";
  return system;
}

function mapGuarantorRelationship(relationship: CodeableConcept | undefined): string {
  const code = relationship?.coding?.[0]?.code;
  if (!code) return "SE";
  switch (code.toUpperCase()) {
    case "SELF": return "SE";
    case "SPOUSE":
    case "SPS": return "SP";
    case "PARENT":
    case "PRN":
    case "MTH":
    case "FTH": return "PA";
    case "CHILD":
    case "CHD": return "CH";
    case "SIBLING":
    case "SIB": return "SB";
    case "GUARD": return "GD";
    default: return "OT";
  }
}

// ============================================================================
// Segment builders
// ============================================================================

const buildMSH = (input: BarMessageInput) => (msh: MSHBuilder) => msh
  .set1_fieldSeparator("|")
  .set2_encodingCharacters("^~\\&")
  .set3_sendingApplication(input.sendingApplication ?? "FHIR_APP")
  .set4_sendingFacility(input.sendingFacility ?? "FHIR_FAC")
  .set5_receivingApplication(input.receivingApplication ?? "BILLING_APP")
  .set6_receivingFacility(input.receivingFacility ?? "BILLING_FAC")
  .set7_dateTimeOfMessage(nowHL7())
  .set9_1_messageCode("BAR")
  .set9_2_triggerEvent(input.triggerEvent)
  .set9_3_messageStructure(`BAR_${input.triggerEvent}`)
  .set10_messageControlId(input.messageControlId)
  .set11_1_processingId("P")
  .set12_1_versionId("2.5.1");

const buildEVN = (input: BarMessageInput) => (evn: EVNBuilder) => {
  const account = input.account;
  const eventDateTime = input.triggerEvent === "P01"
    ? formatHL7Date(account.servicePeriod?.start) || nowHL7()
    : input.triggerEvent === "P06"
      ? formatHL7Date(account.servicePeriod?.end) || nowHL7()
      : nowHL7();

  return evn
    .set1_eventTypeCode(input.triggerEvent)
    .set2_recordedDateTime(eventDateTime)
    .set6_eventOccurred(eventDateTime);
};

const buildPID = (input: BarMessageInput) => (pid: PIDBuilder) => {
  const { patient, account } = input;
  const name = getFirstName(patient.name);
  const address = getFirstAddress(patient.address);
  const phone = patient.telecom?.find(t => t.system === "phone");

  return pid
    .set1_setIdPid("1")
    .set3_1_idNumber(getIdentifierValue(patient.identifier))
    .set3_5_identifierTypeCode("MR")
    .set5_1_1_surname(name?.family)
    .set5_2_givenName(name?.given?.[0])
    .set5_3_secondAndFurtherGivenNamesOrInitialsThereof(name?.given?.[1])
    .set7_dateTimeOfBirth(formatHL7Date(patient.birthDate))
    .set8_administrativeSex(mapGender(patient.gender))
    .set11_1_1_streetOrMailingAddress(address?.line?.[0])
    .set11_3_city(address?.city)
    .set11_4_stateOrProvince(address?.state)
    .set11_5_zipOrPostalCode(address?.postalCode)
    .set11_6_country(address?.country)
    .set13_1_telephoneNumber(phone?.value)
    .set18_1_idNumber(getIdentifierValue(account.identifier));
};

const buildPV1 = (encounter: Encounter) => (pv1: PV1Builder) => {
  const location = encounter.location?.[0];

  return pv1
    .set1_setIdPv1("1")
    .set2_patientClass(mapPatientClass(encounter.class))
    .set3_1_pointOfCare(location?.location?.display)
    .set19_1_idNumber(getIdentifierValue(encounter.identifier))
    .set44_admitDateTime(formatHL7Date(encounter.period?.start))
    .set45_dischargeDateTime(formatHL7Date(encounter.period?.end));
};

const buildGT1 = (guarantor: RelatedPerson | Patient, setId: number) => (gt1: GT1Builder) => {
  const name = getFirstName(guarantor.name);
  const address = getFirstAddress(guarantor.address);
  const phone = guarantor.telecom?.find(t => t.system === "phone");
  const guarantorType = guarantor.resourceType === "Patient"
    ? "SE"
    : mapGuarantorRelationship((guarantor as RelatedPerson).relationship?.[0]);

  return gt1
    .set1_setIdGt1(String(setId))
    .set2_1_idNumber(getIdentifierValue(guarantor.identifier))
    .set3_1_1_surname(name?.family)
    .set3_2_givenName(name?.given?.[0])
    .set5_1_1_streetOrMailingAddress(address?.line?.[0])
    .set5_3_city(address?.city)
    .set5_4_stateOrProvince(address?.state)
    .set5_5_zipOrPostalCode(address?.postalCode)
    .set5_6_country(address?.country)
    .set6_1_telephoneNumber(phone?.value)
    .set10_guarantorType(guarantorType);
};

const buildIN1 = (coverage: Coverage, setId: number, payorOrg?: Organization) => (in1: IN1Builder) => {
  const planCode = getCode(coverage.type);
  const payorId = payorOrg?.identifier?.[0]?.value ?? coverage.payor?.[0]?.reference;
  const payorName = payorOrg?.name ?? coverage.payor?.[0]?.display;
  const groupClass = coverage.class?.find(c => c.type?.coding?.[0]?.code === "group");
  const relationship = getCode(coverage.relationship);

  return in1
    .set1_setIdIn1(String(setId))
    .set2_1_identifier(planCode.code)
    .set2_2_text(planCode.display)
    .set3_1_idNumber(payorId)
    .set4_1_organizationName(payorName)
    .set8_groupNumber(groupClass?.value)
    .set9_1_organizationName(groupClass?.name)
    .set12_planEffectiveDate(formatHL7Date(coverage.period?.start))
    .set13_planExpirationDate(formatHL7Date(coverage.period?.end))
    .set17_1_identifier(relationship.code)
    .set17_2_text(relationship.display)
    .set36_policyNumber(coverage.subscriberId);
};

const buildDG1 = (condition: Condition, setId: number) => (dg1: DG1Builder) => {
  const code = getCode(condition.code);
  const category = getCode(condition.category?.[0]);
  const diagDate = condition.recordedDate ?? condition.onsetDateTime;

  return dg1
    .set1_setIdDg1(String(setId))
    .set2_diagnosisCodingMethod(code.system)
    .set3_1_identifier(code.code)
    .set3_2_text(code.display)
    .set3_3_nameOfCodingSystem(code.system)
    .set5_diagnosisDateTime(formatHL7Date(diagDate))
    .set6_diagnosisType(category.code)
    .set15_diagnosisPriority(String(setId));
};

const buildPR1 = (procedure: Procedure, setId: number) => (pr1: PR1Builder) => {
  const code = getCode(procedure.code);
  const procDate = procedure.performedDateTime ?? procedure.performedPeriod?.start;

  return pr1
    .set1_setIdPr1(String(setId))
    .set2_procedureCodingMethod(code.system)
    .set3_1_identifier(code.code)
    .set3_2_text(code.display)
    .set3_3_nameOfCodingSystem(code.system)
    .set5_procedureDateTime(formatHL7Date(procDate));
};

const buildVisit = (input: BarMessageInput) => (visit: BAR_P01_VISITBuilder) => {
  const { encounter, conditions, procedures, guarantor, coverages, organizations } = input;

  if (encounter) {
    visit.pv1(buildPV1(encounter));
  }

  conditions?.forEach((condition, idx) => {
    visit.addDG1(buildDG1(condition, idx + 1));
  });

  procedures?.forEach((procedure, idx) => {
    visit.addPROCEDURE(proc => proc.pr1(buildPR1(procedure, idx + 1)));
  });

  if (guarantor) {
    visit.addGT1(buildGT1(guarantor, 1));
  }

  if (coverages?.length) {
    const sorted = [...coverages].sort((a, b) => (a.order ?? 1) - (b.order ?? 1));
    sorted.forEach((coverage, idx) => {
      const payorRef = coverage.payor?.[0]?.reference;
      const payorOrg = payorRef ? organizations?.get(payorRef) : undefined;
      visit.addINSURANCE(ins => ins.in1(buildIN1(coverage, idx + 1, payorOrg)));
    });
  }

  return visit;
};

// ============================================================================
// Main generator function
// ============================================================================

/**
 * Generate a BAR message from FHIR resources
 */
export function generateBarMessage(input: BarMessageInput): HL7v2Message {
  return new BAR_P01Builder()
    .msh(buildMSH(input))
    .evn(buildEVN(input))
    .pid(buildPID(input))
    .addVISIT(buildVisit(input))
    .build();
}

// Re-export types
export type { BarMessageInput } from "./types";

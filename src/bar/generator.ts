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
  Encounter,
  Coverage,
  RelatedPerson,
  Condition,
  Procedure,
  Organization,
  CodeableConcept,
  Patient,
} from "../fhir/hl7-fhir-r4-core";
import type { BarMessageInput } from "./types";

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
  .set_msh1_fieldSeparator("|")
  .set_msh2_encodingCharacters("^~\\&")
  .set_msh3_sendingApplication({ namespaceId__1: input.sendingApplication ?? "FHIR_APP" })
  .set_msh4_sendingFacility({ namespaceId__1: input.sendingFacility ?? "FHIR_FAC" })
  .set_msh5_receivingApplication({ namespaceId__1: input.receivingApplication ?? "BILLING_APP" })
  .set_msh6_receivingFacility({ namespaceId__1: input.receivingFacility ?? "BILLING_FAC" })
  .set_msh7_dateTimeOfMessage(nowHL7())
  .set_msh9_messageType({
    messageCode__1: "BAR",
    triggerEvent__2: input.triggerEvent,
    messageStructure__3: `BAR_${input.triggerEvent}`,
  })
  .set_msh10_messageControlId(input.messageControlId)
  .set_msh11_processingId({ processingId__1: "P" })
  .set_msh12_versionId({ versionId__1: "2.5.1" });

const buildEVN = (input: BarMessageInput) => (evn: EVNBuilder) => {
  const account = input.account;
  const eventDateTime = input.triggerEvent === "P01"
    ? formatHL7Date(account.servicePeriod?.start) || nowHL7()
    : input.triggerEvent === "P06"
      ? formatHL7Date(account.servicePeriod?.end) || nowHL7()
      : nowHL7();

  return evn
    .set_evn1_eventTypeCode(input.triggerEvent)
    .set_evn2_recordedDateTime(eventDateTime)
    .set_evn6_eventOccurred(eventDateTime);
};

const buildPID = (input: BarMessageInput) => (pid: PIDBuilder) => {
  const { patient, account } = input;
  const name = patient.name?.[0];
  const address = patient.address?.[0];
  const phone = patient.telecom?.find(t => t.system === "phone");

  return pid
    .set_pid1_setIdPid("1")
    .set_pid3_patientIdentifierList([{
      idNumber__1: patient.identifier?.[0]?.value,
      identifierTypeCode__5: "MR",
    }])
    .set_pid5_patientName([{
      familyName__1: { surname__1: name?.family },
      givenName__2: name?.given?.[0],
      secondAndFurtherGivenNamesOrInitialsThereof__3: name?.given?.[1],
    }])
    .set_pid7_dateTimeOfBirth(formatHL7Date(patient.birthDate))
    .set_pid8_administrativeSex(mapGender(patient.gender))
    .set_pid11_patientAddress([{
      streetAddress__1: { streetOrMailingAddress__1: address?.line?.[0] },
      city__3: address?.city,
      stateOrProvince__4: address?.state,
      zipOrPostalCode__5: address?.postalCode,
      country__6: address?.country,
    }])
    .set_pid13_phoneNumberHome([{
      telephoneNumber__1: phone?.value,
    }])
    .set_pid18_patientAccountNumber({
      idNumber__1: account.identifier?.[0]?.value,
    });
};

const buildPV1 = (encounter: Encounter) => (pv1: PV1Builder) => {
  const location = encounter.location?.[0];

  return pv1
    .set_pv11_setIdPv1("1")
    .set_pv12_patientClass(mapPatientClass(encounter.class))
    .set_pv13_assignedPatientLocation({
      pointOfCare__1: location?.location?.display,
    })
    .set_pv119_visitNumber({
      idNumber__1: encounter.identifier?.[0]?.value,
    })
    .set_pv144_admitDateTime(formatHL7Date(encounter.period?.start))
    .set_pv145_dischargeDateTime(formatHL7Date(encounter.period?.end));
};

const buildGT1 = (guarantor: RelatedPerson | Patient, setId: number) => (gt1: GT1Builder) => {
  const name = guarantor.name?.[0];
  const address = guarantor.address?.[0];
  const phone = guarantor.telecom?.find(t => t.system === "phone");
  const guarantorType = guarantor.resourceType === "Patient"
    ? "SE"
    : mapGuarantorRelationship((guarantor as RelatedPerson).relationship?.[0]);

  return gt1
    .set_gt11_setIdGt1(String(setId))
    .set_gt12_guarantorNumber([{
      idNumber__1: guarantor.identifier?.[0]?.value,
    }])
    .set_gt13_guarantorName([{
      familyName__1: { surname__1: name?.family },
      givenName__2: name?.given?.[0],
    }])
    .set_gt15_guarantorAddress([{
      streetAddress__1: { streetOrMailingAddress__1: address?.line?.[0] },
      city__3: address?.city,
      stateOrProvince__4: address?.state,
      zipOrPostalCode__5: address?.postalCode,
      country__6: address?.country,
    }])
    .set_gt16_guarantorPhNumHome([{
      telephoneNumber__1: phone?.value,
    }])
    .set_gt110_guarantorType(guarantorType);
};

const buildIN1 = (coverage: Coverage, setId: number, payorOrg?: Organization) => (in1: IN1Builder) => {
  const planCode = getCode(coverage.type);
  const payorId = payorOrg?.identifier?.[0]?.value ?? coverage.payor?.[0]?.reference;
  const payorName = payorOrg?.name ?? coverage.payor?.[0]?.display;
  const groupClass = coverage.class?.find(c => c.type?.coding?.[0]?.code === "group");
  const relationship = getCode(coverage.relationship);

  return in1
    .set_in11_setIdIn1(String(setId))
    .set_in12_insurancePlanId({
      identifier__1: planCode.code,
      text__2: planCode.display,
    })
    .set_in13_insuranceCompanyId([{
      idNumber__1: payorId,
    }])
    .set_in14_insuranceCompanyName([{
      organizationName__1: payorName,
    }])
    .set_in18_groupNumber(groupClass?.value)
    .set_in19_groupName([{
      organizationName__1: groupClass?.name,
    }])
    .set_in112_planEffectiveDate(formatHL7Date(coverage.period?.start))
    .set_in113_planExpirationDate(formatHL7Date(coverage.period?.end))
    .set_in117_insuredSRelationshipToPatient({
      identifier__1: relationship.code,
      text__2: relationship.display,
    })
    .set_in136_policyNumber(coverage.subscriberId);
};

const buildDG1 = (condition: Condition, setId: number) => (dg1: DG1Builder) => {
  const code = getCode(condition.code);
  const category = getCode(condition.category?.[0]);
  const diagDate = condition.recordedDate ?? condition.onsetDateTime;

  return dg1
    .set_dg11_setIdDg1(String(setId))
    .set_dg12_diagnosisCodingMethod(code.system)
    .set_dg13_diagnosisCodeDg1({
      identifier__1: code.code,
      text__2: code.display,
      nameOfCodingSystem__3: code.system,
    })
    .set_dg15_diagnosisDateTime(formatHL7Date(diagDate))
    .set_dg16_diagnosisType(category.code)
    .set_dg115_diagnosisPriority(String(setId));
};

const buildPR1 = (procedure: Procedure, setId: number) => (pr1: PR1Builder) => {
  const code = getCode(procedure.code);
  const procDate = procedure.performedDateTime ?? procedure.performedPeriod?.start;

  return pr1
    .set_pr11_setIdPr1(String(setId))
    .set_pr12_procedureCodingMethod(code.system)
    .set_pr13_procedureCode({
      identifier__1: code.code,
      text__2: code.display,
      nameOfCodingSystem__3: code.system,
    })
    .set_pr15_procedureDateTime(formatHL7Date(procDate));
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

/**
 * BAR Message Generator
 * Generates BAR^P01/P05/P06 messages from FHIR resources
 */

import type { HL7v2Message } from "../hl7v2/generated/types";
import {
  type MSH,
  type EVN,
  type PID,
  type PV1,
  type GT1,
  type IN1,
  type DG1,
  type PR1,
} from "../hl7v2/generated/fields";

import { 
  AdministrativeSex,
  PatientClass,
} from "../hl7v2/generated/tables";

import {
  BAR_P01Builder,
  type BAR_P01_VISITBuilder,
} from "../hl7v2/generated/messages";
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
    case "male": return AdministrativeSex.Male;
    case "female": return AdministrativeSex.Female;
    case "other": return AdministrativeSex.Other;
    case "unknown": return AdministrativeSex.Unknown;
    default: return AdministrativeSex.Unknown;
  }
}

function mapPatientClass(encounterClass: { code?: string } | undefined): string {
  if (!encounterClass?.code) return "";
  switch (encounterClass.code) {
    case "IMP":
    case "ACUTE":
    case "NONAC": return PatientClass.Inpatient;
    case "AMB":
    case "OBSENC": return PatientClass.Outpatient;
    case "EMER": return PatientClass.Emergency;
    case "PRENC": return PatientClass.Preadmit;
    default: return PatientClass.Unknown;
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

function buildMSH (input: BarMessageInput): MSH {
  return {
      $1_fieldSeparator: "|",
      $2_encodingCharacters: "^~\\&",
      $3_sendingApplication: { $1_namespace: input.sendingApplication ?? "FHIR_APP" },
      $4_sendingFacility: { $1_namespace: input.sendingFacility ?? "FHIR_FAC" },
      $5_receivingApplication: { $1_namespace: input.receivingApplication ?? "BILLING_APP"},
      $6_receivingFacility: { $1_namespace: input.receivingFacility ?? "BILLING_FAC"},
      $7_messageDateTime: nowHL7(),
      $9_messageType: {
        $1_code: "BAR",
        $2_event: input.triggerEvent,
        $3_structure: `BAR_${input.triggerEvent}`,
      },
      $10_messageControlId: input.messageControlId,
      $11_processingId: {$1_processingId: "P"},
      $12_version: {$1_version: "2.5.1"}

    }
}

function buildEVN (input: BarMessageInput): EVN {
  const account = input.account;
  const eventDateTime = input.triggerEvent === "P01"
    ? formatHL7Date(account.servicePeriod?.start) || nowHL7()
    : input.triggerEvent === "P06"
      ? formatHL7Date(account.servicePeriod?.end) || nowHL7()
      : nowHL7();

  return {
    $1_eventTypeCode: input.triggerEvent,
    $2_recordedDateTime: eventDateTime,
    $6_eventOccurred: eventDateTime
  }
};

function buildPID (input: BarMessageInput): PID {
  const { patient, account } = input;
  const name = patient.name?.[0];
  const address = patient.address?.[0];
  const phone = patient.telecom?.find(t => t.system === "phone");

  return {
    $1_setIdPid: "1",
    $3_identifier: [{
      $1_value: patient.identifier?.[0]?.value,
      $5_type: "MR",
    }],
    $5_name: [{
      $1_family: { $1_family: name?.family },
      $2_given: name?.given?.[0],
      $3_additionalGiven: name?.given?.[1],
    }],
    $7_birthDate: formatHL7Date(patient.birthDate),
    $8_gender: mapGender(patient.gender),
    $11_address: [{
      $1_line1: { $1_line: address?.line?.[0] },
      $3_city: address?.city,
      $4_state: address?.state,
      $5_postalCode: address?.postalCode,
      $6_country: address?.country,
    }],
    $13_homePhone: [{
      $1_value: phone?.value,
    }],
    $18_accountNumber: {
      $1_value: account.identifier?.[0]?.value
    }

  }
};

function buildPV1 (encounter: Encounter): PV1 {
  const location = encounter.location?.[0];
  return {
      $1_setIdPv1: "1",
      $2_class: mapPatientClass(encounter.class),
      $3_assignedPatientLocation: {
        $1_careSite: location?.location?.display,
      },
      $19_visitNumber: {
        $1_value: encounter.identifier?.[0]?.value
      },
      $44_admission: formatHL7Date(encounter.period?.start),
      $45_discharge: [formatHL7Date(encounter.period?.end)]
    }
};

function buildGT1 (guarantor: RelatedPerson | Patient, setId: number): GT1 {
  const name = guarantor.name?.[0];
  const address = guarantor.address?.[0];
  const phone = guarantor.telecom?.find(t => t.system === "phone");
  const guarantorType = guarantor.resourceType === "Patient"
    ? "SE"
    : mapGuarantorRelationship((guarantor as RelatedPerson).relationship?.[0]);
  return {
      $1_setIdGt1: String(setId),
      $2_guarantorNumber: [{
        $1_value: guarantor.identifier?.[0]?.value,
      }],
      $3_guarantorName: [{
        $1_family: { $1_family: name?.family },
        $2_given: name?.given?.[0],
      }],
      $5_guarantorAddress: [{
        $1_line1: { $1_line: address?.line?.[0] },
        $3_city: address?.city,
        $4_state: address?.state,
        $5_postalCode: address?.postalCode,
        $6_country: address?.country,
      }],
      $6_guarantorPhNumHome: [{
        $1_value: phone?.value,
      }],
      $10_guarantorType: guarantorType
  }
};

function buildIN1 (coverage: Coverage, setId: number, payorOrg?: Organization): IN1 {
  const planCode = getCode(coverage.type);
  const payorId = payorOrg?.identifier?.[0]?.value ?? coverage.payor?.[0]?.reference;
  const payorName = payorOrg?.name ?? coverage.payor?.[0]?.display;
  const groupClass = coverage.class?.find(c => c.type?.coding?.[0]?.code === "group");
  const relationship = getCode(coverage.relationship);

  return {
      $1_setIdIn1: (String(setId)),
      $2_insurancePlanId: {
        $1_code: planCode.code,
        $2_text: planCode.display,
      },
      $3_insuranceCompanyId: [{
        $1_value: payorId,
      }],
      $4_insuranceCompanyName: [{
        $1_name: payorName,
      }],
      $8_groupNumber: groupClass?.value,
      $9_groupName: [{
        $1_name: groupClass?.name,
      }],
      $12_planEffectiveDate: formatHL7Date(coverage.period?.start),
      $13_planExpirationDate: formatHL7Date(coverage.period?.end),
      $17_insuredsRelationshipToPatient: {
        $1_code: relationship.code,
        $2_text: relationship.display,
      },
      $36_policyNumber: coverage.subscriberId
    }
};

function buildDG1 (condition: Condition, setId: number): DG1 {
  const code = getCode(condition.code);
  const category = getCode(condition.category?.[0]);
  const diagDate = condition.recordedDate ?? condition.onsetDateTime;

  return {
      $1_setIdDg1: String(setId),
      $2_diagnosisCodingMethod: code.system,
      $3_diagnosisCodeDg1: {
        $1_code: code.code,
        $2_text: code.display,
        $3_system: code.system,
      },
      $5_diagnosisDateTime: formatHL7Date(diagDate),
      $6_diagnosisType: category.code,
      $15_diagnosisPriority: String(setId)
    }
};

function buildPR1 (procedure: Procedure, setId: number): PR1 {
  const code = getCode(procedure.code);
  const procDate = procedure.performedDateTime ?? procedure.performedPeriod?.start;

  return {
      $1_setIdPr1: String(setId),
      $2_procedureCodingMethod: code.system,
      $3_procedureCode: {
        $1_code: code.code,
        $2_text: code.display,
        $3_system: code.system,
      },
      $5_procedureDateTime: formatHL7Date(procDate)
    }
};

const buildVisit = (input: BarMessageInput) => (visit: BAR_P01_VISITBuilder) => {
  const { encounter, conditions, procedures, guarantor, coverages, organizations } = input;

  if (encounter) {
    visit.pv1(buildPV1(encounter) as PV1);
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

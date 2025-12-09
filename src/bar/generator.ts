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
// BarMessageBuilder - fluent builder with FHIR context
// ============================================================================

export class BarMessageBuilder {
  private input: BarMessageInput;

  constructor(input: BarMessageInput) {
    this.input = input;
  }

  // Segment builders that use this.input

  private buildMSH = (msh: MSHBuilder) => msh
    .set1_fieldSeparator("|")
    .set2_encodingCharacters("^~\\&")
    .set3_sendingApplication(this.input.sendingApplication ?? "FHIR_APP")
    .set4_sendingFacility(this.input.sendingFacility ?? "FHIR_FAC")
    .set5_receivingApplication(this.input.receivingApplication ?? "BILLING_APP")
    .set6_receivingFacility(this.input.receivingFacility ?? "BILLING_FAC")
    .set7_dateTimeOfMessage(nowHL7())
    .set9_1_messageCode("BAR")
    .set9_2_triggerEvent(this.input.triggerEvent)
    .set9_3_messageStructure(`BAR_${this.input.triggerEvent}`)
    .set10_messageControlId(this.input.messageControlId)
    .set11_1_processingId("P")
    .set12_1_versionId("2.5.1");

  private buildEVN = (evn: EVNBuilder) => {
    const account = this.input.account;
    let eventDateTime: string;

    if (this.input.triggerEvent === "P01") {
      eventDateTime = formatHL7Date(account.servicePeriod?.start) || nowHL7();
    } else if (this.input.triggerEvent === "P06") {
      eventDateTime = formatHL7Date(account.servicePeriod?.end) || nowHL7();
    } else {
      eventDateTime = nowHL7();
    }

    return evn
      .set1_eventTypeCode(this.input.triggerEvent)
      .set2_recordedDateTime(eventDateTime)
      .set6_eventOccurred(eventDateTime);
  };

  private buildPID = (pid: PIDBuilder) => {
    const { patient, account } = this.input;
    const name = getFirstName(patient.name);
    const address = getFirstAddress(patient.address);
    const phone = patient.telecom?.find(t => t.system === "phone");
    const patientId = getIdentifierValue(patient.identifier);
    const accountId = getIdentifierValue(account.identifier);

    pid.set1_setIdPid("1");

    if (patientId) {
      pid.set3_1_idNumber(patientId).set3_5_identifierTypeCode("MR");
    }
    if (name) {
      if (name.family) pid.set5_1_1_surname(name.family);
      if (name.given?.[0]) pid.set5_2_givenName(name.given[0]);
      if (name.given?.[1]) pid.set5_3_secondAndFurtherGivenNamesOrInitialsThereof(name.given[1]);
    }
    if (patient.birthDate) {
      pid.set7_dateTimeOfBirth(formatHL7Date(patient.birthDate));
    }
    if (patient.gender) {
      pid.set8_administrativeSex(mapGender(patient.gender));
    }
    if (address) {
      if (address.line?.[0]) pid.set11_1_1_streetOrMailingAddress(address.line[0]);
      if (address.city) pid.set11_3_city(address.city);
      if (address.state) pid.set11_4_stateOrProvince(address.state);
      if (address.postalCode) pid.set11_5_zipOrPostalCode(address.postalCode);
      if (address.country) pid.set11_6_country(address.country);
    }
    if (phone?.value) {
      pid.set13_1_telephoneNumber(phone.value);
    }
    if (accountId) {
      pid.set18_1_idNumber(accountId);
    }

    return pid;
  };

  private buildPV1(encounter: Encounter) {
    return (pv1: PV1Builder) => {
      const location = encounter.location?.[0];
      const visitId = getIdentifierValue(encounter.identifier);

      pv1.set1_setIdPv1("1").set2_patientClass(mapPatientClass(encounter.class));

      if (location?.location?.display) {
        pv1.set3_1_pointOfCare(location.location.display);
      }
      if (visitId) {
        pv1.set19_1_idNumber(visitId);
      }
      if (encounter.period?.start) {
        pv1.set44_admitDateTime(formatHL7Date(encounter.period.start));
      }
      if (encounter.period?.end) {
        pv1.set45_dischargeDateTime(formatHL7Date(encounter.period.end));
      }

      return pv1;
    };
  }

  private buildGT1(guarantor: RelatedPerson | Patient, setId: number) {
    return (gt1: GT1Builder) => {
      const name = getFirstName(guarantor.name);
      const address = getFirstAddress(guarantor.address);
      const phone = guarantor.telecom?.find(t => t.system === "phone");
      const guarantorId = getIdentifierValue(guarantor.identifier);

      gt1.set1_setIdGt1(String(setId));

      if (guarantorId) gt1.set2_1_idNumber(guarantorId);
      if (name) {
        if (name.family) gt1.set3_1_1_surname(name.family);
        if (name.given?.[0]) gt1.set3_2_givenName(name.given[0]);
      }
      if (address) {
        if (address.line?.[0]) gt1.set5_1_1_streetOrMailingAddress(address.line[0]);
        if (address.city) gt1.set5_3_city(address.city);
        if (address.state) gt1.set5_4_stateOrProvince(address.state);
        if (address.postalCode) gt1.set5_5_zipOrPostalCode(address.postalCode);
        if (address.country) gt1.set5_6_country(address.country);
      }
      if (phone?.value) gt1.set6_1_telephoneNumber(phone.value);

      if (guarantor.resourceType === "Patient") {
        gt1.set10_guarantorType("SE");
      } else {
        const relationship = (guarantor as RelatedPerson).relationship?.[0];
        gt1.set10_guarantorType(mapGuarantorRelationship(relationship));
      }

      return gt1;
    };
  }

  private buildIN1(coverage: Coverage, setId: number, payorOrg?: Organization) {
    return (in1: IN1Builder) => {
      const planCode = getCode(coverage.type);
      const payorId = payorOrg?.identifier?.[0]?.value ?? coverage.payor?.[0]?.reference;
      const groupClass = coverage.class?.find(c => c.type?.coding?.[0]?.code === "group");
      const relationship = getCode(coverage.relationship);

      in1.set1_setIdIn1(String(setId));

      if (planCode.code) {
        in1.set2_1_identifier(planCode.code);
        if (planCode.display) in1.set2_2_text(planCode.display);
      }
      if (payorId) in1.set3_1_idNumber(payorId);
      if (payorOrg?.name) {
        in1.set4_1_organizationName(payorOrg.name);
      } else if (coverage.payor?.[0]?.display) {
        in1.set4_1_organizationName(coverage.payor[0].display);
      }
      if (groupClass?.value) in1.set8_groupNumber(groupClass.value);
      if (groupClass?.name) in1.set9_1_organizationName(groupClass.name);
      if (coverage.period?.start) in1.set12_planEffectiveDate(formatHL7Date(coverage.period.start));
      if (coverage.period?.end) in1.set13_planExpirationDate(formatHL7Date(coverage.period.end));
      if (relationship.code) {
        in1.set17_1_identifier(relationship.code);
        if (relationship.display) in1.set17_2_text(relationship.display);
      }
      if (coverage.subscriberId) in1.set36_policyNumber(coverage.subscriberId);

      return in1;
    };
  }

  private buildDG1(condition: Condition, setId: number) {
    return (dg1: DG1Builder) => {
      const code = getCode(condition.code);
      const category = getCode(condition.category?.[0]);
      const diagDate = condition.recordedDate ?? condition.onsetDateTime;

      dg1.set1_setIdDg1(String(setId));

      if (code.system) dg1.set2_diagnosisCodingMethod(code.system);
      if (code.code) {
        dg1.set3_1_identifier(code.code);
        if (code.display) dg1.set3_2_text(code.display);
        if (code.system) dg1.set3_3_nameOfCodingSystem(code.system);
      }
      if (diagDate) dg1.set5_diagnosisDateTime(formatHL7Date(diagDate));
      if (category.code) dg1.set6_diagnosisType(category.code);
      dg1.set15_diagnosisPriority(String(setId));

      return dg1;
    };
  }

  private buildPR1(procedure: Procedure, setId: number) {
    return (pr1: PR1Builder) => {
      const code = getCode(procedure.code);
      const procDate = procedure.performedDateTime ?? procedure.performedPeriod?.start;

      pr1.set1_setIdPr1(String(setId));

      if (code.system) pr1.set2_procedureCodingMethod(code.system);
      if (code.code) {
        pr1.set3_1_identifier(code.code);
        if (code.display) pr1.set3_2_text(code.display);
        if (code.system) pr1.set3_3_nameOfCodingSystem(code.system);
      }
      if (procDate) pr1.set5_procedureDateTime(formatHL7Date(procDate));

      return pr1;
    };
  }

  private buildVisit = (visit: BAR_P01_VISITBuilder) => {
    const { encounter, conditions, procedures, guarantor, coverages, organizations } = this.input;

    if (encounter) {
      visit.pv1(this.buildPV1(encounter));
    }

    conditions?.forEach((condition, idx) => {
      visit.addDG1(this.buildDG1(condition, idx + 1));
    });

    procedures?.forEach((procedure, idx) => {
      visit.addPROCEDURE(proc => proc.pr1(this.buildPR1(procedure, idx + 1)));
    });

    if (guarantor) {
      visit.addGT1(this.buildGT1(guarantor, 1));
    }

    if (coverages?.length) {
      const sorted = [...coverages].sort((a, b) => (a.order ?? 1) - (b.order ?? 1));
      sorted.forEach((coverage, idx) => {
        const payorRef = coverage.payor?.[0]?.reference;
        const payorOrg = payorRef ? organizations?.get(payorRef) : undefined;
        visit.addINSURANCE(ins => ins.in1(this.buildIN1(coverage, idx + 1, payorOrg)));
      });
    }

    return visit;
  };

  /**
   * Build the BAR message
   */
  build(): HL7v2Message {
    return new BAR_P01Builder()
      .msh(this.buildMSH)
      .evn(this.buildEVN)
      .pid(this.buildPID)
      .addVISIT(this.buildVisit)
      .build();
  }
}

// ============================================================================
// Convenience function
// ============================================================================

/**
 * Generate a BAR message from FHIR resources
 */
export function generateBarMessage(input: BarMessageInput): HL7v2Message {
  return new BarMessageBuilder(input).build();
}

// Re-export types
export type { BarMessageInput } from "./types";

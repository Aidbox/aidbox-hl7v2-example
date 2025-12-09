/**
 * Example: Building a BAR/P01 message using fluent builders
 *
 * Run: bun example/build-message.ts
 */

import type { HL7v2Message } from "../src/hl7v2/types";
import { formatMessage } from "../src/hl7v2/format";
import {
  // Fluent builders
  MSHBuilder,
  EVNBuilder,
  PIDBuilder,
  PV1Builder,
  DG1Builder,
  PR1Builder,
  GT1Builder,
  IN1Builder,
  // Getters for reading
  MSH_9_1_message_code,
  MSH_9_2_trigger_event,
  PID_5_1_family_name,
  PID_5_2_given_name,
  PID_7_date_time_of_birth,
  PID_8_administrative_sex,
  PV1_2_patient_class,
  PV1_19_1_i_d_number,
  IN1_2_1_identifier,
  IN1_4_1_organization_name,
} from "../src/hl7v2/fields";

// Build a BAR/P01 message using fluent builders
// Method naming: set_[segment][idx]_fieldName({ component__1: value, ... })
const message: HL7v2Message = [
  // MSH - Message Header
  new MSHBuilder()
    .set_msh1_fieldSeparator("|")
    .set_msh2_encodingCharacters("^~\\&")
    .set_msh3_sendingApplication({ namespaceId__1: "HOSPITAL_APP" })
    .set_msh4_sendingFacility({ namespaceId__1: "HOSPITAL_FAC" })
    .set_msh5_receivingApplication({ namespaceId__1: "BILLING_APP" })
    .set_msh6_receivingFacility({ namespaceId__1: "BILLING_FAC" })
    .set_msh7_dateTimeOfMessage("202312151030")
    .set_msh9_messageType({
      messageCode__1: "BAR",
      triggerEvent__2: "P01",
      messageStructure__3: "BAR_P01",
    })
    .set_msh10_messageControlId("MSG00001")
    .set_msh11_processingId({ processingId__1: "P" })
    .set_msh12_versionId({ versionId__1: "2.5.1" })
    .build(),

  // EVN - Event Type
  new EVNBuilder()
    .set_evn1_eventTypeCode("P01")
    .set_evn2_recordedDateTime("202312151030")
    .set_evn6_eventOccurred("202312151030")
    .build(),

  // PID - Patient Identification
  new PIDBuilder()
    .set_pid1_setIdPid("1")
    .set_pid3_patientIdentifierList([{
      idNumber__1: "12345678",
      assigningAuthority__4: { namespaceId__1: "HOSP" },
      identifierTypeCode__5: "MR",
    }])
    .set_pid5_patientName([{
      familyName__1: { surname__1: "Smith" },
      givenName__2: "John",
      secondAndFurtherGivenNamesOrInitialsThereof__3: "Robert",
    }])
    .set_pid7_dateTimeOfBirth("19850315")
    .set_pid8_administrativeSex("M")
    .set_pid11_patientAddress([{
      streetAddress__1: { streetOrMailingAddress__1: "123 Main Street" },
      city__3: "Anytown",
      stateOrProvince__4: "CA",
      zipOrPostalCode__5: "90210",
      country__6: "USA",
    }])
    .build(),

  // PV1 - Patient Visit
  new PV1Builder()
    .set_pv11_setIdPv1("1")
    .set_pv12_patientClass("I") // Inpatient
    .set_pv13_assignedPatientLocation({
      pointOfCare__1: "ICU",
      room__2: "101",
      bed__3: "A",
    })
    .set_pv119_visitNumber({ idNumber__1: "V12345678" })
    .set_pv144_admitDateTime("202312150800")
    .build(),

  // DG1 - Diagnosis
  new DG1Builder()
    .set_dg11_setIdDg1("1")
    .set_dg13_diagnosisCodeDg1({
      identifier__1: "J18.9",
      text__2: "Pneumonia, unspecified organism",
      nameOfCodingSystem__3: "ICD10",
    })
    .set_dg16_diagnosisType("A") // Admitting diagnosis
    .set_dg115_diagnosisPriority("1") // Primary diagnosis
    .build(),

  // PR1 - Procedure
  new PR1Builder()
    .set_pr11_setIdPr1("1")
    .set_pr13_procedureCode({
      identifier__1: "94003",
      text__2: "Ventilation assist and management",
      nameOfCodingSystem__3: "CPT",
    })
    .set_pr15_procedureDateTime("202312151000")
    .set_pr16_procedureFunctionalType("S") // Surgical
    .build(),

  // GT1 - Guarantor
  new GT1Builder()
    .set_gt11_setIdGt1("1")
    .set_gt13_guarantorName([{
      familyName__1: { surname__1: "Smith" },
      givenName__2: "John",
    }])
    .set_gt15_guarantorAddress([{
      streetAddress__1: { streetOrMailingAddress__1: "123 Main Street" },
      city__3: "Anytown",
      stateOrProvince__4: "CA",
      zipOrPostalCode__5: "90210",
    }])
    .set_gt110_guarantorType("SE") // Self
    .build(),

  // IN1 - Insurance
  new IN1Builder()
    .set_in11_setIdIn1("1")
    .set_in12_insurancePlanId({
      identifier__1: "BCBS",
      text__2: "Blue Cross Blue Shield",
    })
    .set_in13_insuranceCompanyId([{ idNumber__1: "INS123456" }])
    .set_in14_insuranceCompanyName([{
      organizationName__1: "Blue Cross Blue Shield of California",
    }])
    .set_in112_planEffectiveDate("20230101")
    .set_in113_planExpirationDate("20231231")
    .set_in136_policyNumber("POL987654321")
    .build(),
];

// Read values using getters
console.log("=== BAR/P01 Message Built with Fluent Builders ===\n");

const msh = message[0]!;
const pid = message[2]!;
const pv1 = message[3]!;
const in1 = message[7]!;

console.log("Message Type:", MSH_9_1_message_code(msh), "/", MSH_9_2_trigger_event(msh));
console.log("Patient:", PID_5_2_given_name(pid), PID_5_1_family_name(pid));
console.log("DOB:", PID_7_date_time_of_birth(pid));
console.log("Sex:", PID_8_administrative_sex(pid));
console.log("Patient Class:", PV1_2_patient_class(pv1));
console.log("Visit Number:", PV1_19_1_i_d_number(pv1));
console.log("Insurance Plan:", IN1_2_1_identifier(in1));
console.log("Insurance Company:", IN1_4_1_organization_name(in1));

console.log("\n=== HL7v2 Wire Format ===\n");
console.log(formatMessage(message).replace(/\r/g, "\n"));

console.log("\n=== Full Message Structure (JSON) ===\n");
console.log(JSON.stringify(message, null, 2));

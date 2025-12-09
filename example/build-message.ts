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
// Method naming: set{fieldNum}_{componentPath}_{name}
const message: HL7v2Message = [
  // MSH - Message Header
  new MSHBuilder()
    .set1_fieldSeparator("|")
    .set2_encodingCharacters("^~\\&")
    .set3_sendingApplication("HOSPITAL_APP")
    .set4_sendingFacility("HOSPITAL_FAC")
    .set5_receivingApplication("BILLING_APP")
    .set6_receivingFacility("BILLING_FAC")
    .set7_dateTimeOfMessage("202312151030")
    .set9_1_messageCode("BAR")
    .set9_2_triggerEvent("P01")
    .set9_3_messageStructure("BAR_P01")
    .set10_messageControlId("MSG00001")
    .set11_1_processingId("P")
    .set12_1_versionId("2.5.1")
    .build(),

  // EVN - Event Type
  new EVNBuilder()
    .set1_eventTypeCode("P01")
    .set2_recordedDateTime("202312151030")
    .set6_eventOccurred("202312151030")
    .build(),

  // PID - Patient Identification
  new PIDBuilder()
    .set1_setIdPid("1")
    .set3_1_idNumber("12345678")
    .set3_4_1_namespaceId("HOSP")
    .set3_5_identifierTypeCode("MR")
    .set5_1_1_surname("Smith")
    .set5_2_givenName("John")
    .set5_3_secondAndFurtherGivenNamesOrInitialsThereof("Robert")
    .set7_dateTimeOfBirth("19850315")
    .set8_administrativeSex("M")
    .set11_1_1_streetOrMailingAddress("123 Main Street")
    .set11_3_city("Anytown")
    .set11_4_stateOrProvince("CA")
    .set11_5_zipOrPostalCode("90210")
    .set11_6_country("USA")
    .build(),

  // PV1 - Patient Visit
  new PV1Builder()
    .set1_setIdPv1("1")
    .set2_patientClass("I") // Inpatient
    .set3_1_pointOfCare("ICU")
    .set3_2_room("101")
    .set3_3_bed("A")
    .set19_1_idNumber("V12345678")
    .set44_admitDateTime("202312150800")
    .build(),

  // DG1 - Diagnosis
  new DG1Builder()
    .set1_setIdDg1("1")
    .set3_1_identifier("J18.9")
    .set3_2_text("Pneumonia, unspecified organism")
    .set3_3_nameOfCodingSystem("ICD10")
    .set6_diagnosisType("A") // Admitting diagnosis
    .set15_diagnosisPriority("1") // Primary diagnosis
    .build(),

  // PR1 - Procedure
  new PR1Builder()
    .set1_setIdPr1("1")
    .set3_1_identifier("94003")
    .set3_2_text("Ventilation assist and management")
    .set3_3_nameOfCodingSystem("CPT")
    .set5_procedureDateTime("202312151000")
    .set6_procedureFunctionalType("S") // Surgical
    .build(),

  // GT1 - Guarantor
  new GT1Builder()
    .set1_setIdGt1("1")
    .set3_1_1_surname("Smith")
    .set3_2_givenName("John")
    .set5_1_1_streetOrMailingAddress("123 Main Street")
    .set5_3_city("Anytown")
    .set5_4_stateOrProvince("CA")
    .set5_5_zipOrPostalCode("90210")
    .set10_guarantorType("SE") // Self
    .build(),

  // IN1 - Insurance
  new IN1Builder()
    .set1_setIdIn1("1")
    .set2_1_identifier("BCBS")
    .set2_2_text("Blue Cross Blue Shield")
    .set3_1_idNumber("INS123456")
    .set4_1_organizationName("Blue Cross Blue Shield of California")
    .set12_planEffectiveDate("20230101")
    .set13_planExpirationDate("20231231")
    .set36_policyNumber("POL987654321")
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

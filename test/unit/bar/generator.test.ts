import { test, expect, describe } from "bun:test";
import { generateBarMessage } from "../../../src/bar/generator";
import { formatMessage } from "@atomic-ehr/hl7v2/src/hl7v2/format";
import type {
  Patient,
  Account,
  Encounter,
  Coverage,
  RelatedPerson,
  Condition,
  Procedure,
  Organization,
  BarMessageInput,
} from "../../../src/bar/types";
import {
  fromDG1,
  fromGT1,
  fromIN1,
  fromMSH,
  fromPID,
  fromPR1,
  fromPV1,
} from "../../../src/hl7v2/generated/fields";

// Test fixtures
const testPatient: Patient = {
  resourceType: "Patient",
  id: "patient-1",
  identifier: [{ system: "http://hospital.org/mrn", value: "MRN12345" }],
  name: [{ family: "Smith", given: ["John", "Robert"] }],
  birthDate: "1985-03-15",
  gender: "male",
  address: [
    {
      line: ["123 Main Street"],
      city: "Anytown",
      state: "CA",
      postalCode: "90210",
      country: "USA",
    },
  ],
  telecom: [{ system: "phone", value: "555-123-4567", use: "home" }],
};

const testAccount: Account = {
  resourceType: "Account",
  id: "account-1",
  identifier: [{ system: "http://hospital.org/account", value: "ACC789" }],
  status: "active",
  servicePeriod: {
    start: "2023-12-15T08:00:00Z",
    end: "2023-12-20T10:00:00Z",
  },
};

const testEncounter: Encounter = {
  resourceType: "Encounter",
  id: "encounter-1",
  identifier: [{ system: "http://hospital.org/visit", value: "VISIT456" }],
  status: "finished",
  class: { code: "IMP", display: "Inpatient" },
  period: {
    start: "2023-12-15T08:00:00Z",
    end: "2023-12-20T10:00:00Z",
  },
  location: [
    {
      location: { reference: "Location/icu-101", display: "ICU Room 101" },
    },
  ],
};

const testCoverage: Coverage = {
  resourceType: "Coverage",
  id: "coverage-1",
  beneficiary: { reference: "Patient/patient-1" },
  status: "active",
  type: {
    coding: [{ system: "http://hl7.org/fhir/v3/ActCode", code: "HMO", display: "Health Maintenance Organization" }],
  },
  subscriberId: "SUB123456",
  period: {
    start: "2023-01-01",
    end: "2023-12-31",
  },
  payor: [{ reference: "Organization/bcbs", display: "Blue Cross Blue Shield" }],
  class: [
    {
      type: { coding: [{ code: "group" }] },
      value: "GRP001",
      name: "Corporate Group Plan",
    },
  ],
  relationship: {
    coding: [{ code: "SELF", display: "Self" }],
  },
  order: 1,
};

const testGuarantor: RelatedPerson = {
  resourceType: "RelatedPerson",
  id: "guarantor-1",
  patient: { reference: "Patient/patient-1" },
  identifier: [{ value: "GT001" }],
  name: [{ family: "Smith", given: ["Jane"] }],
  relationship: [{ coding: [{ code: "SPOUSE" }] }],
  address: [
    {
      line: ["123 Main Street"],
      city: "Anytown",
      state: "CA",
      postalCode: "90210",
    },
  ],
  telecom: [{ system: "phone", value: "555-987-6543" }],
};

const testCondition: Condition = {
  resourceType: "Condition",
  id: "condition-1",
  subject: { reference: "Patient/patient-1" },
  code: {
    coding: [
      {
        system: "http://hl7.org/fhir/sid/icd-10-cm",
        code: "J18.9",
        display: "Pneumonia, unspecified organism",
      },
    ],
  },
  category: [
    {
      coding: [{ code: "A", display: "Admitting" }],
    },
  ],
  recordedDate: "2023-12-15",
};

const testProcedure: Procedure = {
  resourceType: "Procedure",
  id: "procedure-1",
  subject: { reference: "Patient/patient-1" },
  code: {
    coding: [
      {
        system: "http://www.ama-assn.org/go/cpt",
        code: "94003",
        display: "Ventilation assist and management",
      },
    ],
  },
  status: "completed",
  performedDateTime: "2023-12-15T10:00:00Z",
};

const testOrganization: Organization = {
  resourceType: "Organization",
  id: "bcbs",
  identifier: [{ value: "BCBS001" }],
  name: "Blue Cross Blue Shield of California",
};

describe("generateBarMessage", () => {
  test("generates minimal BAR^P01 message with required segments", () => {
    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      messageControlId: "MSG001",
      triggerEvent: "P01",
    };

    const message = generateBarMessage(input);

    // Should have MSH, EVN, PID
    expect(message.length).toBe(3);
    expect(message[0]!.segment).toBe("MSH");
    expect(message[1]!.segment).toBe("EVN");
    expect(message[2]!.segment).toBe("PID");

    // Verify MSH content
    expect(fromMSH(message[0]!).$9_messageType.$1_code).toBe("BAR");
    expect(fromMSH(message[0]!).$9_messageType.$2_event).toBe("P01")

    // Verify PID content
    // FIXME: This index management is bad and should be wrapped into getters like it used to
    expect(fromPID(message![2]!).$3_identifier[0]?.$1_value).toBe("MRN12345");
    expect(fromPID(message[2]!).$5_name[0]?.$1_family?.$1_family).toBe("Smith");
    expect(fromPID(message[2]!).$5_name[0]?.$2_given).toBe("John");
    expect(fromPID(message[2]!).$7_birthDate).toBe("19850315");
    expect(fromPID(message[2]!).$8_gender).toBe("M");
    expect(fromPID(message[2]!).$18_accountNumber?.$1_value).toBe("ACC789");
  });

  test("generates BAR^P05 update message", () => {
    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      messageControlId: "MSG002",
      triggerEvent: "P05",
    };

    const message = generateBarMessage(input);
    expect(fromMSH(message[0]!).$9_messageType.$2_event).toBe("P05");
  });

  test("generates BAR^P06 end message", () => {
    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      messageControlId: "MSG003",
      triggerEvent: "P06",
    };

    const message = generateBarMessage(input);
    expect(fromMSH(message[0]!).$9_messageType.$2_event).toBe("P06");
  });

  test("includes PV1 when encounter provided", () => {
    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      encounter: testEncounter,
      messageControlId: "MSG004",
      triggerEvent: "P01",
    };

    const message = generateBarMessage(input);

    const pv1 = message.find((s) => s.segment === "PV1");
    expect(pv1).toBeDefined();
    expect(fromPV1(pv1!).$2_class).toBe("I"); // Inpatient
    expect(fromPV1(pv1!).$19_visitNumber?.$1_value).toBe("VISIT456");
  });

  test("includes GT1 when guarantor provided", () => {
    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      guarantor: testGuarantor,
      messageControlId: "MSG005",
      triggerEvent: "P01",
    };

    const message = generateBarMessage(input);

    const gt1 = message.find((s) => s.segment === "GT1");
    expect(gt1).toBeDefined();
    expect(fromGT1(gt1!).$3_guarantorName[0]?.$1_family?.$1_family).toBe("Smith");
    expect(fromGT1(gt1!).$10_guarantorType).toBe("SP"); // Spouse
  });

  test("uses patient as self-guarantor", () => {
    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      guarantor: testPatient, // Patient is guarantor
      messageControlId: "MSG006",
      triggerEvent: "P01",
    };

    const message = generateBarMessage(input);

    const gt1 = message.find((s) => s.segment === "GT1");
    expect(gt1).toBeDefined();
    expect(fromGT1(gt1!).$10_guarantorType).toBe("SE"); // Self
  });

  test("includes IN1 segments for coverages", () => {
    const organizations = new Map<string, Organization>();
    organizations.set("Organization/bcbs", testOrganization);

    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      coverages: [testCoverage],
      organizations,
      messageControlId: "MSG007",
      triggerEvent: "P01",
    };

    const message = generateBarMessage(input);

    const in1 = message.find((s) => s.segment === "IN1");
    expect(in1).toBeDefined();
    expect(fromIN1(in1!).$1_setIdIn1).toBe("1");
    expect(fromIN1(in1!).$4_insuranceCompanyName![0]?.$1_name).toBe("Blue Cross Blue Shield of California");
    expect(fromIN1(in1!).$36_policyNumber).toBe("SUB123456");
  });

  test("includes DG1 segments for conditions", () => {
    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      conditions: [testCondition],
      messageControlId: "MSG008",
      triggerEvent: "P01",
    };

    const message = generateBarMessage(input);

    const dg1 = message.find((s) => s.segment === "DG1");
    expect(dg1).toBeDefined();
    expect(fromDG1(dg1!).$3_diagnosisCodeDg1?.$1_code).toBe("J18.9");
    expect(fromDG1(dg1!).$3_diagnosisCodeDg1?.$2_text).toBe("Pneumonia, unspecified organism");
  });

  test("includes PR1 segments for procedures", () => {
    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      procedures: [testProcedure],
      messageControlId: "MSG009",
      triggerEvent: "P01",
    };

    const message = generateBarMessage(input);

    const pr1 = message.find((s) => s.segment === "PR1");
    expect(pr1).toBeDefined();
    expect(fromPR1(pr1!).$3_procedureCode.$1_code).toBe("94003");
  });

  test("generates complete BAR message with all segments", () => {
    const organizations = new Map<string, Organization>();
    organizations.set("Organization/bcbs", testOrganization);

    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      encounter: testEncounter,
      coverages: [testCoverage],
      guarantor: testGuarantor,
      conditions: [testCondition],
      procedures: [testProcedure],
      organizations,
      messageControlId: "MSG010",
      triggerEvent: "P01",
      sendingApplication: "HOSPITAL_APP",
      sendingFacility: "HOSPITAL_FAC",
      receivingApplication: "BILLING_APP",
      receivingFacility: "BILLING_FAC",
    };

    const message = generateBarMessage(input);

    // Verify segment order: MSH, EVN, PID, PV1, DG1, PR1, GT1, IN1
    expect(message[0]!.segment).toBe("MSH");
    expect(message[1]!.segment).toBe("EVN");
    expect(message[2]!.segment).toBe("PID");
    expect(message[3]!.segment).toBe("PV1");
    expect(message[4]!.segment).toBe("DG1");
    expect(message[5]!.segment).toBe("PR1");
    expect(message[6]!.segment).toBe("GT1");
    expect(message[7]!.segment).toBe("IN1");

    // Verify it formats correctly
    const hl7String = formatMessage(message);
    expect(hl7String).toContain("MSH|^~\\&|HOSPITAL_APP|HOSPITAL_FAC|BILLING_APP|BILLING_FAC|");
    expect(hl7String).toContain("BAR^P01");
    expect(hl7String).toContain("PID|1||MRN12345");
    expect(hl7String).toContain("Smith^John");
    expect(hl7String).toContain("J18.9");
    expect(hl7String).toContain("94003");
  });

  test("sorts multiple coverages by order", () => {
    const secondaryCoverage: Coverage = {
      ...testCoverage,
      id: "coverage-2",
      order: 2,
      subscriberId: "SEC999",
    };

    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      coverages: [secondaryCoverage, testCoverage], // Out of order
      messageControlId: "MSG011",
      triggerEvent: "P01",
    };

    const message = generateBarMessage(input);

    const in1Segments = message.filter((s) => s.segment === "IN1");
    expect(in1Segments.length).toBe(2);
    expect(fromIN1(in1Segments[0]!).$1_setIdIn1).toBe("1");
    expect(fromIN1(in1Segments[0]!).$36_policyNumber).toBe("SUB123456"); // Primary first
    expect(fromIN1(in1Segments[1]!).$1_setIdIn1).toBe("2");
    expect(fromIN1(in1Segments[1]!).$36_policyNumber).toBe("SEC999"); // Secondary second
  });
});

describe("BAR message wire format", () => {
  test("produces valid HL7v2 pipe-delimited output", () => {
    const input: BarMessageInput = {
      patient: testPatient,
      account: testAccount,
      messageControlId: "MSG012",
      triggerEvent: "P01",
    };

    const message = generateBarMessage(input);
    const hl7String = formatMessage(message);

    // Should start with MSH
    expect(hl7String.startsWith("MSH|^~\\&|")).toBe(true);

    // Segments should be separated by \r
    const segments = hl7String.split("\r");
    expect(segments.length).toBe(3);
    expect(segments[0]!.startsWith("MSH|")).toBe(true);
    expect(segments[1]!.startsWith("EVN|")).toBe(true);
    expect(segments[2]!.startsWith("PID|")).toBe(true);
  });
});

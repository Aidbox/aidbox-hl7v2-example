import { describe, test, expect } from "bun:test";
import { convertADT_A01 } from "../../../src/v2-to-fhir/messages/adt-a01";
import type { Patient, Encounter, RelatedPerson, Condition, AllergyIntolerance, Coverage } from "../../../src/fhir/hl7-fhir-r4-core";

// Sample ADT_A01 message for testing
const sampleADT_A01 = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ADT^A01^ADT_A01|MSG001|P|2.5.1|||AL|AL
EVN|A01|20231215143000|||OPERATOR
PID|1||P12345^^^HOSPITAL^MR||Smith^John^Robert||19850315|M|||123 Main St^^Anytown^CA^12345^USA||^PRN^PH^^1^555^1234567|^WPN^PH^^1^555^9876543||M||P12345
PV1|1|I|WARD1^ROOM1^BED1||||123^ATTENDING^DOCTOR|||MED||||ADM|||||VN001|||||||||||||||||||||||||||20231215140000
NK1|1|Smith^Jane||456 Oak St^^Othertown^CA^54321^USA|^PRN^PH^^1^555^5551234||||||||||||||||||||||||||||||||
DG1|1||I10^Essential Hypertension^ICD10||20231215|||||||||||001^PHYSICIAN^DIAGNOSING
AL1|1|DA|PCN^Penicillin^RXNORM|SV|Rash||
IN1|1|BCBS^Blue Cross Blue Shield||Blue Cross||123 Main St||GRP001|Blue Cross Group||20230101|20231231||HMO||18|SEL||||||||||||||POL123`;

describe("convertADT_A01", () => {
  describe("bundle structure", () => {
    test("creates a transaction bundle", () => {
      const bundle = convertADT_A01(sampleADT_A01);

      expect(bundle.resourceType).toBe("Bundle");
      expect(bundle.type).toBe("transaction");
      expect(bundle.entry).toBeDefined();
      expect(bundle.entry!.length).toBeGreaterThan(0);
    });

    test("includes all expected resources", () => {
      const bundle = convertADT_A01(sampleADT_A01);

      const resourceTypes = bundle.entry!.map(
        (e) => e.resource?.resourceType
      );

      expect(resourceTypes).toContain("Patient");
      expect(resourceTypes).toContain("Encounter");
      expect(resourceTypes).toContain("RelatedPerson");
      expect(resourceTypes).toContain("Condition");
      expect(resourceTypes).toContain("AllergyIntolerance");
      expect(resourceTypes).toContain("Coverage");
    });
  });

  describe("Patient extraction", () => {
    test("extracts patient from PID segment", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const patient = bundle.entry!.find(e => e.resource?.resourceType === "Patient")?.resource as Patient;

      expect(patient).toBeDefined();
      expect(patient.resourceType).toBe("Patient");
      expect(patient.id).toBe("P12345");
    });

    test("sets patient name", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const patient = bundle.entry!.find(e => e.resource?.resourceType === "Patient")?.resource as Patient;

      expect(patient.name).toBeDefined();
      expect(patient.name![0].family).toBe("Smith");
      expect(patient.name![0].given).toContain("John");
    });

    test("sets patient gender", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const patient = bundle.entry!.find(e => e.resource?.resourceType === "Patient")?.resource as Patient;

      expect(patient.gender).toBe("male");
    });

    test("includes meta tags", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const patient = bundle.entry!.find(e => e.resource?.resourceType === "Patient")?.resource as Patient;

      expect(patient.meta?.tag).toBeDefined();

      const messageIdTag = patient.meta?.tag?.find(
        (t) => t.system === "urn:aidbox:hl7v2:message-id"
      );
      expect(messageIdTag?.code).toBe("MSG001");

      const messageTypeTag = patient.meta?.tag?.find(
        (t) => t.system === "urn:aidbox:hl7v2:message-type"
      );
      expect(messageTypeTag?.code).toBe("ADT_A01");
    });
  });

  describe("Encounter extraction", () => {
    test("extracts encounter from PV1 segment", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const encounter = bundle.entry!.find(e => e.resource?.resourceType === "Encounter")?.resource as Encounter;

      expect(encounter).toBeDefined();
      expect(encounter.resourceType).toBe("Encounter");
    });

    test("sets encounter class", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const encounter = bundle.entry!.find(e => e.resource?.resourceType === "Encounter")?.resource as Encounter;

      expect(encounter.class.code).toBe("IMP");
    });

    test("links encounter to patient", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const encounter = bundle.entry!.find(e => e.resource?.resourceType === "Encounter")?.resource as Encounter;

      expect(encounter.subject?.reference).toBe("Patient/P12345");
    });
  });

  describe("RelatedPerson extraction", () => {
    test("extracts related persons from NK1 segments", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const relatedPersons = bundle.entry!.filter(e => e.resource?.resourceType === "RelatedPerson").map(e => e.resource as RelatedPerson);

      expect(relatedPersons).toHaveLength(1);
      expect(relatedPersons[0].resourceType).toBe("RelatedPerson");
    });

    test("sets related person name", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const relatedPerson = bundle.entry!.find(e => e.resource?.resourceType === "RelatedPerson")?.resource as RelatedPerson;

      expect(relatedPerson.name?.[0]?.family).toBe("Smith");
      expect(relatedPerson.name?.[0]?.given).toContain("Jane");
    });

    test("links related person to patient", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const relatedPerson = bundle.entry!.find(e => e.resource?.resourceType === "RelatedPerson")?.resource as RelatedPerson;

      expect(relatedPerson.patient.reference).toBe("Patient/P12345");
    });
  });

  describe("Condition extraction", () => {
    test("extracts conditions from DG1 segments", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const conditions = bundle.entry!.filter(e => e.resource?.resourceType === "Condition").map(e => e.resource as Condition);

      expect(conditions).toHaveLength(1);
      expect(conditions[0].resourceType).toBe("Condition");
    });

    test("sets condition code", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const condition = bundle.entry!.find(e => e.resource?.resourceType === "Condition")?.resource as Condition;

      expect(condition.code?.coding?.[0]?.code).toBe("I10");
      expect(condition.code?.coding?.[0]?.display).toBe("Essential Hypertension");
    });

    test("links condition to patient", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const condition = bundle.entry!.find(e => e.resource?.resourceType === "Condition")?.resource as Condition;

      expect(condition.subject.reference).toBe("Patient/P12345");
    });

    test("links condition to encounter", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const condition = bundle.entry!.find(e => e.resource?.resourceType === "Condition")?.resource as Condition;

      expect(condition.encounter?.reference).toBe("Encounter/VN001");
    });
  });

  describe("AllergyIntolerance extraction", () => {
    test("extracts allergies from AL1 segments", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const allergies = bundle.entry!.filter(e => e.resource?.resourceType === "AllergyIntolerance").map(e => e.resource as AllergyIntolerance);

      expect(allergies).toHaveLength(1);
      expect(allergies[0].resourceType).toBe("AllergyIntolerance");
    });

    test("sets allergy code", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const allergy = bundle.entry!.find(e => e.resource?.resourceType === "AllergyIntolerance")?.resource as AllergyIntolerance;

      expect(allergy.code?.coding?.[0]?.code).toBe("PCN");
      expect(allergy.code?.coding?.[0]?.display).toBe("Penicillin");
    });

    test("sets allergy category for drug allergy", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const allergy = bundle.entry!.find(e => e.resource?.resourceType === "AllergyIntolerance")?.resource as AllergyIntolerance;

      expect(allergy.category).toContain("medication");
    });

    test("sets allergy criticality", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const allergy = bundle.entry!.find(e => e.resource?.resourceType === "AllergyIntolerance")?.resource as AllergyIntolerance;

      expect(allergy.criticality).toBe("high");
    });

    test("sets reaction manifestation", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const allergy = bundle.entry!.find(e => e.resource?.resourceType === "AllergyIntolerance")?.resource as AllergyIntolerance;

      expect(allergy.reaction?.[0]?.manifestation?.[0]?.text).toBe("Rash");
    });

    test("links allergy to patient", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const allergy = bundle.entry!.find(e => e.resource?.resourceType === "AllergyIntolerance")?.resource as AllergyIntolerance;

      expect(allergy.patient.reference).toBe("Patient/P12345");
    });

    test("sets clinical status to active by default", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const allergy = bundle.entry!.find(e => e.resource?.resourceType === "AllergyIntolerance")?.resource as AllergyIntolerance;

      expect(allergy.clinicalStatus?.coding?.[0]?.code).toBe("active");
    });
  });

  describe("Coverage extraction", () => {
    test("extracts coverages from IN1 segments", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const coverages = bundle.entry!.filter(e => e.resource?.resourceType === "Coverage").map(e => e.resource as Coverage);

      expect(coverages).toHaveLength(1);
      expect(coverages[0].resourceType).toBe("Coverage");
    });

    test("sets coverage identifier from plan ID", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const coverage = bundle.entry!.find(e => e.resource?.resourceType === "Coverage")?.resource as Coverage;

      expect(coverage.identifier?.[0]?.value).toBe("BCBS");
    });

    test("sets coverage period when dates are present", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const coverage = bundle.entry!.find(e => e.resource?.resourceType === "Coverage")?.resource as Coverage;

      expect(coverage.period).toBeDefined();
    });

    test("links coverage to patient as beneficiary", () => {
      const bundle = convertADT_A01(sampleADT_A01);
      const coverage = bundle.entry!.find(e => e.resource?.resourceType === "Coverage")?.resource as Coverage;

      expect(coverage.beneficiary.reference).toBe("Patient/P12345");
    });
  });

  describe("bundle entries", () => {
    test("creates PUT requests for all resources", () => {
      const bundle = convertADT_A01(sampleADT_A01);

      for (const entry of bundle.entry!) {
        expect(entry.request?.method).toBe("PUT");
        expect(entry.request?.url).toMatch(
          /^\/(Patient|Encounter|RelatedPerson|Condition|AllergyIntolerance|Coverage)\//
        );
      }
    });

    test("patient entry is first", () => {
      const bundle = convertADT_A01(sampleADT_A01);

      expect(bundle.entry![0].resource?.resourceType).toBe("Patient");
    });
  });

  describe("error handling", () => {
    test("throws error when MSH segment is missing", () => {
      const invalidMessage = `PID|1||P12345^^^HOSPITAL^MR||Smith^John`;

      expect(() => convertADT_A01(invalidMessage)).toThrow();
    });

    test("throws error when PID segment is missing", () => {
      const invalidMessage = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215||ADT^A01|MSG001|P|2.5.1`;

      expect(() => convertADT_A01(invalidMessage)).toThrow(
        "PID segment not found"
      );
    });
  });

  describe("multiple segments", () => {
    test("handles multiple NK1 segments", () => {
      const messageWithMultipleNK1 = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215||ADT^A01|MSG002|P|2.5.1
PID|1||P54321^^^HOSPITAL^MR||Doe^Jane
NK1|1|Doe^John||||||||||||||||||||||||||||||||||
NK1|2|Doe^Mary||||||||||||||||||||||||||||||||||`;

      const bundle = convertADT_A01(messageWithMultipleNK1);
      const relatedPersons = bundle.entry!.filter(e => e.resource?.resourceType === "RelatedPerson");

      expect(relatedPersons).toHaveLength(2);
    });

    test("handles multiple DG1 segments", () => {
      const messageWithMultipleDG1 = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215||ADT^A01|MSG003|P|2.5.1
PID|1||P54321^^^HOSPITAL^MR||Doe^Jane
PV1|1|I|WARD1||||||||||||||||VN003
DG1|1||I10^Hypertension^ICD10
DG1|2||E11^Diabetes^ICD10`;

      const bundle = convertADT_A01(messageWithMultipleDG1);
      const conditions = bundle.entry!.filter(e => e.resource?.resourceType === "Condition").map(e => e.resource as Condition);

      expect(conditions).toHaveLength(2);
      expect(conditions[0].code?.coding?.[0]?.code).toBe("I10");
      expect(conditions[1].code?.coding?.[0]?.code).toBe("E11");
    });

    test("handles multiple AL1 segments", () => {
      const messageWithMultipleAL1 = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215||ADT^A01|MSG004|P|2.5.1
PID|1||P54321^^^HOSPITAL^MR||Doe^Jane
AL1|1|DA|PCN^Penicillin|SV
AL1|2|FA|PEANUT^Peanuts|MO`;

      const bundle = convertADT_A01(messageWithMultipleAL1);
      const allergies = bundle.entry!.filter(e => e.resource?.resourceType === "AllergyIntolerance").map(e => e.resource as AllergyIntolerance);

      expect(allergies).toHaveLength(2);
      expect(allergies[0].code?.coding?.[0]?.code).toBe("PCN");
      expect(allergies[1].code?.coding?.[0]?.code).toBe("PEANUT");
    });

    test("handles multiple IN1 segments", () => {
      const messageWithMultipleIN1 = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215||ADT^A01|MSG005|P|2.5.1
PID|1||P54321^^^HOSPITAL^MR||Doe^Jane
IN1|1|BCBS||Blue Cross|||||||||HMO
IN1|2|AETNA||Aetna|||||||||PPO`;

      const bundle = convertADT_A01(messageWithMultipleIN1);
      const coverages = bundle.entry!.filter(e => e.resource?.resourceType === "Coverage").map(e => e.resource as Coverage);

      expect(coverages).toHaveLength(2);
      expect(coverages[0].identifier?.[0]?.value).toBe("BCBS");
      expect(coverages[1].identifier?.[0]?.value).toBe("AETNA");
    });
  });

  describe("minimal message", () => {
    test("handles message with only required segments", () => {
      const minimalMessage = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215||ADT^A01|MSG006|P|2.5.1
PID|1||P99999^^^HOSPITAL^MR||Minimal^Patient`;

      const bundle = convertADT_A01(minimalMessage);

      const patient = bundle.entry!.find(e => e.resource?.resourceType === "Patient")?.resource;
      const encounter = bundle.entry!.find(e => e.resource?.resourceType === "Encounter")?.resource;
      const relatedPersons = bundle.entry!.filter(e => e.resource?.resourceType === "RelatedPerson");
      const conditions = bundle.entry!.filter(e => e.resource?.resourceType === "Condition");
      const allergies = bundle.entry!.filter(e => e.resource?.resourceType === "AllergyIntolerance");
      const coverages = bundle.entry!.filter(e => e.resource?.resourceType === "Coverage");

      expect(patient).toBeDefined();
      expect(encounter).toBeUndefined();
      expect(relatedPersons).toHaveLength(0);
      expect(conditions).toHaveLength(0);
      expect(allergies).toHaveLength(0);
      expect(coverages).toHaveLength(0);

      // Bundle should still have patient entry
      expect(bundle.entry).toHaveLength(1);
      expect(bundle.entry![0].resource?.resourceType).toBe("Patient");
    });
  });

  describe("Condition deduplication and composite IDs", () => {
    test("deduplicates identical diagnoses, keeps lowest priority", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
PV1|1|I|WARD1||||||||||||||||VN001
DG1|1||I10^Essential Hypertension^ICD10||||||||||2
DG1|2||I10^Essential Hypertension^ICD10||||||||||1`;

      const bundle = convertADT_A01(message);
      const conditions = bundle.entry!.filter(e => e.resource?.resourceType === "Condition");

      expect(conditions).toHaveLength(1); // Deduplicated
    });

    test("generates composite ID with encounter reference", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
PV1|1|I|WARD1||||||||||||||||VN001
DG1|1||I10^Essential Hypertension^ICD10||||||||||1`;

      const bundle = convertADT_A01(message);
      const condition = bundle.entry!.find(e => e.resource?.resourceType === "Condition")?.resource as Condition;

      expect(condition.id).toBe("VN001-essential-hypertension");
    });

    test("uses diagnosis description for ID when available", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
PV1|1|I|WARD1||||||||||||||||VN001
DG1|1||I10^HTN^ICD10|Essential Primary Hypertension|||||||||1`;

      const bundle = convertADT_A01(message);
      const condition = bundle.entry!.find(e => e.resource?.resourceType === "Condition")?.resource as Condition;

      expect(condition.id).toBe("VN001-essential-primary-hypertension");
    });

    test("requires encounter for condition ID generation", () => {
      // ADT_A01 requires PV1 segment, so encounter ID is always present
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
PV1|1|I|WARD1||||||||||||||||VN001
DG1|1||I10^Essential Hypertension^ICD10||||||||||1`;

      const bundle = convertADT_A01(message);
      const condition = bundle.entry!.find(e => e.resource?.resourceType === "Condition")?.resource as Condition;

      expect(condition.id).toBe("VN001-essential-hypertension");
      expect(condition.encounter?.reference).toBe("Encounter/VN001");
    });

    test("keeps different diagnoses with same code but different display", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
PV1|1|I|WARD1||||||||||||||||VN001
DG1|1||I10^Essential Hypertension^ICD10||||||||||1
DG1|2||I10^Secondary Hypertension^ICD10||||||||||2`;

      const bundle = convertADT_A01(message);
      const conditions = bundle.entry!.filter(e => e.resource?.resourceType === "Condition");

      expect(conditions).toHaveLength(2);
      expect(conditions.map(c => (c.resource as Condition).id).sort()).toEqual([
        "VN001-essential-hypertension",
        "VN001-secondary-hypertension"
      ]);
    });

    test("handles duplicates with no priority - keeps first", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
PV1|1|I|WARD1||||||||||||||||VN001
DG1|1||I10^Hypertension^ICD10
DG1|2||I10^Hypertension^ICD10`;

      const bundle = convertADT_A01(message);
      const conditions = bundle.entry!.filter(e => e.resource?.resourceType === "Condition");

      expect(conditions).toHaveLength(1);
    });

    test("sets clinicalStatus to active", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
PV1|1|I|WARD1||||||||||||||||VN001
DG1|1||I10^Hypertension^ICD10||||||||||1`;

      const bundle = convertADT_A01(message);
      const condition = bundle.entry!.find(e => e.resource?.resourceType === "Condition")?.resource as Condition;

      expect(condition.clinicalStatus?.coding?.[0]?.code).toBe("active");
      expect(condition.clinicalStatus?.coding?.[0]?.system).toBe(
        "http://terminology.hl7.org/CodeSystem/condition-clinical"
      );
    });

    test("handles special characters in condition names", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
PV1|1|I|WARD1||||||||||||||||VN001
DG1|1||E11.9^Type 2 Diabetes (uncontrolled)!^ICD10||||||||||1`;

      const bundle = convertADT_A01(message);
      const condition = bundle.entry!.find(e => e.resource?.resourceType === "Condition")?.resource as Condition;

      expect(condition.id).toBe("VN001-type-2-diabetes-uncontrolled");
    });

    test("priority 1 wins over priority 2 and 3", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
PV1|1|I|WARD1||||||||||||||||VN001
DG1|1||I10^Hypertension^ICD10||||||||||3
DG1|2||I10^Hypertension^ICD10||||||||||1
DG1|3||I10^Hypertension^ICD10||||||||||2`;

      const bundle = convertADT_A01(message);
      const conditions = bundle.entry!.filter(e => e.resource?.resourceType === "Condition");

      expect(conditions).toHaveLength(1); // Only one kept
    });
  });

  describe("Coverage composite IDs and dynamic status", () => {
    test("generates composite ID with patient and payor identifier", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
IN1|1|BCBS^Blue Cross Blue Shield^PLAN|12345^^^BCBS`;

      const bundle = convertADT_A01(message);
      const coverage = bundle.entry!.find(e => e.resource?.resourceType === "Coverage")?.resource as Coverage;

      expect(coverage.id).toBe("P12345-12345");
    });

    test("uses payor organization name for ID when no identifier", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
IN1|1|||Blue Cross Blue Shield`;

      const bundle = convertADT_A01(message);
      const coverage = bundle.entry!.find(e => e.resource?.resourceType === "Coverage")?.resource as Coverage;

      expect(coverage.id).toBe("P12345-blue-cross-blue-shield");
    });

    test("sets status to active when no end date", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
IN1|1|||Blue Cross||||||||20230101`;

      const bundle = convertADT_A01(message);
      const coverage = bundle.entry!.find(e => e.resource?.resourceType === "Coverage")?.resource as Coverage;

      expect(coverage.status).toBe("active");
    });

    test("sets status to active when end date is in future", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().substring(0, 10).replace(/-/g, "");

      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
IN1|1|||Blue Cross||||||||20230101|${futureDateStr}`;

      const bundle = convertADT_A01(message);
      const coverage = bundle.entry!.find(e => e.resource?.resourceType === "Coverage")?.resource as Coverage;

      expect(coverage.status).toBe("active");
      expect(coverage.period?.end).toBeDefined();
    });

    test("sets status to cancelled when end date is in past", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
IN1|1|||Blue Cross||||||||20230101|20230630`;

      const bundle = convertADT_A01(message);
      const coverage = bundle.entry!.find(e => e.resource?.resourceType === "Coverage")?.resource as Coverage;

      expect(coverage.status).toBe("cancelled");
      expect(coverage.period?.end).toBe("2023-06-30");
    });

    test("skips IN1 segments without payor information", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
IN1|1|PLAN123
IN1|2|||Blue Cross`;

      const bundle = convertADT_A01(message);
      const coverages = bundle.entry!.filter(e => e.resource?.resourceType === "Coverage");

      // Only IN1|2 should be processed (has payor name)
      expect(coverages).toHaveLength(1);
      expect((coverages[0].resource as Coverage).id).toBe("P12345-blue-cross");
    });

    test("processes IN1 with company ID even without name", () => {
      const message = `MSH|^~\\&|SENDER|FAC|RECV|DEST|20231215||ADT^A01|MSG001|P|2.5.1
PID|1||P12345^^^HOSP^MR||Smith^John
IN1|1||BCBS123^^^SYSTEM`;

      const bundle = convertADT_A01(message);
      const coverages = bundle.entry!.filter(e => e.resource?.resourceType === "Coverage");

      expect(coverages).toHaveLength(1);
      expect((coverages[0].resource as Coverage).id).toBe("P12345-bcbs123");
    });
  });
});

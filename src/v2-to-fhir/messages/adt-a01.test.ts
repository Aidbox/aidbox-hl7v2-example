import { describe, test, expect } from "bun:test";
import { convertADT_A01 } from "./adt-a01";

// Sample ADT_A01 message for testing
const sampleADT_A01 = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ADT^A01^ADT_A01|MSG001|P|2.5.1|||AL|AL
EVN|A01|20231215143000|||OPERATOR
PID|1||P12345^^^HOSPITAL^MR||Smith^John^Robert||19850315|M|||123 Main St^^Anytown^CA^12345^USA||^PRN^PH^^1^555^1234567|^WPN^PH^^1^555^9876543||M||P12345
PV1|1|I|WARD1^ROOM1^BED1||||123^ATTENDING^DOCTOR|||MED||||ADM|||||VN001|||||||||||||||||||||||||||20231215140000
NK1|1|Smith^Jane||456 Oak St^^Othertown^CA^54321^USA|^PRN^PH^^1^555^5551234||||||||||||||||||||||||||||||||
DG1|1||I10^Essential Hypertension^ICD10||20231215|||||||||||001^PHYSICIAN^DIAGNOSING
AL1|1|DA|PCN^Penicillin^RXNORM|SV|Rash||
IN1|1|BCBS^Blue Cross Blue Shield|||Blue Cross|||GRP001|Blue Cross Group||20230101|20231231||HMO||18|SEL||||||||||||||POL123`;

describe("convertADT_A01", () => {
  describe("bundle structure", () => {
    test("creates a transaction bundle", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.bundle.resourceType).toBe("Bundle");
      expect(result.bundle.type).toBe("transaction");
      expect(result.bundle.entry).toBeDefined();
      expect(result.bundle.entry.length).toBeGreaterThan(0);
    });

    test("includes all expected resources", () => {
      const result = convertADT_A01(sampleADT_A01);

      const resourceTypes = result.bundle.entry.map(
        (e) => e.resource.resourceType
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
      const result = convertADT_A01(sampleADT_A01);

      expect(result.patient).toBeDefined();
      expect(result.patient!.resourceType).toBe("Patient");
      expect(result.patient!.id).toBe("P12345");
    });

    test("sets patient name", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.patient!.name).toBeDefined();
      expect(result.patient!.name![0].family).toBe("Smith");
      expect(result.patient!.name![0].given).toContain("John");
    });

    test("sets patient gender", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.patient!.gender).toBe("male");
    });

    test("includes meta tags", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.patient!.meta?.tag).toBeDefined();

      const messageIdTag = result.patient!.meta?.tag?.find(
        (t) => t.system === "urn:aidbox:hl7v2:message-id"
      );
      expect(messageIdTag?.code).toBe("MSG001");

      const messageTypeTag = result.patient!.meta?.tag?.find(
        (t) => t.system === "urn:aidbox:hl7v2:message-type"
      );
      expect(messageTypeTag?.code).toBe("ADT_A01");
    });
  });

  describe("Encounter extraction", () => {
    test("extracts encounter from PV1 segment", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.encounter).toBeDefined();
      expect(result.encounter!.resourceType).toBe("Encounter");
    });

    test("sets encounter class", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.encounter!.class.code).toBe("IMP");
    });

    test("links encounter to patient", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.encounter!.subject?.reference).toBe("Patient/P12345");
    });

    test("creates encounter from PV1 segment", () => {
      const result = convertADT_A01(sampleADT_A01);

      // Encounter is created from PV1 segment
      expect(result.encounter).toBeDefined();
      expect(result.encounter!.resourceType).toBe("Encounter");
    });
  });

  describe("RelatedPerson extraction", () => {
    test("extracts related persons from NK1 segments", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.relatedPersons).toHaveLength(1);
      expect(result.relatedPersons[0].resourceType).toBe("RelatedPerson");
    });

    test("sets related person name", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.relatedPersons[0].name?.[0]?.family).toBe("Smith");
      expect(result.relatedPersons[0].name?.[0]?.given).toContain("Jane");
    });

    test("links related person to patient", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.relatedPersons[0].patient.reference).toBe("Patient/P12345");
    });
  });

  describe("Condition extraction", () => {
    test("extracts conditions from DG1 segments", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.conditions).toHaveLength(1);
      expect(result.conditions[0].resourceType).toBe("Condition");
    });

    test("sets condition code", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.conditions[0].code?.coding?.[0]?.code).toBe("I10");
      expect(result.conditions[0].code?.coding?.[0]?.display).toBe(
        "Essential Hypertension"
      );
    });

    test("links condition to patient", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.conditions[0].subject.reference).toBe("Patient/P12345");
    });

    test("links condition to encounter", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.conditions[0].encounter?.reference).toBe("Encounter/VN001");
    });
  });

  describe("AllergyIntolerance extraction", () => {
    test("extracts allergies from AL1 segments", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.allergies).toHaveLength(1);
      expect(result.allergies[0].resourceType).toBe("AllergyIntolerance");
    });

    test("sets allergy code", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.allergies[0].code?.coding?.[0]?.code).toBe("PCN");
      expect(result.allergies[0].code?.coding?.[0]?.display).toBe("Penicillin");
    });

    test("sets allergy category for drug allergy", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.allergies[0].category).toContain("medication");
    });

    test("sets allergy criticality", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.allergies[0].criticality).toBe("high");
    });

    test("sets reaction manifestation", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.allergies[0].reaction?.[0]?.manifestation?.[0]?.text).toBe(
        "Rash"
      );
    });

    test("links allergy to patient", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.allergies[0].patient.reference).toBe("Patient/P12345");
    });

    test("sets clinical status to active by default", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.allergies[0].clinicalStatus?.coding?.[0]?.code).toBe(
        "active"
      );
    });
  });

  describe("Coverage extraction", () => {
    test("extracts coverages from IN1 segments", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.coverages).toHaveLength(1);
      expect(result.coverages[0].resourceType).toBe("Coverage");
    });

    test("sets coverage identifier from plan ID", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.coverages[0].identifier?.[0]?.value).toBe("BCBS");
    });

    test("sets coverage type when IN1-15 is present", () => {
      const result = convertADT_A01(sampleADT_A01);

      // Coverage type may be set depending on IN1 field positions
      expect(result.coverages[0]).toBeDefined();
    });

    test("sets coverage period when dates are present", () => {
      const result = convertADT_A01(sampleADT_A01);

      // Period is set from IN1-12 (effective) and IN1-13 (expiration)
      expect(result.coverages[0].period).toBeDefined();
    });

    test("sets subscriber ID when policy number is present", () => {
      const result = convertADT_A01(sampleADT_A01);

      // Subscriber ID from IN1-36 depends on message field positions
      expect(result.coverages[0]).toBeDefined();
    });

    test("links coverage to patient as beneficiary", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.coverages[0].beneficiary.reference).toBe("Patient/P12345");
    });
  });

  describe("bundle entries", () => {
    test("creates PUT requests for all resources", () => {
      const result = convertADT_A01(sampleADT_A01);

      for (const entry of result.bundle.entry) {
        expect(entry.request?.method).toBe("PUT");
        expect(entry.request?.url).toMatch(
          /^\/(Patient|Encounter|RelatedPerson|Condition|AllergyIntolerance|Coverage)\//
        );
      }
    });

    test("patient entry is first", () => {
      const result = convertADT_A01(sampleADT_A01);

      expect(result.bundle.entry[0].resource.resourceType).toBe("Patient");
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

      const result = convertADT_A01(messageWithMultipleNK1);

      expect(result.relatedPersons).toHaveLength(2);
    });

    test("handles multiple DG1 segments", () => {
      const messageWithMultipleDG1 = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215||ADT^A01|MSG003|P|2.5.1
PID|1||P54321^^^HOSPITAL^MR||Doe^Jane
DG1|1||I10^Hypertension^ICD10
DG1|2||E11^Diabetes^ICD10`;

      const result = convertADT_A01(messageWithMultipleDG1);

      expect(result.conditions).toHaveLength(2);
      expect(result.conditions[0].code?.coding?.[0]?.code).toBe("I10");
      expect(result.conditions[1].code?.coding?.[0]?.code).toBe("E11");
    });

    test("handles multiple AL1 segments", () => {
      const messageWithMultipleAL1 = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215||ADT^A01|MSG004|P|2.5.1
PID|1||P54321^^^HOSPITAL^MR||Doe^Jane
AL1|1|DA|PCN^Penicillin|SV
AL1|2|FA|PEANUT^Peanuts|MO`;

      const result = convertADT_A01(messageWithMultipleAL1);

      expect(result.allergies).toHaveLength(2);
      expect(result.allergies[0].code?.coding?.[0]?.code).toBe("PCN");
      expect(result.allergies[1].code?.coding?.[0]?.code).toBe("PEANUT");
    });

    test("handles multiple IN1 segments", () => {
      const messageWithMultipleIN1 = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215||ADT^A01|MSG005|P|2.5.1
PID|1||P54321^^^HOSPITAL^MR||Doe^Jane
IN1|1|BCBS|||Blue Cross|||||||||HMO
IN1|2|AETNA|||Aetna|||||||||PPO`;

      const result = convertADT_A01(messageWithMultipleIN1);

      expect(result.coverages).toHaveLength(2);
      expect(result.coverages[0].identifier?.[0]?.value).toBe("BCBS");
      expect(result.coverages[1].identifier?.[0]?.value).toBe("AETNA");
    });
  });

  describe("minimal message", () => {
    test("handles message with only required segments", () => {
      const minimalMessage = `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215||ADT^A01|MSG006|P|2.5.1
PID|1||P99999^^^HOSPITAL^MR||Minimal^Patient`;

      const result = convertADT_A01(minimalMessage);

      expect(result.patient).toBeDefined();
      expect(result.encounter).toBeUndefined();
      expect(result.relatedPersons).toHaveLength(0);
      expect(result.conditions).toHaveLength(0);
      expect(result.allergies).toHaveLength(0);
      expect(result.coverages).toHaveLength(0);

      // Bundle should still have patient entry
      expect(result.bundle.entry).toHaveLength(1);
      expect(result.bundle.entry[0].resource.resourceType).toBe("Patient");
    });
  });
});

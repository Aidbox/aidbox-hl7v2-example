import { describe, test, expect } from "bun:test";
import { convertPIDToPatient } from "../../../../src/v2-to-fhir/segments/pid-patient";
import type { PID } from "../../../../src/hl7v2/generated/fields";

describe("convertPIDToPatient", () => {
  describe("identifiers", () => {
    test("converts PID-2 Patient ID to identifier", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $2_patientId: {
          $1_value: "12345",
          $4_system: { $1_namespace: "HOSPITAL" },
          $5_type: "MR",
        },
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.identifier).toHaveLength(1);
      expect(patient.identifier![0]!.value).toBe("12345");
      expect(patient.identifier![0]!.system).toBe("HOSPITAL");
      expect(patient.identifier![0]!.type?.coding?.[0]?.code).toBe("MR");
    });

    test("converts PID-3 Patient Identifier List to identifiers", () => {
      const pid: PID = {
        $3_identifier: [
          { $1_value: "MRN001", $5_type: "MR" },
          { $1_value: "ACC001", $5_type: "AN" },
        ],
        $5_name: [],
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.identifier).toHaveLength(2);
      expect(patient.identifier![0]!.value).toBe("MRN001");
      expect(patient.identifier![1]!.value).toBe("ACC001");
    });

    test("converts PID-19 SSN to identifier with correct type and system", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $19_ssnNumberPatient: "123-45-6789",
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.identifier).toHaveLength(1);
      expect(patient.identifier![0]!.value).toBe("123-45-6789");
      expect(patient.identifier![0]!.system).toBe("http://hl7.org/fhir/sid/us-ssn");
      expect(patient.identifier![0]!.type?.coding?.[0]?.code).toBe("SS");
      expect(patient.identifier![0]!.type?.coding?.[0]?.system).toBe(
        "http://terminology.hl7.org/CodeSystem/v2-0203"
      );
    });

    test("converts PID-20 Driver's License to identifier", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $20_driversLicenseNumberPatient: {
          $1_license: "DL12345",
          $2_issuingAuthority: "CA",
          $3_end: "20251231",
        },
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.identifier).toHaveLength(1);
      expect(patient.identifier![0]!.value).toBe("DL12345");
      expect(patient.identifier![0]!.system).toBe("CA");
      expect(patient.identifier![0]!.type?.coding?.[0]?.code).toBe("DL");
      expect(patient.identifier![0]!.period?.end).toBe("20251231");
    });
  });

  describe("names", () => {
    test("converts PID-5 Patient Name", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [
          {
            $1_family: { $1_family: "Smith" },
            $2_given: "John",
            $3_additionalGiven: "Robert",
          },
        ],
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.name).toHaveLength(1);
      expect(patient.name![0]!.family).toBe("Smith");
      expect(patient.name![0]!.given).toEqual(["John", "Robert"]);
    });

    test("converts PID-9 Patient Alias with use=old", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $9_alias: [
          {
            $1_family: { $1_family: "Doe" },
            $2_given: "Jane",
          },
        ],
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.name).toHaveLength(1);
      expect(patient.name![0]!.family).toBe("Doe");
      expect(patient.name![0]!.use).toBe("old");
    });
  });

  describe("demographics", () => {
    test("converts PID-7 Date/Time of Birth to birthDate", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $7_birthDate: "19850315",
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.birthDate).toBe("1985-03-15");
    });

    test("converts PID-7 with time to birthDate and birthTime extension", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $7_birthDate: "198503151030",
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.birthDate).toBe("1985-03-15");
      expect(patient.extension).toBeDefined();
      const birthTimeExt = patient.extension?.find(
        (e) => e.url === "http://hl7.org/fhir/StructureDefinition/patient-birthTime"
      );
      expect(birthTimeExt?.valueDateTime).toBe("1985-03-15T10:30:00");
    });

    test("converts PID-8 Gender", () => {
      const testCases = [
        { input: "M", expected: "male" as const },
        { input: "F", expected: "female" as const },
        { input: "O", expected: "other" as const },
        { input: "U", expected: "unknown" as const },
      ];

      for (const { input, expected } of testCases) {
        const pid: PID = {
          $3_identifier: [],
          $5_name: [],
          $8_gender: input,
        };

        const patient = convertPIDToPatient(pid);
        expect(patient!.gender).toBe(expected);
      }
    });
  });

  describe("address", () => {
    test("converts PID-11 Patient Address", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $11_address: [
          {
            $1_line1: { $1_line: "123 Main St" },
            $3_city: "Anytown",
            $4_state: "CA",
            $5_postalCode: "12345",
            $6_country: "USA",
          },
        ],
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.address).toHaveLength(1);
      expect(patient.address![0]!.line).toEqual(["123 Main St"]);
      expect(patient.address![0]!.city).toBe("Anytown");
      expect(patient.address![0]!.state).toBe("CA");
      expect(patient.address![0]!.postalCode).toBe("12345");
      expect(patient.address![0]!.country).toBe("USA");
    });

    test("applies PID-12 County Code to first address district", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $11_address: [
          {
            $3_city: "Anytown",
          },
        ],
        $12_countyCode: "06037",
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.address![0]!.district).toBe("06037");
    });
  });

  describe("telecom", () => {
    test("converts PID-13 Home Phone with use=home", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $13_homePhone: [
          {
            $1_value: "(555) 123-4567",
          },
        ],
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.telecom).toHaveLength(1);
      expect(patient.telecom![0]!.value).toBe("(555) 123-4567");
      expect(patient.telecom![0]!.use).toBe("home");
    });

    test("converts PID-14 Business Phone with use=work", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $14_businessPhone: [
          {
            $1_value: "(555) 987-6543",
          },
        ],
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.telecom).toHaveLength(1);
      expect(patient.telecom![0]!.value).toBe("(555) 987-6543");
      expect(patient.telecom![0]!.use).toBe("work");
    });
  });

  describe("communication", () => {
    test("converts PID-15 Primary Language", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $15_language: {
          $1_code: "en",
          $2_text: "English",
        },
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.communication).toHaveLength(1);
      expect(patient.communication![0]!.language.coding?.[0]?.code).toBe("en");
      expect(patient.communication![0]!.language.coding?.[0]?.display).toBe("English");
      expect(patient.communication![0]!.preferred).toBe(true);
    });
  });

  describe("marital status", () => {
    test("converts PID-16 Marital Status", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $16_maritalStatus: {
          $1_code: "M",
          $2_text: "Married",
        },
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.maritalStatus?.coding?.[0]?.code).toBe("M");
      expect(patient.maritalStatus?.coding?.[0]?.display).toBe("Married");
    });
  });

  describe("multiple birth", () => {
    test("converts PID-25 Birth Order to multipleBirthInteger", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $25_birthOrder: "2",
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.multipleBirthInteger).toBe(2);
      expect(patient.multipleBirthBoolean).toBeUndefined();
    });

    test("converts PID-24 Multiple Birth Indicator when PID-25 not valued", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $24_multipleBirthIndicator: "Y",
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.multipleBirthBoolean).toBe(true);
      expect(patient.multipleBirthInteger).toBeUndefined();
    });

    test("prefers PID-25 over PID-24", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $24_multipleBirthIndicator: "Y",
        $25_birthOrder: "1",
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.multipleBirthInteger).toBe(1);
      expect(patient.multipleBirthBoolean).toBeUndefined();
    });
  });

  describe("deceased", () => {
    test("converts PID-29 Death Date to deceasedDateTime", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $29_deceasedDateTime: "202312151430",
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.deceasedDateTime).toBe("2023-12-15T14:30:00");
      expect(patient.deceasedBoolean).toBeUndefined();
    });

    test("converts PID-30 Death Indicator when PID-29 not valued", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $30_deceased: "Y",
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.deceasedBoolean).toBe(true);
      expect(patient.deceasedDateTime).toBeUndefined();
    });
  });

  describe("extensions", () => {
    test("converts PID-6 Mother's Maiden Name to extension", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $6_mothersMaidenName: [
          {
            $1_family: { $1_family: "Johnson" },
          },
        ],
      };

      const patient = convertPIDToPatient(pid);

      const ext = patient.extension?.find(
        (e) => e.url === "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName"
      );
      expect(ext?.valueString).toBe("Johnson");
    });

    test("converts PID-17 Religion to extension", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $17_religion: {
          $1_code: "CHR",
          $2_text: "Christian",
        },
      };

      const patient = convertPIDToPatient(pid);

      const ext = patient.extension?.find(
        (e) => e.url === "http://hl7.org/fhir/StructureDefinition/patient-religion"
      );
      expect(ext?.valueCodeableConcept?.coding?.[0]?.code).toBe("CHR");
    });

    test("converts PID-23 Birth Place to extension", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $23_birthPlace: "Los Angeles, CA",
      };

      const patient = convertPIDToPatient(pid);

      const ext = patient.extension?.find(
        (e) => e.url === "http://hl7.org/fhir/StructureDefinition/patient-birthPlace"
      );
      expect(ext?.valueAddress?.text).toBe("Los Angeles, CA");
    });

    test("converts PID-26 Citizenship to extension", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $26_citizenship: [
          {
            $1_code: "USA",
            $2_text: "United States",
          },
        ],
      };

      const patient = convertPIDToPatient(pid);

      const ext = patient.extension?.find(
        (e) => e.url === "http://hl7.org/fhir/StructureDefinition/patient-citizenship"
      );
      expect(ext?.extension![0]?.url).toBe("code");
      expect(ext?.extension![0]?.valueCodeableConcept?.coding?.[0]?.code).toBe("USA");
    });

    test("converts PID-28 Nationality to extension", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $28_nationality: {
          $1_code: "USA",
          $2_text: "American",
        },
      };

      const patient = convertPIDToPatient(pid);

      const ext = patient.extension?.find(
        (e) => e.url === "http://hl7.org/fhir/StructureDefinition/patient-nationality"
      );
      expect(ext?.extension![0]?.url).toBe("code");
      expect(ext?.extension![0]?.valueCodeableConcept?.coding?.[0]?.code).toBe("USA");
    });

    test("converts PID-35/36 Animal (Species/Breed) to extension", () => {
      const pid: PID = {
        $3_identifier: [],
        $5_name: [],
        $35_speciesCode: {
          $1_code: "canine",
          $2_text: "Dog",
        },
        $36_breedCode: {
          $1_code: "labrador",
          $2_text: "Labrador Retriever",
        },
      };

      const patient = convertPIDToPatient(pid);

      const animalExt = patient.extension?.find(
        (e) => e.url === "http://hl7.org/fhir/StructureDefinition/patient-animal"
      );
      expect(animalExt).toBeDefined();

      const speciesExt = animalExt?.extension?.find((e) => e.url === "species");
      expect(speciesExt?.valueCodeableConcept?.coding?.[0]?.code).toBe("canine");

      const breedExt = animalExt?.extension?.find((e) => e.url === "breed");
      expect(breedExt?.valueCodeableConcept?.coding?.[0]?.code).toBe("labrador");
    });
  });

  describe("comprehensive conversion", () => {
    test("converts a complete PID segment", () => {
      const pid: PID = {
        $2_patientId: {
          $1_value: "P12345",
          $5_type: "PI",
        },
        $3_identifier: [
          {
            $1_value: "MRN001",
            $4_system: { $1_namespace: "HOSPITAL" },
            $5_type: "MR",
          },
        ],
        $5_name: [
          {
            $1_family: { $1_family: "Smith" },
            $2_given: "John",
            $3_additionalGiven: "Robert",
            $5_prefix: "Mr.",
          },
        ],
        $7_birthDate: "19850315",
        $8_gender: "M",
        $11_address: [
          {
            $1_line1: { $1_line: "123 Main St" },
            $3_city: "Anytown",
            $4_state: "CA",
            $5_postalCode: "12345",
          },
        ],
        $13_homePhone: [{ $1_value: "(555) 123-4567" }],
        $15_language: { $1_code: "en" },
        $16_maritalStatus: { $1_code: "M" },
        $19_ssnNumberPatient: "123-45-6789",
      };

      const patient = convertPIDToPatient(pid);

      expect(patient.resourceType).toBe("Patient");
      expect(patient.identifier).toHaveLength(3); // PI, MR, SSN
      expect(patient.name).toHaveLength(1);
      expect(patient.name![0]!.family).toBe("Smith");
      expect(patient.birthDate).toBe("1985-03-15");
      expect(patient.gender).toBe("male");
      expect(patient.address).toHaveLength(1);
      expect(patient.telecom).toHaveLength(1);
      expect(patient.communication).toHaveLength(1);
      expect(patient.maritalStatus?.coding?.[0]?.code).toBe("M");
    });
  });
});


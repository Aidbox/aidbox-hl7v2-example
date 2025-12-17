import { test, expect, describe } from "bun:test";
import { convertXCNToPatient, convertXCNArrayToPatients } from "./xcn-patient";
import type { XCN } from "../../hl7v2/generated/fields";

describe("XCN[Patient] Converter", () => {
  describe("convertXCNToPatient", () => {
    test("returns undefined for undefined input", () => {
      const result = convertXCNToPatient(undefined);
      expect(result).toBeUndefined();
    });

    test("returns undefined for empty XCN", () => {
      const xcn: XCN = {};
      const result = convertXCNToPatient(xcn);
      expect(result).toBeUndefined();
    });

    test("converts basic XCN with ID and name", () => {
      const xcn: XCN = {
        $1_value: "12345",
        $2_family: { $1_family: "Smith" },
        $3_given: "John",
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      expect(result?.resourceType).toBe("Patient");
      expect(result?.identifier).toBeDefined();
      expect(result?.identifier?.[0].value).toBe("12345");
      expect(result?.name).toBeDefined();
      expect(result?.name?.[0].family).toBe("Smith");
      expect(result?.name?.[0].given).toEqual(["John"]);
    });

    test("converts XCN with full name components", () => {
      const xcn: XCN = {
        $1_value: "67890",
        $2_family: { $1_family: "Jones" },
        $3_given: "Mary",
        $4_additionalGiven: "Elizabeth",
        $5_suffix: "Jr",
        $6_prefix: "Dr",
        $21_credential: "PhD",
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      expect(result?.name?.[0].family).toBe("Jones");
      expect(result?.name?.[0].given).toEqual(["Mary", "Elizabeth"]);
      expect(result?.name?.[0].prefix).toEqual(["Dr"]);
      expect(result?.name?.[0].suffix).toEqual(["Jr", "PhD"]);
    });

    test("XCN.7 (degree) maps to name.suffix for Patient", () => {
      const xcn: XCN = {
        $1_value: "777",
        $2_family: { $1_family: "Anderson" },
        $5_suffix: "Jr",
        $7_qualification: "MD",
        $21_credential: "FACP",
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      // For Patient: XCN.5->suffix[0], XCN.7->suffix[1], XCN.21->suffix[2]
      expect(result?.name?.[0].suffix).toEqual(["Jr", "MD", "FACP"]);
      // Patient should NOT have qualification property
      expect((result as any)?.qualification).toBeUndefined();
    });

    test("converts XCN with identifier system and type", () => {
      const xcn: XCN = {
        $1_value: "ABC123",
        $2_family: { $1_family: "Brown" },
        $9_system: {
          $1_namespace: "http://hospital.example.org",
        },
        $13_type: "MR",
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      expect(result?.identifier?.[0].value).toBe("ABC123");
      expect(result?.identifier?.[0].system).toBe("http://hospital.example.org");
      expect(result?.identifier?.[0].type?.coding?.[0].code).toBe("MR");
    });

    test("converts XCN with name use code", () => {
      const xcn: XCN = {
        $1_value: "999",
        $2_family: { $1_family: "Wilson" },
        $10_use: "L", // Legal Name
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      expect(result?.name?.[0].use).toBe("official");
    });

    test("converts XCN with name period (XCN.19, XCN.20)", () => {
      const xcn: XCN = {
        $1_value: "555",
        $2_family: { $1_family: "Taylor" },
        $19_start: "2020-01-01T00:00:00Z",
        $20_end: "2025-12-31T23:59:59Z",
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      expect(result?.name?.[0].period?.start).toBe("2020-01-01T00:00:00Z");
      expect(result?.name?.[0].period?.end).toBe("2025-12-31T23:59:59Z");
    });

    test("converts XCN with check digit extensions", () => {
      const xcn: XCN = {
        $1_value: "CHECK123",
        $2_family: { $1_family: "CheckTest" },
        $11_checkDigit: "9",
        $12_checkDigitScheme: "ISO",
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      expect(result?.identifier?.[0].extension).toBeDefined();
      expect(result?.identifier?.[0].extension?.[0].url).toBe(
        "http://hl7.org/fhir/StructureDefinition/identifier-checkDigit"
      );
      expect(result?.identifier?.[0].extension?.[0].valueString).toBe("9");
      expect(result?.identifier?.[0].extension?.[1].url).toBe(
        "http://hl7.org/fhir/StructureDefinition/namingsystem-checkDigit"
      );
      expect(result?.identifier?.[0].extension?.[1].valueString).toBe("ISO");
    });

    test("converts XCN with name assembly order extension", () => {
      const xcn: XCN = {
        $1_value: "ORDER123",
        $2_family: { $1_family: "OrderTest" },
        $18_order: "G",
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      expect(result?.name?.[0].extension).toBeDefined();
      expect(result?.name?.[0].extension?.[0].url).toBe(
        "http://hl7.org/fhir/R4/extension-humanname-assembly-order.html"
      );
      expect(result?.name?.[0].extension?.[0].valueCode).toBe("G");
    });

    test("handles XCN with only ID (no name)", () => {
      const xcn: XCN = {
        $1_value: "ONLY_ID",
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      expect(result?.identifier?.[0].value).toBe("ONLY_ID");
      expect(result?.name).toBeUndefined();
    });

    test("handles XCN with only name (no ID)", () => {
      const xcn: XCN = {
        $2_family: { $1_family: "NameOnly" },
        $3_given: "Test",
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      expect(result?.identifier).toBeUndefined();
      expect(result?.name?.[0].family).toBe("NameOnly");
      expect(result?.name?.[0].given).toEqual(["Test"]);
    });

    test("converts all name type codes correctly", () => {
      const testCases = [
        { code: "A", expected: "usual" },     // Alias
        { code: "B", expected: "official" },  // Birth name
        { code: "C", expected: "official" },  // Adopted
        { code: "D", expected: "usual" },     // Display
        { code: "L", expected: "official" },  // Legal
        { code: "M", expected: "maiden" },    // Maiden
        { code: "N", expected: "nickname" },  // Nickname
        { code: "P", expected: "official" },  // Partner/Spouse
        { code: "R", expected: "official" },  // Registered
        { code: "S", expected: "anonymous" }, // Pseudonym
        { code: "T", expected: "temp" },      // Temporary
        { code: "U", expected: "old" },       // Unknown
      ];

      for (const { code, expected } of testCases) {
        const xcn: XCN = {
          $1_value: "TEST",
          $2_family: { $1_family: "Test" },
          $10_use: code,
        };

        const result = convertXCNToPatient(xcn);
        expect(result?.name?.[0].use).toBe(expected);
      }
    });

    test("XCN.19/20 take precedence over XCN.17 for period", () => {
      const xcn: XCN = {
        $1_value: "PERIOD_TEST",
        $2_family: { $1_family: "PeriodTest" },
        $17_period: {
          $1_start: "2010-01-01",
          $2_end: "2015-12-31",
        },
        $19_start: "2020-01-01T00:00:00Z",
        $20_end: "2025-12-31T23:59:59Z",
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      // XCN.19/20 should be used, not XCN.17
      expect(result?.name?.[0].period?.start).toBe("2020-01-01T00:00:00Z");
      expect(result?.name?.[0].period?.end).toBe("2025-12-31T23:59:59Z");
    });

    test("uses XCN.17 for period when XCN.19/20 are absent", () => {
      const xcn: XCN = {
        $1_value: "PERIOD_TEST2",
        $2_family: { $1_family: "PeriodTest2" },
        $17_period: {
          $1_start: "2010-01-01",
          $2_end: "2015-12-31",
        },
      };

      const result = convertXCNToPatient(xcn);

      expect(result).toBeDefined();
      expect(result?.name?.[0].period?.start).toBe("2010-01-01");
      expect(result?.name?.[0].period?.end).toBe("2015-12-31");
    });
  });

  describe("convertXCNArrayToPatients", () => {
    test("returns undefined for undefined input", () => {
      const result = convertXCNArrayToPatients(undefined);
      expect(result).toBeUndefined();
    });

    test("returns undefined for empty array", () => {
      const result = convertXCNArrayToPatients([]);
      expect(result).toBeUndefined();
    });

    test("converts multiple XCNs", () => {
      const xcns: XCN[] = [
        {
          $1_value: "111",
          $2_family: { $1_family: "First" },
        },
        {
          $1_value: "222",
          $2_family: { $1_family: "Second" },
        },
        {
          $1_value: "333",
          $2_family: { $1_family: "Third" },
        },
      ];

      const result = convertXCNArrayToPatients(xcns);

      expect(result).toBeDefined();
      expect(result).toHaveLength(3);
      expect(result?.[0].name?.[0].family).toBe("First");
      expect(result?.[1].name?.[0].family).toBe("Second");
      expect(result?.[2].name?.[0].family).toBe("Third");
    });

    test("filters out invalid XCNs", () => {
      const xcns: XCN[] = [
        {
          $1_value: "111",
          $2_family: { $1_family: "Valid" },
        },
        {}, // Invalid - empty
        {
          $1_value: "222",
          $2_family: { $1_family: "AlsoValid" },
        },
      ];

      const result = convertXCNArrayToPatients(xcns);

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(result?.[0].name?.[0].family).toBe("Valid");
      expect(result?.[1].name?.[0].family).toBe("AlsoValid");
    });

    test("returns undefined when all XCNs are invalid", () => {
      const xcns: XCN[] = [{}, {}, {}];

      const result = convertXCNArrayToPatients(xcns);

      expect(result).toBeUndefined();
    });
  });
});

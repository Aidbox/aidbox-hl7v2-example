import { test, expect, describe } from "bun:test";
import {
  convertXCNToAnnotationAuthor,
  convertXCNArrayToAnnotationAuthors,
} from "../../../src/v2-to-fhir/datatypes/xcn-annotation-author";
import type { XCN } from "../../../src/hl7v2/generated/fields";

describe("XCN[Annotation-Author] Converter", () => {
  describe("convertXCNToAnnotationAuthor", () => {
    test("returns undefined for undefined input", () => {
      const result = convertXCNToAnnotationAuthor(undefined, "Test text");
      expect(result).toBeUndefined();
    });

    test("returns undefined for empty XCN", () => {
      const xcn: XCN = {};
      const result = convertXCNToAnnotationAuthor(xcn, "Test text");
      expect(result).toBeUndefined();
    });

    test("converts basic XCN with ID and name", () => {
      const xcn: XCN = {
        $1_value: "12345",
        $2_family: { $1_family: "Smith" },
        $3_given: "John",
      };

      const result = convertXCNToAnnotationAuthor(xcn, "Test annotation");

      expect(result).toBeDefined();
      expect(result!.practitioner.resourceType).toBe("Practitioner");
      expect(result!.practitioner.id).toMatch(/^urn:uuid:/);
      expect(result!.practitioner.identifier).toBeDefined();
      expect(result!.practitioner.identifier![0]!.value).toBe("12345");
      expect(result!.practitioner.name).toBeDefined();
      expect(result!.practitioner.name![0]!.family).toBe("Smith");
      expect(result!.practitioner.name![0]!.given).toEqual(["John"]);

      expect(result!.annotation.text).toBe("Test annotation");
      expect(result!.annotation.authorReference).toBeDefined();
      expect(result!.annotation.authorReference!.reference).toBe(`Practitioner/${result!.practitionerId}`);
      expect(result!.annotation.authorReference!.display).toBe("John Smith");
    });

    test("converts XCN with full name components", () => {
      const xcn: XCN = {
        $1_value: "67890",
        $2_family: { $1_family: "Jones" },
        $3_given: "Mary",
        $4_additionalGiven: "Elizabeth",
        $5_suffix: "Jr",
        $6_prefix: "Dr",
        $21_credential: "MD",
      };

      const result = convertXCNToAnnotationAuthor(xcn, "Complex name test");

      expect(result).toBeDefined();
      expect(result!.practitioner.name![0]!.family).toBe("Jones");
      expect(result!.practitioner.name![0]!.given).toEqual(["Mary", "Elizabeth"]);
      expect(result!.practitioner.name![0]!.prefix).toEqual(["Dr"]);
      expect(result!.practitioner.name![0]!.suffix).toEqual(["Jr", "MD"]);

      expect(result!.annotation.authorReference!.display).toBe("Dr Mary Elizabeth Jones Jr MD");
    });

    test("converts XCN with identifier system and type", () => {
      const xcn: XCN = {
        $1_value: "ABC123",
        $2_family: { $1_family: "Brown" },
        $9_system: {
          $1_namespace: "http://hospital.example.org",
        },
        $13_type: "NPI",
      };

      const result = convertXCNToAnnotationAuthor(xcn, "Identifier test");

      expect(result).toBeDefined();
      expect(result!.practitioner.identifier![0]!.value).toBe("ABC123");
      expect(result!.practitioner.identifier![0]!.system).toBe("http://hospital.example.org");
      expect(result!.practitioner.identifier![0]!.type!.coding![0]!.code).toBe("NPI");
    });

    test("converts XCN with name use code", () => {
      const xcn: XCN = {
        $1_value: "999",
        $2_family: { $1_family: "Wilson" },
        $10_use: "L", // Legal Name
      };

      const result = convertXCNToAnnotationAuthor(xcn, "Name use test");

      expect(result).toBeDefined();
      expect(result!.practitioner.name![0]!.use).toBe("official");
    });

    test("converts XCN with name period (XCN.19, XCN.20)", () => {
      const xcn: XCN = {
        $1_value: "555",
        $2_family: { $1_family: "Taylor" },
        $19_start: "2020-01-01T00:00:00Z",
        $20_end: "2025-12-31T23:59:59Z",
      };

      const result = convertXCNToAnnotationAuthor(xcn, "Period test");

      expect(result).toBeDefined();
      expect(result!.practitioner.name![0]!.period!.start).toBe("2020-01-01T00:00:00Z");
      expect(result!.practitioner.name![0]!.period!.end).toBe("2025-12-31T23:59:59Z");
    });

    test("converts XCN with qualification", () => {
      const xcn: XCN = {
        $1_value: "777",
        $2_family: { $1_family: "Anderson" },
        $7_qualification: "MD",
      };

      const result = convertXCNToAnnotationAuthor(xcn, "Qualification test");

      expect(result).toBeDefined();
      expect(result!.practitioner.qualification).toBeDefined();
      expect(result!.practitioner.qualification![0]!.code.coding![0]!.code).toBe("MD");
    });

    test("includes timestamp in annotation", () => {
      const xcn: XCN = {
        $1_value: "888",
        $2_family: { $1_family: "Davis" },
      };

      const timestamp = "2024-01-15T10:30:00Z";
      const result = convertXCNToAnnotationAuthor(xcn, "Timestamped annotation", timestamp);

      expect(result).toBeDefined();
      expect(result!.annotation.time).toBe(timestamp);
    });

    test("annotation without timestamp", () => {
      const xcn: XCN = {
        $1_value: "999",
        $2_family: { $1_family: "Miller" },
      };

      const result = convertXCNToAnnotationAuthor(xcn, "No timestamp");

      expect(result).toBeDefined();
      expect(result!.annotation.time).toBeUndefined();
    });

    test("generates unique IDs for multiple conversions", () => {
      const xcn: XCN = {
        $1_value: "111",
        $2_family: { $1_family: "Clark" },
      };

      const result1 = convertXCNToAnnotationAuthor(xcn, "First");
      const result2 = convertXCNToAnnotationAuthor(xcn, "Second");

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1!.practitionerId).not.toBe(result2!.practitionerId);
      expect(result1!.practitioner.id).toBe(result1!.practitionerId);
      expect(result2!.practitioner.id).toBe(result2!.practitionerId);
    });

    test("authorReference matches practitioner ID", () => {
      const xcn: XCN = {
        $1_value: "222",
        $2_family: { $1_family: "Lewis" },
      };

      const result = convertXCNToAnnotationAuthor(xcn, "Reference test");

      expect(result).toBeDefined();
      expect(result!.annotation.authorReference!.reference).toBe(`Practitioner/${result!.practitioner.id}`);
      expect(result!.annotation.authorReference!.reference).toBe(`Practitioner/${result!.practitionerId}`);
    });

    test("handles XCN with only ID (no name)", () => {
      const xcn: XCN = {
        $1_value: "ONLY_ID",
      };

      const result = convertXCNToAnnotationAuthor(xcn, "ID only test");

      expect(result).toBeDefined();
      expect(result!.practitioner.identifier![0]!.value).toBe("ONLY_ID");
      expect(result!.practitioner.name).toBeUndefined();
      expect(result!.annotation.authorReference!.display).toBeUndefined();
    });

    test("handles XCN with only name (no ID)", () => {
      const xcn: XCN = {
        $2_family: { $1_family: "NameOnly" },
        $3_given: "Test",
      };

      const result = convertXCNToAnnotationAuthor(xcn, "Name only test");

      expect(result).toBeDefined();
      expect(result!.practitioner.identifier).toBeUndefined();
      expect(result!.practitioner.name![0]!.family).toBe("NameOnly");
      expect(result!.annotation.authorReference!.display).toBe("Test NameOnly");
    });
  });

  describe("convertXCNArrayToAnnotationAuthors", () => {
    test("returns undefined for undefined input", () => {
      const result = convertXCNArrayToAnnotationAuthors(undefined, "Test");
      expect(result).toBeUndefined();
    });

    test("returns undefined for empty array", () => {
      const result = convertXCNArrayToAnnotationAuthors([], "Test");
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

      const result = convertXCNArrayToAnnotationAuthors(xcns, "Multiple authors");

      expect(result).toBeDefined();
      expect(result!).toHaveLength(3);
      expect(result![0]!.practitioner.name![0]!.family).toBe("First");
      expect(result![1]!.practitioner.name![0]!.family).toBe("Second");
      expect(result![2]!.practitioner.name![0]!.family).toBe("Third");

      // Each should have unique IDs
      const ids = result!.map((r) => r.practitionerId);
      expect(new Set(ids).size).toBe(3);
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

      const result = convertXCNArrayToAnnotationAuthors(xcns, "Mixed validity");

      expect(result).toBeDefined();
      expect(result!).toHaveLength(2);
      expect(result![0]!.practitioner.name![0]!.family).toBe("Valid");
      expect(result![1]!.practitioner.name![0]!.family).toBe("AlsoValid");
    });

    test("returns undefined when all XCNs are invalid", () => {
      const xcns: XCN[] = [{}, {}, {}];

      const result = convertXCNArrayToAnnotationAuthors(xcns, "All invalid");

      expect(result).toBeUndefined();
    });

    test("applies timestamp to all annotations", () => {
      const xcns: XCN[] = [
        { $1_value: "111", $2_family: { $1_family: "A" } },
        { $1_value: "222", $2_family: { $1_family: "B" } },
      ];

      const timestamp = "2024-01-01T12:00:00Z";
      const result = convertXCNArrayToAnnotationAuthors(xcns, "Shared timestamp", timestamp);

      expect(result).toBeDefined();
      expect(result![0]!.annotation.time).toBe(timestamp);
      expect(result![1]!.annotation.time).toBe(timestamp);
    });
  });
});

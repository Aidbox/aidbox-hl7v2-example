import { test, expect, describe } from "bun:test";
import {
  convertXCNToRelatedPerson,
  convertXCNArrayToRelatedPersons,
} from "../../../src/v2-to-fhir/datatypes/xcn-related-person";

describe("convertXCNToRelatedPerson", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXCNToRelatedPerson(undefined)).toBeUndefined();
  });

  test("returns undefined for empty XCN", () => {
    expect(convertXCNToRelatedPerson({})).toBeUndefined();
  });

  test("converts XCN with identifier only", () => {
    const result = convertXCNToRelatedPerson({
      $1_value: "REL123",
    });
    expect(result?.resourceType).toBe("RelatedPerson");
    expect(result?.identifier?.[0]).toEqual({ value: "REL123" });
    expect(result?.patient).toEqual({ reference: "" });
  });

  test("converts XCN with family name only", () => {
    const result = convertXCNToRelatedPerson({
      $2_family: { $1_family: "Smith" },
    });
    expect(result?.resourceType).toBe("RelatedPerson");
    expect(result?.name?.[0]).toEqual({ family: "Smith" });
  });

  test("converts XCN with given name", () => {
    const result = convertXCNToRelatedPerson({
      $2_family: { $1_family: "Smith" },
      $3_given: "John",
    });
    expect(result?.name?.[0]).toEqual({
      family: "Smith",
      given: ["John"],
    });
  });

  test("converts XCN with additional given name", () => {
    const result = convertXCNToRelatedPerson({
      $2_family: { $1_family: "Smith" },
      $3_given: "John",
      $4_additionalGiven: "Michael",
    });
    expect(result?.name?.[0]).toEqual({
      family: "Smith",
      given: ["John", "Michael"],
    });
  });

  test("converts XCN with suffix", () => {
    const result = convertXCNToRelatedPerson({
      $2_family: { $1_family: "Smith" },
      $5_suffix: "Jr",
    });
    expect(result?.name?.[0]).toEqual({
      family: "Smith",
      suffix: ["Jr"],
    });
  });

  test("converts XCN with prefix", () => {
    const result = convertXCNToRelatedPerson({
      $2_family: { $1_family: "Smith" },
      $6_prefix: "Ms",
    });
    expect(result?.name?.[0]).toEqual({
      family: "Smith",
      prefix: ["Ms"],
    });
  });

  test("converts XCN with professional credential", () => {
    const result = convertXCNToRelatedPerson({
      $2_family: { $1_family: "Smith" },
      $21_credential: "RN",
    });
    expect(result?.name?.[0]).toEqual({
      family: "Smith",
      suffix: ["RN"],
    });
  });

  test("converts XCN with identifier system from HD", () => {
    const result = convertXCNToRelatedPerson({
      $1_value: "REL123",
      $9_system: { $1_namespace: "http://hospital.example.org" },
    });
    expect(result?.identifier?.[0]).toEqual({
      value: "REL123",
      system: "http://hospital.example.org",
    });
  });

  test("converts XCN with identifier type", () => {
    const result = convertXCNToRelatedPerson({
      $1_value: "REL123",
      $13_type: "MR",
    });
    expect(result?.identifier?.[0]).toEqual({
      value: "REL123",
      type: { coding: [{ code: "MR" }] },
    });
  });

  test("converts XCN.10 L to name.use official", () => {
    const result = convertXCNToRelatedPerson({
      $2_family: { $1_family: "Smith" },
      $10_use: "L",
    });
    expect(result?.name?.[0]?.use).toBe("official");
  });

  test("converts XCN.10 M to name.use maiden", () => {
    const result = convertXCNToRelatedPerson({
      $2_family: { $1_family: "Smith" },
      $10_use: "M",
    });
    expect(result?.name?.[0]?.use).toBe("maiden");
  });

  test("converts XCN with check digit extension", () => {
    const result = convertXCNToRelatedPerson({
      $1_value: "REL123",
      $11_checkDigit: "8",
    });
    expect(result?.identifier?.[0]?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/identifier-checkDigit",
      valueString: "8",
    });
  });

  test("converts XCN with name period from DR", () => {
    const result = convertXCNToRelatedPerson({
      $2_family: { $1_family: "Smith" },
      $17_period: {
        $1_start: "20200101",
        $2_end: "20251231",
      },
    });
    expect(result?.name?.[0]?.period).toEqual({
      start: "20200101",
      end: "20251231",
    });
  });

  test("converts full XCN with all fields", () => {
    const result = convertXCNToRelatedPerson({
      $1_value: "REL123",
      $2_family: { $1_family: "Smith" },
      $3_given: "Jane",
      $4_additionalGiven: "Mary",
      $5_suffix: "Jr",
      $6_prefix: "Ms",
      $9_system: { $1_namespace: "http://hospital.example.org" },
      $10_use: "L",
      $13_type: "MR",
      $19_start: "20200101",
      $21_credential: "RN",
    });

    expect(result?.resourceType).toBe("RelatedPerson");
    expect(result?.patient).toEqual({ reference: "" });
    expect(result?.identifier).toHaveLength(1);
    expect(result?.identifier?.[0].value).toBe("REL123");
    expect(result?.name).toHaveLength(1);
    expect(result?.name?.[0].family).toBe("Smith");
    expect(result?.name?.[0].given).toEqual(["Jane", "Mary"]);
    expect(result?.name?.[0].suffix).toEqual(["Jr", "RN"]);
  });
});

describe("convertXCNArrayToRelatedPersons", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXCNArrayToRelatedPersons(undefined)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(convertXCNArrayToRelatedPersons([])).toBeUndefined();
  });

  test("converts array of XCN", () => {
    const result = convertXCNArrayToRelatedPersons([
      { $1_value: "REL1", $2_family: { $1_family: "Smith" } },
      { $1_value: "REL2", $2_family: { $1_family: "Jones" } },
    ]);

    expect(result).toHaveLength(2);
    expect(result?.[0].identifier?.[0].value).toBe("REL1");
    expect(result?.[1].identifier?.[0].value).toBe("REL2");
  });

  test("filters out invalid related persons", () => {
    const result = convertXCNArrayToRelatedPersons([
      { $1_value: "REL1" },
      {},
      { $2_family: { $1_family: "Jones" } },
    ]);

    expect(result).toHaveLength(2);
  });
});

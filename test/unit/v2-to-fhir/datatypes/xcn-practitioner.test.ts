import { test, expect, describe } from "bun:test";
import {
  convertXCNToPractitioner,
  convertXCNArrayToPractitioners,
} from "../../../../src/v2-to-fhir/datatypes/xcn-practitioner";

describe("convertXCNToPractitioner", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXCNToPractitioner(undefined)).toBeUndefined();
  });

  test("returns undefined for empty XCN", () => {
    expect(convertXCNToPractitioner({})).toBeUndefined();
  });

  test("converts XCN with identifier only", () => {
    const result = convertXCNToPractitioner({
      $1_value: "12345",
    });
    expect(result).toEqual({
      resourceType: "Practitioner",
      identifier: [{ value: "12345" }],
    });
  });

  test("converts XCN with family name only", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
    });
    expect(result).toEqual({
      resourceType: "Practitioner",
      name: [{ family: "Smith" }],
    });
  });

  test("converts XCN with given name", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $3_given: "John",
    });
    expect(result).toEqual({
      resourceType: "Practitioner",
      name: [{ family: "Smith", given: ["John"] }],
    });
  });

  test("converts XCN with additional given name", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $3_given: "John",
      $4_additionalGiven: "Michael",
    });
    expect(result).toEqual({
      resourceType: "Practitioner",
      name: [{ family: "Smith", given: ["John", "Michael"] }],
    });
  });

  test("converts XCN with suffix", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $5_suffix: "Jr",
    });
    expect(result).toEqual({
      resourceType: "Practitioner",
      name: [{ family: "Smith", suffix: ["Jr"] }],
    });
  });

  test("converts XCN with prefix", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $6_prefix: "Dr",
    });
    expect(result).toEqual({
      resourceType: "Practitioner",
      name: [{ family: "Smith", prefix: ["Dr"] }],
    });
  });

  test("converts XCN with professional suffix", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $21_credential: "MD",
    });
    expect(result).toEqual({
      resourceType: "Practitioner",
      name: [{ family: "Smith", suffix: ["MD"] }],
    });
  });

  test("converts XCN with suffix and professional suffix", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $5_suffix: "Jr",
      $21_credential: "MD",
    });
    expect(result).toEqual({
      resourceType: "Practitioner",
      name: [{ family: "Smith", suffix: ["Jr", "MD"] }],
    });
  });

  test("converts XCN with qualification from degree", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $7_qualification: "MD",
    });
    expect(result?.qualification).toEqual([
      {
        code: {
          coding: [{ code: "MD" }],
        },
      },
    ]);
  });

  test("converts XCN with identifier system from HD", () => {
    const result = convertXCNToPractitioner({
      $1_value: "12345",
      $9_system: { $1_namespace: "http://hospital.example.org" },
    });
    expect(result?.identifier?.[0]).toEqual({
      value: "12345",
      system: "http://hospital.example.org",
    });
  });

  test("converts XCN with identifier type", () => {
    const result = convertXCNToPractitioner({
      $1_value: "12345",
      $13_type: "NPI",
    });
    expect(result?.identifier?.[0]).toEqual({
      value: "12345",
      type: {
        coding: [{ code: "NPI" }],
      },
    });
  });

  test("converts XCN with check digit extension", () => {
    const result = convertXCNToPractitioner({
      $1_value: "12345",
      $11_checkDigit: "9",
    });
    expect(result?.identifier?.[0]?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/identifier-checkDigit",
      valueString: "9",
    });
  });

  test("converts XCN with check digit scheme extension", () => {
    const result = convertXCNToPractitioner({
      $1_value: "12345",
      $12_checkDigitScheme: "M10",
    });
    expect(result?.identifier?.[0]?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/namingsystem-checkDigit",
      valueString: "M10",
    });
  });

  test("converts XCN.10 L to name.use official", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $10_use: "L",
    });
    expect(result?.name?.[0]?.use).toBe("official");
  });

  test("converts XCN.10 N to name.use nickname", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $10_use: "N",
    });
    expect(result?.name?.[0]?.use).toBe("nickname");
  });

  test("converts XCN.10 M to name.use maiden", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $10_use: "M",
    });
    expect(result?.name?.[0]?.use).toBe("maiden");
  });

  test("converts XCN with name period from DR", () => {
    const result = convertXCNToPractitioner({
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

  test("converts XCN with explicit start/end dates overriding DR", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $17_period: {
        $1_start: "20200101",
        $2_end: "20201231",
      },
      $19_start: "20210101",
      $20_end: "20261231",
    });
    expect(result?.name?.[0]?.period).toEqual({
      start: "20210101",
      end: "20261231",
    });
  });

  test("converts XCN with name assembly order extension", () => {
    const result = convertXCNToPractitioner({
      $2_family: { $1_family: "Smith" },
      $18_order: "F",
    });
    expect(result?.name?.[0]?.extension).toContainEqual({
      url: "http://hl7.org/fhir/R4/extension-humanname-assembly-order.html",
      valueCode: "F",
    });
  });

  test("converts full XCN with all fields", () => {
    const result = convertXCNToPractitioner({
      $1_value: "NPI123456",
      $2_family: { $1_family: "Smith" },
      $3_given: "John",
      $4_additionalGiven: "Michael",
      $5_suffix: "III",
      $6_prefix: "Dr",
      $7_qualification: "MD",
      $9_system: { $1_namespace: "http://hl7.org/fhir/sid/us-npi" },
      $10_use: "L",
      $13_type: "NPI",
      $19_start: "20200101",
      $21_credential: "FACP",
    });

    expect(result).toEqual({
      resourceType: "Practitioner",
      identifier: [
        {
          value: "NPI123456",
          system: "http://hl7.org/fhir/sid/us-npi",
          type: { coding: [{ code: "NPI" }] },
        },
      ],
      name: [
        {
          family: "Smith",
          given: ["John", "Michael"],
          prefix: ["Dr"],
          suffix: ["III", "FACP"],
          use: "official",
          period: { start: "20200101" },
        },
      ],
      qualification: [
        {
          code: { coding: [{ code: "MD" }] },
        },
      ],
    });
  });
});

describe("convertXCNArrayToPractitioners", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXCNArrayToPractitioners(undefined)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(convertXCNArrayToPractitioners([])).toBeUndefined();
  });

  test("converts array of XCN", () => {
    const result = convertXCNArrayToPractitioners([
      { $1_value: "12345", $2_family: { $1_family: "Smith" } },
      { $1_value: "67890", $2_family: { $1_family: "Jones" } },
    ]);

    expect(result).toHaveLength(2);
    expect(result?.[0]!.identifier?.[0]!.value).toBe("12345");
    expect(result?.[0]!.name?.[0]!.family).toBe("Smith");
    expect(result?.[1]!.identifier?.[0]!.value).toBe("67890");
    expect(result?.[1]!.name?.[0]!.family).toBe("Jones");
  });

  test("filters out invalid practitioners", () => {
    const result = convertXCNArrayToPractitioners([
      { $1_value: "12345" },
      {},
      { $2_family: { $1_family: "Jones" } },
    ]);

    expect(result).toHaveLength(2);
  });
});

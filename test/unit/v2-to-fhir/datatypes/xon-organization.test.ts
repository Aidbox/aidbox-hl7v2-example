import { test, expect, describe } from "bun:test";
import {
  convertXONToOrganization,
  convertXONArrayToOrganizations,
  convertXONToString,
} from "../../../../src/v2-to-fhir/datatypes/xon-organization";

describe("convertXONToOrganization", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXONToOrganization(undefined)).toBeUndefined();
  });

  test("returns undefined for empty XON", () => {
    expect(convertXONToOrganization({})).toBeUndefined();
  });

  test("converts XON with name only", () => {
    const result = convertXONToOrganization({
      $1_name: "General Hospital",
    });
    expect(result).toEqual({
      resourceType: "Organization",
      name: "General Hospital",
    });
  });

  test("converts XON with organization identifier (XON.10)", () => {
    const result = convertXONToOrganization({
      $1_name: "General Hospital",
      $10_organizationId: "ORG123",
    });
    expect(result).toEqual({
      resourceType: "Organization",
      name: "General Hospital",
      identifier: [{ value: "ORG123" }],
    });
  });

  test("converts XON with ID number (XON.3) when XON.10 not valued", () => {
    const result = convertXONToOrganization({
      $1_name: "General Hospital",
      $3_value: "12345",
    });
    expect(result).toEqual({
      resourceType: "Organization",
      name: "General Hospital",
      identifier: [{ value: "12345" }],
    });
  });

  test("XON.10 takes precedence over XON.3", () => {
    const result = convertXONToOrganization({
      $1_name: "General Hospital",
      $3_value: "12345",
      $10_organizationId: "ORG123",
    });
    expect(result?.identifier?.[0].value).toBe("ORG123");
  });

  test("converts XON with identifier system from HD", () => {
    const result = convertXONToOrganization({
      $1_name: "General Hospital",
      $10_organizationId: "ORG123",
      $6_system: { $1_namespace: "http://hospital.example.org" },
    });
    expect(result?.identifier?.[0]).toEqual({
      value: "ORG123",
      system: "http://hospital.example.org",
    });
  });

  test("converts XON with identifier type", () => {
    const result = convertXONToOrganization({
      $1_name: "General Hospital",
      $10_organizationId: "ORG123",
      $7_type: "NPI",
    });
    expect(result?.identifier?.[0]).toEqual({
      value: "ORG123",
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "NPI",
          },
        ],
      },
    });
  });

  test("converts XON with check digit extension", () => {
    const result = convertXONToOrganization({
      $1_name: "General Hospital",
      $10_organizationId: "ORG123",
      $4_checkDigit: "9",
    });
    expect(result?.identifier?.[0]?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/identifier-checkDigit",
      valueString: "9",
    });
  });

  test("converts XON with check digit scheme extension", () => {
    const result = convertXONToOrganization({
      $1_name: "General Hospital",
      $10_organizationId: "ORG123",
      $5_checkDigitScheme: "M10",
    });
    expect(result?.identifier?.[0]?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/namingsystem-checkDigit",
      valueString: "M10",
    });
  });

  test("converts XON with name type extension", () => {
    const result = convertXONToOrganization({
      $1_name: "General Hospital",
      $2_nameType: "L",
    });
    expect(result?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/organization-nameType",
      valueCoding: { code: "L" },
    });
  });

  test("converts XON with identifier only (no name)", () => {
    const result = convertXONToOrganization({
      $10_organizationId: "ORG123",
    });
    expect(result).toEqual({
      resourceType: "Organization",
      identifier: [{ value: "ORG123" }],
    });
  });

  test("converts full XON with all fields", () => {
    const result = convertXONToOrganization({
      $1_name: "General Hospital",
      $2_nameType: "L",
      $4_checkDigit: "9",
      $5_checkDigitScheme: "M10",
      $6_system: { $1_namespace: "http://hospital.example.org" },
      $7_type: "NPI",
      $10_organizationId: "NPI1234567890",
    });

    expect(result).toEqual({
      resourceType: "Organization",
      name: "General Hospital",
      identifier: [
        {
          value: "NPI1234567890",
          system: "http://hospital.example.org",
          type: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                code: "NPI",
              },
            ],
          },
          extension: [
            {
              url: "http://hl7.org/fhir/StructureDefinition/identifier-checkDigit",
              valueString: "9",
            },
            {
              url: "http://hl7.org/fhir/StructureDefinition/namingsystem-checkDigit",
              valueString: "M10",
            },
          ],
        },
      ],
      extension: [
        {
          url: "http://hl7.org/fhir/StructureDefinition/organization-nameType",
          valueCoding: { code: "L" },
        },
      ],
    });
  });
});

describe("convertXONArrayToOrganizations", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXONArrayToOrganizations(undefined)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(convertXONArrayToOrganizations([])).toBeUndefined();
  });

  test("converts array of XON", () => {
    const result = convertXONArrayToOrganizations([
      { $1_name: "Hospital A", $10_organizationId: "ORG1" },
      { $1_name: "Hospital B", $10_organizationId: "ORG2" },
    ]);

    expect(result).toHaveLength(2);
    expect(result?.[0].name).toBe("Hospital A");
    expect(result?.[1].name).toBe("Hospital B");
  });

  test("filters out invalid organizations", () => {
    const result = convertXONArrayToOrganizations([
      { $1_name: "Hospital A" },
      {},
      { $1_name: "Hospital B" },
    ]);

    expect(result).toHaveLength(2);
  });
});

describe("convertXONToString", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXONToString(undefined)).toBeUndefined();
  });

  test("returns undefined for XON without name", () => {
    expect(convertXONToString({})).toBeUndefined();
  });

  test("returns organization name", () => {
    expect(convertXONToString({ $1_name: "General Hospital" })).toBe(
      "General Hospital"
    );
  });
});

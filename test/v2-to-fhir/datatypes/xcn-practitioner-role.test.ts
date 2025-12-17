import { test, expect, describe } from "bun:test";
import {
  convertXCNToPractitionerRole,
  convertXCNArrayToPractitionerRoles,
} from "../../../src/v2-to-fhir/datatypes/xcn-practitioner-role";

describe("convertXCNToPractitionerRole", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXCNToPractitionerRole(undefined)).toBeUndefined();
  });

  test("returns undefined for empty XCN", () => {
    expect(convertXCNToPractitionerRole({})).toBeUndefined();
  });

  test("returns undefined for XCN without identifier", () => {
    expect(convertXCNToPractitionerRole({ $2_family: { $1_family: "Smith" } })).toBeUndefined();
  });

  test("converts XCN with identifier only", () => {
    const result = convertXCNToPractitionerRole({
      $1_value: "PR12345",
    });
    expect(result).toEqual({
      resourceType: "PractitionerRole",
      identifier: [{ value: "PR12345" }],
    });
  });

  test("converts XCN with identifier system from HD", () => {
    const result = convertXCNToPractitionerRole({
      $1_value: "PR12345",
      $9_system: { $1_namespace: "http://hospital.example.org" },
    });
    expect(result?.identifier?.[0]).toEqual({
      value: "PR12345",
      system: "http://hospital.example.org",
    });
  });

  test("converts XCN with identifier type", () => {
    const result = convertXCNToPractitionerRole({
      $1_value: "PR12345",
      $13_type: "NPI",
    });
    expect(result?.identifier?.[0]).toEqual({
      value: "PR12345",
      type: {
        coding: [{ code: "NPI" }],
      },
    });
  });

  test("converts XCN with check digit extension", () => {
    const result = convertXCNToPractitionerRole({
      $1_value: "PR12345",
      $11_checkDigit: "7",
    });
    expect(result?.identifier?.[0]?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/identifier-checkDigit",
      valueString: "7",
    });
  });

  test("converts XCN with check digit scheme extension", () => {
    const result = convertXCNToPractitionerRole({
      $1_value: "PR12345",
      $12_checkDigitScheme: "M11",
    });
    expect(result?.identifier?.[0]?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/namingsystem-checkDigit",
      valueString: "M11",
    });
  });

  test("converts full XCN with all identifier fields", () => {
    const result = convertXCNToPractitionerRole({
      $1_value: "NPI9876543210",
      $9_system: { $1_namespace: "http://hl7.org/fhir/sid/us-npi" },
      $11_checkDigit: "5",
      $12_checkDigitScheme: "ISO",
      $13_type: "NPI",
    });

    expect(result).toEqual({
      resourceType: "PractitionerRole",
      identifier: [
        {
          value: "NPI9876543210",
          system: "http://hl7.org/fhir/sid/us-npi",
          type: { coding: [{ code: "NPI" }] },
          extension: [
            {
              url: "http://hl7.org/fhir/StructureDefinition/identifier-checkDigit",
              valueString: "5",
            },
            {
              url: "http://hl7.org/fhir/StructureDefinition/namingsystem-checkDigit",
              valueString: "ISO",
            },
          ],
        },
      ],
    });
  });
});

describe("convertXCNArrayToPractitionerRoles", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXCNArrayToPractitionerRoles(undefined)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(convertXCNArrayToPractitionerRoles([])).toBeUndefined();
  });

  test("converts array of XCN", () => {
    const result = convertXCNArrayToPractitionerRoles([
      { $1_value: "PR12345", $13_type: "NPI" },
      { $1_value: "PR67890", $13_type: "DEA" },
    ]);

    expect(result).toHaveLength(2);
    expect(result?.[0].identifier?.[0].value).toBe("PR12345");
    expect(result?.[1].identifier?.[0].value).toBe("PR67890");
  });

  test("filters out invalid practitioner roles", () => {
    const result = convertXCNArrayToPractitionerRoles([
      { $1_value: "PR12345" },
      {},
      { $1_value: "PR67890" },
    ]);

    expect(result).toHaveLength(2);
  });
});

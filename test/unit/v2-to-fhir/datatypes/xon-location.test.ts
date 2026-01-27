import { test, expect, describe } from "bun:test";
import {
  convertXONToLocation,
  convertXONArrayToLocations,
} from "../../../../src/v2-to-fhir/datatypes/xon-location";

describe("convertXONToLocation", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXONToLocation(undefined)).toBeUndefined();
  });

  test("returns undefined for empty XON", () => {
    expect(convertXONToLocation({})).toBeUndefined();
  });

  test("converts XON with name only", () => {
    const result = convertXONToLocation({
      $1_name: "Hospital Main",
    });
    expect(result).toEqual({
      resourceType: "Location",
      name: "Hospital Main",
    });
  });

  test("converts XON with organization identifier (XON.10)", () => {
    const result = convertXONToLocation({
      $1_name: "Hospital Main",
      $10_organizationId: "LOC123",
    });
    expect(result).toEqual({
      resourceType: "Location",
      name: "Hospital Main",
      identifier: [{ value: "LOC123" }],
    });
  });

  test("converts XON with ID number (XON.3) when XON.10 not valued", () => {
    const result = convertXONToLocation({
      $1_name: "Hospital Main",
      $3_value: "12345",
    });
    expect(result).toEqual({
      resourceType: "Location",
      name: "Hospital Main",
      identifier: [{ value: "12345" }],
    });
  });

  test("XON.10 takes precedence over XON.3", () => {
    const result = convertXONToLocation({
      $1_name: "Hospital Main",
      $3_value: "12345",
      $10_organizationId: "LOC123",
    });
    expect(result?.identifier?.[0]!.value).toBe("LOC123");
  });

  test("converts XON with identifier system from HD", () => {
    const result = convertXONToLocation({
      $1_name: "Hospital Main",
      $10_organizationId: "LOC123",
      $6_system: { $1_namespace: "http://hospital.example.org/locations" },
    });
    expect(result?.identifier?.[0]).toEqual({
      value: "LOC123",
      system: "http://hospital.example.org/locations",
    });
  });

  test("converts XON with identifier type", () => {
    const result = convertXONToLocation({
      $1_name: "Hospital Main",
      $10_organizationId: "LOC123",
      $7_type: "PIN",
    });
    expect(result?.identifier?.[0]).toEqual({
      value: "LOC123",
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "PIN",
          },
        ],
      },
    });
  });

  test("converts XON with check digit extension", () => {
    const result = convertXONToLocation({
      $1_name: "Hospital Main",
      $10_organizationId: "LOC123",
      $4_checkDigit: "5",
    });
    expect(result?.identifier?.[0]?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/identifier-checkDigit",
      valueString: "5",
    });
  });

  test("converts XON with check digit scheme extension", () => {
    const result = convertXONToLocation({
      $1_name: "Hospital Main",
      $10_organizationId: "LOC123",
      $5_checkDigitScheme: "ISO",
    });
    expect(result?.identifier?.[0]?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/namingsystem-checkDigit",
      valueString: "ISO",
    });
  });

  test("converts XON with name type extension", () => {
    const result = convertXONToLocation({
      $1_name: "Hospital Main",
      $2_nameType: "A",
    });
    expect(result?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/location-nameType",
      valueCoding: { code: "A" },
    });
  });

  test("converts XON with identifier only (no name)", () => {
    const result = convertXONToLocation({
      $10_organizationId: "LOC123",
    });
    expect(result).toEqual({
      resourceType: "Location",
      identifier: [{ value: "LOC123" }],
    });
  });

  test("converts full XON with all fields", () => {
    const result = convertXONToLocation({
      $1_name: "Hospital Main",
      $2_nameType: "L",
      $4_checkDigit: "5",
      $5_checkDigitScheme: "ISO",
      $6_system: { $1_namespace: "http://hospital.example.org" },
      $7_type: "PIN",
      $10_organizationId: "PIN1234567890",
    });

    expect(result).toEqual({
      resourceType: "Location",
      name: "Hospital Main",
      identifier: [
        {
          value: "PIN1234567890",
          system: "http://hospital.example.org",
          type: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                code: "PIN",
              },
            ],
          },
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
      extension: [
        {
          url: "http://hl7.org/fhir/StructureDefinition/location-nameType",
          valueCoding: { code: "L" },
        },
      ],
    });
  });
});

describe("convertXONArrayToLocations", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXONArrayToLocations(undefined)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(convertXONArrayToLocations([])).toBeUndefined();
  });

  test("converts array of XON", () => {
    const result = convertXONArrayToLocations([
      { $1_name: "Hospital A", $10_organizationId: "LOC1" },
      { $1_name: "Hospital B", $10_organizationId: "LOC2" },
    ]);

    expect(result).toHaveLength(2);
    expect(result?.[0]!.name).toBe("Hospital A");
    expect(result?.[1]!.name).toBe("Hospital B");
  });

  test("filters out invalid locations", () => {
    const result = convertXONArrayToLocations([
      { $1_name: "Hospital A" },
      {},
      { $1_name: "Hospital B" },
    ]);

    expect(result).toHaveLength(2);
  });
});

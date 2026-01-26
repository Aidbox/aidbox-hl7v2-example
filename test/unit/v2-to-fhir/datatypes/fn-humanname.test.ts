import { test, expect, describe } from "bun:test";
import { convertFNToHumanName } from "../../../../src/v2-to-fhir/datatypes/fn-humanname";

describe("convertFNToHumanName", () => {
  test("returns undefined for undefined input", () => {
    expect(convertFNToHumanName(undefined)).toBeUndefined();
  });

  test("returns undefined for empty FN", () => {
    expect(convertFNToHumanName({})).toBeUndefined();
  });

  test("converts simple family name", () => {
    const result = convertFNToHumanName({
      $1_family: "Smith",
    });
    expect(result).toEqual({
      family: "Smith",
    });
  });

  test("converts family name with own surname prefix extension", () => {
    const result = convertFNToHumanName({
      $1_family: "van Berg",
      $2_ownPrefix: "van",
    });
    expect(result).toEqual({
      family: "van Berg",
      _family: {
        extension: [
          {
            url: "http://hl7.org/fhir/StructureDefinition/humanname-own-prefix",
            valueString: "van",
          },
        ],
      },
    });
  });

  test("converts family name with own surname extension", () => {
    const result = convertFNToHumanName({
      $1_family: "van Berg",
      $3_ownFamily: "Berg",
    });
    expect(result).toEqual({
      family: "van Berg",
      _family: {
        extension: [
          {
            url: "http://hl7.org/fhir/StructureDefinition/humanname-own-name",
            valueString: "Berg",
          },
        ],
      },
    });
  });

  test("converts family name with partner prefix extension", () => {
    const result = convertFNToHumanName({
      $1_family: "Smith-Jones",
      $4_partnerPrefix: "de",
    });
    expect(result).toEqual({
      family: "Smith-Jones",
      _family: {
        extension: [
          {
            url: "http://hl7.org/fhir/StructureDefinition/humanname-partner-prefix",
            valueString: "de",
          },
        ],
      },
    });
  });

  test("converts family name with partner name extension", () => {
    const result = convertFNToHumanName({
      $1_family: "Smith-Jones",
      $5_partnerFamily: "Jones",
    });
    expect(result).toEqual({
      family: "Smith-Jones",
      _family: {
        extension: [
          {
            url: "http://hl7.org/fhir/StructureDefinition/humanname-partner-name",
            valueString: "Jones",
          },
        ],
      },
    });
  });

  test("converts full family name with all extensions", () => {
    const result = convertFNToHumanName({
      $1_family: "van Berg-de Jong",
      $2_ownPrefix: "van",
      $3_ownFamily: "Berg",
      $4_partnerPrefix: "de",
      $5_partnerFamily: "Jong",
    });
    expect(result).toEqual({
      family: "van Berg-de Jong",
      _family: {
        extension: [
          {
            url: "http://hl7.org/fhir/StructureDefinition/humanname-own-prefix",
            valueString: "van",
          },
          {
            url: "http://hl7.org/fhir/StructureDefinition/humanname-own-name",
            valueString: "Berg",
          },
          {
            url: "http://hl7.org/fhir/StructureDefinition/humanname-partner-prefix",
            valueString: "de",
          },
          {
            url: "http://hl7.org/fhir/StructureDefinition/humanname-partner-name",
            valueString: "Jong",
          },
        ],
      },
    });
  });

  test("does not add _family when no extensions present", () => {
    const result = convertFNToHumanName({
      $1_family: "Smith",
    });
    expect(result?._family).toBeUndefined();
  });
});

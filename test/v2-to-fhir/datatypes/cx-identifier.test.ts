import { test, expect, describe } from "bun:test";
import { convertCXToIdentifier } from "../../../src/v2-to-fhir/datatypes/cx-identifier";

describe("convertCXToIdentifier", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCXToIdentifier(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CX", () => {
    expect(convertCXToIdentifier({})).toBeUndefined();
  });

  test("returns undefined when value is missing", () => {
    expect(convertCXToIdentifier({ $5_type: "MR" })).toBeUndefined();
  });

  test("converts simple identifier with value only", () => {
    const result = convertCXToIdentifier({
      $1_value: "12345",
    });
    expect(result).toEqual({
      value: "12345",
    });
  });

  test("converts identifier with system from HD universal ID", () => {
    const result = convertCXToIdentifier({
      $1_value: "12345",
      $4_system: {
        $1_namespace: "Hospital",
        $2_system: "urn:oid:2.16.840.1.113883.19.5",
      },
    });
    expect(result).toEqual({
      value: "12345",
      system: "urn:oid:2.16.840.1.113883.19.5",
    });
  });

  test("converts identifier with system from HD namespace when universal ID missing", () => {
    const result = convertCXToIdentifier({
      $1_value: "12345",
      $4_system: {
        $1_namespace: "HOSPITAL",
      },
    });
    expect(result).toEqual({
      value: "12345",
      system: "HOSPITAL",
    });
  });

  test("converts identifier with type code", () => {
    const result = convertCXToIdentifier({
      $1_value: "12345",
      $5_type: "MR",
    });
    expect(result).toEqual({
      value: "12345",
      type: {
        coding: [{ code: "MR" }],
      },
    });
  });

  test("converts identifier with period start and end", () => {
    const result = convertCXToIdentifier({
      $1_value: "12345",
      $7_start: "20200101",
      $8_end: "20251231",
    });
    expect(result).toEqual({
      value: "12345",
      period: {
        start: "20200101",
        end: "20251231",
      },
    });
  });

  test("converts identifier with period start only", () => {
    const result = convertCXToIdentifier({
      $1_value: "12345",
      $7_start: "20200101",
    });
    expect(result).toEqual({
      value: "12345",
      period: {
        start: "20200101",
      },
    });
  });

  test("converts full identifier with all mapped fields", () => {
    const result = convertCXToIdentifier({
      $1_value: "MRN123456",
      $4_system: {
        $1_namespace: "Hospital",
        $2_system: "http://hospital.example.org/mrn",
      },
      $5_type: "MR",
      $7_start: "20200101",
      $8_end: "20301231",
    });
    expect(result).toEqual({
      value: "MRN123456",
      system: "http://hospital.example.org/mrn",
      type: {
        coding: [{ code: "MR" }],
      },
      period: {
        start: "20200101",
        end: "20301231",
      },
    });
  });
});

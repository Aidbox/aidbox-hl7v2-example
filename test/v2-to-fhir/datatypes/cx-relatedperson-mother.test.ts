import { test, expect, describe } from "bun:test";
import { convertCXToRelatedPersonMother } from "../../../src/v2-to-fhir/datatypes/cx-relatedperson-mother";

describe("convertCXToRelatedPersonMother", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCXToRelatedPersonMother(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CX", () => {
    expect(convertCXToRelatedPersonMother({})).toBeUndefined();
  });

  test("returns undefined when value is missing", () => {
    expect(convertCXToRelatedPersonMother({ $5_type: "MR" })).toBeUndefined();
  });

  test("converts simple identifier with mother relationship", () => {
    const result = convertCXToRelatedPersonMother({
      $1_value: "MOTHER123",
    });
    expect(result).toEqual({
      identifier: {
        value: "MOTHER123",
      },
      relationship: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
            code: "MTH",
          },
        ],
      },
    });
  });

  test("converts identifier with system from HD universal ID", () => {
    const result = convertCXToRelatedPersonMother({
      $1_value: "MOTHER123",
      $4_system: {
        $1_namespace: "Hospital",
        $2_system: "urn:oid:2.16.840.1.113883.19.5",
      },
    });
    expect(result?.identifier).toEqual({
      value: "MOTHER123",
      system: "urn:oid:2.16.840.1.113883.19.5",
    });
  });

  test("converts identifier with type code", () => {
    const result = convertCXToRelatedPersonMother({
      $1_value: "MOTHER123",
      $5_type: "SS",
    });
    expect(result?.identifier).toEqual({
      value: "MOTHER123",
      type: {
        coding: [{ code: "SS" }],
      },
    });
  });

  test("converts identifier with period", () => {
    const result = convertCXToRelatedPersonMother({
      $1_value: "MOTHER123",
      $7_start: "19800101",
      $8_end: "20501231",
    });
    expect(result?.identifier).toEqual({
      value: "MOTHER123",
      period: {
        start: "19800101",
        end: "20501231",
      },
    });
  });

  test("always includes mother relationship code", () => {
    const result = convertCXToRelatedPersonMother({
      $1_value: "ANY",
    });
    expect(result?.relationship).toEqual({
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
          code: "MTH",
        },
      ],
    });
  });

  test("converts full identifier with all mapped fields", () => {
    const result = convertCXToRelatedPersonMother({
      $1_value: "SSN123456789",
      $4_system: {
        $2_system: "http://hl7.org/fhir/sid/us-ssn",
      },
      $5_type: "SS",
      $7_start: "19800101",
    });
    expect(result).toEqual({
      identifier: {
        value: "SSN123456789",
        system: "http://hl7.org/fhir/sid/us-ssn",
        type: {
          coding: [{ code: "SS" }],
        },
        period: {
          start: "19800101",
        },
      },
      relationship: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
            code: "MTH",
          },
        ],
      },
    });
  });
});

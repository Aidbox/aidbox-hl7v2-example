import { test, expect, describe } from "bun:test";
import { convertDLNToIdentifier } from "../../../src/v2-to-fhir/datatypes/dln-identifier";

describe("convertDLNToIdentifier", () => {
  test("returns undefined for undefined input", () => {
    expect(convertDLNToIdentifier(undefined)).toBeUndefined();
  });

  test("returns undefined for empty DLN", () => {
    expect(convertDLNToIdentifier({})).toBeUndefined();
  });

  test("returns undefined when license number is missing", () => {
    expect(convertDLNToIdentifier({ $2_issuingAuthority: "CA" })).toBeUndefined();
  });

  test("converts simple license number with DL type", () => {
    const result = convertDLNToIdentifier({
      $1_license: "D1234567",
    });
    expect(result).toEqual({
      value: "D1234567",
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "DL",
          },
        ],
      },
    });
  });

  test("converts license with issuing authority as system", () => {
    const result = convertDLNToIdentifier({
      $1_license: "D1234567",
      $2_issuingAuthority: "CA",
    });
    expect(result).toEqual({
      value: "D1234567",
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "DL",
          },
        ],
      },
      system: "CA",
    });
  });

  test("converts license with expiration date", () => {
    const result = convertDLNToIdentifier({
      $1_license: "D1234567",
      $3_end: "20251231",
    });
    expect(result).toEqual({
      value: "D1234567",
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "DL",
          },
        ],
      },
      period: {
        end: "20251231",
      },
    });
  });

  test("converts full license with all fields", () => {
    const result = convertDLNToIdentifier({
      $1_license: "A9876543",
      $2_issuingAuthority: "NY",
      $3_end: "20301231",
    });
    expect(result).toEqual({
      value: "A9876543",
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "DL",
          },
        ],
      },
      system: "NY",
      period: {
        end: "20301231",
      },
    });
  });
});

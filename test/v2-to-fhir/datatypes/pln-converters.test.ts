import { test, expect, describe } from "bun:test";
import { convertPLNToIdentifier } from "../../../src/v2-to-fhir/datatypes/pln-converters";

describe("convertPLNToIdentifier", () => {
  test("returns undefined for undefined input", () => {
    expect(convertPLNToIdentifier(undefined)).toBeUndefined();
  });

  test("returns undefined when no ID number", () => {
    expect(convertPLNToIdentifier({})).toBeUndefined();
  });

  test("returns identifier with value only", () => {
    const result = convertPLNToIdentifier({
      $1_idNumber: "12345",
    });
    expect(result).toEqual({
      value: "12345",
    });
  });

  test("returns identifier with type", () => {
    const result = convertPLNToIdentifier({
      $1_idNumber: "MD123",
      $2_idType: { $1_code: "MD" },
    });
    expect(result?.value).toBe("MD123");
    expect(result?.type?.coding?.[0]?.code).toBe("MD");
  });

  test("returns identifier with state qualifier extension", () => {
    const result = convertPLNToIdentifier({
      $1_idNumber: "12345",
      $3_stateQualifier: "CA",
    });
    expect(result?.value).toBe("12345");
    expect(result?.extension).toHaveLength(1);
    expect(result?.extension?.[0]?.url).toBe("http://hl7.org/fhir/StructureDefinition/identifier-state-qualifier");
    expect(result?.extension?.[0]?.valueString).toBe("CA");
  });

  test("returns identifier with expiration date", () => {
    const result = convertPLNToIdentifier({
      $1_idNumber: "12345",
      $4_expirationDate: "20251231",
    });
    expect(result?.value).toBe("12345");
    expect(result?.period?.end).toBe("20251231");
  });

  test("returns full identifier with all fields", () => {
    const result = convertPLNToIdentifier({
      $1_idNumber: "ABC123",
      $2_idType: { $1_code: "NPI" },
      $3_stateQualifier: "NY",
      $4_expirationDate: "20301231",
    });
    expect(result?.value).toBe("ABC123");
    expect(result?.type?.coding?.[0]?.code).toBe("NPI");
    expect(result?.extension?.[0]?.valueString).toBe("NY");
    expect(result?.period?.end).toBe("20301231");
  });
});

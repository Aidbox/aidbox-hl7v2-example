import { test, expect, describe } from "bun:test";
import { convertDLDToLocationDischarge } from "../../../src/v2-to-fhir/datatypes/dld-location-discharge";

describe("convertDLDToLocationDischarge", () => {
  test("returns undefined for undefined input", () => {
    expect(convertDLDToLocationDischarge(undefined)).toBeUndefined();
  });

  test("returns undefined for empty DLD", () => {
    expect(convertDLDToLocationDischarge({})).toBeUndefined();
  });

  test("returns undefined when location is missing", () => {
    expect(convertDLDToLocationDischarge({ $2_start: "20200101" })).toBeUndefined();
  });

  test("converts discharge location to type CodeableConcept", () => {
    const result = convertDLDToLocationDischarge({
      $1_location: "HOME",
    });
    expect(result).toEqual({
      type: {
        coding: [
          {
            code: "HOME",
          },
        ],
      },
    });
  });

  test("converts discharge location with effective date (ignores date)", () => {
    const result = convertDLDToLocationDischarge({
      $1_location: "SNF",
      $2_start: "20200101120000",
    });
    expect(result).toEqual({
      type: {
        coding: [
          {
            code: "SNF",
          },
        ],
      },
    });
  });

  test("converts various discharge location codes", () => {
    expect(convertDLDToLocationDischarge({ $1_location: "HOS" })?.type?.coding?.[0].code).toBe("HOS");
    expect(convertDLDToLocationDischarge({ $1_location: "OTH" })?.type?.coding?.[0].code).toBe("OTH");
    expect(convertDLDToLocationDischarge({ $1_location: "HH" })?.type?.coding?.[0].code).toBe("HH");
  });
});

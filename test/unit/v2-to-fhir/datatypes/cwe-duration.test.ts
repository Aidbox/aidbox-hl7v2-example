import { test, expect, describe } from "bun:test";
import { convertCWEToDuration } from "../../../../src/v2-to-fhir/datatypes/cwe-codeableconcept";

describe("convertCWEToDuration", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToDuration(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToDuration({})).toBeUndefined();
  });

  test("extracts duration code from identifier", () => {
    const result = convertCWEToDuration({ $1_code: "min" });
    expect(result).toEqual({ code: "min" });
  });

  test("uses text when code is not valued", () => {
    const result = convertCWEToDuration({ $2_text: "minutes" });
    expect(result).toEqual({ code: "minutes" });
  });

  test("prefers code over text", () => {
    const result = convertCWEToDuration({
      $1_code: "h",
      $2_text: "hours",
    });
    expect(result).toEqual({ code: "h" });
  });

  test("ignores system and other fields", () => {
    const result = convertCWEToDuration({
      $1_code: "d",
      $3_system: "http://unitsofmeasure.org",
      $7_version: "1.0",
    });
    expect(result).toEqual({ code: "d" });
  });

  test("returns undefined when only alternate coding present", () => {
    const result = convertCWEToDuration({
      $4_altCode: "s",
      $5_altDisplay: "seconds",
    });
    expect(result).toBeUndefined();
  });
});

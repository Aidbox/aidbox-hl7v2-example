import { test, expect, describe } from "bun:test";
import { convertCWEToCoding } from "../../../../src/v2-to-fhir/datatypes/cwe-codeableconcept";

describe("convertCWEToCoding", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToCoding(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToCoding({})).toBeUndefined();
  });

  test("converts full coding", () => {
    const result = convertCWEToCoding({
      $1_code: "ABC",
      $2_text: "Description",
      $3_system: "http://example.org",
      $7_version: "1.0",
    });

    expect(result).toEqual({
      code: "ABC",
      display: "Description",
      system: "http://example.org",
      version: "1.0",
    });
  });

  test("converts code only", () => {
    const result = convertCWEToCoding({ $1_code: "XYZ" });

    expect(result).toEqual({ code: "XYZ" });
  });

  test("converts text only", () => {
    const result = convertCWEToCoding({ $2_text: "Some text" });

    expect(result).toEqual({ display: "Some text" });
  });

  test("ignores alternate coding", () => {
    const result = convertCWEToCoding({
      $1_code: "PRIMARY",
      $4_altCode: "ALT",
      $5_altDisplay: "Alternate",
    });

    expect(result).toEqual({ code: "PRIMARY" });
  });

  test("returns undefined when only alternate coding present", () => {
    const result = convertCWEToCoding({
      $4_altCode: "ALT",
      $5_altDisplay: "Alternate",
    });

    expect(result).toBeUndefined();
  });

  test("ignores original text", () => {
    const result = convertCWEToCoding({
      $1_code: "CODE",
      $9_originalText: "Original",
    });

    expect(result).toEqual({ code: "CODE" });
  });
});

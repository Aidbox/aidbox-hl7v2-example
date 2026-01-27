import { test, expect, describe } from "bun:test";
import { convertCFToCodeableConcept } from "../../../../src/v2-to-fhir/datatypes/cf-codeableconcept";

describe("convertCFToCodeableConcept", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCFToCodeableConcept(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CF", () => {
    expect(convertCFToCodeableConcept({})).toBeUndefined();
  });

  test("converts primary coding with version", () => {
    const result = convertCFToCodeableConcept({
      $1_code: "123",
      $2_text: "Test Code",
      $3_system: "http://example.com",
      $7_version: "2.0",
    });

    expect(result).toEqual({
      coding: [
        {
          code: "123",
          display: "Test Code",
          system: "http://example.com",
          version: "2.0",
        },
      ],
      text: "Test Code",
    });
  });

  test("uses originalText for text when present", () => {
    const result = convertCFToCodeableConcept({
      $1_code: "123",
      $2_text: "Display Text",
      $9_originalText: "Original Text",
    });

    expect(result?.text).toBe("Original Text");
  });

  test("converts alternate coding with version", () => {
    const result = convertCFToCodeableConcept({
      $1_code: "A",
      $4_altCode: "B",
      $5_altDisplay: "Alt Display",
      $6_altSystem: "http://alt.com",
      $8_altVersion: "1.0",
    });

    expect(result?.coding).toHaveLength(2);
    expect(result?.coding?.[1]).toEqual({
      code: "B",
      display: "Alt Display",
      system: "http://alt.com",
      version: "1.0",
    });
  });
});

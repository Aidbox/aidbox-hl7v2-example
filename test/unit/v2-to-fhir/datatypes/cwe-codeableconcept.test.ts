import { test, expect, describe } from "bun:test";
import { convertCWEToCodeableConcept } from "../../../../src/v2-to-fhir/datatypes/cwe-codeableconcept";

describe("convertCWEToCodeableConcept", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToCodeableConcept(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToCodeableConcept({})).toBeUndefined();
  });

  test("converts primary coding", () => {
    const result = convertCWEToCodeableConcept({
      $1_code: "ABC",
      $2_text: "ABC Description",
      $3_system: "http://example.org",
    });

    expect(result).toEqual({
      coding: [
        {
          code: "ABC",
          display: "ABC Description",
          system: "http://example.org",
        },
      ],
      text: "ABC Description",
    });
  });

  test("converts with version", () => {
    const result = convertCWEToCodeableConcept({
      $1_code: "CODE",
      $2_text: "Description",
      $7_version: "2.0",
    });

    expect(result).toEqual({
      coding: [
        {
          code: "CODE",
          display: "Description",
          version: "2.0",
        },
      ],
      text: "Description",
    });
  });

  test("converts with alternate coding", () => {
    const result = convertCWEToCodeableConcept({
      $1_code: "C1",
      $2_text: "Text1",
      $3_system: "S1",
      $4_altCode: "C2",
      $5_altDisplay: "Text2",
      $6_altSystem: "S2",
    });

    expect(result).toEqual({
      coding: [
        { code: "C1", display: "Text1", system: "S1" },
        { code: "C2", display: "Text2", system: "S2" },
      ],
      text: "Text1",
    });
  });

  test("uses original text when available", () => {
    const result = convertCWEToCodeableConcept({
      $1_code: "CODE",
      $2_text: "Display",
      $9_originalText: "Original",
    });

    expect(result?.text).toBe("Original");
  });

  test("converts code only", () => {
    const result = convertCWEToCodeableConcept({ $1_code: "XYZ" });

    expect(result).toEqual({
      coding: [{ code: "XYZ" }],
    });
  });

  test("converts text only", () => {
    const result = convertCWEToCodeableConcept({ $2_text: "Some text" });

    expect(result).toEqual({
      coding: [{ display: "Some text" }],
      text: "Some text",
    });
  });

  test("converts alternate coding only", () => {
    const result = convertCWEToCodeableConcept({
      $4_altCode: "ALT",
      $5_altDisplay: "Alternate",
    });

    expect(result).toEqual({
      coding: [{ code: "ALT", display: "Alternate" }],
    });
  });
});

import { test, expect, describe } from "bun:test";
import { convertCWEToString } from "../../../../src/v2-to-fhir/datatypes/cwe-string";

describe("convertCWEToString", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToString(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToString({})).toBeUndefined();
  });

  test("returns original text when present", () => {
    const result = convertCWEToString({
      $2_text: "Text value",
      $9_originalText: "Original text value",
    });
    expect(result).toBe("Original text value");
  });

  test("returns text when original text is not present", () => {
    const result = convertCWEToString({
      $2_text: "Text value",
    });
    expect(result).toBe("Text value");
  });

  test("prefers original text over text", () => {
    const result = convertCWEToString({
      $1_code: "ABC",
      $2_text: "Fallback text",
      $9_originalText: "Original",
    });
    expect(result).toBe("Original");
  });

  test("ignores other fields when extracting string", () => {
    const result = convertCWEToString({
      $1_code: "CODE",
      $3_system: "http://system",
    });
    expect(result).toBeUndefined();
  });
});

import { test, expect, describe } from "bun:test";
import { convertCWEToCode } from "../../../../src/v2-to-fhir/datatypes/cwe-codeableconcept";

describe("convertCWEToCode", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToCode(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToCode({})).toBeUndefined();
  });

  test("extracts code", () => {
    const result = convertCWEToCode({
      $1_code: "ABC123",
      $2_text: "Some description",
    });
    expect(result).toBe("ABC123");
  });

  test("returns undefined when no code", () => {
    const result = convertCWEToCode({
      $2_text: "Only text",
    });
    expect(result).toBeUndefined();
  });

  test("ignores alternate code", () => {
    const result = convertCWEToCode({
      $4_altCode: "ALT",
    });
    expect(result).toBeUndefined();
  });

  test("returns primary code even with alternate present", () => {
    const result = convertCWEToCode({
      $1_code: "PRIMARY",
      $4_altCode: "ALTERNATE",
    });
    expect(result).toBe("PRIMARY");
  });
});

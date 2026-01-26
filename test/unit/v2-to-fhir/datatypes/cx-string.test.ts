import { test, expect, describe } from "bun:test";
import { convertCXToString } from "../../../../src/v2-to-fhir/datatypes/cx-string";

describe("convertCXToString", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCXToString(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CX", () => {
    expect(convertCXToString({})).toBeUndefined();
  });

  test("returns ID number as string", () => {
    const result = convertCXToString({
      $1_value: "12345",
    });
    expect(result).toBe("12345");
  });

  test("ignores other CX fields", () => {
    const result = convertCXToString({
      $1_value: "ABC123",
      $2_checkDigit: "9",
      $5_type: "MR",
      $4_system: { $1_namespace: "Hospital" },
    });
    expect(result).toBe("ABC123");
  });

  test("returns undefined when value is missing", () => {
    const result = convertCXToString({
      $5_type: "MR",
    });
    expect(result).toBeUndefined();
  });
});

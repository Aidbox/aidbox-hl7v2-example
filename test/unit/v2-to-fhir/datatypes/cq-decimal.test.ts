import { test, expect, describe } from "bun:test";
import { convertCQToDecimal } from "../../../../src/v2-to-fhir/datatypes/cq-quantity";

describe("convertCQToDecimal", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCQToDecimal(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CQ", () => {
    expect(convertCQToDecimal({})).toBeUndefined();
  });

  test("extracts quantity value", () => {
    expect(convertCQToDecimal({ $1_quantity: 10.5 })).toBe(10.5);
  });

  test("extracts integer quantity", () => {
    expect(convertCQToDecimal({ $1_quantity: 42 })).toBe(42);
  });

  test("extracts zero quantity", () => {
    expect(convertCQToDecimal({ $1_quantity: 0 })).toBe(0);
  });

  test("extracts negative quantity", () => {
    expect(convertCQToDecimal({ $1_quantity: -5.25 })).toBe(-5.25);
  });

  test("ignores units", () => {
    const result = convertCQToDecimal({
      $1_quantity: 100,
      $2_units: { $1_code: "mg", $2_text: "milligram" },
    });
    expect(result).toBe(100);
  });
});

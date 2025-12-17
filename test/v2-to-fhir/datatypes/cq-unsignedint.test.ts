import { test, expect, describe } from "bun:test";
import { convertCQToUnsignedInt } from "../../../src/v2-to-fhir/datatypes/cq-quantity";

describe("convertCQToUnsignedInt", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCQToUnsignedInt(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CQ", () => {
    expect(convertCQToUnsignedInt({})).toBeUndefined();
  });

  test("converts integer quantity", () => {
    expect(convertCQToUnsignedInt({ $1_quantity: 42 })).toBe(42);
  });

  test("floors decimal quantity", () => {
    expect(convertCQToUnsignedInt({ $1_quantity: 10.9 })).toBe(10);
  });

  test("converts zero quantity", () => {
    expect(convertCQToUnsignedInt({ $1_quantity: 0 })).toBe(0);
  });

  test("clamps negative to zero", () => {
    expect(convertCQToUnsignedInt({ $1_quantity: -5 })).toBe(0);
  });

  test("clamps negative decimal to zero", () => {
    expect(convertCQToUnsignedInt({ $1_quantity: -3.7 })).toBe(0);
  });

  test("ignores units", () => {
    const result = convertCQToUnsignedInt({
      $1_quantity: 60,
      $2_units: { $1_code: "min", $2_text: "minutes" },
    });
    expect(result).toBe(60);
  });
});

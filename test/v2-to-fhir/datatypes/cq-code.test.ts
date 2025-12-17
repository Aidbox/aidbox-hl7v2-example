import { test, expect, describe } from "bun:test";
import { convertCQToCode } from "../../../src/v2-to-fhir/datatypes/cq-code";

describe("convertCQToCode", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCQToCode(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CQ", () => {
    expect(convertCQToCode({})).toBeUndefined();
  });

  test("returns undefined when no units", () => {
    expect(convertCQToCode({ $1_quantity: 10 })).toBeUndefined();
  });

  test("extracts code from units", () => {
    const result = convertCQToCode({
      $1_quantity: 10,
      $2_units: {
        $1_code: "mg",
        $2_text: "milligram",
      },
    });

    expect(result).toBe("mg");
  });

  test("returns undefined when units has no code", () => {
    const result = convertCQToCode({
      $1_quantity: 5,
      $2_units: {
        $2_text: "some unit",
      },
    });

    expect(result).toBeUndefined();
  });
});

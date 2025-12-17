import { test, expect, describe } from "bun:test";
import { convertCQToQuantity } from "../../../src/v2-to-fhir/datatypes/cq-quantity";

describe("convertCQToQuantity", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCQToQuantity(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CQ", () => {
    expect(convertCQToQuantity({})).toBeUndefined();
  });

  test("converts quantity only", () => {
    const result = convertCQToQuantity({ $1_quantity: 10.5 });
    expect(result).toEqual({ value: 10.5 });
  });

  test("converts quantity with full units", () => {
    const result = convertCQToQuantity({
      $1_quantity: 100,
      $2_units: {
        $1_code: "mg",
        $2_text: "milligram",
        $3_system: "http://unitsofmeasure.org",
      },
    });

    expect(result).toEqual({
      value: 100,
      unit: "milligram",
      system: "http://unitsofmeasure.org",
      code: "mg",
    });
  });

  test("converts units only", () => {
    const result = convertCQToQuantity({
      $2_units: {
        $1_code: "kg",
        $2_text: "kilogram",
      },
    });

    expect(result).toEqual({
      unit: "kilogram",
      code: "kg",
    });
  });

  test("converts zero quantity", () => {
    const result = convertCQToQuantity({ $1_quantity: 0 });
    expect(result).toEqual({ value: 0 });
  });

  test("handles units with code only", () => {
    const result = convertCQToQuantity({
      $1_quantity: 5,
      $2_units: { $1_code: "mL" },
    });

    expect(result).toEqual({
      value: 5,
      code: "mL",
    });
  });

  test("handles units with text only", () => {
    const result = convertCQToQuantity({
      $1_quantity: 10,
      $2_units: { $2_text: "tablets" },
    });

    expect(result).toEqual({
      value: 10,
      unit: "tablets",
    });
  });
});

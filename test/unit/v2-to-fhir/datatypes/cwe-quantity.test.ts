import { test, expect, describe } from "bun:test";
import { convertCWEToQuantity } from "../../../../src/v2-to-fhir/datatypes/cwe-quantity";

describe("convertCWEToQuantity", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToQuantity(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToQuantity({})).toBeUndefined();
  });

  test("converts full CWE to Quantity with code and system", () => {
    const result = convertCWEToQuantity({
      $1_code: "kg",
      $2_text: "kilogram",
      $3_system: "http://unitsofmeasure.org",
    });

    expect(result).toEqual({
      unit: "kilogram",
      code: "kg",
      system: "http://unitsofmeasure.org",
    });
  });

  test("uses text as unit when present", () => {
    const result = convertCWEToQuantity({
      $1_code: "mg",
      $2_text: "milligram",
    });

    expect(result).toEqual({
      unit: "milligram",
    });
  });

  test("uses code as unit when text is missing", () => {
    const result = convertCWEToQuantity({
      $1_code: "mg",
    });

    expect(result).toEqual({
      unit: "mg",
    });
  });

  test("includes code and system only when both are present", () => {
    const result = convertCWEToQuantity({
      $1_code: "mL",
      $3_system: "http://unitsofmeasure.org",
    });

    expect(result).toEqual({
      unit: "mL",
      code: "mL",
      system: "http://unitsofmeasure.org",
    });
  });

  test("does not include code without system", () => {
    const result = convertCWEToQuantity({
      $1_code: "units",
      $2_text: "Units",
    });

    expect(result).toEqual({
      unit: "Units",
    });
    expect(result?.code).toBeUndefined();
    expect(result?.system).toBeUndefined();
  });

  test("text only returns quantity with unit", () => {
    const result = convertCWEToQuantity({
      $2_text: "tablets",
    });

    expect(result).toEqual({
      unit: "tablets",
    });
  });

  test("does not set value (value comes from different field)", () => {
    const result = convertCWEToQuantity({
      $1_code: "kg",
      $2_text: "kilogram",
      $3_system: "http://unitsofmeasure.org",
    });

    expect(result?.value).toBeUndefined();
  });
});

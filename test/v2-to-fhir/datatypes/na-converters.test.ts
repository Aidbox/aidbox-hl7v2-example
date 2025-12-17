import { test, expect, describe } from "bun:test";
import {
  convertNAToSampledData,
  convertNumericArrayToSampledData,
} from "../../../src/v2-to-fhir/datatypes/na-converters";

describe("convertNAToSampledData", () => {
  test("returns undefined for undefined input", () => {
    expect(convertNAToSampledData(undefined)).toBeUndefined();
  });

  test("returns undefined when no values", () => {
    expect(convertNAToSampledData({})).toBeUndefined();
  });

  test("returns SampledData with single value", () => {
    const result = convertNAToSampledData({
      $1_value1: "10",
    });
    expect(result).toEqual({
      dimensions: 1,
      data: "10",
    });
  });

  test("returns SampledData with multiple values", () => {
    const result = convertNAToSampledData({
      $1_value1: "1",
      $2_value2: "2",
      $3_value3: "3",
      $4_value4: "4",
    });
    expect(result).toEqual({
      dimensions: 4,
      data: "1 2 3 4",
    });
  });

  test("handles sparse values", () => {
    const result = convertNAToSampledData({
      $1_value1: "10",
      $3_value3: "30",
    });
    expect(result).toEqual({
      dimensions: 2,
      data: "10 30",
    });
  });
});

describe("convertNumericArrayToSampledData", () => {
  test("returns undefined for undefined input", () => {
    expect(convertNumericArrayToSampledData(undefined)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(convertNumericArrayToSampledData([])).toBeUndefined();
  });

  test("returns SampledData from string array", () => {
    const result = convertNumericArrayToSampledData(["1", "2", "3"]);
    expect(result).toEqual({
      dimensions: 3,
      data: "1 2 3",
    });
  });

  test("filters out empty strings", () => {
    const result = convertNumericArrayToSampledData(["1", "", "3", ""]);
    expect(result).toEqual({
      dimensions: 2,
      data: "1 3",
    });
  });
});

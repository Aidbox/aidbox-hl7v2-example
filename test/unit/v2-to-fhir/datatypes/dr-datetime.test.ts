import { test, expect, describe } from "bun:test";
import { convertDRToDateTime, convertDRToPeriod } from "../../../../src/v2-to-fhir/datatypes/dr-datetime";

describe("convertDRToDateTime", () => {
  test("returns undefined for undefined input", () => {
    expect(convertDRToDateTime(undefined)).toBeUndefined();
  });

  test("returns undefined for empty DR", () => {
    expect(convertDRToDateTime({})).toBeUndefined();
  });

  test("returns start date as dateTime", () => {
    const result = convertDRToDateTime({
      $1_start: "20200101120000",
    });
    expect(result).toBe("20200101120000");
  });

  test("ignores end date", () => {
    const result = convertDRToDateTime({
      $1_start: "20200101",
      $2_end: "20201231",
    });
    expect(result).toBe("20200101");
  });

  test("returns undefined when only end date is present", () => {
    const result = convertDRToDateTime({
      $2_end: "20201231",
    });
    expect(result).toBeUndefined();
  });
});

describe("convertDRToPeriod", () => {
  test("returns undefined for undefined input", () => {
    expect(convertDRToPeriod(undefined)).toBeUndefined();
  });

  test("returns undefined for empty DR", () => {
    expect(convertDRToPeriod({})).toBeUndefined();
  });

  test("converts full range to Period with start and end", () => {
    const result = convertDRToPeriod({
      $1_start: "20200101",
      $2_end: "20201231",
    });
    expect(result).toEqual({
      start: "20200101",
      end: "20201231",
    });
  });

  test("converts start date only", () => {
    const result = convertDRToPeriod({
      $1_start: "20200101",
    });
    expect(result).toEqual({
      start: "20200101",
    });
  });

  test("converts end date only", () => {
    const result = convertDRToPeriod({
      $2_end: "20201231",
    });
    expect(result).toEqual({
      end: "20201231",
    });
  });

  test("handles date with time", () => {
    const result = convertDRToPeriod({
      $1_start: "20200101120000",
      $2_end: "20201231235959",
    });
    expect(result).toEqual({
      start: "20200101120000",
      end: "20201231235959",
    });
  });
});

import { test, expect, describe } from "bun:test";
import { convertDTMToDateTime, convertDTMToAnnotationTime } from "../../../../src/v2-to-fhir/datatypes/dtm-datetime";

describe("convertDTMToDateTime", () => {
  test("returns undefined for undefined input", () => {
    expect(convertDTMToDateTime(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertDTMToDateTime("")).toBeUndefined();
  });

  test("returns year only for 4-char input", () => {
    expect(convertDTMToDateTime("2020")).toBe("2020");
  });

  test("returns year-month for 6-char input", () => {
    expect(convertDTMToDateTime("202001")).toBe("2020-01");
  });

  test("returns date only for 8-char input", () => {
    expect(convertDTMToDateTime("20200101")).toBe("2020-01-01");
  });

  test("returns full dateTime for 14-char input", () => {
    expect(convertDTMToDateTime("20200101120000")).toBe("2020-01-01T12:00:00Z");
  });

  test("returns dateTime with partial time (10 chars, hours only)", () => {
    expect(convertDTMToDateTime("2020010112")).toBe("2020-01-01T12:00:00Z");
  });

  test("returns dateTime with partial time (12 chars, hours+minutes)", () => {
    expect(convertDTMToDateTime("202001011230")).toBe("2020-01-01T12:30:00Z");
  });
});

describe("convertDTMToAnnotationTime", () => {
  test("returns undefined for undefined input", () => {
    expect(convertDTMToAnnotationTime(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertDTMToAnnotationTime("")).toBeUndefined();
  });

  test("returns time object for date string", () => {
    const result = convertDTMToAnnotationTime("20200101120000");
    expect(result).toEqual({
      time: "20200101120000",
    });
  });

  test("returns time object for date with timezone", () => {
    const result = convertDTMToAnnotationTime("20200101120000-0500");
    expect(result).toEqual({
      time: "20200101120000-0500",
    });
  });
});

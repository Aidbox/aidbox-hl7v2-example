import { test, expect, describe } from "bun:test";
import { convertDTMToDateTime, convertDTMToAnnotationTime } from "../../../../src/v2-to-fhir/datatypes/dtm-datetime";

describe("convertDTMToDateTime", () => {
  test("returns undefined for undefined input", () => {
    expect(convertDTMToDateTime(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertDTMToDateTime("")).toBeUndefined();
  });

  test("returns date only format", () => {
    expect(convertDTMToDateTime("20200101")).toBe("20200101");
  });

  test("returns date with time format", () => {
    expect(convertDTMToDateTime("20200101120000")).toBe("20200101120000");
  });

  test("returns date with time and milliseconds", () => {
    expect(convertDTMToDateTime("20200101120000.1234")).toBe("20200101120000.1234");
  });

  test("returns date with timezone", () => {
    expect(convertDTMToDateTime("20200101120000+0500")).toBe("20200101120000+0500");
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

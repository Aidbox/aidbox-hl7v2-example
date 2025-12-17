import { test, expect, describe } from "bun:test";
import {
  convertMSGToCode,
  convertMSGToCoding,
  convertMSGToMessageHeader,
} from "../../../src/v2-to-fhir/datatypes/msg-converters";

describe("convertMSGToCode", () => {
  test("returns undefined for undefined input", () => {
    expect(convertMSGToCode(undefined)).toBeUndefined();
  });

  test("returns undefined when no event", () => {
    expect(convertMSGToCode({})).toBeUndefined();
    expect(convertMSGToCode({ $1_code: "ADT" })).toBeUndefined();
  });

  test("returns trigger event as code", () => {
    const result = convertMSGToCode({
      $1_code: "ADT",
      $2_event: "A01",
      $3_structure: "ADT_A01",
    });
    expect(result).toBe("A01");
  });
});

describe("convertMSGToCoding", () => {
  test("returns undefined for undefined input", () => {
    expect(convertMSGToCoding(undefined)).toBeUndefined();
  });

  test("returns undefined when no event", () => {
    expect(convertMSGToCoding({})).toBeUndefined();
    expect(convertMSGToCoding({ $1_code: "ADT" })).toBeUndefined();
  });

  test("returns Coding with all components in display", () => {
    const result = convertMSGToCoding({
      $1_code: "ADT",
      $2_event: "A08",
      $3_structure: "ADT_A08",
    });
    expect(result).toEqual({
      code: "A08",
      system: "http://terminology.hl7.org/CodeSystem/v2-0003",
      display: "ADT^A08^ADT_A08",
    });
  });

  test("returns Coding with partial display when some components missing", () => {
    const result = convertMSGToCoding({
      $2_event: "A01",
    });
    expect(result).toEqual({
      code: "A01",
      system: "http://terminology.hl7.org/CodeSystem/v2-0003",
      display: "A01",
    });
  });

  test("returns Coding with message code and event in display", () => {
    const result = convertMSGToCoding({
      $1_code: "BAR",
      $2_event: "P01",
    });
    expect(result).toEqual({
      code: "P01",
      system: "http://terminology.hl7.org/CodeSystem/v2-0003",
      display: "BAR^P01",
    });
  });
});

describe("convertMSGToMessageHeader", () => {
  test("returns undefined for undefined input", () => {
    expect(convertMSGToMessageHeader(undefined)).toBeUndefined();
  });

  test("returns undefined when no event and no structure", () => {
    expect(convertMSGToMessageHeader({})).toBeUndefined();
    expect(convertMSGToMessageHeader({ $1_code: "ADT" })).toBeUndefined();
  });

  test("returns eventCoding and definition", () => {
    const result = convertMSGToMessageHeader({
      $1_code: "ADT",
      $2_event: "A01",
      $3_structure: "ADT_A01",
    });
    expect(result).toEqual({
      eventCoding: {
        code: "A01",
        system: "http://terminology.hl7.org/CodeSystem/v2-0003",
      },
      definition: "ADT_A01",
    });
  });

  test("returns only eventCoding when no structure", () => {
    const result = convertMSGToMessageHeader({
      $1_code: "BAR",
      $2_event: "P01",
    });
    expect(result).toEqual({
      eventCoding: {
        code: "P01",
        system: "http://terminology.hl7.org/CodeSystem/v2-0003",
      },
    });
  });

  test("returns only definition when no event", () => {
    const result = convertMSGToMessageHeader({
      $3_structure: "ADT_A08",
    });
    expect(result).toEqual({
      definition: "ADT_A08",
    });
  });
});

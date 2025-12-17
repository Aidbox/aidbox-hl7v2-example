import { test, expect, describe } from "bun:test";
import { convertCWEToDevice } from "../../../src/v2-to-fhir/datatypes/cwe-device";

describe("convertCWEToDevice", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToDevice(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToDevice({})).toBeUndefined();
  });

  test("converts identifier from code", () => {
    const result = convertCWEToDevice({
      $1_code: "DEV001",
      $3_system: "http://devices.example.org",
    });

    expect(result).toEqual({
      identifier: [
        { value: "DEV001", system: "http://devices.example.org" },
      ],
    });
  });

  test("converts device name from text", () => {
    const result = convertCWEToDevice({
      $2_text: "Infusion Pump",
    });

    expect(result).toEqual({
      deviceName: [
        { name: "Infusion Pump", type: "user-friendly-name" },
      ],
    });
  });

  test("converts full CWE with primary and alternate", () => {
    const result = convertCWEToDevice({
      $1_code: "ID1",
      $2_text: "Device Name 1",
      $3_system: "http://sys1.org",
      $4_altCode: "ID2",
      $5_altDisplay: "Device Name 2",
      $6_altSystem: "http://sys2.org",
    });

    expect(result).toEqual({
      identifier: [
        { value: "ID1", system: "http://sys1.org" },
        { value: "ID2", system: "http://sys2.org" },
      ],
      deviceName: [
        { name: "Device Name 1", type: "user-friendly-name" },
        { name: "Device Name 2", type: "user-friendly-name" },
      ],
    });
  });

  test("converts original text as other device name", () => {
    const result = convertCWEToDevice({
      $1_code: "DEV",
      $9_originalText: "Original device description",
    });

    expect(result).toEqual({
      identifier: [{ value: "DEV" }],
      deviceName: [
        { name: "Original device description", type: "other" },
      ],
    });
  });

  test("converts code without system", () => {
    const result = convertCWEToDevice({ $1_code: "SIMPLE" });

    expect(result).toEqual({
      identifier: [{ value: "SIMPLE" }],
    });
  });
});

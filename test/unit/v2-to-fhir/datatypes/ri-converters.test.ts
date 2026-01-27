import { test, expect, describe } from "bun:test";
import { convertRIToTiming } from "../../../../src/v2-to-fhir/datatypes/ri-converters";
import type { TimingRepeat } from "../../../../src/fhir/hl7-fhir-r4-core/Timing";

describe("convertRIToTiming", () => {
  test("returns undefined for undefined input", () => {
    expect(convertRIToTiming(undefined)).toBeUndefined();
  });

  test("returns undefined when no values", () => {
    expect(convertRIToTiming({})).toBeUndefined();
  });

  test("returns Timing with repeat pattern code", () => {
    const result = convertRIToTiming({
      $1_repeatPattern: "BID",
    });
    expect(result).toEqual({
      code: {
        coding: [{ code: "BID" }],
      },
    });
  });

  test("returns Timing with single time of day", () => {
    const result = convertRIToTiming({
      $2_explicitTimeInterval: "0800",
    });
    expect(result).toEqual({
      repeat: {
        timeOfDay: ["08:00:00"],
      },
    } as any);
  });

  test("returns Timing with multiple times of day", () => {
    const result = convertRIToTiming({
      $2_explicitTimeInterval: "0800,1200,1800",
    });
    expect(result).toEqual({
      repeat: {
        timeOfDay: ["08:00:00", "12:00:00", "18:00:00"],
      },
    } as any);
  });

  test("returns Timing with both code and times", () => {
    const result = convertRIToTiming({
      $1_repeatPattern: "TID",
      $2_explicitTimeInterval: "0900,1300,2100",
    });
    expect(result?.code?.coding?.[0]?.code).toBe("TID");
    expect((result?.repeat as TimingRepeat | undefined)?.timeOfDay).toEqual(["09:00:00", "13:00:00", "21:00:00"]);
  });

  test("handles time with seconds", () => {
    const result = convertRIToTiming({
      $2_explicitTimeInterval: "083000",
    });
    expect((result?.repeat as TimingRepeat | undefined)?.timeOfDay).toEqual(["08:30:00"]);
  });

  test("handles whitespace in time intervals", () => {
    const result = convertRIToTiming({
      $2_explicitTimeInterval: "0800, 1200, 1800",
    });
    expect((result?.repeat as TimingRepeat | undefined)?.timeOfDay).toEqual(["08:00:00", "12:00:00", "18:00:00"]);
  });
});

import { test, expect, describe } from "bun:test";
import { convertPTToMeta } from "../../../src/v2-to-fhir/datatypes/pt-converters";

describe("convertPTToMeta", () => {
  test("returns undefined for undefined input", () => {
    expect(convertPTToMeta(undefined)).toBeUndefined();
  });

  test("returns undefined when no values", () => {
    expect(convertPTToMeta({})).toBeUndefined();
  });

  test("returns Meta with processing ID tag", () => {
    const result = convertPTToMeta({
      $1_processingId: "P",
    });
    expect(result).toEqual({
      tag: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v2-0103",
          code: "P",
        },
      ],
    });
  });

  test("returns Meta with processing mode tag", () => {
    const result = convertPTToMeta({
      $2_processingMode: "T",
    });
    expect(result).toEqual({
      tag: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v2-0207",
          code: "T",
        },
      ],
    });
  });

  test("returns Meta with both tags", () => {
    const result = convertPTToMeta({
      $1_processingId: "D",
      $2_processingMode: "R",
    });
    expect(result).toEqual({
      tag: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v2-0103",
          code: "D",
        },
        {
          system: "http://terminology.hl7.org/CodeSystem/v2-0207",
          code: "R",
        },
      ],
    });
  });
});

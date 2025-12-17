import { test, expect, describe } from "bun:test";
import { convertCWEToObservationSupportingInfo } from "../../../src/v2-to-fhir/datatypes/cwe-observation-supportinginfo";

const testCode = { coding: [{ code: "TEST", display: "Test Code" }] };

describe("convertCWEToObservationSupportingInfo", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToObservationSupportingInfo(undefined, { code: testCode })).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToObservationSupportingInfo({}, { code: testCode })).toBeUndefined();
  });

  test("converts primary coding to Observation", () => {
    const result = convertCWEToObservationSupportingInfo(
      {
        $1_code: "ABC",
        $2_text: "ABC Description",
        $3_system: "http://example.org",
      },
      { code: testCode }
    );

    expect(result).toEqual({
      resourceType: "Observation",
      code: testCode,
      status: "final",
      valueCodeableConcept: {
        coding: [
          {
            code: "ABC",
            display: "ABC Description",
            system: "http://example.org",
          },
        ],
      },
    });
  });

  test("converts with alternate coding", () => {
    const result = convertCWEToObservationSupportingInfo(
      {
        $1_code: "C1",
        $2_text: "Text1",
        $3_system: "S1",
        $4_altCode: "C2",
        $5_altDisplay: "Text2",
        $6_altSystem: "S2",
      },
      { code: testCode }
    );

    expect(result).toEqual({
      resourceType: "Observation",
      code: testCode,
      status: "final",
      valueCodeableConcept: {
        coding: [
          { code: "C1", display: "Text1", system: "S1" },
          { code: "C2", display: "Text2", system: "S2" },
        ],
      },
    });
  });

  test("converts code only", () => {
    const result = convertCWEToObservationSupportingInfo(
      { $1_code: "XYZ" },
      { code: testCode }
    );

    expect(result).toEqual({
      resourceType: "Observation",
      code: testCode,
      status: "final",
      valueCodeableConcept: {
        coding: [{ code: "XYZ" }],
      },
    });
  });

  test("converts text only", () => {
    const result = convertCWEToObservationSupportingInfo(
      { $2_text: "Some text" },
      { code: testCode }
    );

    expect(result).toEqual({
      resourceType: "Observation",
      code: testCode,
      status: "final",
      valueCodeableConcept: {
        coding: [{ display: "Some text" }],
      },
    });
  });

  test("converts alternate coding only", () => {
    const result = convertCWEToObservationSupportingInfo(
      {
        $4_altCode: "ALT",
        $5_altDisplay: "Alternate",
      },
      { code: testCode }
    );

    expect(result).toEqual({
      resourceType: "Observation",
      code: testCode,
      status: "final",
      valueCodeableConcept: {
        coding: [{ code: "ALT", display: "Alternate" }],
      },
    });
  });

  test("uses custom code", () => {
    const customCode = { coding: [{ code: "CUSTOM", system: "http://custom.org" }], text: "Custom" };
    const result = convertCWEToObservationSupportingInfo(
      { $1_code: "VALUE" },
      { code: customCode }
    );

    expect(result?.code).toEqual(customCode);
  });

  test("status is always final", () => {
    const result = convertCWEToObservationSupportingInfo(
      { $1_code: "TEST" },
      { code: testCode }
    );

    expect(result?.status).toBe("final");
  });
});

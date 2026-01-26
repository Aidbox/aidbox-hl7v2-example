import { test, expect, describe } from "bun:test";
import { convertCWEToIdentifier } from "../../../../src/v2-to-fhir/datatypes/cwe-codeableconcept";

describe("convertCWEToIdentifier", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToIdentifier(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToIdentifier({})).toBeUndefined();
  });

  test("converts primary identifier", () => {
    const result = convertCWEToIdentifier({
      $1_code: "ID001",
      $3_system: "http://example.org/ids",
    });

    expect(result).toEqual([
      { value: "ID001", system: "http://example.org/ids" },
    ]);
  });

  test("converts identifier without system", () => {
    const result = convertCWEToIdentifier({ $1_code: "SIMPLE" });

    expect(result).toEqual([{ value: "SIMPLE" }]);
  });

  test("converts primary and alternate identifiers", () => {
    const result = convertCWEToIdentifier({
      $1_code: "ID1",
      $3_system: "http://sys1.org",
      $4_altCode: "ID2",
      $6_altSystem: "http://sys2.org",
    });

    expect(result).toEqual([
      { value: "ID1", system: "http://sys1.org" },
      { value: "ID2", system: "http://sys2.org" },
    ]);
  });

  test("returns undefined when only text present", () => {
    const result = convertCWEToIdentifier({
      $2_text: "Some text",
      $5_altDisplay: "Alt text",
    });

    expect(result).toBeUndefined();
  });

  test("ignores text fields", () => {
    const result = convertCWEToIdentifier({
      $1_code: "CODE",
      $2_text: "Description",
    });

    expect(result).toEqual([{ value: "CODE" }]);
  });

  test("converts alternate only when primary not present", () => {
    const result = convertCWEToIdentifier({
      $4_altCode: "ALT",
      $6_altSystem: "http://alt.org",
    });

    expect(result).toEqual([
      { value: "ALT", system: "http://alt.org" },
    ]);
  });
});

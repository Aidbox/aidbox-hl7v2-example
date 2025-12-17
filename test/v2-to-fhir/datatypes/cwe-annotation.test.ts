import { test, expect, describe } from "bun:test";
import { convertCWEToAnnotation } from "../../../src/v2-to-fhir/datatypes/cwe-codeableconcept";

describe("convertCWEToAnnotation", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToAnnotation(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToAnnotation({})).toBeUndefined();
  });

  test("converts code only", () => {
    const result = convertCWEToAnnotation({ $1_code: "ABC" });
    expect(result).toEqual({ text: "ABC" });
  });

  test("converts text only", () => {
    const result = convertCWEToAnnotation({ $2_text: "Some text" });
    expect(result).toEqual({ text: "Some text" });
  });

  test("converts full CWE with delimiters", () => {
    const result = convertCWEToAnnotation({
      $1_code: "CODE",
      $2_text: "Description",
      $3_system: "http://example.org",
    });
    expect(result).toEqual({ text: "CODE^Description^http://example.org" });
  });

  test("converts CWE with alternate coding", () => {
    const result = convertCWEToAnnotation({
      $1_code: "CODE1",
      $2_text: "Text1",
      $4_altCode: "CODE2",
      $5_altDisplay: "Text2",
    });
    expect(result).toEqual({ text: "CODE1^Text1^CODE2^Text2" });
  });

  test("converts CWE with version info", () => {
    const result = convertCWEToAnnotation({
      $1_code: "CODE",
      $7_version: "2.1",
    });
    expect(result).toEqual({ text: "CODE^2.1" });
  });

  test("converts CWE with original text", () => {
    const result = convertCWEToAnnotation({
      $1_code: "CODE",
      $9_originalText: "Original description",
    });
    expect(result).toEqual({ text: "CODE^Original description" });
  });

  test("converts complete CWE", () => {
    const result = convertCWEToAnnotation({
      $1_code: "C1",
      $2_text: "T1",
      $3_system: "S1",
      $4_altCode: "C2",
      $5_altDisplay: "T2",
      $6_altSystem: "S2",
      $7_version: "V1",
      $8_altVersion: "V2",
      $9_originalText: "OT",
    });
    expect(result).toEqual({ text: "C1^T1^S1^C2^T2^S2^V1^V2^OT" });
  });
});

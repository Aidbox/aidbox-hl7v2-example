import { test, expect, describe } from "bun:test";
import { convertCWEToUri } from "../../../src/v2-to-fhir/datatypes/cwe-uri";

describe("convertCWEToUri", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToUri(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToUri({})).toBeUndefined();
  });

  test("returns identifier as uri", () => {
    const result = convertCWEToUri({
      $1_code: "http://example.com/resource",
    });
    expect(result).toBe("http://example.com/resource");
  });

  test("returns alternate identifier when identifier is not present", () => {
    const result = convertCWEToUri({
      $4_altCode: "http://example.com/alternate",
    });
    expect(result).toBe("http://example.com/alternate");
  });

  test("prefers identifier over alternate identifier", () => {
    const result = convertCWEToUri({
      $1_code: "http://example.com/primary",
      $4_altCode: "http://example.com/alternate",
    });
    expect(result).toBe("http://example.com/primary");
  });

  test("ignores text fields", () => {
    const result = convertCWEToUri({
      $2_text: "Example description",
      $5_altDisplay: "Alternate description",
    });
    expect(result).toBeUndefined();
  });

  test("returns identifier with any string value", () => {
    const result = convertCWEToUri({
      $1_code: "urn:oid:1.2.3.4",
    });
    expect(result).toBe("urn:oid:1.2.3.4");
  });
});

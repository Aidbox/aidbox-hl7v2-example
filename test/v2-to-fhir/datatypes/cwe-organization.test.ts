import { test, expect, describe } from "bun:test";
import { convertCWEToOrganization } from "../../../src/v2-to-fhir/datatypes/cwe-organization";

describe("convertCWEToOrganization", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToOrganization(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToOrganization({})).toBeUndefined();
  });

  test("converts full CWE to Organization", () => {
    const result = convertCWEToOrganization({
      $1_code: "ORG123",
      $2_text: "Test Organization",
      $3_system: "http://example.org/orgs",
    });

    expect(result).toEqual({
      resourceType: "Organization",
      name: "Test Organization",
      identifier: [
        {
          value: "ORG123",
          system: "http://example.org/orgs",
        },
      ],
    });
  });

  test("converts with name only", () => {
    const result = convertCWEToOrganization({
      $2_text: "Organization Name",
    });

    expect(result).toEqual({
      resourceType: "Organization",
      name: "Organization Name",
    });
  });

  test("converts with identifier only", () => {
    const result = convertCWEToOrganization({
      $1_code: "ORG456",
    });

    expect(result).toEqual({
      resourceType: "Organization",
      identifier: [{ value: "ORG456" }],
    });
  });

  test("converts with identifier and system", () => {
    const result = convertCWEToOrganization({
      $1_code: "ORG789",
      $3_system: "http://example.org",
    });

    expect(result).toEqual({
      resourceType: "Organization",
      identifier: [
        {
          value: "ORG789",
          system: "http://example.org",
        },
      ],
    });
  });

  test("uses original text as name when text is missing", () => {
    const result = convertCWEToOrganization({
      $1_code: "ORG001",
      $9_originalText: "Original Name",
    });

    expect(result).toEqual({
      resourceType: "Organization",
      name: "Original Name",
      identifier: [{ value: "ORG001" }],
    });
  });

  test("prefers text over original text for name", () => {
    const result = convertCWEToOrganization({
      $2_text: "Primary Name",
      $9_originalText: "Original Name",
    });

    expect(result?.name).toBe("Primary Name");
  });

  test("ignores alternate coding fields", () => {
    const result = convertCWEToOrganization({
      $1_code: "ORG001",
      $2_text: "Main Org",
      $4_altCode: "ALT001",
      $5_altDisplay: "Alternate Org",
    });

    expect(result).toEqual({
      resourceType: "Organization",
      name: "Main Org",
      identifier: [{ value: "ORG001" }],
    });
  });
});

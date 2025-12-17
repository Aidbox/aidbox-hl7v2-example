import { test, expect, describe } from "bun:test";
import { convertCNNToPractitioner } from "../../../src/v2-to-fhir/datatypes/cnn-practitioner";

describe("convertCNNToPractitioner", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCNNToPractitioner(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CNN", () => {
    expect(convertCNNToPractitioner({})).toBeUndefined();
  });

  test("converts identifier only", () => {
    const result = convertCNNToPractitioner({
      $1_id: "12345",
    });

    expect(result).toEqual({
      resourceType: "Practitioner",
      identifier: [{ value: "12345" }],
    });
  });

  test("converts full name", () => {
    const result = convertCNNToPractitioner({
      $2_family: "Smith",
      $3_given: "John",
      $4_additionalGiven: "Michael",
      $5_suffix: "Jr",
      $6_prefix: "Dr",
      $7_degree: "MD",
    });

    expect(result?.name?.[0]).toEqual({
      family: "Smith",
      given: ["John", "Michael"],
      prefix: ["Dr"],
      suffix: ["Jr", "MD"],
    });
  });

  test("converts identifier and name", () => {
    const result = convertCNNToPractitioner({
      $1_id: "DOC001",
      $2_family: "Johnson",
      $3_given: "Sarah",
    });

    expect(result?.identifier?.[0]?.value).toBe("DOC001");
    expect(result?.name?.[0]?.family).toBe("Johnson");
    expect(result?.name?.[0]?.given).toEqual(["Sarah"]);
  });

  test("converts partial name", () => {
    const result = convertCNNToPractitioner({
      $2_family: "Williams",
    });

    expect(result?.name?.[0]).toEqual({
      family: "Williams",
    });
  });
});

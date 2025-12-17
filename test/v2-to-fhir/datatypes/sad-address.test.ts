import { test, expect, describe } from "bun:test";
import { convertSADToAddress } from "../../../src/v2-to-fhir/datatypes/sad-address";

describe("convertSADToAddress", () => {
  test("returns undefined for undefined input", () => {
    expect(convertSADToAddress(undefined)).toBeUndefined();
  });

  test("returns undefined for empty SAD", () => {
    expect(convertSADToAddress({})).toBeUndefined();
  });

  test("converts SAD with street address only", () => {
    const result = convertSADToAddress({
      $1_line: "123 Main Street",
    });
    expect(result).toEqual({
      line: ["123 Main Street"],
    });
  });

  test("converts SAD with street name only", () => {
    const result = convertSADToAddress({
      $2_streetName: "Main Street",
    });
    expect(result).toEqual({
      line: ["Main Street"],
    });
  });

  test("converts SAD with dwelling number only", () => {
    const result = convertSADToAddress({
      $3_houseNumber: "123",
    });
    expect(result).toEqual({
      line: ["123"],
    });
  });

  test("converts SAD with all fields", () => {
    const result = convertSADToAddress({
      $1_line: "123 Main Street, Suite 100",
      $2_streetName: "Main Street",
      $3_houseNumber: "123",
    });
    expect(result).toEqual({
      line: ["123 Main Street, Suite 100", "Main Street", "123"],
    });
  });

  test("converts SAD with street address and dwelling number", () => {
    const result = convertSADToAddress({
      $1_line: "Apartment 4B",
      $3_houseNumber: "456",
    });
    expect(result).toEqual({
      line: ["Apartment 4B", "456"],
    });
  });
});

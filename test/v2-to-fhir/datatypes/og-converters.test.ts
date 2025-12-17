import { test, expect, describe } from "bun:test";
import { convertOGToExtension } from "../../../src/v2-to-fhir/datatypes/og-converters";

describe("convertOGToExtension", () => {
  test("returns undefined for undefined input", () => {
    expect(convertOGToExtension(undefined)).toBeUndefined();
  });

  test("returns undefined when no values", () => {
    expect(convertOGToExtension({})).toBeUndefined();
  });

  test("returns extension with original sub-identifier", () => {
    const result = convertOGToExtension({
      $1_originalSubIdentifier: "1.2.3",
    });
    expect(result?.url).toBe("http://hl7.org/fhir/StructureDefinition/observation-v2-subid");
    expect(result?.extension).toHaveLength(1);
    expect(result?.extension?.[0]).toEqual({
      url: "original-sub-identifier",
      valueString: "1.2.3",
    });
  });

  test("returns extension with group as decimal", () => {
    const result = convertOGToExtension({
      $2_group: "5",
    });
    expect(result?.extension).toHaveLength(1);
    expect(result?.extension?.[0]).toEqual({
      url: "group",
      valueDecimal: 5,
    });
  });

  test("returns extension with sequence as decimal", () => {
    const result = convertOGToExtension({
      $3_sequence: "10",
    });
    expect(result?.extension).toHaveLength(1);
    expect(result?.extension?.[0]).toEqual({
      url: "sequence",
      valueDecimal: 10,
    });
  });

  test("returns extension with identifier", () => {
    const result = convertOGToExtension({
      $4_identifier: "obs-id-123",
    });
    expect(result?.extension).toHaveLength(1);
    expect(result?.extension?.[0]).toEqual({
      url: "identifier",
      valueString: "obs-id-123",
    });
  });

  test("returns extension with all fields", () => {
    const result = convertOGToExtension({
      $1_originalSubIdentifier: "1.2.3",
      $2_group: "2",
      $3_sequence: "3",
      $4_identifier: "id",
    });
    expect(result?.extension).toHaveLength(4);
  });

  test("skips invalid numeric values", () => {
    const result = convertOGToExtension({
      $2_group: "not-a-number",
    });
    expect(result).toBeUndefined();
  });
});

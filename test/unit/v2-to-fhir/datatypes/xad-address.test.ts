import { test, expect, describe } from "bun:test";
import {
  convertXADToAddress,
  convertXADArrayToAddresses,
  mapAddressTypeToFHIRWithResult,
  convertXADWithMappingSupport,
  convertXADArrayWithMappingSupport,
} from "../../../../src/v2-to-fhir/datatypes/xad-address";

describe("convertXADToAddress", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXADToAddress(undefined)).toBeUndefined();
  });

  test("returns undefined for empty XAD", () => {
    expect(convertXADToAddress({})).toBeUndefined();
  });

  test("converts XAD with SAD street address", () => {
    const result = convertXADToAddress({
      $1_line1: {
        $1_line: "123 Main Street",
      },
    });
    expect(result).toEqual({
      line: ["123 Main Street"],
    });
  });

  test("converts XAD with full SAD street address", () => {
    const result = convertXADToAddress({
      $1_line1: {
        $1_line: "123 Main Street",
        $2_streetName: "Main Street",
        $3_houseNumber: "123",
      },
    });
    expect(result).toEqual({
      line: ["123 Main Street", "Main Street", "123"],
    });
  });

  test("converts XAD with other designation", () => {
    const result = convertXADToAddress({
      $1_line1: { $1_line: "123 Main Street" },
      $2_line2: "Suite 100",
    });
    expect(result).toEqual({
      line: ["123 Main Street", "Suite 100"],
    });
  });

  test("converts XAD with city", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
    });
    expect(result).toEqual({
      city: "Boston",
    });
  });

  test("converts XAD with state", () => {
    const result = convertXADToAddress({
      $4_state: "MA",
    });
    expect(result).toEqual({
      state: "MA",
    });
  });

  test("converts XAD with postal code", () => {
    const result = convertXADToAddress({
      $5_postalCode: "02101",
    });
    expect(result).toEqual({
      postalCode: "02101",
    });
  });

  test("converts XAD with country", () => {
    const result = convertXADToAddress({
      $6_country: "USA",
    });
    expect(result).toEqual({
      country: "USA",
    });
  });

  test("converts XAD with district from county/parish", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $9_district: "Suffolk",
    });
    expect(result).toEqual({
      city: "Boston",
      district: "Suffolk",
    });
  });

  test("converts XAD.7 M to type postal", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $7_type: "M",
    });
    expect(result?.type).toBe("postal");
  });

  test("converts XAD.7 SH to type postal", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $7_type: "SH",
    });
    expect(result?.type).toBe("postal");
  });

  test("converts XAD.7 H to use home", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $7_type: "H",
    });
    expect(result?.use).toBe("home");
  });

  test("converts XAD.7 B to use work", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $7_type: "B",
    });
    expect(result?.use).toBe("work");
  });

  test("converts XAD.7 BI to use billing", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $7_type: "BI",
    });
    expect(result?.use).toBe("billing");
  });

  test("converts XAD.7 C to use temp", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $7_type: "C",
    });
    expect(result?.use).toBe("temp");
  });

  test("converts XAD.7 HV to extension", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $7_type: "HV",
    });
    expect(result?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/iso21090-AD-use",
      valueCode: "HV",
    });
  });

  test("includes address type extension for all type codes", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $7_type: "H",
    });
    expect(result?.extension).toContainEqual({
      url: "http://terminology.hl7.org/CodeSystem/v2-0190",
      valueCodeableConcept: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0190",
            code: "H",
          },
        ],
      },
    });
  });

  test("converts XAD.10 census tract to extension", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $10_censusTract: "0101.01",
    });
    expect(result?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-censusTract",
      valueString: "0101.01",
    });
  });

  test("converts XAD with period from DR", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $12_period: {
        $1_start: "20200101",
        $2_end: "20251231",
      },
    });
    expect(result?.period).toEqual({
      start: "20200101",
      end: "20251231",
    });
  });

  test("converts XAD with explicit start/end dates overriding DR", () => {
    const result = convertXADToAddress({
      $3_city: "Boston",
      $12_period: {
        $1_start: "20200101",
        $2_end: "20201231",
      },
      $13_start: "20210101",
      $14_end: "20261231",
    });
    expect(result?.period).toEqual({
      start: "20210101",
      end: "20261231",
    });
  });

  test("converts full XAD address", () => {
    const result = convertXADToAddress({
      $1_line1: {
        $1_line: "123 Main Street",
      },
      $2_line2: "Suite 200",
      $3_city: "Boston",
      $4_state: "MA",
      $5_postalCode: "02101",
      $6_country: "USA",
      $7_type: "H",
      $9_district: "Suffolk",
      $13_start: "20200101",
    });

    expect(result).toEqual({
      line: ["123 Main Street", "Suite 200"],
      city: "Boston",
      state: "MA",
      postalCode: "02101",
      country: "USA",
      district: "Suffolk",
      use: "home",
      period: { start: "20200101" },
      extension: [
        {
          url: "http://terminology.hl7.org/CodeSystem/v2-0190",
          valueCodeableConcept: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0190",
                code: "H",
              },
            ],
          },
        },
      ],
    });
  });
});

describe("convertXADArrayToAddresses", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXADArrayToAddresses(undefined)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(convertXADArrayToAddresses([])).toBeUndefined();
  });

  test("converts array of XAD addresses", () => {
    const result = convertXADArrayToAddresses([
      { $3_city: "Boston", $7_type: "H" },
      { $3_city: "Cambridge", $7_type: "B" },
    ]);

    expect(result).toHaveLength(2);
    expect(result?.[0]!.city).toBe("Boston");
    expect(result?.[0]!.use).toBe("home");
    expect(result?.[1]!.city).toBe("Cambridge");
    expect(result?.[1]!.use).toBe("work");
  });

  test("filters out invalid addresses", () => {
    const result = convertXADArrayToAddresses([
      { $3_city: "Boston" },
      {},
      { $3_city: "Cambridge" },
    ]);

    expect(result).toHaveLength(2);
  });
});

describe("mapAddressTypeToFHIRWithResult", () => {
  describe("valid address types that map to type", () => {
    test.each([
      ["M", "postal"],
      ["SH", "postal"],
    ] as const)("maps %s to type %s", (input, expectedType) => {
      const result = mapAddressTypeToFHIRWithResult(input);

      expect(result.type).toBe(expectedType);
      expect(result.use).toBeUndefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe("valid address types that map to use", () => {
    test.each([
      ["BA", "billing"],
      ["BI", "billing"],
      ["C", "temp"],
      ["B", "work"],
      ["H", "home"],
      ["O", "work"],
    ] as const)("maps %s to use %s", (input, expectedUse) => {
      const result = mapAddressTypeToFHIRWithResult(input);

      expect(result.use).toBe(expectedUse);
      expect(result.type).toBeUndefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe("special cases", () => {
    test("accepts lowercase address type", () => {
      const result = mapAddressTypeToFHIRWithResult("h");

      expect(result.use).toBe("home");
      expect(result.error).toBeUndefined();
    });

    test("HV returns no type/use (extension only)", () => {
      const result = mapAddressTypeToFHIRWithResult("HV");

      expect(result.type).toBeUndefined();
      expect(result.use).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    test("undefined address type returns empty result (no error)", () => {
      const result = mapAddressTypeToFHIRWithResult(undefined);

      expect(result.type).toBeUndefined();
      expect(result.use).toBeUndefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe("invalid address types", () => {
    test("returns error for invalid address type P", () => {
      const result = mapAddressTypeToFHIRWithResult("P");

      expect(result.type).toBeUndefined();
      expect(result.use).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.mappingType).toBe("address-type");
      expect(result.error?.localCode).toBe("P");
      expect(result.error?.localSystem).toBe(
        "http://terminology.hl7.org/CodeSystem/v2-0190",
      );
    });

    test("returns error for invalid address type X", () => {
      const result = mapAddressTypeToFHIRWithResult("X");

      expect(result.error).toBeDefined();
      expect(result.error?.localCode).toBe("X");
    });

    test("returns error for invalid address type 99", () => {
      const result = mapAddressTypeToFHIRWithResult("99");

      expect(result.error).toBeDefined();
      expect(result.error?.localCode).toBe("99");
    });

    test("error includes descriptive local display", () => {
      const result = mapAddressTypeToFHIRWithResult("CUSTOM");

      expect(result.error?.localDisplay).toContain("XAD.7");
      expect(result.error?.localDisplay).toContain("CUSTOM");
    });
  });
});

describe("convertXADWithMappingSupport", () => {
  describe("valid address types", () => {
    test("returns address with type for valid type code", () => {
      const result = convertXADWithMappingSupport({
        $3_city: "Boston",
        $7_type: "M",
      });

      expect(result.address).toBeDefined();
      expect(result.address?.city).toBe("Boston");
      expect(result.address?.type).toBe("postal");
      expect(result.error).toBeUndefined();
    });

    test("returns address with use for valid use code", () => {
      const result = convertXADWithMappingSupport({
        $3_city: "Boston",
        $7_type: "H",
      });

      expect(result.address).toBeDefined();
      expect(result.address?.use).toBe("home");
      expect(result.error).toBeUndefined();
    });

    test("returns address without type/use for HV (extension only)", () => {
      const result = convertXADWithMappingSupport({
        $3_city: "Boston",
        $7_type: "HV",
      });

      expect(result.address).toBeDefined();
      expect(result.address?.type).toBeUndefined();
      expect(result.address?.use).toBeUndefined();
      // But extension should be present
      expect(result.address?.extension).toContainEqual({
        url: "http://hl7.org/fhir/StructureDefinition/iso21090-AD-use",
        valueCode: "HV",
      });
      expect(result.error).toBeUndefined();
    });
  });

  describe("invalid address types", () => {
    test("returns address without type/use AND error for invalid type", () => {
      const result = convertXADWithMappingSupport({
        $3_city: "Boston",
        $7_type: "P",
      });

      expect(result.address).toBeDefined();
      expect(result.address?.city).toBe("Boston");
      expect(result.address?.type).toBeUndefined();
      expect(result.address?.use).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.localCode).toBe("P");
    });

    test("includes all other address fields when type is invalid", () => {
      const result = convertXADWithMappingSupport({
        $1_line1: { $1_line: "123 Main St" },
        $3_city: "Boston",
        $4_state: "MA",
        $5_postalCode: "02101",
        $7_type: "UNKNOWN",
      });

      expect(result.address).toBeDefined();
      expect(result.address?.line).toEqual(["123 Main St"]);
      expect(result.address?.city).toBe("Boston");
      expect(result.address?.state).toBe("MA");
      expect(result.address?.postalCode).toBe("02101");
      expect(result.error?.localCode).toBe("UNKNOWN");
    });
  });

  describe("edge cases", () => {
    test("returns undefined address for undefined input", () => {
      const result = convertXADWithMappingSupport(undefined);

      expect(result.address).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    test("returns undefined address for empty XAD", () => {
      const result = convertXADWithMappingSupport({});

      expect(result.address).toBeUndefined();
      expect(result.error).toBeUndefined();
    });
  });
});

describe("convertXADArrayWithMappingSupport", () => {
  test("returns addresses and empty errors for valid types", () => {
    const result = convertXADArrayWithMappingSupport([
      { $3_city: "Boston", $7_type: "H" },
      { $3_city: "Cambridge", $7_type: "B" },
    ]);

    expect(result.addresses).toHaveLength(2);
    expect(result.addresses?.[0]?.use).toBe("home");
    expect(result.addresses?.[1]?.use).toBe("work");
    expect(result.errors).toHaveLength(0);
  });

  test("collects errors from invalid types while still returning addresses", () => {
    const result = convertXADArrayWithMappingSupport([
      { $3_city: "Boston", $7_type: "H" },
      { $3_city: "Cambridge", $7_type: "P" },
    ]);

    expect(result.addresses).toHaveLength(2);
    expect(result.addresses?.[0]?.use).toBe("home");
    expect(result.addresses?.[1]?.use).toBeUndefined(); // P is invalid
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.localCode).toBe("P");
  });

  test("deduplicates errors by localCode", () => {
    const result = convertXADArrayWithMappingSupport([
      { $3_city: "Boston", $7_type: "P" },
      { $3_city: "Cambridge", $7_type: "P" },
      { $3_city: "Somerville", $7_type: "Q" },
    ]);

    expect(result.addresses).toHaveLength(3);
    expect(result.errors).toHaveLength(2); // P deduplicated, Q is unique
    expect(result.errors.map((e) => e.localCode)).toEqual(["P", "Q"]);
  });

  test("returns undefined addresses for empty array", () => {
    const result = convertXADArrayWithMappingSupport([]);

    expect(result.addresses).toBeUndefined();
    expect(result.errors).toHaveLength(0);
  });

  test("returns undefined addresses for undefined input", () => {
    const result = convertXADArrayWithMappingSupport(undefined);

    expect(result.addresses).toBeUndefined();
    expect(result.errors).toHaveLength(0);
  });
});

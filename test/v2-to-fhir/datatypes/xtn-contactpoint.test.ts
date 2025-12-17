import { test, expect, describe } from "bun:test";
import {
  convertXTNToContactPoint,
  convertXTNArrayToContactPoints,
} from "../../../src/v2-to-fhir/datatypes/xtn-contactpoint";

describe("convertXTNToContactPoint", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXTNToContactPoint(undefined)).toBeUndefined();
  });

  test("returns undefined for empty XTN", () => {
    expect(convertXTNToContactPoint({})).toBeUndefined();
  });

  test("converts XTN with telephone number only", () => {
    const result = convertXTNToContactPoint({
      $1_value: "555-1234",
    });
    expect(result).toEqual({
      value: "555-1234",
    });
  });

  test("converts XTN with system PH to phone", () => {
    const result = convertXTNToContactPoint({
      $1_value: "555-1234",
      $3_system: "PH",
    });
    expect(result).toEqual({
      system: "phone",
      value: "555-1234",
    });
  });

  test("converts XTN with system CP to phone", () => {
    const result = convertXTNToContactPoint({
      $1_value: "555-1234",
      $3_system: "CP",
    });
    expect(result?.system).toBe("phone");
  });

  test("converts XTN with system FX to fax", () => {
    const result = convertXTNToContactPoint({
      $1_value: "555-1234",
      $3_system: "FX",
    });
    expect(result?.system).toBe("fax");
  });

  test("converts XTN with system BP to pager", () => {
    const result = convertXTNToContactPoint({
      $1_value: "555-1234",
      $3_system: "BP",
    });
    expect(result?.system).toBe("pager");
  });

  test("converts XTN with system Internet to email", () => {
    const result = convertXTNToContactPoint({
      $3_system: "Internet",
      $4_email: "john@example.com",
    });
    expect(result).toEqual({
      system: "email",
      value: "john@example.com",
    });
  });

  test("converts XTN with system X.400 to email", () => {
    const result = convertXTNToContactPoint({
      $3_system: "X.400",
      $4_email: "john@x400.example.com",
    });
    expect(result?.system).toBe("email");
  });

  test("defaults to email system when XTN.4 valued but no XTN.3", () => {
    const result = convertXTNToContactPoint({
      $4_email: "john@example.com",
    });
    expect(result).toEqual({
      system: "email",
      value: "john@example.com",
    });
  });

  test("converts XTN with use code PRN to home", () => {
    const result = convertXTNToContactPoint({
      $1_value: "555-1234",
      $2_use: "PRN",
    });
    expect(result?.use).toBe("home");
  });

  test("converts XTN with use code WPN to work", () => {
    const result = convertXTNToContactPoint({
      $1_value: "555-1234",
      $2_use: "WPN",
    });
    expect(result?.use).toBe("work");
  });

  test("converts XTN with use code EMR to temp", () => {
    const result = convertXTNToContactPoint({
      $1_value: "555-1234",
      $2_use: "EMR",
    });
    expect(result?.use).toBe("temp");
  });

  test("prefers XTN.12 (unformatted) over XTN.1 for phone", () => {
    const result = convertXTNToContactPoint({
      $1_value: "555-1234",
      $3_system: "PH",
      $12_unformatted: "5551234",
    });
    expect(result?.value).toBe("5551234");
  });

  test("builds value from components when XTN.7 is valued", () => {
    const result = convertXTNToContactPoint({
      $3_system: "PH",
      $6_areaCode: "555",
      $7_localNumber: "1234567",
    });
    expect(result?.value).toBe("555 1234567");
  });

  test("builds value with country code", () => {
    const result = convertXTNToContactPoint({
      $3_system: "PH",
      $5_countryCode: "1",
      $6_areaCode: "555",
      $7_localNumber: "1234567",
    });
    expect(result?.value).toBe("+1 555 1234567");
  });

  test("builds value with extension", () => {
    const result = convertXTNToContactPoint({
      $3_system: "PH",
      $6_areaCode: "555",
      $7_localNumber: "1234567",
      $8_extension: "100",
    });
    expect(result?.value).toBe("555 1234567 X100");
  });

  test("builds value with all components", () => {
    const result = convertXTNToContactPoint({
      $3_system: "PH",
      $5_countryCode: "1",
      $6_areaCode: "555",
      $7_localNumber: "1234567",
      $8_extension: "100",
    });
    expect(result?.value).toBe("+1 555 1234567 X100");
  });

  test("adds country code extension for phone", () => {
    const result = convertXTNToContactPoint({
      $3_system: "PH",
      $5_countryCode: "1",
      $7_localNumber: "1234567",
    });
    expect(result?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/contactpoint-country",
      valueString: "1",
    });
  });

  test("adds area code extension for phone", () => {
    const result = convertXTNToContactPoint({
      $3_system: "PH",
      $6_areaCode: "555",
      $7_localNumber: "1234567",
    });
    expect(result?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/contactpoint-area",
      valueString: "555",
    });
  });

  test("adds local number extension for phone", () => {
    const result = convertXTNToContactPoint({
      $3_system: "PH",
      $7_localNumber: "1234567",
    });
    expect(result?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/contactpoint-local",
      valueString: "1234567",
    });
  });

  test("adds extension extension for phone", () => {
    const result = convertXTNToContactPoint({
      $3_system: "PH",
      $7_localNumber: "1234567",
      $8_extension: "100",
    });
    expect(result?.extension).toContainEqual({
      url: "http://hl7.org/fhir/StructureDefinition/contactpoint-extension",
      valueString: "100",
    });
  });

  test("does not add phone extensions for email", () => {
    const result = convertXTNToContactPoint({
      $3_system: "Internet",
      $4_email: "john@example.com",
      $5_countryCode: "1",
      $6_areaCode: "555",
    });
    expect(result?.extension).toBeUndefined();
  });

  test("converts full XTN phone number", () => {
    const result = convertXTNToContactPoint({
      $2_use: "WPN",
      $3_system: "PH",
      $5_countryCode: "1",
      $6_areaCode: "555",
      $7_localNumber: "1234567",
      $8_extension: "100",
    });

    expect(result).toEqual({
      system: "phone",
      value: "+1 555 1234567 X100",
      use: "work",
      extension: [
        {
          url: "http://hl7.org/fhir/StructureDefinition/contactpoint-country",
          valueString: "1",
        },
        {
          url: "http://hl7.org/fhir/StructureDefinition/contactpoint-area",
          valueString: "555",
        },
        {
          url: "http://hl7.org/fhir/StructureDefinition/contactpoint-local",
          valueString: "1234567",
        },
        {
          url: "http://hl7.org/fhir/StructureDefinition/contactpoint-extension",
          valueString: "100",
        },
      ],
    });
  });
});

describe("convertXTNArrayToContactPoints", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXTNArrayToContactPoints(undefined)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(convertXTNArrayToContactPoints([])).toBeUndefined();
  });

  test("converts array of XTN", () => {
    const result = convertXTNArrayToContactPoints([
      { $1_value: "555-1234", $3_system: "PH", $2_use: "WPN" },
      { $4_email: "john@example.com", $3_system: "Internet" },
    ]);

    expect(result).toHaveLength(2);
    expect(result?.[0].system).toBe("phone");
    expect(result?.[0].value).toBe("555-1234");
    expect(result?.[1].system).toBe("email");
    expect(result?.[1].value).toBe("john@example.com");
  });

  test("filters out invalid contact points", () => {
    const result = convertXTNArrayToContactPoints([
      { $1_value: "555-1234" },
      {},
      { $4_email: "john@example.com" },
    ]);

    expect(result).toHaveLength(2);
  });
});

import { test, expect, describe } from "bun:test";
import { convertXPNToString } from "../../../src/v2-to-fhir/datatypes/xpn-humanname";

describe("convertXPNToString", () => {
  test("returns undefined for undefined input", () => {
    expect(convertXPNToString(undefined)).toBeUndefined();
  });

  test("returns undefined for empty XPN", () => {
    expect(convertXPNToString({})).toBeUndefined();
  });

  test("converts XPN with family name only", () => {
    const result = convertXPNToString({
      $1_family: { $1_family: "Smith" },
    });
    expect(result).toBe("Smith");
  });

  test("converts XPN with given name only", () => {
    const result = convertXPNToString({
      $2_given: "John",
    });
    expect(result).toBe("John");
  });

  test("converts XPN with given and family (default order)", () => {
    const result = convertXPNToString({
      $1_family: { $1_family: "Smith" },
      $2_given: "John",
    });
    expect(result).toBe("John Smith");
  });

  test("converts XPN with given, middle, and family (default order)", () => {
    const result = convertXPNToString({
      $1_family: { $1_family: "Smith" },
      $2_given: "John",
      $3_additionalGiven: "Michael",
    });
    expect(result).toBe("John Michael Smith");
  });

  test("converts XPN with family first order (F)", () => {
    const result = convertXPNToString({
      $1_family: { $1_family: "Smith" },
      $2_given: "John",
      $11_order: "F",
    });
    expect(result).toBe("Smith John");
  });

  test("converts XPN with given first order (G)", () => {
    const result = convertXPNToString({
      $1_family: { $1_family: "Smith" },
      $2_given: "John",
      $11_order: "G",
    });
    expect(result).toBe("John Smith");
  });

  test("converts XPN with prefix", () => {
    const result = convertXPNToString({
      $1_family: { $1_family: "Smith" },
      $2_given: "John",
      $5_prefix: "Dr",
    });
    expect(result).toBe("Dr John Smith");
  });

  test("converts XPN with suffix", () => {
    const result = convertXPNToString({
      $1_family: { $1_family: "Smith" },
      $2_given: "John",
      $4_suffix: "Jr",
    });
    expect(result).toBe("John Smith Jr");
  });

  test("converts XPN with qualification (degree)", () => {
    const result = convertXPNToString({
      $1_family: { $1_family: "Smith" },
      $2_given: "John",
      $6_qualification: "MD",
    });
    expect(result).toBe("John Smith MD");
  });

  test("converts XPN with professional credential", () => {
    const result = convertXPNToString({
      $1_family: { $1_family: "Smith" },
      $2_given: "John",
      $14_credential: "FACP",
    });
    expect(result).toBe("John Smith FACP");
  });

  test("converts full XPN with all parts", () => {
    const result = convertXPNToString({
      $1_family: { $1_family: "Smith" },
      $2_given: "John",
      $3_additionalGiven: "Michael",
      $4_suffix: "III",
      $5_prefix: "Dr",
      $6_qualification: "MD",
      $14_credential: "FACP",
    });
    expect(result).toBe("Dr John Michael Smith III MD FACP");
  });

  test("converts full XPN with family first order", () => {
    const result = convertXPNToString({
      $1_family: { $1_family: "Smith" },
      $2_given: "John",
      $3_additionalGiven: "Michael",
      $4_suffix: "III",
      $5_prefix: "Dr",
      $11_order: "F",
    });
    expect(result).toBe("Dr Smith John Michael III");
  });
});

import { test, expect, describe } from "bun:test";
import {
  convertHDToUri,
  convertHDToIdentifiers,
  convertHDToDevice,
  convertHDToOrganization,
  convertHDToLocation,
  convertHDToMessageHeaderEndpoint,
  convertHDToMessageHeaderName,
} from "../../../../src/v2-to-fhir/datatypes/hd-converters";

describe("convertHDToUri", () => {
  test("returns undefined for undefined input", () => {
    expect(convertHDToUri(undefined)).toBeUndefined();
  });

  test("returns namespace when valued", () => {
    const result = convertHDToUri({
      $1_namespace: "MyNamespace",
      $2_system: "1.2.3.4",
      $3_systemType: "ISO",
    });
    expect(result).toBe("MyNamespace");
  });

  test("returns urn:oid: prefix for ISO type", () => {
    const result = convertHDToUri({
      $2_system: "1.2.3.4.5.6",
      $3_systemType: "ISO",
    });
    expect(result).toBe("urn:oid:1.2.3.4.5.6");
  });

  test("returns urn:uuid: prefix for UUID type", () => {
    const result = convertHDToUri({
      $2_system: "550e8400-e29b-41d4-a716-446655440000",
      $3_systemType: "UUID",
    });
    expect(result).toBe("urn:uuid:550e8400-e29b-41d4-a716-446655440000");
  });

  test("returns system as-is for other types", () => {
    const result = convertHDToUri({
      $2_system: "example.com",
      $3_systemType: "DNS",
    });
    expect(result).toBe("example.com");
  });

  test("returns undefined when no values", () => {
    expect(convertHDToUri({})).toBeUndefined();
  });
});

describe("convertHDToIdentifiers", () => {
  test("returns undefined for undefined input", () => {
    expect(convertHDToIdentifiers(undefined)).toBeUndefined();
  });

  test("returns identifier from namespace only", () => {
    const result = convertHDToIdentifiers({
      $1_namespace: "MyNamespace",
    });
    expect(result).toEqual([{ value: "MyNamespace" }]);
  });

  test("returns identifier from universal ID with ISO type", () => {
    const result = convertHDToIdentifiers({
      $2_system: "1.2.3.4",
      $3_systemType: "ISO",
    });
    expect(result).toEqual([
      {
        value: "1.2.3.4",
        type: { coding: [{ code: "ISO" }] },
        system: "urn:ietf:rfc:3986",
      },
    ]);
  });

  test("returns identifier from universal ID with UUID type", () => {
    const result = convertHDToIdentifiers({
      $2_system: "550e8400-e29b-41d4-a716-446655440000",
      $3_systemType: "UUID",
    });
    expect(result).toEqual([
      {
        value: "550e8400-e29b-41d4-a716-446655440000",
        type: { coding: [{ code: "UUID" }] },
        system: "urn:ietf:rfc:3986",
      },
    ]);
  });

  test("returns both identifiers when namespace and system present", () => {
    const result = convertHDToIdentifiers({
      $1_namespace: "MyNamespace",
      $2_system: "1.2.3.4",
      $3_systemType: "ISO",
    });
    expect(result).toEqual([
      { value: "MyNamespace" },
      {
        value: "1.2.3.4",
        type: { coding: [{ code: "ISO" }] },
        system: "urn:ietf:rfc:3986",
      },
    ]);
  });

  test("returns identifier without system for non-standard type", () => {
    const result = convertHDToIdentifiers({
      $2_system: "example.com",
      $3_systemType: "DNS",
    });
    expect(result).toEqual([
      {
        value: "example.com",
        type: { coding: [{ code: "DNS" }] },
      },
    ]);
  });

  test("returns undefined when no values", () => {
    expect(convertHDToIdentifiers({})).toBeUndefined();
  });
});

describe("convertHDToDevice", () => {
  test("returns undefined for undefined input", () => {
    expect(convertHDToDevice(undefined)).toBeUndefined();
  });

  test("returns device with identifiers", () => {
    const result = convertHDToDevice({
      $1_namespace: "DeviceNamespace",
    });
    expect(result).toEqual({
      identifier: [{ value: "DeviceNamespace" }],
    });
  });
});

describe("convertHDToOrganization", () => {
  test("returns undefined for undefined input", () => {
    expect(convertHDToOrganization(undefined)).toBeUndefined();
  });

  test("returns organization with identifiers", () => {
    const result = convertHDToOrganization({
      $1_namespace: "OrgNamespace",
      $2_system: "1.2.3.4",
      $3_systemType: "ISO",
    });
    expect(result).toEqual({
      identifier: [
        { value: "OrgNamespace" },
        {
          value: "1.2.3.4",
          type: { coding: [{ code: "ISO" }] },
          system: "urn:ietf:rfc:3986",
        },
      ],
    });
  });
});

describe("convertHDToLocation", () => {
  test("returns undefined for undefined input", () => {
    expect(convertHDToLocation(undefined)).toBeUndefined();
  });

  test("returns undefined when no values", () => {
    expect(convertHDToLocation({})).toBeUndefined();
  });

  test("returns location with name from namespace", () => {
    const result = convertHDToLocation({
      $1_namespace: "MainBuilding",
    });
    expect(result).toEqual({
      name: "MainBuilding",
      physicalType: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/location-physical-type",
            code: "si",
          },
        ],
      },
    });
  });

  test("returns location with identifier for ISO type", () => {
    const result = convertHDToLocation({
      $2_system: "1.2.3.4",
      $3_systemType: "ISO",
    });
    expect(result).toEqual({
      identifier: { value: "1.2.3.4" },
      physicalType: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/location-physical-type",
            code: "si",
          },
        ],
      },
    });
  });

  test("returns location with name and identifier", () => {
    const result = convertHDToLocation({
      $1_namespace: "MainBuilding",
      $2_system: "1.2.3.4",
      $3_systemType: "ISO",
    });
    expect(result).toEqual({
      name: "MainBuilding",
      identifier: { value: "1.2.3.4" },
      physicalType: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/location-physical-type",
            code: "si",
          },
        ],
      },
    });
  });

  test("does not add identifier for non-ISO/UUID types", () => {
    const result = convertHDToLocation({
      $1_namespace: "MainBuilding",
      $2_system: "example.com",
      $3_systemType: "DNS",
    });
    expect(result).toEqual({
      name: "MainBuilding",
      physicalType: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/location-physical-type",
            code: "si",
          },
        ],
      },
    });
  });
});

describe("convertHDToMessageHeaderEndpoint", () => {
  test("returns undefined for undefined input", () => {
    expect(convertHDToMessageHeaderEndpoint(undefined)).toBeUndefined();
  });

  test("returns undefined when no values", () => {
    expect(convertHDToMessageHeaderEndpoint({})).toBeUndefined();
  });

  test("returns endpoint with urn:oid: for ISO type", () => {
    const result = convertHDToMessageHeaderEndpoint({
      $2_system: "1.2.3.4",
      $3_systemType: "ISO",
    });
    expect(result).toEqual({ endpoint: "urn:oid:1.2.3.4" });
  });

  test("returns endpoint with urn:uuid: for UUID type", () => {
    const result = convertHDToMessageHeaderEndpoint({
      $2_system: "550e8400-e29b-41d4-a716-446655440000",
      $3_systemType: "UUID",
    });
    expect(result).toEqual({ endpoint: "urn:uuid:550e8400-e29b-41d4-a716-446655440000" });
  });

  test("returns endpoint with urn:dns: for DNS type", () => {
    const result = convertHDToMessageHeaderEndpoint({
      $2_system: "example.com",
      $3_systemType: "DNS",
    });
    expect(result).toEqual({ endpoint: "urn:dns:example.com" });
  });

  test("returns endpoint as-is for URI type", () => {
    const result = convertHDToMessageHeaderEndpoint({
      $2_system: "http://example.com/endpoint",
      $3_systemType: "URI",
    });
    expect(result).toEqual({ endpoint: "http://example.com/endpoint" });
  });

  test("returns name when namespace only", () => {
    const result = convertHDToMessageHeaderEndpoint({
      $1_namespace: "MyApplication",
    });
    expect(result).toEqual({ name: "MyApplication" });
  });

  test("returns combined name for non-standard type", () => {
    const result = convertHDToMessageHeaderEndpoint({
      $1_namespace: "MyApp",
      $2_system: "custom-id",
      $3_systemType: "L",
    });
    expect(result).toEqual({ name: "MyApp - L:custom-id" });
  });
});

describe("convertHDToMessageHeaderName", () => {
  test("returns undefined for undefined input", () => {
    expect(convertHDToMessageHeaderName(undefined)).toBeUndefined();
  });

  test("returns namespace as name", () => {
    const result = convertHDToMessageHeaderName({
      $1_namespace: "MyApplication",
      $2_system: "1.2.3.4",
    });
    expect(result).toBe("MyApplication");
  });

  test("returns undefined when no namespace", () => {
    const result = convertHDToMessageHeaderName({
      $2_system: "1.2.3.4",
    });
    expect(result).toBeUndefined();
  });
});

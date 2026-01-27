import { test, expect, describe } from "bun:test";
import {
  convertEIToCoding,
  convertEIToIdentifierSystem,
  convertEIToIdentifierExtension,
  convertEIToIdentifierOrganization,
  convertEIToIdentifierDefaultAssigner,
  convertEIToCondition,
  convertEIToProcedure,
  convertEIToDeviceUdiCarrier,
  convertEIPToPlacerAssignedIdentifier,
  convertEIPToFillerAssignedIdentifier,
} from "../../../../src/v2-to-fhir/datatypes/ei-coding";

describe("convertEIToCoding", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEIToCoding(undefined)).toBeUndefined();
  });

  test("returns undefined for empty EI", () => {
    expect(convertEIToCoding({})).toBeUndefined();
  });

  test("returns undefined when value is missing", () => {
    expect(convertEIToCoding({ $2_namespace: "NS" })).toBeUndefined();
  });

  test("converts code only", () => {
    const result = convertEIToCoding({ $1_value: "ABC123" });
    expect(result).toEqual({ code: "ABC123" });
  });

  test("converts code with system", () => {
    const result = convertEIToCoding({
      $1_value: "ABC123",
      $2_namespace: "http://example.com/system",
    });
    expect(result).toEqual({
      code: "ABC123",
      system: "http://example.com/system",
    });
  });
});

describe("convertEIToIdentifierSystem", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEIToIdentifierSystem(undefined)).toBeUndefined();
  });

  test("returns undefined for empty EI", () => {
    expect(convertEIToIdentifierSystem({})).toBeUndefined();
  });

  test("converts value only", () => {
    const result = convertEIToIdentifierSystem({ $1_value: "ID123" });
    expect(result).toEqual({ value: "ID123" });
  });

  test("converts value with system from Universal ID", () => {
    const result = convertEIToIdentifierSystem({
      $1_value: "ID123",
      $3_system: "urn:oid:2.16.840.1.113883.4.6",
    });
    expect(result).toEqual({
      value: "ID123",
      system: "urn:oid:2.16.840.1.113883.4.6",
    });
  });
});

describe("convertEIToIdentifierExtension", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEIToIdentifierExtension(undefined)).toBeUndefined();
  });

  test("converts value with namespace as system", () => {
    const result = convertEIToIdentifierExtension({
      $1_value: "EXT001",
      $2_namespace: "HOSPITAL",
    });
    expect(result).toEqual({
      value: "EXT001",
      system: "HOSPITAL",
    });
  });
});

describe("convertEIToIdentifierOrganization", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEIToIdentifierOrganization(undefined)).toBeUndefined();
  });

  test("converts value with assigner display", () => {
    const result = convertEIToIdentifierOrganization({
      $1_value: "ORG001",
      $2_namespace: "Main Hospital",
    });
    expect(result).toEqual({
      value: "ORG001",
      assigner: {
        display: "Main Hospital",
      },
    });
  });

  test("converts value without assigner when namespace missing", () => {
    const result = convertEIToIdentifierOrganization({
      $1_value: "ORG001",
    });
    expect(result).toEqual({
      value: "ORG001",
    });
  });
});

describe("convertEIToIdentifierDefaultAssigner", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEIToIdentifierDefaultAssigner(undefined)).toBeUndefined();
  });

  test("converts value with assigner identifier", () => {
    const result = convertEIToIdentifierDefaultAssigner({
      $1_value: "DEF001",
      $2_namespace: "NS001",
      $3_system: "urn:oid:1.2.3.4",
    });
    expect(result).toEqual({
      value: "DEF001",
      assigner: {
        identifier: {
          value: "NS001",
          system: "urn:oid:1.2.3.4",
        },
      },
    });
  });

  test("converts value with namespace only", () => {
    const result = convertEIToIdentifierDefaultAssigner({
      $1_value: "DEF001",
      $2_namespace: "NS001",
    });
    expect(result).toEqual({
      value: "DEF001",
      assigner: {
        identifier: {
          value: "NS001",
        },
      },
    });
  });

  test("converts value with system only", () => {
    const result = convertEIToIdentifierDefaultAssigner({
      $1_value: "DEF001",
      $3_system: "urn:oid:1.2.3.4",
    });
    expect(result).toEqual({
      value: "DEF001",
      assigner: {
        identifier: {
          system: "urn:oid:1.2.3.4",
        },
      },
    });
  });
});

describe("convertEIToCondition", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEIToCondition(undefined)).toBeUndefined();
  });

  test("returns undefined for empty EI", () => {
    expect(convertEIToCondition({})).toBeUndefined();
  });

  test("converts simple condition identifier", () => {
    const result = convertEIToCondition({ $1_value: "COND001" });
    expect(result).toEqual({
      identifier: { value: "COND001" },
    });
  });

  test("converts condition with full assigner", () => {
    const result = convertEIToCondition({
      $1_value: "COND001",
      $2_namespace: "HOSPITAL",
      $3_system: "urn:oid:1.2.3.4",
      $4_systemType: "ISO",
    });
    expect(result).toEqual({
      identifier: {
        value: "COND001",
        assigner: {
          identifier: {
            value: "HOSPITAL",
            system: "urn:oid:1.2.3.4",
            type: {
              coding: [{ code: "ISO" }],
            },
          },
        },
      },
    });
  });
});

describe("convertEIToProcedure", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEIToProcedure(undefined)).toBeUndefined();
  });

  test("converts procedure identifier", () => {
    const result = convertEIToProcedure({ $1_value: "PROC001" });
    expect(result).toEqual({
      identifier: { value: "PROC001" },
    });
  });
});

describe("convertEIToDeviceUdiCarrier", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEIToDeviceUdiCarrier(undefined)).toBeUndefined();
  });

  test("returns undefined for empty EI", () => {
    expect(convertEIToDeviceUdiCarrier({})).toBeUndefined();
  });

  test("converts device identifier", () => {
    const result = convertEIToDeviceUdiCarrier({ $1_value: "UDI12345" });
    expect(result).toEqual({
      deviceIdentifier: "UDI12345",
    });
  });
});

describe("convertEIPToPlacerAssignedIdentifier", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEIPToPlacerAssignedIdentifier(undefined)).toBeUndefined();
  });

  test("returns undefined for empty EIP", () => {
    expect(convertEIPToPlacerAssignedIdentifier({})).toBeUndefined();
  });

  test("converts placer identifier with PGN type", () => {
    const result = convertEIPToPlacerAssignedIdentifier({
      $1_placerAssignedIdentifier: { $1_value: "PLACER001" },
    });
    expect(result).toEqual({
      value: "PLACER001",
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "PGN",
          },
        ],
      },
    });
  });
});

describe("convertEIPToFillerAssignedIdentifier", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEIPToFillerAssignedIdentifier(undefined)).toBeUndefined();
  });

  test("returns undefined for empty EIP", () => {
    expect(convertEIPToFillerAssignedIdentifier({})).toBeUndefined();
  });

  test("converts filler identifier with FGN type", () => {
    const result = convertEIPToFillerAssignedIdentifier({
      $2_fillerAssignedIdentifier: { $1_value: "FILLER001" },
    });
    expect(result).toEqual({
      value: "FILLER001",
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "FGN",
          },
        ],
      },
    });
  });
});

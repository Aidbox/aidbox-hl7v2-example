import { test, expect, describe } from "bun:test";
import { convertNDLToPractitionerRole } from "../../../src/v2-to-fhir/datatypes/ndl-converters";

describe("convertNDLToPractitionerRole", () => {
  test("returns undefined for undefined input", () => {
    expect(convertNDLToPractitionerRole(undefined)).toBeUndefined();
  });

  test("returns undefined when no values", () => {
    expect(convertNDLToPractitionerRole({})).toBeUndefined();
  });

  test("returns practitioner reference indicator when name present", () => {
    const result = convertNDLToPractitionerRole({
      $1_name: {
        $1_idNumber: "12345",
        $2_family: "Smith",
      },
    });
    expect(result?.practitioner).toBeDefined();
  });

  test("returns period from start/end dates", () => {
    const result = convertNDLToPractitionerRole({
      $2_startDateTime: "202301010800",
      $3_endDateTime: "202301011700",
    });
    expect(result?.period).toEqual({
      start: "202301010800",
      end: "202301011700",
    });
  });

  test("returns period with only start date", () => {
    const result = convertNDLToPractitionerRole({
      $2_startDateTime: "202301010800",
    });
    expect(result?.period).toEqual({
      start: "202301010800",
    });
  });

  test("returns locations array with point of care", () => {
    const result = convertNDLToPractitionerRole({
      $4_pointOfCare: "ICU",
    });
    expect(result?.locations).toHaveLength(1);
    expect(result?.locations?.[0]?.identifier).toEqual([{ value: "ICU" }]);
    expect(result?.locations?.[0]?.physicalType?.coding?.[0]?.code).toBe("poc");
  });

  test("returns locations array with room", () => {
    const result = convertNDLToPractitionerRole({
      $5_room: "ROOM-101",
    });
    expect(result?.locations?.[0]?.identifier).toEqual([{ value: "ROOM-101" }]);
    expect(result?.locations?.[0]?.physicalType?.coding?.[0]?.code).toBe("ro");
  });

  test("returns locations array with bed", () => {
    const result = convertNDLToPractitionerRole({
      $6_bed: "BED-A",
    });
    expect(result?.locations?.[0]?.identifier).toEqual([{ value: "BED-A" }]);
    expect(result?.locations?.[0]?.physicalType?.coding?.[0]?.code).toBe("bd");
  });

  test("returns locations array with facility from HD", () => {
    const result = convertNDLToPractitionerRole({
      $7_facility: {
        $1_namespace: "MainHospital",
      },
    });
    expect(result?.locations).toHaveLength(1);
    expect(result?.locations?.[0]?.physicalType?.coding?.[0]?.code).toBe("si");
  });

  test("returns locations array with building", () => {
    const result = convertNDLToPractitionerRole({
      $10_building: "Building-A",
    });
    expect(result?.locations?.[0]?.identifier).toEqual([{ value: "Building-A" }]);
    expect(result?.locations?.[0]?.physicalType?.coding?.[0]?.code).toBe("bu");
  });

  test("returns locations array with floor", () => {
    const result = convertNDLToPractitionerRole({
      $11_floor: "Floor-3",
    });
    expect(result?.locations?.[0]?.identifier).toEqual([{ value: "Floor-3" }]);
    expect(result?.locations?.[0]?.physicalType?.coding?.[0]?.code).toBe("lvl");
  });

  test("sets location status on all locations", () => {
    const result = convertNDLToPractitionerRole({
      $5_room: "ROOM-1",
      $6_bed: "BED-1",
      $8_locationStatus: "active",
    });
    expect(result?.locations?.[0]?.status).toBe("active");
    expect(result?.locations?.[1]?.status).toBe("active");
  });

  test("returns complete PractitionerRole data", () => {
    const result = convertNDLToPractitionerRole({
      $1_name: {
        $1_idNumber: "DR001",
        $2_family: "Jones",
        $3_given: "Mary",
      },
      $2_startDateTime: "202301010800",
      $3_endDateTime: "202301011700",
      $4_pointOfCare: "ER",
      $5_room: "ROOM-5",
      $8_locationStatus: "active",
    });
    expect(result?.practitioner).toBeDefined();
    expect(result?.period?.start).toBe("202301010800");
    expect(result?.locations).toHaveLength(2);
  });
});

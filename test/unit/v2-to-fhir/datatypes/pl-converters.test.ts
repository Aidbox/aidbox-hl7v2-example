import { test, expect, describe } from "bun:test";
import {
  convertPLToLocationHierarchy,
  convertPLToLocation,
} from "../../../../src/v2-to-fhir/datatypes/pl-converters";

describe("convertPLToLocationHierarchy", () => {
  test("returns undefined for undefined input", () => {
    expect(convertPLToLocationHierarchy(undefined)).toBeUndefined();
  });

  test("returns undefined when no location components", () => {
    expect(convertPLToLocationHierarchy({})).toBeUndefined();
  });

  test("returns hierarchy with bed", () => {
    const result = convertPLToLocationHierarchy({
      $3_bed: "BED-A",
    });
    expect(result?.bed?.identifier).toEqual([{ value: "BED-A" }]);
    expect(result?.bed?.mode).toBe("instance");
    expect(result?.bed?.physicalType?.coding?.[0]?.code).toBe("bd");
    expect(result?.mostGranular).toBe(result?.bed);
  });

  test("returns hierarchy with room", () => {
    const result = convertPLToLocationHierarchy({
      $2_room: "ROOM-101",
    });
    expect(result?.room?.identifier).toEqual([{ value: "ROOM-101" }]);
    expect(result?.room?.physicalType?.coding?.[0]?.code).toBe("ro");
    expect(result?.mostGranular).toBe(result?.room);
  });

  test("returns hierarchy with point of care", () => {
    const result = convertPLToLocationHierarchy({
      $1_careSite: "ICU",
    });
    expect(result?.pointOfCare?.identifier).toEqual([{ value: "ICU" }]);
    expect(result?.pointOfCare?.physicalType?.coding?.[0]?.code).toBe("poc");
  });

  test("returns hierarchy with facility from HD", () => {
    const result = convertPLToLocationHierarchy({
      $4_facility: {
        $1_namespace: "MainHospital",
      },
    });
    expect(result?.facility?.identifier?.[0]?.value).toBe("MainHospital");
    expect(result?.facility?.physicalType?.coding?.[0]?.code).toBe("si");
  });

  test("returns hierarchy with building and floor", () => {
    const result = convertPLToLocationHierarchy({
      $7_building: "Building-A",
      $8_floor: "Floor-3",
    });
    expect(result?.building?.identifier).toEqual([{ value: "Building-A" }]);
    expect(result?.building?.physicalType?.coding?.[0]?.code).toBe("bu");
    expect(result?.floor?.identifier).toEqual([{ value: "Floor-3" }]);
    expect(result?.floor?.physicalType?.coding?.[0]?.code).toBe("lvl");
  });

  test("sets status on all locations", () => {
    const result = convertPLToLocationHierarchy({
      $3_bed: "BED-1",
      $2_room: "ROOM-1",
      $5_status: "active",
    });
    expect(result?.bed?.status).toBe("active");
    expect(result?.room?.status).toBe("active");
  });

  test("sets description on most granular location", () => {
    const result = convertPLToLocationHierarchy({
      $2_room: "ROOM-1",
      $9_description: "Private room with window",
    });
    expect(result?.room?.description).toBe("Private room with window");
    expect(result?.mostGranular?.description).toBe("Private room with window");
  });

  test("bed is most granular when all present", () => {
    const result = convertPLToLocationHierarchy({
      $3_bed: "BED-1",
      $2_room: "ROOM-1",
      $1_careSite: "ICU",
      $7_building: "Building-A",
    });
    expect(result?.mostGranular).toBe(result?.bed);
  });
});

describe("convertPLToLocation", () => {
  test("returns undefined for undefined input", () => {
    expect(convertPLToLocation(undefined)).toBeUndefined();
  });

  test("returns most granular location", () => {
    const result = convertPLToLocation({
      $3_bed: "BED-1",
      $2_room: "ROOM-1",
    });
    expect(result?.identifier).toEqual([{ value: "BED-1" }]);
  });
});

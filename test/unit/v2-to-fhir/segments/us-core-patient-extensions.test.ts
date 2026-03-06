import { describe, expect, test } from "bun:test";
import type { PID } from "../../../../src/hl7v2/generated/fields";
import {
  buildUsCoreEthnicityExtension,
  buildUsCorePatientExtensionsFromPid,
  buildUsCoreRaceExtension,
  mapPid22ToOmbCategory,
  OMB_RACE_ETHNICITY_SYSTEM,
  US_CORE_ETHNICITY_URL,
  US_CORE_RACE_URL,
} from "../../../../src/v2-to-fhir/segments/us-core-patient-extensions";

describe("us-core-patient-extensions", () => {
  test("buildUsCoreRaceExtension maps OMB race coding to ombCategory + text", () => {
    const extension = buildUsCoreRaceExtension([
      { $1_code: "2106-3", $2_text: "White", $3_system: "CDCREC" },
    ]);

    expect(extension?.url).toBe(US_CORE_RACE_URL);

    const ombCategory = extension?.extension?.find((item) => item.url === "ombCategory");
    expect(ombCategory?.valueCoding?.code).toBe("2106-3");
    expect(ombCategory?.valueCoding?.system).toBe(OMB_RACE_ETHNICITY_SYSTEM);
    expect(ombCategory?.valueCoding?.display).toBe("White");

    const detailedEntries = extension?.extension?.filter((item) => item.url === "detailed") ?? [];
    expect(detailedEntries).toHaveLength(0);

    const textExtension = extension?.extension?.find((item) => item.url === "text");
    expect(textExtension?.valueString).toBe("White, 2106-3");
  });

  test("buildUsCoreRaceExtension de-duplicates repeated OMB categories", () => {
    const extension = buildUsCoreRaceExtension([
      { $1_code: "2106-3", $2_text: "White", $3_system: "CDCREC" },
      { $1_code: "2106-3", $2_text: "White", $3_system: "urn:oid:2.16.840.1.113883.6.238" },
    ]);

    const ombEntries = extension?.extension?.filter((item) => item.url === "ombCategory") ?? [];
    expect(ombEntries).toHaveLength(1);
  });

  test("buildUsCoreRaceExtension keeps detailed entries only for non-OMB CDC codes", () => {
    const extension = buildUsCoreRaceExtension([
      { $1_code: "2106-3", $2_text: "White", $3_system: "CDCREC" },
      { $1_code: "2054-5", $2_text: "Black or African American", $3_system: "CDCREC" },
      { $1_code: "1006-6", $2_text: "Abenaki", $3_system: "CDCREC" },
    ]);

    const detailedEntries = extension?.extension?.filter((item) => item.url === "detailed") ?? [];
    expect(detailedEntries).toHaveLength(1);
    expect(detailedEntries[0]?.valueCoding?.code).toBe("1006-6");
  });

  test("buildUsCoreEthnicityExtension maps H to OMB Hispanic category", () => {
    const extension = buildUsCoreEthnicityExtension([
      { $1_code: "H", $2_text: "Hispanic or Latino", $3_system: "HL70189" },
    ]);

    expect(extension?.url).toBe(US_CORE_ETHNICITY_URL);

    const ombCategory = extension?.extension?.find((item) => item.url === "ombCategory");
    expect(ombCategory?.valueCoding?.code).toBe("2135-2");
    expect(ombCategory?.valueCoding?.system).toBe(OMB_RACE_ETHNICITY_SYSTEM);

    const detailedEntries = extension?.extension?.filter((item) => item.url === "detailed") ?? [];
    expect(detailedEntries).toHaveLength(0);
  });

  test("buildUsCoreEthnicityExtension omits ombCategory for U while preserving text", () => {
    const extension = buildUsCoreEthnicityExtension([
      { $1_code: "U", $2_text: "Unknown", $3_system: "HL70189" },
    ]);

    const ombCategory = extension?.extension?.find((item) => item.url === "ombCategory");
    expect(ombCategory).toBeUndefined();

    const textExtension = extension?.extension?.find((item) => item.url === "text");
    expect(textExtension?.valueString).toBe("Unknown, U");
  });

  test("buildUsCorePatientExtensionsFromPid returns both race and ethnicity extensions", () => {
    const pid: PID = {
      $3_identifier: [],
      $5_name: [],
      $10_race: [{ $1_code: "2106-3", $2_text: "White", $3_system: "CDCREC" }],
      $22_ethnicity: [{ $1_code: "N", $2_text: "Not Hispanic or Latino", $3_system: "HL70189" }],
    };

    const extensions = buildUsCorePatientExtensionsFromPid(pid);
    expect(extensions).toHaveLength(2);
    expect(extensions.map((item) => item.url)).toEqual([US_CORE_RACE_URL, US_CORE_ETHNICITY_URL]);
  });

  test("mapPid22ToOmbCategory returns undefined for unknown code", () => {
    expect(mapPid22ToOmbCategory("X")).toBeUndefined();
  });
});

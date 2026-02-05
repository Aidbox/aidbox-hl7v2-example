import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import * as fs from "fs";
import {
  hl7v2ToFhirConfig,
  clearConfigCache,
  type Hl7v2ToFhirConfig,
} from "../../../src/v2-to-fhir/config";

describe("hl7v2ToFhirConfig", () => {
  let readFileSyncSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    clearConfigCache();
  });

  afterEach(() => {
    readFileSyncSpy?.mockRestore();
    clearConfigCache();
  });

  test("config file missing throws startup error", () => {
    readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    expect(() => hl7v2ToFhirConfig()).toThrow(
      /Failed to load HL7v2-to-FHIR config.*ENOENT/,
    );
  });

  test("config file malformed JSON throws startup error with parse details", () => {
    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
      "{ invalid json",
    );

    expect(() => hl7v2ToFhirConfig()).toThrow(
      /Failed to parse HL7v2-to-FHIR config as JSON/,
    );
  });

  test("valid config returns typed object with correct structure", () => {
    const validConfig: Hl7v2ToFhirConfig = {
      "ORU-R01": {
        preprocess: { PV1: { "19": { authorityFallback: { source: "msh" } } } },
        converter: { PV1: { required: false } },
      },
      "ADT-A01": {
        preprocess: { PV1: { "19": { authorityFallback: { source: "msh" } } } },
        converter: { PV1: { required: true } },
      },
    };

    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(validConfig),
    );

    const config = hl7v2ToFhirConfig();

    expect(config).toEqual(validConfig);
    expect(config["ORU-R01"]).toBeDefined();
    expect(config["ADT-A01"]).toBeDefined();
  });

  test("config navigation works: ORU-R01 converter PV1 required is false", () => {
    const validConfig = {
      "ORU-R01": {
        converter: { PV1: { required: false } },
      },
    };

    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(validConfig),
    );

    const config = hl7v2ToFhirConfig();

    expect(config["ORU-R01"]?.converter?.PV1?.required).toBe(false);
  });

  test("config navigation works: ADT-A01 preprocess authorityFallback source is msh", () => {
    const validConfig = {
      "ADT-A01": {
        preprocess: { PV1: { "19": { authorityFallback: { source: "msh" } } } },
      },
    };

    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(validConfig),
    );

    const config = hl7v2ToFhirConfig();

    expect(config["ADT-A01"]?.preprocess?.PV1?.["19"]?.authorityFallback?.source).toBe(
      "msh",
    );
  });

  test("config is cached after first load", () => {
    const validConfig = { "ORU-R01": { converter: { PV1: { required: false } } } };

    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(validConfig),
    );

    hl7v2ToFhirConfig();
    hl7v2ToFhirConfig();

    expect(readFileSyncSpy).toHaveBeenCalledTimes(1);
  });

  test("clearConfigCache allows config to be reloaded", () => {
    const config1 = { "ORU-R01": { converter: { PV1: { required: false } } } };
    const config2 = { "ORU-R01": { converter: { PV1: { required: true } } } };

    readFileSyncSpy = spyOn(fs, "readFileSync")
      .mockReturnValueOnce(JSON.stringify(config1))
      .mockReturnValueOnce(JSON.stringify(config2));

    const result1 = hl7v2ToFhirConfig();
    expect(result1["ORU-R01"]?.converter?.PV1?.required).toBe(false);

    clearConfigCache();

    const result2 = hl7v2ToFhirConfig();
    expect(result2["ORU-R01"]?.converter?.PV1?.required).toBe(true);
  });

  test("config with null value throws error", () => {
    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue("null");

    expect(() => hl7v2ToFhirConfig()).toThrow(
      /Invalid HL7v2-to-FHIR config: expected object/,
    );
  });

  test("config with array value throws error", () => {
    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue("[]");

    expect(() => hl7v2ToFhirConfig()).toThrow(
      /Invalid HL7v2-to-FHIR config: expected object/,
    );
  });

  test("missing message type config returns undefined via navigation", () => {
    const validConfig = { "ORU-R01": { converter: { PV1: { required: false } } } };

    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(validConfig),
    );

    const config = hl7v2ToFhirConfig();

    // ADT-A01 is not in config, should return undefined
    expect(config["ADT-A01"]).toBeUndefined();
    expect(config["ADT-A01"]?.converter?.PV1?.required).toBeUndefined();
  });
});

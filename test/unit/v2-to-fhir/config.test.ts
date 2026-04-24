import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import * as fs from "fs";
import {
  hl7v2ToFhirConfig,
  clearConfigCache,
  type Hl7v2ToFhirConfig,
} from "../../../src/v2-to-fhir/config";

/** Minimal valid identity rules for tests that don't focus on identity validation. */
const minimalRules = [{ assigner: "UNIPAT" }];

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

  test("config supports full-line // comments", () => {
    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(`{
  // Comment line should be ignored
  "identitySystem": { "patient": { "rules": [{ "assigner": "UNIPAT" }] } },
  "messages": {
    "VXU-V04": {
      "preprocess": {
        // This preprocessor remains opt-in by default
        "RXA": { "6": ["normalize-rxa6-dose"] }
      }
    }
  }
}`);

    const config = hl7v2ToFhirConfig();

    expect(config.messages?.["VXU-V04"]?.preprocess?.RXA?.["6"]?.[0]).toBe("normalize-rxa6-dose");
  });

  test("config supports inline // comments and /* block */ comments", () => {
    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(`{
  "identitySystem": { "patient": { "rules": [{ "assigner": "UNIPAT" }] } }, // inline
  "messages": {
    "VXU-V04": {
      /* block comment */
      "preprocess": { "RXA": { "9": ["normalize-rxa9-nip001"] } }
    }
  }
}`);

    const config = hl7v2ToFhirConfig();

    expect(config.messages?.["VXU-V04"]?.preprocess?.RXA?.["9"]?.[0]).toBe("normalize-rxa9-nip001");
  });

  test("comment stripping does not alter // inside string values", () => {
    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(`{
  "identitySystem": { "patient": { "rules": [{ "assigner": "UNIPAT" }] } },
  "messages": {
    "ORU-R01": {
      "converter": { "PV1": { "required": false } },
      "exampleUrl": "https://example.org/path//keep"
    }
  }
}`);

    const config = hl7v2ToFhirConfig() as Hl7v2ToFhirConfig & {
      messages?: Record<string, { exampleUrl?: string } | undefined>;
    };

    expect(config.messages?.["ORU-R01"]?.exampleUrl).toBe("https://example.org/path//keep");
  });

  test("valid config returns typed object with correct structure", () => {
    const validConfig: Hl7v2ToFhirConfig = {
      identitySystem: { patient: { rules: minimalRules } },
      messages: {
        "ORU-R01": {
          preprocess: { PV1: { "19": ["fix-pv1-authority-with-msh"] } },
          converter: { PV1: { required: false } },
        },
        "ADT-A01": {
          preprocess: { PV1: { "19": ["fix-pv1-authority-with-msh"] } },
          converter: { PV1: { required: true } },
        },
      },
    };

    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(validConfig),
    );

    const config = hl7v2ToFhirConfig();

    expect(config).toEqual(validConfig);
    expect(config.messages?.["ORU-R01"]).toBeDefined();
    expect(config.messages?.["ADT-A01"]).toBeDefined();
  });

  test("config navigation works: ORU-R01 converter PV1 required is false", () => {
    const validConfig: Hl7v2ToFhirConfig = {
      identitySystem: { patient: { rules: minimalRules } },
      messages: {
        "ORU-R01": {
          converter: { PV1: { required: false } },
        },
      },
    };

    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(validConfig),
    );

    const config = hl7v2ToFhirConfig();

    expect(config.messages?.["ORU-R01"]?.converter?.PV1?.required).toBe(false);
  });

  test("config navigation works: ADT-A01 preprocess PV1.19 has fix-pv1-authority-with-msh", () => {
    const validConfig: Hl7v2ToFhirConfig = {
      identitySystem: { patient: { rules: minimalRules } },
      messages: {
        "ADT-A01": {
          preprocess: { PV1: { "19": ["fix-pv1-authority-with-msh"] } },
        },
      },
    };

    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(validConfig),
    );

    const config = hl7v2ToFhirConfig();

    expect(config.messages?.["ADT-A01"]?.preprocess?.PV1?.["19"]?.[0]).toBe(
      "fix-pv1-authority-with-msh",
    );
  });

  test("config is cached after first load", () => {
    const validConfig: Hl7v2ToFhirConfig = {
      identitySystem: { patient: { rules: minimalRules } },
      messages: { "ORU-R01": { converter: { PV1: { required: false } } } },
    };

    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(validConfig),
    );

    hl7v2ToFhirConfig();
    hl7v2ToFhirConfig();

    expect(readFileSyncSpy).toHaveBeenCalledTimes(1);
  });

  test("clearConfigCache allows config to be reloaded", () => {
    const config1: Hl7v2ToFhirConfig = {
      identitySystem: { patient: { rules: minimalRules } },
      messages: { "ORU-R01": { converter: { PV1: { required: false } } } },
    };
    const config2: Hl7v2ToFhirConfig = {
      identitySystem: { patient: { rules: minimalRules } },
      messages: { "ORU-R01": { converter: { PV1: { required: true } } } },
    };

    readFileSyncSpy = spyOn(fs, "readFileSync")
      .mockReturnValueOnce(JSON.stringify(config1))
      .mockReturnValueOnce(JSON.stringify(config2));

    const result1 = hl7v2ToFhirConfig();
    expect(result1.messages?.["ORU-R01"]?.converter?.PV1?.required).toBe(false);

    clearConfigCache();

    const result2 = hl7v2ToFhirConfig();
    expect(result2.messages?.["ORU-R01"]?.converter?.PV1?.required).toBe(true);
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
    const validConfig: Hl7v2ToFhirConfig = {
      identitySystem: { patient: { rules: minimalRules } },
      messages: { "ORU-R01": { converter: { PV1: { required: false } } } },
    };

    readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(validConfig),
    );

    const config = hl7v2ToFhirConfig();

    expect(config.messages?.["ADT-A01"]).toBeUndefined();
    expect(config.messages?.["ADT-A01"]?.converter?.PV1?.required).toBeUndefined();
  });

  describe("identitySystem validation", () => {
    test("identitySystem.patient.rules missing from JSON throws at startup", () => {
      const invalidConfig = {
        messages: { "ORU-R01": { converter: { PV1: { required: false } } } },
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidConfig),
      );

      expect(() => hl7v2ToFhirConfig()).toThrow(
        /identitySystem\.patient\.rules.*must be an array/,
      );
    });

    test("empty rules array throws at startup", () => {
      const invalidConfig = {
        identitySystem: { patient: { rules: [] } },
        messages: {},
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidConfig),
      );

      expect(() => hl7v2ToFhirConfig()).toThrow(
        /identitySystem\.patient\.rules.*must not be empty/,
      );
    });

    test("MatchRule with neither assigner, type, nor any throws at startup", () => {
      const invalidConfig = {
        identitySystem: { patient: { rules: [{}] } },
        messages: {},
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidConfig),
      );

      expect(() => hl7v2ToFhirConfig()).toThrow(
        /rules\[0\]: MatchRule must specify at least one of/,
      );
    });

    test("valid MatchRule with assigner passes validation", () => {
      const validConfig = {
        identitySystem: { patient: { rules: [{ assigner: "UNIPAT" }] } },
        messages: {},
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(validConfig),
      );

      expect(() => hl7v2ToFhirConfig()).not.toThrow();
    });

    test("valid MatchRule with type passes validation", () => {
      const validConfig = {
        identitySystem: { patient: { rules: [{ type: "MR" }] } },
        messages: {},
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(validConfig),
      );

      expect(() => hl7v2ToFhirConfig()).not.toThrow();
    });

    test("valid MatchRule with any passes validation", () => {
      const validConfig = {
        identitySystem: { patient: { rules: [{ any: true }] } },
        messages: {},
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(validConfig),
      );

      expect(() => hl7v2ToFhirConfig()).not.toThrow();
    });

    test("MpiLookupRule passes validation (no field-level checks)", () => {
      const validConfig = {
        identitySystem: {
          patient: {
            rules: [
              {
                mpiLookup: {
                  endpoint: { baseUrl: "http://mpi" },
                  strategy: "pix",
                  target: { system: "urn:oid:1.2.3", assigner: "MPI" },
                },
              },
            ],
          },
        },
        messages: {},
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(validConfig),
      );

      expect(() => hl7v2ToFhirConfig()).not.toThrow();
    });
  });

  describe("preprocessor ID validation", () => {
    test("unknown preprocessor ID throws startup error", () => {
      const invalidConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        messages: {
          "ORU-R01": {
            preprocess: { PV1: { "19": ["unknown-preprocessor"] } },
          },
        },
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidConfig),
      );

      expect(() => hl7v2ToFhirConfig()).toThrow(
        /Unknown preprocessor ID "unknown-preprocessor".*Valid IDs: fix-pv1-authority-with-msh/,
      );
    });

    test("valid preprocessor ID passes validation", () => {
      const validConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        messages: {
          "ORU-R01": {
            preprocess: { PV1: { "19": ["fix-pv1-authority-with-msh"] } },
          },
        },
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(validConfig),
      );

      expect(() => hl7v2ToFhirConfig()).not.toThrow();
    });

    test("multiple preprocessor IDs are all validated", () => {
      const invalidConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        messages: {
          "ORU-R01": {
            preprocess: { PV1: { "19": ["fix-pv1-authority-with-msh", "bad-one"] } },
          },
        },
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidConfig),
      );

      expect(() => hl7v2ToFhirConfig()).toThrow(
        /Unknown preprocessor ID "bad-one"/,
      );
    });

    test("empty preprocessor list passes validation", () => {
      const validConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        messages: {
          "ORU-R01": {
            preprocess: { PV1: { "19": [] } },
          },
        },
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(validConfig),
      );

      expect(() => hl7v2ToFhirConfig()).not.toThrow();
    });

    test("config without preprocess section passes validation", () => {
      const validConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        messages: {
          "ORU-R01": {
            converter: { PV1: { required: false } },
          },
        },
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(validConfig),
      );

      expect(() => hl7v2ToFhirConfig()).not.toThrow();
    });

    test("non-array preprocessorIds throws startup error", () => {
      const invalidConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        messages: {
          "ORU-R01": {
            preprocess: { PV1: { "19": "fix-pv1-authority-with-msh" } },
          },
        },
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidConfig),
      );

      expect(() => hl7v2ToFhirConfig()).toThrow(
        /Invalid preprocessor config.*expected array of entries, got string/,
      );
    });

    test("numeric preprocessorIds throws startup error", () => {
      const invalidConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        messages: {
          "ORU-R01": {
            preprocess: { PV1: { "19": 123 } },
          },
        },
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidConfig),
      );

      expect(() => hl7v2ToFhirConfig()).toThrow(
        /Invalid preprocessor config.*expected array of entries, got number/,
      );
    });

    test("null preprocessorIds is allowed (optional field)", () => {
      const validConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        messages: {
          "ORU-R01": {
            preprocess: { PV1: { "19": null } },
          },
        },
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(validConfig),
      );

      expect(() => hl7v2ToFhirConfig()).not.toThrow();
    });
  });

  describe("profile conformance IG validation", () => {
    test("valid profileConformance.implementationGuides passes validation", () => {
      const validConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        profileConformance: {
          implementationGuides: [
            {
              id: "us-core",
              package: "hl7.fhir.us.core",
              version: "6.1.0",
              enabled: true,
            },
          ],
        },
        messages: {},
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(validConfig),
      );

      expect(() => hl7v2ToFhirConfig()).not.toThrow();
      const config = hl7v2ToFhirConfig();
      expect(config.profileConformance?.implementationGuides?.[0]?.id).toBe("us-core");
    });

    test("non-array implementationGuides throws startup error", () => {
      const invalidConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        profileConformance: {
          implementationGuides: "us-core",
        },
        messages: {},
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidConfig),
      );

      expect(() => hl7v2ToFhirConfig()).toThrow(
        /profileConformance\.implementationGuides.*must be an array/,
      );
    });

    test("implementation guide missing id throws startup error", () => {
      const invalidConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        profileConformance: {
          implementationGuides: [
            {
              package: "hl7.fhir.us.core",
              version: "6.1.0",
            },
          ],
        },
        messages: {},
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidConfig),
      );

      expect(() => hl7v2ToFhirConfig()).toThrow(
        /implementationGuides\[0\]\.id/,
      );
    });

    test("implementation guide with non-boolean enabled throws startup error", () => {
      const invalidConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        profileConformance: {
          implementationGuides: [
            {
              id: "us-core",
              package: "hl7.fhir.us.core",
              version: "6.1.0",
              enabled: "yes",
            },
          ],
        },
        messages: {},
      };

      readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidConfig),
      );

      expect(() => hl7v2ToFhirConfig()).toThrow(
        /implementationGuides\[0\]\.enabled/,
      );
    });
  });
});

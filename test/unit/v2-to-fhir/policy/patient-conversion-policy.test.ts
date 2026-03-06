import { describe, expect, test } from "bun:test";
import type { Hl7v2ToFhirConfig } from "../../../../src/v2-to-fhir/config";
import { buildPatientConversionPolicy } from "../../../../src/v2-to-fhir/policy/patient-conversion-policy";

function baseConfig(overrides?: Partial<Hl7v2ToFhirConfig>): Hl7v2ToFhirConfig {
  return {
    identitySystem: {
      patient: {
        rules: [{ assigner: "UNIPAT" }],
      },
    },
    messages: {},
    ...overrides,
  };
}

describe("buildPatientConversionPolicy", () => {
  test("returns us-core mode when US Core IG id is configured", () => {
    const config = baseConfig({
      profileConformance: {
        implementationGuides: [
          { id: "us-core", package: "example.package", version: "1.0.0" },
        ],
      },
    });

    const policy = buildPatientConversionPolicy(config);
    expect(policy.demographicExtensionMode).toBe("us-core");
  });

  test("returns us-core mode when package is hl7.fhir.us.core", () => {
    const config = baseConfig({
      profileConformance: {
        implementationGuides: [
          { id: "custom-id", package: "hl7.fhir.us.core", version: "6.1.0" },
        ],
      },
    });

    const policy = buildPatientConversionPolicy(config);
    expect(policy.demographicExtensionMode).toBe("us-core");
  });

  test("returns none when US Core IG is absent", () => {
    const config = baseConfig({
      profileConformance: {
        implementationGuides: [
          { id: "custom", package: "hl7.fhir.custom", version: "1.0.0" },
        ],
      },
    });

    const policy = buildPatientConversionPolicy(config);
    expect(policy.demographicExtensionMode).toBe("none");
  });

  test("returns none when US Core IG is disabled", () => {
    const config = baseConfig({
      profileConformance: {
        implementationGuides: [
          { id: "us-core", package: "hl7.fhir.us.core", version: "6.1.0", enabled: false },
        ],
      },
    });

    const policy = buildPatientConversionPolicy(config);
    expect(policy.demographicExtensionMode).toBe("none");
  });
});

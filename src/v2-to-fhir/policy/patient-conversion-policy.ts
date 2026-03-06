import type { Hl7v2ToFhirConfig, ImplementationGuidePolicy } from "../config";

export type PatientConversionPolicy = {
  demographicExtensionMode: "none" | "us-core";
};

export const DEFAULT_PATIENT_CONVERSION_POLICY: PatientConversionPolicy = {
  demographicExtensionMode: "none",
};

function isUsCoreEnabled(implementationGuide: ImplementationGuidePolicy): boolean {
  if (implementationGuide.enabled === false) {
    return false;
  }

  const normalizedId = implementationGuide.id.trim().toLowerCase();
  const normalizedPackage = implementationGuide.package.trim().toLowerCase();

  if (normalizedId === "us-core") {
    return true;
  }

  if (normalizedPackage === "hl7.fhir.us.core") {
    return true;
  }

  return false;
}

export function buildPatientConversionPolicy(config: Hl7v2ToFhirConfig): PatientConversionPolicy {
  const implementationGuides = config.profileConformance?.implementationGuides ?? [];
  const hasUsCore = implementationGuides.some(isUsCoreEnabled);

  if (!hasUsCore) {
    return DEFAULT_PATIENT_CONVERSION_POLICY;
  }

  return {
    demographicExtensionMode: "us-core",
  };
}

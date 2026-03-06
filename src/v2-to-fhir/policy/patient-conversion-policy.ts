// ============================================================================
// DESIGN PROTOTYPE: 2026-02-25-us-core-patient-extensions.md
// Do not use until implementation complete
// ============================================================================
//
// This file will contain:
//
// import type { Hl7v2ToFhirConfig } from "../config";
//
// export type PatientConversionPolicy = {
//   demographicExtensionMode: "none" | "us-core";
// };
//
// export function buildPatientConversionPolicy(
//   config: Hl7v2ToFhirConfig,
// ): PatientConversionPolicy {
//   const hasUsCore = (config.profileConformance?.implementationGuides ?? []).some((ig) =>
//     ig.enabled !== false &&
//     (ig.id.toLowerCase() === "us-core" || ig.package === "hl7.fhir.us.core")
//   );
//
//   return {
//     demographicExtensionMode: hasUsCore ? "us-core" : "none",
//   };
// }
//
// ============================================================================

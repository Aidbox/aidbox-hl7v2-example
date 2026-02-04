// ═══════════════════════════════════════════════════════════════════════════
// DESIGN PROTOTYPE: 2026-02-03-unified-encounter-id-generation.md
// Do not use until implementation complete
// ═══════════════════════════════════════════════════════════════════════════
//
// This file will contain:
//
// export type Hl7v2ToFhirConfig = {
//   "ORU-R01"?: {
//     preprocess?: { PV1?: { "19"?: { authorityFallback?: { source?: "msh" } } } };
//     converter?: { PV1?: { required?: boolean } };
//   };
//   "ADT-A01"?: {
//     preprocess?: { PV1?: { "19"?: { authorityFallback?: { source?: "msh" } } } };
//     converter?: { PV1?: { required?: boolean } };
//   };
// };
//
// // Config is keyed by exact message type strings; missing converter config is a hard error.
//
// export function loadHl7v2ToFhirConfig(): Hl7v2ToFhirConfig;
// export function isPv1Required(
//   config: Hl7v2ToFhirConfig,
//   messageType: "ORU-R01" | "ADT-A01",
// ): boolean;
//
// export function getAuthorityFallbackSource(
//   config: Hl7v2ToFhirConfig,
//   messageType: "ORU-R01" | "ADT-A01",
// ): "msh" | null;
//
// ═══════════════════════════════════════════════════════════════════════════

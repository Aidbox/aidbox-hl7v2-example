// ═══════════════════════════════════════════════════════════════════════════
// DESIGN PROTOTYPE: 2026-02-03-unified-encounter-id-generation.md
// Do not use until implementation complete
// ═══════════════════════════════════════════════════════════════════════════
//
// This file will contain:
//
// export type Hl7v2ToFhirConfig = {
//   "ORU-R01"?: {
//     validation?: {
//       PV1?: { "19"?: { authority?: { required?: boolean } } };
//     };
//   };
//   ADT?: {
//     PV1?: { "19"?: { authority?: { required?: boolean } } };
//   };
// };
//
// export function loadHl7v2ToFhirConfig(): Hl7v2ToFhirConfig;
// export function getAuthorityRequirement(
//   config: Hl7v2ToFhirConfig,
//   messageType: "ORU-R01" | "ADT",
// ): boolean;
//
// ═══════════════════════════════════════════════════════════════════════════

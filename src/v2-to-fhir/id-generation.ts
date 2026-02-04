// ═══════════════════════════════════════════════════════════════════════════
// DESIGN PROTOTYPE: 2026-02-03-unified-encounter-id-generation.md
// Do not use until implementation complete
// ═══════════════════════════════════════════════════════════════════════════
//
// This file will contain:
//
// export type EncounterAuthorityResolution = {
//   authority: string | null;
//   source: "cx4" | "cx6" | "msh" | "missing";
// };
//
// export function resolveEncounterAuthority(
//   visitNumber: CX,
//   sender: SenderContext,
// ): EncounterAuthorityResolution;
//
// export function generateEncounterId(
//   visitNumber: CX,
//   sender: SenderContext,
// ): string | null;
//
// export function buildEncounterIdentifier(
//   visitNumber: CX,
// ): Encounter["identifier"];
//
// ═══════════════════════════════════════════════════════════════════════════

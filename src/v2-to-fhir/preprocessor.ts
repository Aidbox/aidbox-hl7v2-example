// ═══════════════════════════════════════════════════════════════════════════
// DESIGN PROTOTYPE: 2026-02-03-unified-encounter-id-generation.md
// Do not use until implementation complete
// ═══════════════════════════════════════════════════════════════════════════
//
// This file will contain:
//
// export function preprocessIncomingMessage(
//   message: IncomingHL7v2Message,
//   config: Hl7v2ToFhirConfig,
// ): IncomingHL7v2Message;
//
// // Behavior:
// // - Config-driven per message type (ORU-R01, ADT-A01); preprocess config is optional.
// // - If config enables preprocess.PV1.19.authorityFallback.source="msh", attempt to populate
// //   CX.4/9/10 using MSH sender context (no core fallback).
// // - Never sets status or error fields; converters remain unaware.
//
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Preprocessors are registered by kebab-case IDs and validated at config load time.
 * They compose in the order listed in config. Each modifies the segment in place.
 */

import type { HL7v2Message, HL7v2Segment, FieldValue } from "../hl7v2/generated/types";
import { fromMSH, fromPV1 } from "../hl7v2/generated/fields";
import { findSegment } from "./converter";

/** Provides parsed message for cross-segment lookups (e.g., MSH for authority fallback). */
export interface PreprocessorContext {
  parsedMessage: HL7v2Message;
}

export type SegmentPreprocessorFn = (
  context: PreprocessorContext,
  segment: HL7v2Segment,
) => void;

export const SEGMENT_PREPROCESSORS: Record<string, SegmentPreprocessorFn> = {
  "fix-authority-with-msh": fixAuthorityWithMsh,
  // DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity.md
  // Register new PID preprocessors here when implemented:
  //   "merge-pid2-into-pid3": mergePid2IntoPid3,
  //   "inject-authority-from-msh": injectAuthorityFromMsh,
  // END DESIGN PROTOTYPE
};

export type SegmentPreprocessorId = keyof typeof SEGMENT_PREPROCESSORS;

/** @throws Error if ID is not registered */
export function getPreprocessor(id: string): SegmentPreprocessorFn {
  const preprocessor = SEGMENT_PREPROCESSORS[id];
  if (!preprocessor) {
    throw new Error(
      `Unknown preprocessor ID: ${id}. Valid IDs: ${Object.keys(SEGMENT_PREPROCESSORS).join(", ")}`,
    );
  }
  return preprocessor;
}

// =============================================================================
// Preprocessor Implementations
// =============================================================================

/**
 * If PV1-19 is present but missing authority (CX.4/9/10),
 * populate CX.4 from MSH-3/4. Never overrides existing authority.
 */
function fixAuthorityWithMsh(
  context: PreprocessorContext,
  segment: HL7v2Segment,
): void {
  if (segment.segment !== "PV1") {
    return;
  }

  const mshSegment = findSegment(context.parsedMessage, "MSH");
  if (!mshSegment) {
    return;
  }

  const msh = fromMSH(mshSegment);
  const pv1 = fromPV1(segment);

  if (!pv1.$19_visitNumber?.$1_value) {
    return;
  }

  const visitNumber = pv1.$19_visitNumber;
  const hasCx4 =
    hasValue(visitNumber.$4_system?.$1_namespace) ||
    hasValue(visitNumber.$4_system?.$2_system);
  const hasCx9 =
    hasValue(visitNumber.$9_jurisdiction?.$1_code) ||
    hasValue(visitNumber.$9_jurisdiction?.$3_system);
  const hasCx10 =
    hasValue(visitNumber.$10_department?.$1_code) ||
    hasValue(visitNumber.$10_department?.$3_system);

  // Don't override existing authority
  if (hasCx4 || hasCx9 || hasCx10) {
    return;
  }

  const msh3 = parseHdNamespace(msh.$3_sendingApplication?.$1_namespace);
  const msh4 = parseHdNamespace(msh.$4_sendingFacility?.$1_namespace);

  const namespaceParts = [msh3.namespace, msh4.namespace].filter(Boolean);
  const namespace = namespaceParts.length > 0 ? namespaceParts.join("-") : undefined;

  if (!namespace) {
    // TODO: Handle missing namespaces by falling back to Universal ID (HD.2+HD.3)
    // See tasks/drafts/2026-02-06-hd-universal-id-fallback.md
    return;
  }

  insertAuthorityIntoPv1Segment(segment, namespace);
}

function hasValue(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

/** Parse HD string that may contain subcomponents (namespace&system&type) */
function parseHdNamespace(
  hdString: string | undefined,
): { namespace?: string; system?: string } {
  if (!hdString) return {};
  const parts = hdString.split("&");
  return {
    namespace: parts[0] || undefined,
    system: parts[1] || undefined,
  };
}

// =============================================================================
// DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity.md
//
// New preprocessor implementations for PID segment normalization.
// These are placeholders — register in SEGMENT_PREPROCESSORS when implemented.
// =============================================================================

/**
 * DESIGN PROTOTYPE: merge-pid2-into-pid3
 *
 * Fired on PID field 2 (PID-2, Patient ID — deprecated in HL7 v2.4+, removed in v2.8.2).
 * ASTRA senders place UNIPAT in PID-2; this moves it into PID-3 so the converter
 * sees all identifiers in one place.
 *
 * Behavior:
 *   - If PID-2 has a non-empty CX.1 value: append PID-2 CX as a new repeat in PID-3.
 *     PID-3 is created if absent.
 *   - Clear PID-2 after migration (set to empty).
 *   - No-op if PID-2 is empty or has no CX.1 value.
 *   - Never overwrites existing PID-3 content — always appends.
 *
 * Field-presence guard: preprocessor.ts calls isFieldPresentInSegment(segment, "2")
 * before invoking this function. The guard returns false for absent, null, or empty-string
 * fields — so this function is only called when PID-2 is a non-empty string.
 * The preprocessor's own "no-op if PID-2 is empty/no CX.1" guard handles the case
 * where PID-2 is a non-empty string but the parsed CX has no CX.1 component.
 * Both layers independently enforce the same invariant without conflict.
 *
 * Config trigger: MessageTypeConfig.preprocess.PID."2" = ["merge-pid2-into-pid3"]
 */
// DESIGN PROTOTYPE:
// function mergePid2IntoPid3(
//   context: PreprocessorContext,
//   segment: HL7v2Segment,
// ): void {
//   if (segment.segment !== "PID") return;
//   // 1. Read PID-2 (field index 2)
//   // 2. If empty or no CX.1 value, return
//   // 3. Append PID-2 CX to PID-3 (field index 3, which is a repeat array)
//   // 4. Clear PID-2 (set segment.fields[2] to empty/undefined)
// }

/**
 * DESIGN PROTOTYPE: inject-authority-from-msh
 *
 * Fired on PID field 3 (PID-3, Patient Identifier List — the primary identifier field).
 * Some senders omit the assigning authority on identifiers (e.g., `12345^^^^MR`).
 * This injects the MSH-3/4 derived namespace as CX.4.1 for bare identifiers.
 *
 * Behavior:
 *   - For each CX repeat in PID-3:
 *     * If CX.1 has a value AND all of CX.4/9/10 are empty → inject MSH namespace as CX.4.1
 *     * If CX already has any authority → skip (never overrides)
 *   - Authority derivation: same logic as fix-authority-with-msh (MSH-3 + MSH-4 namespaces)
 *   - No-op if MSH has no usable namespace.
 *
 * Config trigger: MessageTypeConfig.preprocess.PID."3" = ["inject-authority-from-msh"]
 *
 * Note: named "inject-authority-from-msh" (not "fix-authority-with-msh") to distinguish
 * from the PV1 variant — same authority derivation logic, different segment target and
 * application (PID-3 repeats vs single PV1-19).
 */
// DESIGN PROTOTYPE:
// function injectAuthorityFromMsh(
//   context: PreprocessorContext,
//   segment: HL7v2Segment,
// ): void {
//   if (segment.segment !== "PID") return;
//   const mshSegment = findSegment(context.parsedMessage, "MSH");
//   if (!mshSegment) return;
//   // Derive namespace from MSH-3/4 (same as parseHdNamespace usage in fixAuthorityWithMsh)
//   // For each CX repeat in segment.fields[3]:
//   //   if CX.1 has value AND CX.4/9/10 all empty → set CX.4.1 = namespace
// }

// END DESIGN PROTOTYPE
// =============================================================================

/**
 * Insert authority (CX.4) into PV1-19 parsed segment field.
 * Modifies the segment in place.
 */
function insertAuthorityIntoPv1Segment(
  segment: HL7v2Segment,
  namespace: string,
): void {
  const pv1_19 = segment.fields[19];
  if (!pv1_19) {
    return;
  }

  // PV1-19 is a CX type. We need to set CX.4 (component 4) to the namespace.
  // CX.4 is an HD type, and we're setting HD.1 (namespace).
  //
  // Structure: CX.1 (value) ^ CX.2 ^ CX.3 ^ CX.4 (HD: namespace & universalId & type) ^ ...
  // We need to ensure CX.4.1 = namespace

  if (typeof pv1_19 === "string") {
    // Simple string value - convert to complex structure
    segment.fields[19] = {
      1: pv1_19,
      4: { 1: namespace },
    } as FieldValue;
  } else if (typeof pv1_19 === "object" && !Array.isArray(pv1_19)) {
    // Complex value - set component 4
    (pv1_19 as Record<number, FieldValue>)[4] = { 1: namespace };
  }
}

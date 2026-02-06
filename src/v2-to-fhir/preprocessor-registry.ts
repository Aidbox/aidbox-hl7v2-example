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

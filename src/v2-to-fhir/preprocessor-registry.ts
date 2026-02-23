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
  "move-pid2-into-pid3": movePid2IntoPid3,
  "inject-authority-from-msh": injectAuthorityFromMsh,
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
    // See ai/tickets/drafts/2026-02-06-hd-universal-id-fallback.md
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
 * Fired on PID field 2. If PID-2 has a non-empty CX.1, appends PID-2 CX
 * as a new repeat in PID-3, then clears PID-2. No-op if CX.1 is empty.
 */
function movePid2IntoPid3(
  _context: PreprocessorContext,
  segment: HL7v2Segment,
): void {
  if (segment.segment !== "PID") return;

  const pid2 = segment.fields[2];
  if (pid2 === undefined || pid2 === null) return;

  // Extract CX.1 value from PID-2
  const cx1Value = extractCx1(pid2);
  if (!cx1Value) return;

  // Append PID-2 into PID-3's repeat list
  const pid3 = segment.fields[3];
  if (pid3 === undefined || pid3 === null) {
    // PID-3 absent — create with single entry
    segment.fields[3] = [pid2];
  } else if (Array.isArray(pid3)) {
    // PID-3 is already a repeating array — append
    pid3.push(pid2);
  } else {
    // PID-3 is a single CX — convert to array and append
    segment.fields[3] = [pid3, pid2];
  }

  // Clear PID-2
  delete segment.fields[2];
}

/**
 * Fired on PID field 3. For each CX repeat in PID-3 with CX.1 but no authority
 * (CX.4/9/10 all empty), injects MSH-3/4 derived namespace as CX.4.1.
 * Never overrides existing authority. No-op if MSH has no usable namespace.
 */
function injectAuthorityFromMsh(
  context: PreprocessorContext,
  segment: HL7v2Segment,
): void {
  if (segment.segment !== "PID") return;

  const mshSegment = findSegment(context.parsedMessage, "MSH");
  if (!mshSegment) return;

  const msh = fromMSH(mshSegment);
  const namespace = deriveMshNamespace(msh);
  if (!namespace) return;

  const pid3 = segment.fields[3];
  if (pid3 === undefined || pid3 === null) return;

  if (Array.isArray(pid3)) {
    for (let i = 0; i < pid3.length; i++) {
      const cx = pid3[i]!;
      const replaced = injectAuthorityIntoCx(cx, namespace);
      if (replaced) pid3[i] = replaced;
    }
  } else {
    const replaced = injectAuthorityIntoCx(pid3, namespace);
    if (replaced) segment.fields[3] = replaced;
  }
}

/** Extract CX.1 value from a raw FieldValue representing a single CX. */
function extractCx1(fv: FieldValue): string | undefined {
  if (typeof fv === "string") return fv.trim() || undefined;
  if (Array.isArray(fv)) return undefined;
  const v1 = fv[1];
  if (v1 === undefined) return undefined;
  if (typeof v1 === "string") return v1.trim() || undefined;
  if (typeof v1 === "object" && !Array.isArray(v1)) {
    const inner = (v1 as Record<number, FieldValue>)[1];
    if (typeof inner === "string") return inner.trim() || undefined;
  }
  return undefined;
}

/** Derive MSH-3/MSH-4 namespace using the same logic as fixAuthorityWithMsh. */
function deriveMshNamespace(msh: ReturnType<typeof fromMSH>): string | undefined {
  const msh3 = parseHdNamespace(msh.$3_sendingApplication?.$1_namespace);
  const msh4 = parseHdNamespace(msh.$4_sendingFacility?.$1_namespace);
  const parts = [msh3.namespace, msh4.namespace].filter(Boolean);
  return parts.length > 0 ? parts.join("-") : undefined;
}

/**
 * Check if a raw CX FieldValue has any authority component (CX.4/9/10).
 * Checks the same semantic subcomponents as fixAuthorityWithMsh:
 * CX.4.1 (HD namespace), CX.4.2 (HD universal ID), CX.9.1 (CWE code),
 * CX.9.3 (CWE system), CX.10.1 (CWE code), CX.10.3 (CWE system).
 */
function cxHasAuthority(fv: FieldValue): boolean {
  if (typeof fv === "string" || Array.isArray(fv)) return false;
  const obj = fv as Record<number, FieldValue>;

  const hasCx4 = hasSubcomponent(obj[4], 1) || hasSubcomponent(obj[4], 2);
  const hasCx9 = hasSubcomponent(obj[9], 1) || hasSubcomponent(obj[9], 3);
  const hasCx10 = hasSubcomponent(obj[10], 1) || hasSubcomponent(obj[10], 3);

  return hasCx4 || hasCx9 || hasCx10;
}

/** Check if a specific numbered subcomponent of a FieldValue is non-empty. */
function hasSubcomponent(fv: FieldValue | undefined, key: number): boolean {
  if (fv === undefined || fv === null) return false;
  if (typeof fv === "string") {
    // A string field has no subcomponents; for key 1 the string itself is the value
    return key === 1 && fv.trim().length > 0;
  }
  if (Array.isArray(fv)) return false;
  const sub = (fv as Record<number, FieldValue>)[key];
  if (sub === undefined || sub === null) return false;
  if (typeof sub === "string") return sub.trim().length > 0;
  return false;
}

/**
 * Inject authority namespace (CX.4.1) into a raw CX FieldValue. Only modifies bare CX entries.
 * Returns a replacement FieldValue if the original was a string (cannot be modified in place),
 * or undefined if the modification was done in place.
 */
function injectAuthorityIntoCx(fv: FieldValue, namespace: string): FieldValue | undefined {
  const cx1 = extractCx1(fv);
  if (!cx1) return undefined;
  if (cxHasAuthority(fv)) return undefined;

  if (typeof fv === "string") {
    // String CX — convert to object form with authority
    return { 1: fv, 4: { 1: namespace } } as FieldValue;
  }

  if (Array.isArray(fv)) return undefined;

  // Complex object — set CX.4.1 (HD.1 = namespace) in place
  (fv as Record<number, FieldValue>)[4] = { 1: namespace } as FieldValue;
  return undefined;
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

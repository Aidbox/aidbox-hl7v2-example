/**
 * Preprocessor for HL7v2 messages before FHIR conversion.
 *
 * The preprocessor runs before message handlers and returns a modified IncomingHL7v2Message.
 * Converters are unaware the preprocessor ran; it never sets status or error fields.
 *
 * Currently supports:
 * - authorityFallback.source="msh": Populates missing PV1-19 authority (CX.4) using MSH-3/4
 */

import { parseMessage } from "@atomic-ehr/hl7v2";
import type { IncomingHL7v2Message } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import type { Hl7v2ToFhirConfig } from "./config";
import { fromMSH, fromPV1 } from "../hl7v2/generated/fields";

/**
 * Preprocesses an incoming HL7v2 message based on config.
 * Returns a (possibly modified) message; never modifies status or error fields.
 */
export function preprocessIncomingMessage(
  message: IncomingHL7v2Message,
  config: Hl7v2ToFhirConfig,
): IncomingHL7v2Message {
  // Convert message type from "ORU^R01" to "ORU-R01" for config lookup
  const configKey = normalizeMessageType(message.type);
  if (!configKey) {
    return message;
  }

  const messageConfig = config[configKey];
  if (!messageConfig?.preprocess?.PV1?.["19"]?.authorityFallback) {
    return message;
  }

  const fallbackSource = messageConfig.preprocess.PV1["19"].authorityFallback.source;
  if (fallbackSource !== "msh") {
    return message;
  }

  // Apply MSH authority fallback to PV1-19
  const modifiedRawMessage = applyMshAuthorityFallback(message.message);
  if (modifiedRawMessage === message.message) {
    return message;
  }

  // Return a new message object with modified raw message
  // Never modify status or error fields
  return {
    ...message,
    message: modifiedRawMessage,
  };
}

/**
 * Normalizes message type from HL7v2 format to config key format.
 * "ORU^R01" -> "ORU-R01", "ADT^A01" -> "ADT-A01"
 */
function normalizeMessageType(type: string): "ORU-R01" | "ADT-A01" | null {
  const normalized = type.replace("^", "-");
  if (normalized === "ORU-R01" || normalized === "ADT-A01") {
    return normalized;
  }
  return null;
}

/**
 * Applies MSH-3/4 authority fallback to PV1-19 if authority is missing.
 * Returns the original message if no modification is needed.
 */
function applyMshAuthorityFallback(rawMessage: string): string {
  try {
    const parsed = parseMessage(rawMessage);

    // Find MSH segment
    const mshSegment = parsed.find((s) => s.segment === "MSH");
    if (!mshSegment) {
      return rawMessage;
    }

    // Find PV1 segment
    const pv1Segment = parsed.find((s) => s.segment === "PV1");
    if (!pv1Segment) {
      return rawMessage;
    }

    const msh = fromMSH(mshSegment);
    const pv1 = fromPV1(pv1Segment);

    // Check if PV1-19 exists but has no authority
    if (!pv1.$19_visitNumber?.$1_value) {
      return rawMessage; // No visit number value, nothing to enhance
    }

    const visitNumber = pv1.$19_visitNumber;
    const hasCx4 = hasValue(visitNumber.$4_system?.$1_namespace) || hasValue(visitNumber.$4_system?.$2_system);
    const hasCx9 = hasValue(visitNumber.$9_jurisdiction?.$1_code) || hasValue(visitNumber.$9_jurisdiction?.$3_system);
    const hasCx10 = hasValue(visitNumber.$10_department?.$1_code) || hasValue(visitNumber.$10_department?.$3_system);

    if (hasCx4 || hasCx9 || hasCx10) {
      return rawMessage; // Already has authority, don't override
    }

    // Extract MSH-3 (Sending Application) and MSH-4 (Sending Facility) for authority
    const msh3Namespace = msh.$3_sendingApplication?.$1_namespace;
    const msh3System = msh.$3_sendingApplication?.$2_system;
    const msh4Namespace = msh.$4_sendingFacility?.$1_namespace;
    const msh4System = msh.$4_sendingFacility?.$2_system;

    // Build authority from MSH-3 (prefer) or MSH-4
    const namespace = msh3Namespace || msh4Namespace;
    const system = msh3System || msh4System;

    if (!namespace && !system) {
      return rawMessage; // No MSH authority available
    }

    // Modify the raw message to add authority to PV1-19
    return insertPv1AuthorityIntoRawMessage(rawMessage, namespace, system);
  } catch {
    // If parsing fails, return original message (let converter handle the error)
    return rawMessage;
  }
}

/**
 * Checks if a string has a non-empty value (not null, undefined, or whitespace-only).
 */
function hasValue(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

/**
 * Inserts authority (CX.4) into PV1-19 in the raw message string.
 * CX.4 is an HD type with format: namespace&system&type
 */
function insertPv1AuthorityIntoRawMessage(
  rawMessage: string,
  namespace: string | undefined,
  system: string | undefined,
): string {
  // HL7v2 segments are separated by \r
  const segments = rawMessage.split("\r");

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment?.startsWith("PV1|")) {
      continue;
    }

    // Found PV1 segment, modify field 19
    const fields = segment.split("|");

    // PV1 field indices: [0]=segment name, [1]=field 1, ..., [19]=field 19
    if (fields.length <= 19) {
      // Extend fields array to have at least 20 elements
      while (fields.length <= 19) {
        fields.push("");
      }
    }

    const pv1_19 = fields[19] ?? "";

    // Parse existing CX components (separated by ^)
    const components = pv1_19.split("^");
    const existingValue = components[0] || "";

    if (!existingValue.trim()) {
      continue; // No visit number value, skip
    }

    // Build CX.4 (HD type: namespace&system&type)
    // HD format: HD.1&HD.2&HD.3 where HD.1=namespace, HD.2=universalId, HD.3=universalIdType
    const hdParts: string[] = [];
    hdParts.push(namespace || "");
    hdParts.push(system || "");
    if (system) {
      hdParts.push("ISO"); // HD.3 - Universal ID Type
    }
    const cx4Value = hdParts.join("&");

    // CX has components: CX.1^CX.2^CX.3^CX.4^CX.5^...
    // We need to set CX.4 (index 3)
    while (components.length < 4) {
      components.push("");
    }
    components[3] = cx4Value;

    // Reconstruct the field
    fields[19] = components.join("^");

    // Reconstruct the segment
    segments[i] = fields.join("|");
    break;
  }

  return segments.join("\r");
}

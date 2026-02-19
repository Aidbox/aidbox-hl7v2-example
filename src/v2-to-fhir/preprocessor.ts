/**
 * Preprocessor for HL7v2 messages before FHIR conversion.
 *
 * The preprocessor runs before message handlers on already-parsed messages.
 * It modifies parsed segments in place and returns the modified HL7v2Message.
 *
 * Preprocessing is config-driven:
 * - Per message type (ORU-R01, ADT-A01, etc.)
 * - Per segment and field (e.g., PV1.19)
 * - Uses a list of preprocessor IDs that compose in order
 *
 * Preprocessors run for every matching segment only when the configured field is present.
 */

import type { HL7v2Message, HL7v2Segment } from "../hl7v2/generated/types";
import { fromMSH } from "../hl7v2/generated/fields";
import type { Hl7v2ToFhirConfig } from "./config";
import { findSegment } from "./converter";
import {
  getPreprocessor,
  type PreprocessorContext,
} from "./preprocessor-registry";

// DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity.md
// After config restructure:
//   config[configKey] -> config.messages[configKey]
//   NonNullable<Hl7v2ToFhirConfig[string]>["preprocess"] -> NonNullable<MessageTypeConfig>["preprocess"]
// END DESIGN PROTOTYPE

/**
 * Preprocesses a parsed HL7v2 message based on config.
 * Returns a (possibly modified) parsed message.
 */
export function preprocessMessage(
  parsed: HL7v2Message,
  config: Hl7v2ToFhirConfig,
): HL7v2Message {
  const configKey = extractMessageTypeKey(parsed);
  if (!configKey) {
    return parsed;
  }

  const messageConfig = config[configKey];
  if (!messageConfig?.preprocess) {
    return parsed;
  }

  return applyPreprocessors(parsed, messageConfig.preprocess);
}

/**
 * Extracts message type from MSH-9 and converts to config key format.
 * "ORU^R01" -> "ORU-R01", "ADT^A01" -> "ADT-A01"
 */
function extractMessageTypeKey(parsed: HL7v2Message): string | null {
  const mshSegment = findSegment(parsed, "MSH");
  if (!mshSegment) return null;

  const msh = fromMSH(mshSegment);
  const code = msh.$9_messageType?.$1_code;
  const event = msh.$9_messageType?.$2_event;

  if (!code || !event) return null;

  return `${code}-${event}`;
}

function applyPreprocessors(
  parsed: HL7v2Message,
  preprocessConfig: NonNullable<Hl7v2ToFhirConfig[string]>["preprocess"],
): HL7v2Message {
  if (!preprocessConfig) {
    return parsed;
  }

  const context: PreprocessorContext = {
    parsedMessage: parsed,
  };

  for (let i = 0; i < parsed.length; i++) {
    const segment = parsed[i];
    if (!segment) continue;

    const segmentType = segment.segment;

    const segmentConfig = preprocessConfig[segmentType as keyof typeof preprocessConfig];
    if (!segmentConfig)
      continue;

    // Apply preprocessors for each configured field
    for (const [field, preprocessorIds] of Object.entries(segmentConfig)) {
      if (!Array.isArray(preprocessorIds)) continue;

      // Only process if the field is present in the segment
      if (!isFieldPresentInSegment(segment, field))
        continue;

      // Apply each preprocessor in order (each wrapped in try-catch)
      for (const id of preprocessorIds) {
        try {
          const preprocessor = getPreprocessor(id);
          preprocessor(context, segment);
        } catch (error) {
          console.error(
            `Preprocessor "${id}" failed on ${segmentType}-${field}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }
  }

  return parsed;
}

function isFieldPresentInSegment(segment: HL7v2Segment, field: string): boolean {
  const fieldIndex = parseInt(field, 10);
  if (isNaN(fieldIndex)) return false;

  const fieldValue = segment.fields[fieldIndex];
  if (fieldValue === undefined || fieldValue === null) return false;
  if (typeof fieldValue === "string") return fieldValue.trim().length > 0;
  return true;
}

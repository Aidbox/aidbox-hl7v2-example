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
 * Preprocessors run for every matching segment and configured field in listed order.
 * By default, preprocessors run only when the configured field has a non-empty value.
 * Select preprocessors may opt into empty-field execution for specific field keys.
 */

import type { HL7v2Message, HL7v2Segment } from "../hl7v2/generated/types";
import { fromMSH } from "../hl7v2/generated/fields";
import type { Hl7v2ToFhirConfig, MessageTypeConfig } from "./config";
import { findSegment } from "./converter";
import {
  getPreprocessor,
  type PreprocessorContext,
} from "./preprocessor-registry";

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

  const messageConfig = config.messages?.[configKey];
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
  preprocessConfig: NonNullable<MessageTypeConfig>["preprocess"],
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

      // Apply each preprocessor in order (each wrapped in try-catch)
      for (const id of preprocessorIds) {
        if (!shouldRunPreprocessorForField(segment, field, id)) {
          continue;
        }

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

function shouldRunPreprocessorForField(
  segment: HL7v2Segment,
  field: string,
  preprocessorId: string,
): boolean {
  // Special-case: this fallback must be scoped to RXA-3 and allowed to run
  // when RXA-3 is empty/missing so it can backfill from MSH-7.
  if (preprocessorId === "fallback-rxa3-from-msh7") {
    return segment.segment === "RXA" && field === "3";
  }

  return isFieldPresentInSegment(segment, field);
}

function isFieldPresentInSegment(segment: HL7v2Segment, field: string): boolean {
  const fieldIndex = parseInt(field, 10);
  if (isNaN(fieldIndex)) return false;

  const fieldValue = segment.fields[fieldIndex];
  if (fieldValue === undefined || fieldValue === null) return false;
  if (typeof fieldValue === "string") return fieldValue.trim().length > 0;
  return true;
}

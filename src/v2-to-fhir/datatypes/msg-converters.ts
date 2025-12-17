import type { MSG } from "../../hl7v2/generated/fields";
import type { Coding } from "../../fhir/hl7-fhir-r4-core";

const MSG_EVENT_SYSTEM = "http://terminology.hl7.org/CodeSystem/v2-0003";

/** Partial MessageHeader data for eventCoding and definition */
export interface MessageHeaderEventData {
  eventCoding?: Coding;
  definition?: string;
}

/**
 * Converts MSG (Message Type) to FHIR code.
 *
 * Mapping:
 * - MSG.2 (Trigger Event) -> $this (code)
 */
export function convertMSGToCode(msg: MSG | undefined): string | undefined {
  if (!msg) return undefined;
  return msg.$2_event;
}

/**
 * Converts MSG (Message Type) to Coding.
 *
 * Mapping:
 * - MSG.2 (Trigger Event) -> code
 * - system = "http://terminology.hl7.org/CodeSystem/v2-0003"
 * - display = MSG.1^MSG.2^MSG.3 (concatenated)
 */
export function convertMSGToCoding(msg: MSG | undefined): Coding | undefined {
  if (!msg) return undefined;
  if (!msg.$2_event) return undefined;

  const coding: Coding = {
    code: msg.$2_event,
    system: MSG_EVENT_SYSTEM,
  };

  // Build display from all components
  const displayParts = [msg.$1_code, msg.$2_event, msg.$3_structure].filter(Boolean);
  if (displayParts.length > 0) {
    coding.display = displayParts.join("^");
  }

  return coding;
}

/**
 * Converts MSG (Message Type) to MessageHeader event data.
 *
 * Mapping:
 * - MSG.2 (Trigger Event) -> eventCoding.code
 * - eventCoding.system = "http://terminology.hl7.org/CodeSystem/v2-0003"
 * - MSG.3 (Message Structure) -> definition (as canonical URI)
 */
export function convertMSGToMessageHeader(msg: MSG | undefined): MessageHeaderEventData | undefined {
  if (!msg) return undefined;
  if (!msg.$2_event && !msg.$3_structure) return undefined;

  const result: MessageHeaderEventData = {};

  if (msg.$2_event) {
    result.eventCoding = {
      code: msg.$2_event,
      system: MSG_EVENT_SYSTEM,
    };
  }

  if (msg.$3_structure) {
    // According to the spec, this should map to MessageHeader.definition
    // which is a canonical reference to a MessageDefinition
    result.definition = msg.$3_structure;
  }

  return result;
}

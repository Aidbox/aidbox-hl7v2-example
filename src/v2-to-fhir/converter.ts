/**
 * HL7v2 to FHIR Converter Router
 *
 * Routes HL7v2 messages to appropriate converters based on message type.
 * Supports: ADT_A01, ADT_A08
 */

import { parseMessage } from "@atomic-ehr/hl7v2";
import type { HL7v2Message, HL7v2Segment } from "../hl7v2/generated/types";
import { fromMSH, type MSH } from "../hl7v2/generated/fields";
import type { Bundle } from "../fhir/hl7-fhir-r4-core";
import { convertADT_A01 } from "./messages/adt-a01";
import { convertADT_A08 } from "./messages/adt-a08";

// ============================================================================
// Helper Functions
// ============================================================================

function findSegment(
  message: HL7v2Message,
  name: string
): HL7v2Segment | undefined {
  return message.find((s) => s.segment === name);
}

/**
 * Extract message type from MSH-9 segment
 * Returns message type in format: ADT_A01, ADT_A08, etc.
 */
function extractMessageType(message: string): string {
  const parsed = parseMessage(message);

  const mshSegment = findSegment(parsed, "MSH");
  if (!mshSegment) {
    throw new Error("MSH segment not found");
  }

  const msh = fromMSH(mshSegment);

  if (!msh.$9_messageType) {
    throw new Error("Message type not found in MSH-9");
  }

  const code = msh.$9_messageType.$1_code;
  const event = msh.$9_messageType.$2_event;

  if (!code || !event) {
    throw new Error("Invalid message type in MSH-9");
  }

  return `${code}_${event}`;
}

// ============================================================================
// Main Converter Function
// ============================================================================

/**
 * Convert HL7v2 message to FHIR Bundle
 *
 * Reads message type from MSH-9 and routes to appropriate converter:
 * - ADT_A01 -> convertADT_A01
 * - ADT_A08 -> convertADT_A08
 *
 * @param message - Raw HL7v2 message string
 * @returns FHIR R4 Transaction Bundle
 * @throws Error if message type is unsupported
 */
export function convertToFHIR(message: string): Bundle {
  const messageType = extractMessageType(message);

  switch (messageType) {
    case "ADT_A01":
      return convertADT_A01(message);

    case "ADT_A08":
      return convertADT_A08(message);

    default:
      throw new Error(`Unsupported message type: ${messageType}`);
  }
}

export default convertToFHIR;

// Re-export types for backward compatibility
export type { Bundle, BundleEntry } from "../fhir/hl7-fhir-r4-core";

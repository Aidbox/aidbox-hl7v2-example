/**
 * HL7v2 to FHIR Converter Router
 *
 * Routes HL7v2 messages to appropriate converters based on message type.
 * Supports: ADT_A01, ADT_A08, ORU_R01, ORM_O01, VXU_V04
 */

import type { HL7v2Message, HL7v2Segment } from "../hl7v2/generated/types";
import { fromMSH } from "../hl7v2/generated/fields";
import type { Bundle } from "../fhir/hl7-fhir-r4-core";
import type { IncomingHL7v2Message } from "../fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import { convertADT_A01 } from "./messages/adt-a01";
import { convertADT_A08 } from "./messages/adt-a08";
import { convertORU_R01 } from "./messages/oru-r01";
import { convertORM_O01 } from "./messages/orm-o01";
import { convertVXU_V04 } from "./messages/vxu-v04";
import { createConverterContext } from "./converter-context";

// ============================================================================
// Types
// ============================================================================

export interface ConversionResult {
  /** Absent when conversion fails (e.g., required PV1 invalid). */
  bundle?: Bundle;
  messageUpdate: Partial<IncomingHL7v2Message>;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function findSegment(
  message: HL7v2Message,
  name: string,
): HL7v2Segment | undefined {
  return message.find((s) => s.segment === name);
}

export function findAllSegments(
  message: HL7v2Message,
  name: string,
): HL7v2Segment[] {
  return message.filter((s) => s.segment === name);
}

function extractMessageType(parsed: HL7v2Message): string {
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
 * Convert HL7v2 message to FHIR Bundle with message update
 *
 * Reads message type from MSH-9 and routes to appropriate converter:
 * - ADT_A01 -> convertADT_A01
 * - ADT_A08 -> convertADT_A08
 * - ORU_R01 -> convertORU_R01
 * - ORM_O01 -> convertORM_O01
 * - VXU_V04 -> convertVXU_V04
 *
 * @param parsed - Already-parsed HL7v2 message
 * @returns ConversionResult with FHIR Bundle and message update fields
 * @throws Error if message type is unsupported
 */
export async function convertToFHIR(
  parsed: HL7v2Message,
): Promise<ConversionResult> {
  const messageType = extractMessageType(parsed);
  const context = createConverterContext();

  switch (messageType) {
    case "ADT_A01":
      return await convertADT_A01(parsed, context);

    case "ADT_A08":
      return await convertADT_A08(parsed, context);

    case "ORU_R01":
      return await convertORU_R01(parsed, context);

    case "ORM_O01":
      return await convertORM_O01(parsed, context);

    case "VXU_V04":
      return await convertVXU_V04(parsed, context);

    default:
      throw new Error(`Unsupported message type: ${messageType}`);
  }
}

export default convertToFHIR;

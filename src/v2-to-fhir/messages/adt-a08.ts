/**
 * HL7v2 ADT_A08 Message to FHIR Bundle Converter
 *
 * ADT_A08 - Update Patient Information
 *
 * Creates:
 * - Patient from PID
 */

import type { HL7v2Message } from "../../hl7v2/generated/types";
import { findSegment, type ConversionResult } from "../converter";
import {
  fromMSH,
  fromPID,
  type MSH,
} from "../../hl7v2/generated/fields";
import type {
  Patient,
  Bundle,
  Coding,
  Meta,
} from "../../fhir/hl7-fhir-r4-core";
import { convertPIDToPatient } from "../segments/pid-patient";
import type { ConverterContext } from "../converter-context";
import { createBundleEntry } from "../fhir-bundle";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract meta tags from MSH segment
 */
function extractMetaTags(msh: MSH): Coding[] {
  const tags: Coding[] = [];

  // Message Control ID
  if (msh.$10_messageControlId) {
    tags.push({
      code: msh.$10_messageControlId,
      system: "urn:aidbox:hl7v2:message-id",
    });
  }

  // Message Type (ADT^A08 -> ADT_A08)
  if (msh.$9_messageType) {
    const code = msh.$9_messageType.$1_code;
    const event = msh.$9_messageType.$2_event;
    if (code && event) {
      tags.push({
        code: `${code}_${event}`,
        system: "urn:aidbox:hl7v2:message-type",
      });
    }
  }

  return tags;
}


// ============================================================================
// Main Converter Function
// ============================================================================

/**
 * Convert HL7v2 ADT_A08 message to FHIR Transaction Bundle
 *
 * Message Structure:
 * MSH - Message Header (1)
 * EVN - Event Type (1)
 * PID - Patient Identification (1)
 */
export async function convertADT_A08(
  parsed: HL7v2Message,
  context: ConverterContext,
): Promise<ConversionResult> {
  const { resolvePatientId } = context;
  // =========================================================================
  // Extract MSH
  // =========================================================================
  const mshSegment = findSegment(parsed, "MSH");
  if (!mshSegment) {
    throw new Error("MSH segment not found");
  }
  const msh = fromMSH(mshSegment);

  // =========================================================================
  // Extract PID
  // =========================================================================
  const pidSegment = findSegment(parsed, "PID");
  if (!pidSegment) {
    throw new Error("PID segment not found");
  }
  const pid = fromPID(pidSegment);

  // =========================================================================
  // Create Meta with Tags
  // =========================================================================
  const meta: Meta = {
    tag: extractMetaTags(msh),
  };

  // =========================================================================
  // Convert PID to Patient
  // =========================================================================
  const patient = convertPIDToPatient(pid);

  const patientIdResult = await resolvePatientId(pid.$3_identifier ?? []);
  if ("error" in patientIdResult) {
    return {
      messageUpdate: { status: "error", error: patientIdResult.error },
    };
  }
  patient.id = patientIdResult.id;

  // Add meta tags to patient
  patient.meta = meta;

  // Extract sender tag from MR identifier if available
  if (pid.$3_identifier) {
    for (const cx of pid.$3_identifier) {
      if (cx.$5_type === "MR" && cx.$4_system?.$1_namespace) {
        const senderTag: Coding = {
          code: cx.$4_system.$1_namespace.toLowerCase(),
          system: "urn:aidbox:hl7v2:sender",
        };
        if (!meta.tag?.some((t) => t.system === senderTag.system)) {
          meta.tag?.push(senderTag);
        }
      }
    }
  }

  // =========================================================================
  // Create Bundle Entry
  // =========================================================================
  const entry = createBundleEntry(patient);

  // =========================================================================
  // Create Bundle
  // =========================================================================
  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: [entry],
  };

  return {
    bundle,
    messageUpdate: {
      status: "processed",
      patient: { reference: `Patient/${patient.id}` },
    },
  };
}

export default convertADT_A08;

/**
 * MSH parsing and meta tag extraction for message converters.
 */

import type { HL7v2Message } from "../../hl7v2/generated/types";
import { findSegment } from "../converter";
import { fromMSH, type MSH } from "../../hl7v2/generated/fields";
import type { Coding, Meta } from "../../fhir/hl7-fhir-r4-core";
import type { SenderContext } from "../../code-mapping/concept-map";

export interface ParsedMSH {
  msh: MSH;
  senderContext: SenderContext;
  baseMeta: Meta;
}

export function extractMetaTags(msh: MSH): Coding[] {
  const tags: Coding[] = [];

  if (msh.$10_messageControlId) {
    tags.push({
      code: msh.$10_messageControlId,
      system: "urn:aidbox:hl7v2:message-id",
    });
  }

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

export function addSenderTagToMeta(meta: Meta, senderTag: Coding | undefined): void {
  if (!senderTag || !meta.tag) return;

  const hasSenderTag = meta.tag.some((t) => t.system === senderTag.system);
  if (!hasSenderTag) {
    meta.tag.push(senderTag);
  }
}

export function parseMSH(message: HL7v2Message, messageType: string): ParsedMSH {
  const mshSegment = findSegment(message, "MSH");
  if (!mshSegment) {
    throw new Error(`MSH segment not found in ${messageType} message`);
  }

  const msh = fromMSH(mshSegment);

  const sendingApplication = msh.$3_sendingApplication?.$1_namespace;
  const sendingFacility = msh.$4_sendingFacility?.$1_namespace;

  if (!sendingApplication || !sendingFacility) {
    throw new Error(
      `MSH-3 (sending application) and MSH-4 (sending facility) are required. ` +
        `Got: MSH-3="${sendingApplication || ""}", MSH-4="${sendingFacility || ""}"`,
    );
  }

  const senderContext: SenderContext = { sendingApplication, sendingFacility };

  const baseMeta: Meta = {
    tag: extractMetaTags(msh),
  };

  return { msh, senderContext, baseMeta };
}

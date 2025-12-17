import type { HD } from "../../hl7v2/generated/fields";
import type { Attachment } from "../../fhir/hl7-fhir-r4-core";

/** RP (Reference Pointer) datatype */
export interface RP {
  /** RP.1 - Pointer */
  $1_pointer?: string;
  /** RP.2 - Application ID */
  $2_applicationId?: HD;
  /** RP.3 - Type of Data */
  $3_typeOfData?: string;
  /** RP.4 - Subtype */
  $4_subtype?: string;
}

/** Partial DocumentReference data */
export interface DocumentReferenceContentData {
  content?: {
    attachment?: Attachment;
  }[];
}

/**
 * Converts RP (Reference Pointer) to Attachment.
 *
 * Mapping:
 * - RP.1 (Pointer) -> url
 * - RP.3 (Type of Data) / RP.4 (Subtype) -> contentType (format: type/subtype)
 */
export function convertRPToAttachment(rp: RP | undefined): Attachment | undefined {
  if (!rp) return undefined;
  if (!rp.$1_pointer && !rp.$3_typeOfData) return undefined;

  const attachment: Attachment = {};

  if (rp.$1_pointer) {
    attachment.url = rp.$1_pointer;
  }

  // Build contentType from type and subtype
  if (rp.$3_typeOfData) {
    if (rp.$4_subtype) {
      attachment.contentType = `${rp.$3_typeOfData}/${rp.$4_subtype}`;
    } else {
      attachment.contentType = rp.$3_typeOfData;
    }
  }

  return attachment;
}

/**
 * Converts RP (Reference Pointer) to DocumentReference content data.
 *
 * Mapping:
 * - RP.1 (Pointer) -> content[0].attachment.url
 * - RP.3/RP.4 -> content[0].attachment.contentType
 */
export function convertRPToDocumentReference(rp: RP | undefined): DocumentReferenceContentData | undefined {
  const attachment = convertRPToAttachment(rp);
  if (!attachment) return undefined;

  return {
    content: [{ attachment }],
  };
}

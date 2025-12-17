import type { Attachment, DocumentReferenceContent } from "../../fhir/hl7-fhir-r4-core";

/**
 * ED (Encapsulated Data) structure for HL7v2.
 * Note: May not be in generated types, defined here for converter use.
 */
export interface ED {
  /** ED.1 - Source Application */
  $1_sourceApplication?: string;
  /** ED.2 - Type of Data */
  $2_typeOfData?: string;
  /** ED.3 - Data Subtype */
  $3_dataSubtype?: string;
  /** ED.4 - Encoding */
  $4_encoding?: string;
  /** ED.5 - Data */
  $5_data?: string;
}

/**
 * Converts ED (Encapsulated Data) to FHIR Attachment.
 *
 * Mapping:
 * - ED.3 (Data Subtype) -> contentType
 * - ED.5 (Data) -> data (base64Binary)
 *
 * Note: ED.5 data may need to be converted from A or HEX to base64.
 * This basic implementation returns the data as-is.
 */
export function convertEDToAttachment(ed: ED | undefined): Attachment | undefined {
  if (!ed) return undefined;
  if (!ed.$5_data && !ed.$3_dataSubtype) return undefined;

  const attachment: Attachment = {};

  if (ed.$3_dataSubtype) {
    attachment.contentType = ed.$3_dataSubtype;
  }

  if (ed.$5_data) {
    attachment.data = ed.$5_data;
  }

  return attachment;
}

/** Partial DocumentReference data for ED conversion */
export interface DocumentReferenceData {
  status: "current" | "superseded" | "entered-in-error";
  content: DocumentReferenceContent[];
}

/**
 * Converts ED (Encapsulated Data) to partial DocumentReference data.
 *
 * Mapping:
 * - Fixed: status = "current"
 * - ED.3 (Data Subtype) -> content.attachment.contentType
 * - ED.5 (Data) -> content.attachment.data (base64Binary)
 *
 * Note: ED.5 data may need to be converted from A or HEX to base64.
 * This basic implementation returns the data as-is.
 */
export function convertEDToDocumentReference(ed: ED | undefined): DocumentReferenceData | undefined {
  if (!ed) return undefined;
  if (!ed.$5_data && !ed.$3_dataSubtype) return undefined;

  const attachment: Attachment = {};

  if (ed.$3_dataSubtype) {
    attachment.contentType = ed.$3_dataSubtype;
  }

  if (ed.$5_data) {
    attachment.data = ed.$5_data;
  }

  return {
    status: "current",
    content: [{ attachment }],
  };
}

/**
 * HL7v2 XCN to FHIR Annotation (with Author) Mapping
 * Based on: HL7 Data Type - FHIR R4_ XCN[Annotation-Author]
 */

import type { XCN } from "../../hl7v2/generated/fields";
import type {
  Annotation,
  Practitioner,
  Reference,
} from "../../fhir/hl7-fhir-r4-core";
import { convertXCNToPractitioner } from "./xcn-practitioner";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of XCN to Annotation-Author conversion
 * Contains both the Practitioner resource and the Annotation with authorReference
 */
export interface AnnotationWithAuthor {
  /** The Practitioner resource created from XCN */
  practitioner: Practitioner;
  /** The Annotation with authorReference pointing to the Practitioner */
  annotation: Annotation;
  /** Temporary UUID for the Practitioner (used in authorReference) */
  practitionerId: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a temporary UUID for FHIR resources
 * Format: urn:uuid:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
function generateTempId(): string {
  return `urn:uuid:${crypto.randomUUID()}`;
}

// ============================================================================
// Main Converter Function
// ============================================================================

/**
 * Convert HL7v2 XCN (Extended Composite ID Number and Name for Persons) to FHIR Annotation with Author
 *
 * This creates both:
 * 1. A Practitioner resource from the XCN data
 * 2. An Annotation with authorReference pointing to that Practitioner
 *
 * The Practitioner is assigned a temporary UUID (urn:uuid:...) for use in FHIR Bundles.
 *
 * Mapping:
 * - XCN.1          -> authorReference(Practitioner.identifier[1].value)
 * - XCN.2 (FN)     -> authorReference(Practitioner.name)
 * - XCN.3          -> authorReference(Practitioner.name.given[1])
 * - XCN.4          -> authorReference(Practitioner.name.given[2])
 * - XCN.5          -> authorReference(Practitioner.name.suffix[1])
 * - XCN.6          -> authorReference(Practitioner.name.prefix)
 * - XCN.7          -> authorReference(Practitioner.name.suffix[2])
 * - XCN.9          -> authorReference(Practitioner.identifier[1].assigner/system)
 * - XCN.10         -> authorReference(Practitioner.name.use)
 * - XCN.11         -> authorReference(Practitioner.extension[1]) - checkDigit
 * - XCN.12         -> authorReference(Practitioner.extension[2]) - checkDigitScheme
 * - XCN.13         -> authorReference(Practitioner.identifier[1].type.coding.code)
 * - XCN.14         -> authorReference(Practitioner.identifier.extension) - assigningFacility
 * - XCN.17         -> authorReference(Practitioner.name.period) - if XCN.19/20 not present
 * - XCN.18         -> authorReference(Practitioner.name.family.extension) - assembly order
 * - XCN.19         -> authorReference(Practitioner.name.period.start)
 * - XCN.20         -> authorReference(Practitioner.name.period.end)
 * - XCN.21         -> authorReference(Practitioner.name.suffix)
 *
 * @param xcn - HL7v2 XCN datatype
 * @param text - The annotation text (required for Annotation)
 * @param time - Optional timestamp for the annotation
 * @returns AnnotationWithAuthor object containing Practitioner, Annotation, and ID, or undefined if XCN is invalid
 */
export function convertXCNToAnnotationAuthor(
  xcn: XCN | undefined,
  text: string,
  time?: string
): AnnotationWithAuthor | undefined {
  if (!xcn) return undefined;

  // Convert XCN to Practitioner
  const practitioner = convertXCNToPractitioner(xcn);
  if (!practitioner) return undefined;

  // Generate temporary ID for the Practitioner
  const practitionerId = generateTempId();

  // Add ID to Practitioner
  const practitionerWithId: Practitioner = {
    ...practitioner,
    id: practitionerId,
  };

  // Create authorReference
  const authorReference: Reference<"Practitioner"> = {
    reference: `Practitioner/${practitionerId}`,
  };

  // Add display text if we have name information
  if (practitioner.name?.[0]) {
    const name = practitioner.name[0];
    const displayParts: string[] = [];

    if (name.prefix?.length) displayParts.push(...name.prefix);
    if (name.given?.length) displayParts.push(...name.given);
    if (name.family) displayParts.push(name.family);
    if (name.suffix?.length) displayParts.push(...name.suffix);

    if (displayParts.length > 0) {
      authorReference.display = displayParts.join(" ");
    }
  }

  // Create Annotation with authorReference
  const annotation: Annotation = {
    authorReference,
    text,
    ...(time && { time }),
  };

  return {
    practitioner: practitionerWithId,
    annotation,
    practitionerId,
  };
}

/**
 * Convert array of XCN to array of AnnotationWithAuthor
 *
 * @param xcns - Array of HL7v2 XCN datatypes
 * @param text - The annotation text (required for Annotation)
 * @param time - Optional timestamp for the annotations
 * @returns Array of AnnotationWithAuthor objects, or undefined if no valid conversions
 */
export function convertXCNArrayToAnnotationAuthors(
  xcns: XCN[] | undefined,
  text: string,
  time?: string
): AnnotationWithAuthor[] | undefined {
  if (!xcns || xcns.length === 0) return undefined;

  const results: AnnotationWithAuthor[] = [];

  for (const xcn of xcns) {
    const result = convertXCNToAnnotationAuthor(xcn, text, time);
    if (result) results.push(result);
  }

  return results.length > 0 ? results : undefined;
}

export default convertXCNToAnnotationAuthor;

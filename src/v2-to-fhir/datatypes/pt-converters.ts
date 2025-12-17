import type { PT } from "../../hl7v2/generated/fields";
import type { Meta, Coding } from "../../fhir/hl7-fhir-r4-core";

const PROCESSING_ID_SYSTEM = "http://terminology.hl7.org/CodeSystem/v2-0103";
const PROCESSING_MODE_SYSTEM = "http://terminology.hl7.org/CodeSystem/v2-0207";

/**
 * Converts PT (Processing Type) to Meta.
 *
 * Mapping:
 * - PT.1 (Processing ID) -> tag[0].code, tag[0].system = v2-0103
 * - PT.2 (Processing Mode) -> tag[1].code, tag[1].system = v2-0207
 */
export function convertPTToMeta(pt: PT | undefined): Partial<Meta> | undefined {
  if (!pt) return undefined;
  if (!pt.$1_processingId && !pt.$2_processingMode) return undefined;

  const tags: Coding[] = [];

  if (pt.$1_processingId) {
    tags.push({
      system: PROCESSING_ID_SYSTEM,
      code: pt.$1_processingId,
    });
  }

  if (pt.$2_processingMode) {
    tags.push({
      system: PROCESSING_MODE_SYSTEM,
      code: pt.$2_processingMode,
    });
  }

  return {
    tag: tags,
  };
}

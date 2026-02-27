/**
 * IGEnrichment — contract for IG-specific post-conversion logic.
 *
 * Code pattern/contract, not a framework. No registry, no config-driven selection.
 * Sync (pure data transformation), operates on whole ConversionResult.
 * On hard error, sets messageUpdate.status = "error" and messageUpdate.error.
 */

import type { HL7v2Message } from "../../hl7v2/generated/types";
import type { ConversionResult } from "../converter";
import type { SenderContext } from "../../code-mapping/concept-map";

export interface IGEnrichment {
  name: string;

  /**
   * Enrich a ConversionResult with IG-specific data.
   *
   * Reads segments from the parsed message, finds matching resources in
   * result.bundle by position, and adds IG-specific fields.
   *
   * May return a modified result or an error result if IG-specific
   * validation fails (e.g., unknown OBX code in ORDER context).
   */
  enrich(
    parsedMessage: HL7v2Message,
    result: ConversionResult,
    context: SenderContext,
  ): ConversionResult;
}

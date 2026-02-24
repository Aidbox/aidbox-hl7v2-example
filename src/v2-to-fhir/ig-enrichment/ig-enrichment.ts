/**
 * DESIGN PROTOTYPE: 2026-02-23-vxu-support.md
 *
 * IGEnrichment interface -- contract for IG-specific post-conversion logic.
 *
 * Design principles:
 * - Code pattern/contract, not a framework. No registry, no config-driven selection.
 * - Sync, not async. IG enrichment is pure data transformation.
 * - Operates on whole ConversionResult (cross-resource context needed).
 * - Correlation via deterministic IDs in the bundle.
 * - On hard error, sets messageUpdate.status = "error" and messageUpdate.error.
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
   * result.bundle by deterministic ID, and adds IG-specific fields.
   *
   * May return a modified result or a new error result if IG-specific
   * validation fails (e.g., unknown OBX code in ORDER context).
   */
  enrich(
    parsedMessage: HL7v2Message,
    result: ConversionResult,
    context: SenderContext,
  ): ConversionResult;
}

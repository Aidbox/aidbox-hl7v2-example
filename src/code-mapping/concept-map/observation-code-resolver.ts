/**
 * Observation Code Resolution Service
 *
 * Resolves OBX-3 observation identifiers to LOINC codes.
 * Uses inline LOINC detection first, then falls back to ConceptMap lookup.
 */

import type { CE } from "../../hl7v2/generated/fields";
import type { CodeableConcept, Coding } from "../../fhir/hl7-fhir-r4-core";
import { normalizeSystem } from "../../v2-to-fhir/code-mapping/coding-systems";
import {
  generateConceptMapId,
  translateCode,
  type SenderContext,
} from "./service";

// Re-export SenderContext for backward compatibility
export type { SenderContext } from "./service";

export interface CodeResolutionResult {
  loinc: Coding;
  local?: Coding;
}

export class LoincResolutionError extends Error {
  constructor(
    message: string,
    public readonly localCode: string | undefined,
    public readonly localDisplay: string | undefined,
    public readonly localSystem: string | undefined,
    public readonly sendingApplication: string,
    public readonly sendingFacility: string,
  ) {
    super(message);
    this.name = "LoincResolutionError";
  }
}

export class MissingLocalSystemError extends Error {
  constructor(
    message: string,
    public readonly localCode: string | undefined,
    public readonly localDisplay: string | undefined,
    public readonly sendingApplication: string,
    public readonly sendingFacility: string,
  ) {
    super(message);
    this.name = "MissingLocalSystemError";
  }
}

/**
 * Check if OBX-3 has LOINC code in primary coding (components 1-3)
 */
function hasLoincInPrimaryCoding(ce: CE): boolean {
  return ce.$3_system?.toUpperCase() === "LN";
}

/**
 * Check if OBX-3 has LOINC code in alternate coding (components 4-6)
 */
function hasLoincInAlternateCoding(ce: CE): boolean {
  return ce.$6_altSystem?.toUpperCase() === "LN";
}

/**
 * Extract LOINC coding from primary fields (components 1-3)
 */
function extractLoincFromPrimary(ce: CE): Coding {
  return {
    code: ce.$1_code,
    display: ce.$2_text,
    system: "http://loinc.org",
  };
}

/**
 * Extract LOINC coding from alternate fields (components 4-6)
 */
function extractLoincFromAlternate(ce: CE): Coding {
  return {
    code: ce.$4_altCode,
    display: ce.$5_altDisplay,
    system: "http://loinc.org",
  };
}

/**
 * Extract local coding from primary fields (components 1-3)
 */
function extractLocalFromPrimary(ce: CE): Coding | undefined {
  if (!ce.$1_code) return undefined;
  return {
    code: ce.$1_code,
    display: ce.$2_text,
    system: normalizeSystem(ce.$3_system),
  };
}

function tryResolveFromInlineLoinc(
  observationIdentifier: CE,
): CodeResolutionResult | null {
  if (hasLoincInPrimaryCoding(observationIdentifier)) {
    return { loinc: extractLoincFromPrimary(observationIdentifier) };
  }

  if (hasLoincInAlternateCoding(observationIdentifier)) {
    return {
      loinc: extractLoincFromAlternate(observationIdentifier),
      local: extractLocalFromPrimary(observationIdentifier),
    };
  }

  return null;
}

async function resolveFromConceptMap(
  observationIdentifier: CE,
  sender: SenderContext,
): Promise<CodeResolutionResult> {
  const localCode = observationIdentifier.$1_code;
  const localDisplay = observationIdentifier.$2_text;
  const localSystem = observationIdentifier.$3_system;

  if (!localCode) {
    throw new LoincResolutionError(
      "OBX-3 has no code value",
      undefined,
      undefined,
      localSystem,
      sender.sendingApplication,
      sender.sendingFacility,
    );
  }

  if (!localSystem) {
    throw new MissingLocalSystemError(
      `OBX-3 local code "${localCode}" is missing coding system (component 3). ` +
        `Messages without local code system are not supported.`,
      localCode,
      localDisplay,
      sender.sendingApplication,
      sender.sendingFacility,
    );
  }

  const conceptMapId = generateConceptMapId(sender, "observation-code-loinc");
  const localSystemNormalized = normalizeSystem(localSystem);

  const result = await translateCode(
    conceptMapId,
    localCode,
    localSystemNormalized,
  );

  if (result.status === "not_found") {
    throw new LoincResolutionError(
      `ConceptMap not found: ${conceptMapId}. ` +
        `No LOINC code in OBX-3 and no ConceptMap exists for sender ` +
        `${sender.sendingApplication}/${sender.sendingFacility}.`,
      localCode,
      localDisplay,
      localSystemNormalized,
      sender.sendingApplication,
      sender.sendingFacility,
    );
  }

  if (result.status === "no_mapping") {
    throw new LoincResolutionError(
      `No LOINC mapping found for local code "${localCode}" (system: ${localSystemNormalized || "none"}) ` +
        `in ConceptMap ${conceptMapId}. ` +
        `Sender: ${sender.sendingApplication}/${sender.sendingFacility}.`,
      localCode,
      localDisplay,
      localSystemNormalized,
      sender.sendingApplication,
      sender.sendingFacility,
    );
  }

  return {
    loinc: result.coding,
    local: extractLocalFromPrimary(observationIdentifier),
  };
}

/**
 * Resolve OBX-3 observation identifier to LOINC code.
 *
 * Resolution algorithm (per spec Appendix E):
 * 1. Check if component 3 (Name of Coding System) = "LN" → use components 1-3 as LOINC
 * 2. Else check if component 6 (Name of Alternate Coding System) = "LN" → use components 4-6 as LOINC
 * 3. If neither has "LN", lookup local code (components 1-3) in sender-specific ConceptMap via $translate
 * 4. If ConceptMap not found or mapping not found → throw error
 */
export async function resolveToLoinc(
  observationIdentifier: CE,
  sender: SenderContext,
): Promise<CodeResolutionResult> {
  const inlineResult = tryResolveFromInlineLoinc(observationIdentifier);
  if (inlineResult) return inlineResult;

  return resolveFromConceptMap(observationIdentifier, sender);
}

/**
 * Build CodeableConcept from resolution result.
 * LOINC coding comes first, followed by optional local coding.
 */
export function buildCodeableConcept(
  result: CodeResolutionResult,
): CodeableConcept {
  const codings: Coding[] = [result.loinc];

  if (result.local) {
    codings.push(result.local);
  }

  return {
    coding: codings,
    text: result.loinc.display || result.local?.display,
  };
}


/**
 * ConceptMap Lookup Service for HL7v2 to LOINC Code Resolution
 *
 * Resolves local codes to LOINC codes using sender-specific ConceptMaps.
 * ConceptMap ID convention: hl7v2-{sendingApplication}-{sendingFacility}-to-loinc
 */

import type { CE } from "../../hl7v2/generated/fields";
import type { CodeableConcept, Coding } from "../../fhir/hl7-fhir-r4-core";
import type { ConceptMap, ConceptMapGroup } from "../../fhir/hl7-fhir-r4-core/ConceptMap";
import { aidboxFetch } from "../../aidbox";
import { normalizeSystem } from "./coding-systems";

// ============================================================================
// Types
// ============================================================================

export interface SenderContext {
  sendingApplication: string;
  sendingFacility: string;
}

export interface CodeResolutionResult {
  loinc: Coding;
  local?: Coding;
}

export class LoincResolutionError extends Error {
  constructor(
    message: string,
    public readonly localCode: string | undefined,
    public readonly localSystem: string | undefined,
    public readonly sendingApplication: string,
    public readonly sendingFacility: string,
  ) {
    super(message);
    this.name = "LoincResolutionError";
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert string to kebab-case for use in ConceptMap IDs
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate ConceptMap ID from sender context
 * Format: hl7v2-{sendingApplication}-{sendingFacility}-to-loinc
 */
export function generateConceptMapId(sender: SenderContext): string {
  const app = toKebabCase(sender.sendingApplication);
  const facility = toKebabCase(sender.sendingFacility);
  return `hl7v2-${app}-${facility}-to-loinc`;
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

// ============================================================================
// ConceptMap Fetching
// ============================================================================

/**
 * Fetch ConceptMap from Aidbox by ID
 * Returns null if ConceptMap doesn't exist
 */
export async function fetchConceptMap(
  conceptMapId: string,
): Promise<ConceptMap | null> {
  try {
    return await aidboxFetch<ConceptMap>(`/fhir/ConceptMap/${conceptMapId}`);
  } catch (error) {
    // Check if it's a 404 (not found)
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

/**
 * Look up a local code in a ConceptMap to find its LOINC mapping
 */
export function lookupInConceptMap(
  conceptMap: ConceptMap,
  localCode: string,
  localSystem: string | undefined,
): Coding | null {
  if (!conceptMap.group) return null;

  for (const group of conceptMap.group) {
    // Check if this group maps to LOINC
    if (group.target !== "http://loinc.org") continue;

    // If a source system is specified in the group, check if it matches
    if (localSystem && group.source && group.source !== localSystem) {
      // Also try with normalized system
      if (normalizeSystem(localSystem) !== group.source) {
        continue;
      }
    }

    // Find matching element
    for (const element of group.element) {
      if (element.code === localCode) {
        // Found a match - get the target LOINC code
        const target = element.target?.[0];
        if (target && target.code) {
          return {
            code: target.code,
            display: target.display,
            system: "http://loinc.org",
          };
        }
      }
    }
  }

  return null;
}

// ============================================================================
// Main Resolution Function
// ============================================================================

/**
 * Resolve OBX-3 observation identifier to LOINC code.
 *
 * Resolution algorithm (per spec Appendix E):
 * 1. Check if component 3 (Name of Coding System) = "LN" → use components 1-3 as LOINC
 * 2. Else check if component 6 (Name of Alternate Coding System) = "LN" → use components 4-6 as LOINC
 * 3. If neither has "LN", lookup local code (components 1-3) in sender-specific ConceptMap
 * 4. If ConceptMap not found or mapping not found → throw error
 *
 * @param observationIdentifier - OBX-3 CE/CWE field
 * @param sender - Sender context (application and facility from MSH)
 * @returns CodeResolutionResult with LOINC coding and optional local coding
 * @throws LoincResolutionError if LOINC cannot be resolved
 */
export async function resolveToLoinc(
  observationIdentifier: CE | undefined,
  sender: SenderContext,
): Promise<CodeResolutionResult> {
  if (!observationIdentifier) {
    throw new LoincResolutionError(
      "OBX-3 observation identifier is missing",
      undefined,
      undefined,
      sender.sendingApplication,
      sender.sendingFacility,
    );
  }

  // Validate sender context
  if (!sender.sendingApplication || !sender.sendingFacility) {
    throw new LoincResolutionError(
      "sendingApplication and sendingFacility are required for code resolution",
      observationIdentifier.$1_code,
      observationIdentifier.$3_system,
      sender.sendingApplication || "empty",
      sender.sendingFacility || "empty",
    );
  }

  // Step 1: Check if LOINC is in primary coding (components 1-3)
  if (hasLoincInPrimaryCoding(observationIdentifier)) {
    return {
      loinc: extractLoincFromPrimary(observationIdentifier),
    };
  }

  // Step 2: Check if LOINC is in alternate coding (components 4-6)
  if (hasLoincInAlternateCoding(observationIdentifier)) {
    return {
      loinc: extractLoincFromAlternate(observationIdentifier),
      local: extractLocalFromPrimary(observationIdentifier),
    };
  }

  // Step 3: No inline LOINC - lookup in sender-specific ConceptMap
  const localCode = observationIdentifier.$1_code;
  const localSystem = observationIdentifier.$3_system;

  if (!localCode) {
    throw new LoincResolutionError(
      "OBX-3 has no code value",
      undefined,
      localSystem,
      sender.sendingApplication,
      sender.sendingFacility,
    );
  }

  const conceptMapId = generateConceptMapId(sender);
  const conceptMap = await fetchConceptMap(conceptMapId);

  if (!conceptMap) {
    throw new LoincResolutionError(
      `ConceptMap not found: ${conceptMapId}. ` +
        `No LOINC code in OBX-3 and no ConceptMap exists for sender ` +
        `${sender.sendingApplication}/${sender.sendingFacility}.`,
      localCode,
      localSystem,
      sender.sendingApplication,
      sender.sendingFacility,
    );
  }

  const loincCoding = lookupInConceptMap(conceptMap, localCode, localSystem);

  if (!loincCoding) {
    throw new LoincResolutionError(
      `No LOINC mapping found for local code "${localCode}" (system: ${localSystem || "none"}) ` +
        `in ConceptMap ${conceptMapId}. ` +
        `Sender: ${sender.sendingApplication}/${sender.sendingFacility}.`,
      localCode,
      localSystem,
      sender.sendingApplication,
      sender.sendingFacility,
    );
  }

  return {
    loinc: loincCoding,
    local: extractLocalFromPrimary(observationIdentifier),
  };
}

/**
 * Build CodeableConcept from resolution result.
 * LOINC coding comes first, followed by optional local coding.
 */
export function buildCodeableConcept(result: CodeResolutionResult): CodeableConcept {
  const codings: Coding[] = [result.loinc];

  if (result.local) {
    codings.push(result.local);
  }

  return {
    coding: codings,
    text: result.loinc.display || result.local?.display,
  };
}

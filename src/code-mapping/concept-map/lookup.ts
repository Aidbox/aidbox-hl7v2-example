/**
 * ConceptMap Lookup Service for HL7v2 to LOINC Code Resolution
 *
 * Resolves local codes to LOINC codes using sender-specific ConceptMaps.
 * ConceptMap ID convention: hl7v2-{sendingApplication}-{sendingFacility}-to-loinc
 */

import type { CE } from "../../hl7v2/generated/fields";
import type { CodeableConcept, Coding } from "../../fhir/hl7-fhir-r4-core";
import type { ConceptMap } from "../../fhir/hl7-fhir-r4-core/ConceptMap";
import { normalizeSystem } from "../../v2-to-fhir/code-mapping/coding-systems";
import { toKebabCase } from "../../utils/string";

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
    public readonly localDisplay: string | undefined,
    public readonly localSystem: string | undefined,
    public readonly sendingApplication: string,
    public readonly sendingFacility: string,
  ) {
    super(message);
    this.name = "LoincResolutionError";
  }
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

/**
 * Look up a local code in a ConceptMap to find its LOINC mapping.
 *
 * @param conceptMap - The ConceptMap to search in
 * @param localCode - The local code to look up
 * @param localSystem - The coding system URI (must be pre-normalized by caller using normalizeSystem())
 * @returns LOINC Coding if found, null otherwise
 */
export function lookupInConceptMap(
  conceptMap: ConceptMap,
  localCode: string,
  localSystem: string | undefined,
): Coding | null {
  if (!conceptMap.group) return null;

  for (const mappingSystem of conceptMap.group) {
    const mapsToLoinc = mappingSystem.target === "http://loinc.org";
    const matchingSystem = mappingSystem.source === localSystem;

    if (!mapsToLoinc || !matchingSystem) continue;

    for (const mapping of mappingSystem.element) {
      if (mapping.code === localCode) {
        const target = mapping.target?.[0];
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
  fetchConceptMap: (id: string) => Promise<ConceptMap | null>,
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

  const conceptMapId = generateConceptMapId(sender);
  const conceptMap = await fetchConceptMap(conceptMapId);

  if (!conceptMap) {
    throw new LoincResolutionError(
      `ConceptMap not found: ${conceptMapId}. ` +
        `No LOINC code in OBX-3 and no ConceptMap exists for sender ` +
        `${sender.sendingApplication}/${sender.sendingFacility}.`,
      localCode,
      localDisplay,
      localSystem,
      sender.sendingApplication,
      sender.sendingFacility,
    );
  }

  const localSystemNormalized = normalizeSystem(localSystem);

  const loincCoding = lookupInConceptMap(
    conceptMap,
    localCode,
    localSystemNormalized,
  );

  if (!loincCoding) {
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
    loinc: loincCoding,
    local: extractLocalFromPrimary(observationIdentifier),
  };
}

/**
 * Resolve OBX-3 observation identifier to LOINC code.
 *
 * Resolution algorithm (per spec Appendix E):
 * 1. Check if component 3 (Name of Coding System) = "LN" → use components 1-3 as LOINC
 * 2. Else check if component 6 (Name of Alternate Coding System) = "LN" → use components 4-6 as LOINC
 * 3. If neither has "LN", lookup local code (components 1-3) in sender-specific ConceptMap
 * 4. If ConceptMap not found or mapping not found → throw error
 */
export async function resolveToLoinc(
  observationIdentifier: CE,
  sender: SenderContext,
  fetchConceptMap: (id: string) => Promise<ConceptMap | null>,
): Promise<CodeResolutionResult> {
  const inlineResult = tryResolveFromInlineLoinc(observationIdentifier);
  if (inlineResult) return inlineResult;

  return resolveFromConceptMap(observationIdentifier, sender, fetchConceptMap);
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

/**
 * Format sender context as title string (format: "APP | FACILITY")
 * Used for ConceptMap.title field
 */
export function formatSenderAsTitle(sender: SenderContext): string {
  return `${sender.sendingApplication} | ${sender.sendingFacility}`;
}

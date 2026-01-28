/**
 * ConceptMap Lookup Service for HL7v2 to LOINC Code Resolution
 *
 * Resolves local codes to LOINC codes using sender-specific ConceptMaps.
 * ConceptMap ID convention: hl7v2-{sendingApplication}-{sendingFacility}-to-loinc
 */

import type { CE } from "../../hl7v2/generated/fields";
import type { CodeableConcept, Coding } from "../../fhir/hl7-fhir-r4-core";
import { normalizeSystem } from "../../v2-to-fhir/code-mapping/coding-systems";
import { toKebabCase } from "../../utils/string";
import { aidboxFetch, HttpError } from "../../aidbox";
import { MAPPING_TYPES, type MappingTypeName } from "../mapping-types";

interface TranslateResponseParameter {
  name: string;
  valueBoolean?: boolean;
  valueCoding?: Coding;
  part?: TranslateResponseParameter[];
}

interface TranslateResponse {
  resourceType: "Parameters";
  parameter?: TranslateResponseParameter[];
}

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
 * Generate ConceptMap ID from sender context
 * Format: hl7v2-{sendingApplication}-{sendingFacility}{conceptMapSuffix}
 *
 * @param sender - The sender context with sendingApplication and sendingFacility
 * @param mappingType - Optional mapping type name. Defaults to "loinc" for backward compatibility.
 */
export function generateConceptMapId(
  sender: SenderContext,
  mappingType: MappingTypeName = "loinc",
): string {
  const type = MAPPING_TYPES[mappingType];
  const app = toKebabCase(sender.sendingApplication);
  const facility = toKebabCase(sender.sendingFacility);
  return `hl7v2-${app}-${facility}${type.conceptMapSuffix}`;
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

export type TranslateResult =
  | { status: "found"; coding: Coding }
  | { status: "no_mapping" }
  | { status: "not_found" };

function extractCodingFromTranslateResponse(
  response: TranslateResponse,
): Coding | null {
  const resultParam = response.parameter?.find((p) => p.name === "result");
  if (!resultParam?.valueBoolean) {
    return null;
  }

  const matchParam = response.parameter?.find((p) => p.name === "match");
  if (!matchParam?.part) {
    return null;
  }

  const conceptPart = matchParam.part.find((p) => p.name === "concept");
  if (!conceptPart?.valueCoding?.code) {
    return null;
  }

  return {
    code: conceptPart.valueCoding.code,
    display: conceptPart.valueCoding.display,
    system: "http://loinc.org",
  };
}

/**
 * Translate a local code to LOINC using Aidbox $translate operation.
 *
 * @param conceptMapId - The ConceptMap resource ID
 * @param localCode - The local code to translate
 * @param localSystem - The local coding system URI
 * @returns Discriminated result: "found" with coding, "no_mapping", or "not_found"
 */
export async function translateCode(
  conceptMapId: string,
  localCode: string,
  localSystem: string | undefined,
): Promise<TranslateResult> {
  const requestBody = {
    resourceType: "Parameters",
    parameter: [
      { name: "code", valueCode: localCode },
      ...(localSystem ? [{ name: "system", valueUri: localSystem }] : []),
    ],
  };

  let response: TranslateResponse;
  try {
    response = await aidboxFetch<TranslateResponse>(
      `/fhir/ConceptMap/${conceptMapId}/$translate`,
      {
        method: "POST",
        body: JSON.stringify(requestBody),
      },
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return { status: "not_found" };
    }
    throw error;
  }

  const coding = extractCodingFromTranslateResponse(response);
  if (!coding) {
    return { status: "no_mapping" };
  }

  return { status: "found", coding };
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

  const conceptMapId = generateConceptMapId(sender);
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

/**
 * Format sender context as title string (format: "APP | FACILITY")
 * Used for ConceptMap.title field
 */
export function formatSenderAsTitle(sender: SenderContext): string {
  return `${sender.sendingApplication} | ${sender.sendingFacility}`;
}

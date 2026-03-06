import type { CE, CWE, PID } from "../../hl7v2/generated/fields";
import type { Extension, Coding } from "../../fhir/hl7-fhir-r4-core";

export const US_CORE_RACE_URL = "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race";
export const US_CORE_ETHNICITY_URL = "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity";
export const OMB_RACE_ETHNICITY_SYSTEM = "urn:oid:2.16.840.1.113883.6.238";

type DemographicRepeat = CE | CWE;

const US_CORE_RACE_OMB_MAP: Record<string, Coding> = {
  "1002-5": {
    code: "1002-5",
    display: "American Indian or Alaska Native",
    system: OMB_RACE_ETHNICITY_SYSTEM,
  },
  "2028-9": {
    code: "2028-9",
    display: "Asian",
    system: OMB_RACE_ETHNICITY_SYSTEM,
  },
  "2054-5": {
    code: "2054-5",
    display: "Black or African American",
    system: OMB_RACE_ETHNICITY_SYSTEM,
  },
  "2076-8": {
    code: "2076-8",
    display: "Native Hawaiian or Other Pacific Islander",
    system: OMB_RACE_ETHNICITY_SYSTEM,
  },
  "2106-3": {
    code: "2106-3",
    display: "White",
    system: OMB_RACE_ETHNICITY_SYSTEM,
  },
  "2131-1": {
    code: "2131-1",
    display: "Other Race",
    system: OMB_RACE_ETHNICITY_SYSTEM,
  },
};

const US_CORE_ETHNICITY_OMB_MAP: Record<string, Coding> = {
  H: {
    code: "2135-2",
    display: "Hispanic or Latino",
    system: OMB_RACE_ETHNICITY_SYSTEM,
  },
  N: {
    code: "2186-5",
    display: "Not Hispanic or Latino",
    system: OMB_RACE_ETHNICITY_SYSTEM,
  },
};

export function buildUsCorePatientExtensionsFromPid(pid: PID): Extension[] {
  const extensions: Extension[] = [];

  const raceExtension = buildUsCoreRaceExtension(pid.$10_race);
  if (raceExtension) {
    extensions.push(raceExtension);
  }

  const ethnicityExtension = buildUsCoreEthnicityExtension(pid.$22_ethnicity);
  if (ethnicityExtension) {
    extensions.push(ethnicityExtension);
  }

  return extensions;
}

export function buildUsCoreRaceExtension(
  raceRepeats: Array<CWE | CE> | undefined,
): Extension | undefined {
  if (!raceRepeats || raceRepeats.length === 0) {
    return undefined;
  }

  const codings = extractUniqueCodings(raceRepeats);
  const ombCategories = getRaceOmbCategories(codings);
  const detailedCodings = codings.filter(
    (coding) => isCdcRaceEthnicityCoding(coding) && !isRaceOmbCategoryCode(coding.code),
  );
  const text = summarizeDemographicText(raceRepeats);

  if (ombCategories.length === 0 && detailedCodings.length === 0 && !text) {
    return undefined;
  }

  const nestedExtensions: Extension[] = [];
  for (const category of ombCategories) {
    nestedExtensions.push({
      url: "ombCategory",
      valueCoding: category,
    });
  }

  for (const coding of detailedCodings) {
    nestedExtensions.push({
      url: "detailed",
      valueCoding: coding,
    });
  }

  if (text) {
    nestedExtensions.push({
      url: "text",
      valueString: text,
    });
  }

  return {
    url: US_CORE_RACE_URL,
    extension: nestedExtensions,
  };
}

export function buildUsCoreEthnicityExtension(
  ethnicityRepeats: Array<CWE | CE> | undefined,
): Extension | undefined {
  if (!ethnicityRepeats || ethnicityRepeats.length === 0) {
    return undefined;
  }

  const codings = extractUniqueCodings(ethnicityRepeats);

  let ombCategory: Coding | undefined;
  for (const repeat of ethnicityRepeats) {
    ombCategory = mapPid22ToOmbCategory(repeat.$1_code);
    if (ombCategory) {
      break;
    }

    ombCategory = mapPid22ToOmbCategory(repeat.$4_altCode);
    if (ombCategory) {
      break;
    }
  }

  const detailedCodings = codings.filter(
    (coding) =>
      isCdcRaceEthnicityCoding(coding) &&
      !isEthnicityOmbCategoryCode(coding.code),
  );
  const text = summarizeDemographicText(ethnicityRepeats);

  if (!ombCategory && detailedCodings.length === 0 && !text) {
    return undefined;
  }

  const nestedExtensions: Extension[] = [];
  if (ombCategory) {
    nestedExtensions.push({
      url: "ombCategory",
      valueCoding: ombCategory,
    });
  }

  for (const coding of detailedCodings) {
    nestedExtensions.push({
      url: "detailed",
      valueCoding: coding,
    });
  }

  if (text) {
    nestedExtensions.push({
      url: "text",
      valueString: text,
    });
  }

  return {
    url: US_CORE_ETHNICITY_URL,
    extension: nestedExtensions,
  };
}

export function mapPid22ToOmbCategory(code: string | undefined): Coding | undefined {
  const normalizedCode = normalizeString(code)?.toUpperCase();
  if (!normalizedCode) {
    return undefined;
  }

  return US_CORE_ETHNICITY_OMB_MAP[normalizedCode];
}

export function summarizeDemographicText(
  repeats: Array<CWE | CE>,
): string | undefined {
  const values: string[] = [];

  for (const repeat of repeats) {
    if ("$9_originalText" in repeat) {
      addUniqueValue(values, repeat.$9_originalText);
    }
    addUniqueValue(values, repeat.$2_text);
    addUniqueValue(values, repeat.$5_altDisplay);
    addUniqueValue(values, repeat.$1_code);
    addUniqueValue(values, repeat.$4_altCode);
  }

  if (values.length === 0) {
    return undefined;
  }

  return values.join(", ");
}

function extractUniqueCodings(repeats: DemographicRepeat[]): Coding[] {
  const codings: Coding[] = [];
  const seenKeys = new Set<string>();

  for (const repeat of repeats) {
    addCodingIfPresent(codings, seenKeys, repeat.$1_code, repeat.$2_text, repeat.$3_system);
    addCodingIfPresent(codings, seenKeys, repeat.$4_altCode, repeat.$5_altDisplay, repeat.$6_altSystem);
  }

  return codings;
}

function addCodingIfPresent(
  codings: Coding[],
  seenKeys: Set<string>,
  code: string | undefined,
  display: string | undefined,
  system: string | undefined,
): void {
  const coding = buildCoding(code, display, system);
  if (!coding) {
    return;
  }

  const key = `${coding.system ?? ""}|${coding.code ?? ""}|${coding.display ?? ""}`;
  if (seenKeys.has(key)) {
    return;
  }

  seenKeys.add(key);
  codings.push(coding);
}

function buildCoding(
  code: string | undefined,
  display: string | undefined,
  system: string | undefined,
): Coding | undefined {
  const normalizedCode = normalizeString(code);
  const normalizedDisplay = normalizeString(display);
  const normalizedSystem = normalizeCodingSystem(system);
  const resolvedDisplay = resolveDisplay(normalizedCode, normalizedDisplay, normalizedSystem);

  if (!normalizedCode && !normalizedDisplay) {
    return undefined;
  }

  return {
    ...(normalizedCode && { code: normalizedCode }),
    ...(resolvedDisplay && { display: resolvedDisplay }),
    ...(normalizedSystem && { system: normalizedSystem }),
  };
}

function resolveDisplay(
  code: string | undefined,
  display: string | undefined,
  system: string | undefined,
): string | undefined {
  if (system !== OMB_RACE_ETHNICITY_SYSTEM) {
    return display;
  }

  if (!code) {
    return undefined;
  }

  const knownOmbDisplay = US_CORE_RACE_OMB_MAP[code]?.display ?? getEthnicityOmbDisplay(code);
  if (knownOmbDisplay) {
    return knownOmbDisplay;
  }

  return undefined;
}

function normalizeCodingSystem(system: string | undefined): string | undefined {
  const normalizedSystem = normalizeString(system);
  if (!normalizedSystem) {
    return undefined;
  }

  const upper = normalizedSystem.toUpperCase();
  if (
    upper === "CDCREC" ||
    upper === "2.16.840.1.113883.6.238" ||
    upper === "URN:OID:2.16.840.1.113883.6.238"
  ) {
    return OMB_RACE_ETHNICITY_SYSTEM;
  }

  return normalizedSystem;
}

function addUniqueValue(values: string[], value: string | undefined): void {
  const normalized = normalizeString(value);
  if (!normalized) {
    return;
  }

  if (!values.includes(normalized)) {
    values.push(normalized);
  }
}

function getRaceOmbCategories(codings: Coding[]): Coding[] {
  const categories: Coding[] = [];
  const seenCodes = new Set<string>();

  for (const coding of codings) {
    if (!isRaceOmbCategoryCode(coding.code)) {
      continue;
    }

    const code = coding.code!;
    if (seenCodes.has(code)) {
      continue;
    }

    seenCodes.add(code);
    categories.push(US_CORE_RACE_OMB_MAP[code]!);
  }

  return categories;
}

function isRaceOmbCategoryCode(code: string | undefined): boolean {
  if (!code) {
    return false;
  }

  return Boolean(US_CORE_RACE_OMB_MAP[code]);
}

function isEthnicityOmbCategoryCode(code: string | undefined): boolean {
  return code === "2135-2" || code === "2186-5";
}

function getEthnicityOmbDisplay(code: string): string | undefined {
  for (const ombCoding of Object.values(US_CORE_ETHNICITY_OMB_MAP)) {
    if (ombCoding.code === code) {
      return ombCoding.display;
    }
  }

  return undefined;
}

function isCdcRaceEthnicityCoding(coding: Coding): boolean {
  return coding.system === OMB_RACE_ETHNICITY_SYSTEM && Boolean(coding.code);
}

function normalizeString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed;
}

/**
 * Terminology API - LOINC search and validation via local Aidbox instance
 */

import { aidboxFetch } from "../aidbox";

export interface LoincSearchResult {
  code: string;
  display: string;
  component?: string;
  property?: string;
  timing?: string;
  scale?: string;
}

interface ValueSetExpansionContains {
  code: string;
  display: string;
  designation?: Array<{
    use?: { code: string };
    value: string;
  }>;
}

interface ValueSetExpansion {
  expansion: {
    contains?: ValueSetExpansionContains[];
  };
}

interface CodeSystemLookupResult {
  parameter?: Array<{
    name: string;
    valueString?: string;
    valueCode?: string;
  }>;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

function isRetryableError(error: Error): boolean {
  const message = error.message;
  return message.includes("5") && message.includes("HTTP");
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (!isRetryableError(lastError)) {
        throw lastError;
      }

      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw lastError;
}

function extractDesignation(
  designations: ValueSetExpansionContains["designation"],
  useCode: string
): string | undefined {
  return designations?.find((d) => d.use?.code === useCode)?.value;
}

export async function searchLoincCodes(
  query: string
): Promise<LoincSearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const path = `/fhir/ValueSet/$expand?url=http://loinc.org/vs&filter=${encodedQuery}&count=10`;

  const response = await withRetry(() =>
    aidboxFetch<ValueSetExpansion>(path)
  );

  const contains = response.expansion?.contains || [];

  return contains.map((item) => ({
    code: item.code,
    display: item.display,
    component: extractDesignation(item.designation, "COMPONENT"),
    property: extractDesignation(item.designation, "PROPERTY"),
    timing: extractDesignation(item.designation, "TIME_ASPCT"),
    scale: extractDesignation(item.designation, "SCALE_TYP"),
  }));
}

export interface LoincValidationResult {
  code: string;
  display: string;
}

export async function validateLoincCode(
  code: string
): Promise<LoincValidationResult | null> {
  const path = `/fhir/CodeSystem/$lookup?system=http://loinc.org&code=${encodeURIComponent(code)}`;

  try {
    const response = await withRetry(() =>
      aidboxFetch<CodeSystemLookupResult>(path)
    );

    const displayParam = response.parameter?.find((p) => p.name === "display");

    if (!displayParam?.valueString) {
      return null;
    }

    return {
      code,
      display: displayParam.valueString,
    };
  } catch (error) {
    if ((error as Error).message.includes("404")) {
      return null;
    }
    throw error;
  }
}

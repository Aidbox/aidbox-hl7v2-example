import { readFileSync } from "fs";
import { join } from "path";

/**
 * Configuration for message-type-specific preprocessing and conversion behavior.
 * Config is keyed by exact message type strings (e.g., "ORU-R01", "ADT-A01").
 */

export type MessageTypeConfig = {
  preprocess?: {
    PV1?: {
      "19"?: {
        authorityFallback?: { source?: "msh" };
      };
    };
  };
  converter?: {
    PV1?: { required?: boolean };
  };
};

export type Hl7v2ToFhirConfig = {
  "ORU-R01"?: MessageTypeConfig;
  "ADT-A01"?: MessageTypeConfig;
};

const CONFIG_PATH = join(process.cwd(), "config", "hl7v2-to-fhir.json");

let cachedConfig: Hl7v2ToFhirConfig | null = null;

/**
 * Returns the HL7v2-to-FHIR configuration (lazy singleton).
 * Config is loaded once at first call and cached for process lifetime.
 *
 * @throws Error if config file is missing or malformed
 */
export function hl7v2ToFhirConfig(): Hl7v2ToFhirConfig {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  let fileContent: string;
  try {
    fileContent = readFileSync(CONFIG_PATH, "utf-8");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error reading file";
    throw new Error(
      `Failed to load HL7v2-to-FHIR config from ${CONFIG_PATH}: ${message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown parse error";
    throw new Error(
      `Failed to parse HL7v2-to-FHIR config as JSON: ${message}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `Invalid HL7v2-to-FHIR config: expected object, got ${Array.isArray(parsed) ? "array" : typeof parsed}`,
    );
  }

  cachedConfig = parsed as Hl7v2ToFhirConfig;
  return cachedConfig;
}

/**
 * Clears the cached config. Used for testing.
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

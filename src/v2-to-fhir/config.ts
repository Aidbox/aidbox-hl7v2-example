import { readFileSync } from "fs";
import { join } from "path";
import {
  SEGMENT_PREPROCESSORS,
  type SegmentPreprocessorId,
} from "./preprocessor-registry";
import type { IdentifierPriorityRule } from "./identity-system/patient-id";

export type MessageTypeConfig = {
  preprocess?: {
    PV1?: {
      "19"?: SegmentPreprocessorId[];
    };
    PID?: {
      "2"?: SegmentPreprocessorId[];
      "3"?: SegmentPreprocessorId[];
    };
    ORC?: {
      "3"?: SegmentPreprocessorId[];
    };
    RXA?: {
      "6"?: SegmentPreprocessorId[];
      "9"?: SegmentPreprocessorId[];
    };
  };
  converter?: {
    PV1?: { required?: boolean };
  };
};

export type Hl7v2ToFhirConfig = {
  identitySystem?: {
    patient?: { rules: IdentifierPriorityRule[] };
  };
  // DESIGN PROTOTYPE: 2026-02-24-profiles-support.md
  // Add profile/IG conformance configuration for post-conversion validation.
  // profileConformance?: ProfileConformanceConfig;
  messages?: Record<string, MessageTypeConfig | undefined>;
};

const DEFAULT_CONFIG_PATH = join(process.cwd(), "config", "hl7v2-to-fhir.json");

function getConfigPath(): string {
  return process.env.HL7V2_TO_FHIR_CONFIG ?? DEFAULT_CONFIG_PATH;
}

let cachedConfig: Hl7v2ToFhirConfig | null = null;

/**
 * Returns the HL7v2-to-FHIR configuration (lazy singleton).
 * Config is loaded once at first call and cached for process lifetime.
 * Validates all preprocessor IDs at load time (fail fast).
 *
 * @throws Error if config file is missing, malformed, or contains unknown preprocessor IDs
 */
export function hl7v2ToFhirConfig(): Hl7v2ToFhirConfig {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  let fileContent: string;
  try {
    fileContent = readFileSync(getConfigPath(), "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error reading file";
    throw new Error(
      `Failed to load HL7v2-to-FHIR config from ${getConfigPath()}: ${message}`,
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

  const config = parsed as Hl7v2ToFhirConfig;

  validateIdentitySystemRules(config);
  validatePreprocessorIds(config);

  cachedConfig = config;
  return cachedConfig;
}

/**
 * Validates identitySystem.patient.rules at startup.
 * @throws Error if rules array is missing, empty, or contains invalid rules
 */
function validateIdentitySystemRules(config: Hl7v2ToFhirConfig): void {
  const rules = config.identitySystem?.patient?.rules;

  if (!Array.isArray(rules)) {
    throw new Error(
      `Invalid HL7v2-to-FHIR config: "identitySystem.patient.rules" must be an array. ` +
        `Got: ${typeof rules}. ` +
        `Add an "identitySystem": { "patient": { "rules": [...] } } section to the config file.`,
    );
  }

  if (rules.length === 0) {
    throw new Error(
      `Invalid HL7v2-to-FHIR config: "identitySystem.patient.rules" must not be empty. ` +
        `Add at least one MatchRule or MpiLookupRule.`,
    );
  }

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]!;
    if ("mpiLookup" in rule) {
      // MpiLookupRule — MPI-specific validation deferred to MPI implementation ticket.
    } else {
      if (!rule.assigner && !rule.type && !rule.any) {
        throw new Error(
          `Invalid identitySystem.patient.rules[${i}]: MatchRule must specify at least one of: ` +
            `"assigner", "type", or "any".`,
        );
      }
    }
  }
}

/**
 * Validates that all preprocessor IDs in the config are registered.
 * @throws Error if any unknown preprocessor ID is found
 */
function validatePreprocessorIds(config: Hl7v2ToFhirConfig): void {
  const registeredIds = Object.keys(SEGMENT_PREPROCESSORS);
  const messages = config.messages ?? {};

  for (const [messageType, messageConfig] of Object.entries(messages)) {
    if (!messageConfig?.preprocess) continue;

    for (const [segment, segmentConfig] of Object.entries(
      messageConfig.preprocess,
    )) {
      if (!segmentConfig) continue;

      for (const [field, preprocessorIds] of Object.entries(segmentConfig)) {
        // Skip null/undefined values (optional fields)
        if (preprocessorIds === null || preprocessorIds === undefined) continue;

        // Non-array values are invalid config
        if (!Array.isArray(preprocessorIds)) {
          throw new Error(
            `Invalid preprocessor config for ${messageType}.preprocess.${segment}.${field}: ` +
              `expected array of preprocessor IDs, got ${typeof preprocessorIds}`,
          );
        }

        for (const id of preprocessorIds) {
          if (!registeredIds.includes(id)) {
            throw new Error(
              `Unknown preprocessor ID "${id}" in config for ${messageType}.preprocess.${segment}.${field}. ` +
                `Valid IDs: ${registeredIds.join(", ")}`,
            );
          }
        }
      }
    }
  }
}

/**
 * Clears the cached config. Used for testing.
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

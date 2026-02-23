// ═══════════════════════════════════════════════════════════════════════════
// DESIGN PROTOTYPE: 2026-02-23-converter-context-refactor.md
// Do not use until implementation complete
// ═══════════════════════════════════════════════════════════════════════════
//
// ConverterContext: single object carrying all runtime dependencies that
// converters (convertADT_A01, convertADT_A08, convertORU_R01) require.
//
// Goals:
//   - Uniform converter signature: (parsed: HL7v2Message, context: ConverterContext)
//   - Config injected explicitly (converters no longer call hl7v2ToFhirConfig())
//   - PatientLookupFn / EncounterLookupFn centralised here (moved from oru-r01.ts)
//   - One factory function wires up production defaults
//
// ═══════════════════════════════════════════════════════════════════════════

import type { Patient, Encounter } from "../fhir/hl7-fhir-r4-core";
import type { PatientIdResolver } from "./identity-system/patient-id";
import { defaultPatientIdResolver } from "./identity-system/patient-id";
import type { Hl7v2ToFhirConfig } from "./config";
import { hl7v2ToFhirConfig } from "./config";
// NOTE: defaultPatientLookup / defaultEncounterLookup remain in oru-r01.ts
// because they are Aidbox-specific network calls that live naturally alongside
// the ORU converter. They are imported here only to wire up production defaults.
// If this import feels uncomfortable (bidirectional coupling), extract them to
// src/v2-to-fhir/aidbox-lookups.ts in a follow-up.
import {
  defaultPatientLookup,
  defaultEncounterLookup,
} from "./messages/oru-r01";

// ============================================================================
// Lookup function types (moved from oru-r01.ts)
// ============================================================================

/**
 * Function type for looking up a Patient by ID.
 * Returns the Patient if found, or null if not found.
 *
 * DESIGN PROTOTYPE: 2026-02-23-converter-context-refactor.md
 * Moved from src/v2-to-fhir/messages/oru-r01.ts — was oru-r01-specific, now
 * part of the shared context contract.
 */
export type PatientLookupFn = (patientId: string) => Promise<Patient | null>;

/**
 * Function type for looking up an Encounter by ID.
 * Returns the Encounter if found, or null if not found.
 *
 * DESIGN PROTOTYPE: 2026-02-23-converter-context-refactor.md
 * Moved from src/v2-to-fhir/messages/oru-r01.ts — was oru-r01-specific, now
 * part of the shared context contract.
 */
export type EncounterLookupFn = (encounterId: string) => Promise<Encounter | null>;

// ============================================================================
// ConverterContext interface
// ============================================================================

/**
 * All runtime dependencies required by message converters.
 *
 * Converters receive `(parsed: HL7v2Message, context: ConverterContext)`.
 * Each converter destructures only the fields it needs; unused fields
 * (e.g., lookupPatient in ADT converters) are simply ignored.
 *
 * Construct via createConverterContext() for production use, or build
 * an object literal / use makeTestContext() in tests.
 */
export interface ConverterContext {
  /**
   * Loaded HL7v2-to-FHIR config.
   * Injected explicitly so converters are not coupled to the global singleton
   * and tests can supply alternative configs without env-var overrides.
   */
  config: Hl7v2ToFhirConfig;

  /**
   * Resolves Patient.id from a pool of PID-3 CX identifiers.
   * Uses the identity system rules defined in config.identitySystem.patient.rules.
   */
  resolvePatientId: PatientIdResolver;

  /**
   * Look up an existing Patient by ID in the FHIR server.
   * Returns null when not found; throws on unexpected errors.
   * Used by ORU_R01 to avoid creating duplicate draft patients.
   */
  lookupPatient: PatientLookupFn;

  /**
   * Look up an existing Encounter by ID in the FHIR server.
   * Returns null when not found; throws on unexpected errors.
   * Used by ORU_R01 to avoid creating duplicate draft encounters.
   */
  lookupEncounter: EncounterLookupFn;
}

// ============================================================================
// Factory function
// ============================================================================

/**
 * Construct a ConverterContext wired with production defaults:
 *   - config:            loaded via hl7v2ToFhirConfig() (cached singleton)
 *   - resolvePatientId:  built from config + StubMpiClient
 *   - lookupPatient:     queries Aidbox (defaultPatientLookup)
 *   - lookupEncounter:   queries Aidbox (defaultEncounterLookup)
 *
 * Called once per message in converter.ts. Converters themselves never
 * construct context.
 */
export function createConverterContext(): ConverterContext {
  return {
    config: hl7v2ToFhirConfig(),
    resolvePatientId: defaultPatientIdResolver(),
    lookupPatient: defaultPatientLookup,
    lookupEncounter: defaultEncounterLookup,
  };
}

// ═══════════════════════════════════════════════════════════════════════════

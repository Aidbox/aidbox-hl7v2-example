import type { PatientIdResolver } from "./identity-system/patient-id";
import { defaultPatientIdResolver } from "./identity-system/patient-id";
import type { Hl7v2ToFhirConfig } from "./config";
import { hl7v2ToFhirConfig } from "./config";
import {
  type PatientLookupFn,
  type EncounterLookupFn,
  defaultPatientLookup,
  defaultEncounterLookup,
} from "./aidbox-lookups";

export interface ConverterContext {
  config: Hl7v2ToFhirConfig;
  // DESIGN PROTOTYPE: 2026-02-25-us-core-patient-extensions.md
  // Derived once from config.profileConformance.implementationGuides.
  // usCorePatientExtensionsEnabled: boolean;
  resolvePatientId: PatientIdResolver;
  lookupPatient: PatientLookupFn;
  lookupEncounter: EncounterLookupFn;
}

export function createConverterContext(): ConverterContext {
  const config = hl7v2ToFhirConfig();
  return {
    config,
    // DESIGN PROTOTYPE: 2026-02-25-us-core-patient-extensions.md
    // usCorePatientExtensionsEnabled: isUsCoreConfigured(config),
    resolvePatientId: defaultPatientIdResolver(config),
    lookupPatient: defaultPatientLookup,
    lookupEncounter: defaultEncounterLookup,
  };
}

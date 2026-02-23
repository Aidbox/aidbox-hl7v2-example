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
  resolvePatientId: PatientIdResolver;
  lookupPatient: PatientLookupFn;
  lookupEncounter: EncounterLookupFn;
}

export function createConverterContext(): ConverterContext {
  return {
    config: hl7v2ToFhirConfig(),
    resolvePatientId: defaultPatientIdResolver(),
    lookupPatient: defaultPatientLookup,
    lookupEncounter: defaultEncounterLookup,
  };
}

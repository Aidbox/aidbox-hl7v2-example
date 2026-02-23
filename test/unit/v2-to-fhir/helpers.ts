import type { ConverterContext } from "../../../src/v2-to-fhir/converter-context";
import { defaultPatientIdResolver } from "../../../src/v2-to-fhir/identity-system/patient-id";
import { hl7v2ToFhirConfig } from "../../../src/v2-to-fhir/config";

export function makeTestContext(overrides?: Partial<ConverterContext>): ConverterContext {
  const config = overrides?.config ?? hl7v2ToFhirConfig();
  return {
    config,
    resolvePatientId: defaultPatientIdResolver(config),
    lookupPatient: async () => null,
    lookupEncounter: async () => null,
    ...overrides,
  };
}

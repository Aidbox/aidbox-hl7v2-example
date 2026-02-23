import type { Patient, Encounter } from "../fhir/hl7-fhir-r4-core";
import { getResourceWithETag, NotFoundError } from "../aidbox";

export type PatientLookupFn = (patientId: string) => Promise<Patient | null>;

export type EncounterLookupFn = (encounterId: string) => Promise<Encounter | null>;

export async function defaultPatientLookup(
  patientId: string,
): Promise<Patient | null> {
  try {
    const { resource } = await getResourceWithETag<Patient>("Patient", patientId);
    return resource;
  } catch (error) {
    if (error instanceof NotFoundError) {
      return null;
    }
    throw error;
  }
}

export async function defaultEncounterLookup(
  encounterId: string,
): Promise<Encounter | null> {
  try {
    const { resource } = await getResourceWithETag<Encounter>("Encounter", encounterId);
    return resource;
  } catch (error) {
    if (error instanceof NotFoundError) {
      return null;
    }
    throw error;
  }
}

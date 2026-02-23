// ═══════════════════════════════════════════════════════════════════════════
// DESIGN PROTOTYPE: 2026-02-23-converter-context-refactor.md
// Do not use until implementation complete
// ═══════════════════════════════════════════════════════════════════════════
//
// aidbox-lookups.ts: Aidbox-backed FHIR lookup functions.
//
// Purpose: Break the circular import that would exist between
//   converter-context.ts → oru-r01.ts → converter-context.ts
// by moving defaultPatientLookup and defaultEncounterLookup here.
//
// Dependency graph (no cycles):
//
//   aidbox-lookups.ts   → aidbox.ts, fhir/  (no import from converter-context.ts)
//   converter-context.ts → aidbox-lookups.ts (imports the implementations)
//   oru-r01.ts           → converter-context.ts (imports types only)
//
// The lookup function implementations use inline types rather than importing
// PatientLookupFn / EncounterLookupFn from converter-context.ts — that would
// recreate the cycle. TypeScript structural typing ensures compatibility.
//
// ═══════════════════════════════════════════════════════════════════════════

import type { Patient, Encounter } from "../fhir/hl7-fhir-r4-core";
import { getResourceWithETag, NotFoundError } from "../aidbox";

/**
 * Default patient lookup function using Aidbox.
 * Returns null on 404 (not found), throws on other errors.
 *
 * DESIGN PROTOTYPE: 2026-02-23-converter-context-refactor.md
 * Moved from src/v2-to-fhir/messages/oru-r01.ts to break the
 * converter-context.ts ↔ oru-r01.ts circular import.
 * Structurally satisfies PatientLookupFn from converter-context.ts.
 */
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

/**
 * Default encounter lookup function using Aidbox.
 * Returns null on 404 (not found), throws on other errors.
 *
 * DESIGN PROTOTYPE: 2026-02-23-converter-context-refactor.md
 * Moved from src/v2-to-fhir/messages/oru-r01.ts to break the
 * converter-context.ts ↔ oru-r01.ts circular import.
 * Structurally satisfies EncounterLookupFn from converter-context.ts.
 */
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

// ═══════════════════════════════════════════════════════════════════════════

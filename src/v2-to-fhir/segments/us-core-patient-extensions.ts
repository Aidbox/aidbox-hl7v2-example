// ============================================================================
// DESIGN PROTOTYPE: 2026-02-25-us-core-patient-extensions.md
// Do not use until implementation complete
// ============================================================================
//
// This file will contain:
//
// import type { PID, CE, CWE } from "../../hl7v2/generated/fields";
// import type { Extension, Coding } from "../../fhir/hl7-fhir-r4-core";
//
// export const US_CORE_RACE_URL =
//   "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race";
//
// export const US_CORE_ETHNICITY_URL =
//   "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity";
//
// export const OMB_RACE_ETHNICITY_SYSTEM = "urn:oid:2.16.840.1.113883.6.238";
//
// export function buildUsCorePatientExtensionsFromPid(pid: PID): Extension[]
//
// export function buildUsCoreRaceExtension(
//   raceRepeats: Array<CWE | CE> | undefined,
// ): Extension | undefined
//
// export function buildUsCoreEthnicityExtension(
//   ethnicityRepeats: Array<CWE | CE> | undefined,
// ): Extension | undefined
//
// export function mapPid22ToOmbCategory(code: string | undefined): Coding | undefined
//   // H -> 2135-2, N -> 2186-5, U -> undefined
//
// export function summarizeDemographicText(
//   repeats: Array<CWE | CE>,
//   fallbackLabel: string,
// ): string
//
// ============================================================================

/**
 * DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity.md
 *
 * MPI (Master Patient Index) client interface and stub implementation.
 *
 * This module defines the contract for querying an external MPI to cross-reference
 * patient identifiers across EHR systems. Used by the selectPatientId() priority-list
 * algorithm in id-generation.ts when an MpiLookupRule is configured.
 *
 * Current status: STUB ONLY — StubMpiClient always returns { status: 'not-found' }.
 * Replace with a real implementation when MPI integration is prioritized.
 *
 * Supported strategies (when implemented):
 *   - 'pix': IHE PIXm (ITI-83) — identifier cross-referencing via GET $ihe-pix
 *   - 'match': IHE PDQm (ITI-119) — demographic matching via POST $match
 *
 * Design decisions:
 *   - MpiResult is a discriminated union; 'unavailable' is NOT an exception.
 *     The caller (selectPatientId) treats 'unavailable' as a hard error — message
 *     processing stops and the message is retried when MPI recovers.
 *   - 'not-found' is a normal outcome (patient not yet in MPI); caller falls through
 *     to the next priority rule.
 *   - Injectable via parameter — enables unit testing without network calls.
 */

// =============================================================================
// Result type
// =============================================================================

/**
 * Discriminated union result from an MPI query.
 *
 * 'found'       — MPI returned a matching identifier for the target system.
 * 'not-found'   — MPI has no record for this patient in the target system.
 *                 Caller should fall through to the next identifier priority rule.
 * 'unavailable' — MPI could not be reached (network error, timeout, etc.).
 *                 Caller MUST treat this as a hard error (not fallthrough).
 */
export type MpiResult =
  | { status: "found"; identifier: { value: string } }
  | { status: "not-found" }
  | { status: "unavailable"; error: string };

// =============================================================================
// Patient demographics (for 'match' strategy)
// =============================================================================

/**
 * Patient demographic data extracted from PID segment for IHE PDQm matching.
 * Used only with strategy='match'.
 */
export type PatientDemographics = {
  familyName?: string;
  givenName?: string;
  birthDate?: string;    // ISO 8601: YYYY-MM-DD
  gender?: string;       // FHIR AdministrativeGender: male | female | other | unknown
};

// =============================================================================
// MpiClient interface
// =============================================================================

/**
 * Injectable interface for querying an external Master Patient Index.
 *
 * Implementations must NOT throw exceptions for MPI-level failures
 * (network errors, timeouts, HTTP 5xx). These must be returned as
 * { status: 'unavailable', error: string } so selectPatientId() can
 * distinguish infrastructure failures from "patient not found".
 *
 * Exceptions from implementations are permitted only for programming errors
 * (invalid arguments, etc.).
 */
export interface MpiClient {
  /**
   * IHE PIXm cross-reference (ITI-83).
   *
   * Queries the MPI to find the target-system identifier corresponding to
   * a known source identifier.
   *
   * HTTP: GET [base]/Patient/$ihe-pix?sourceIdentifier={source.system}|{source.value}
   *                                   &targetSystem={targetSystem}
   *
   * @param source       - The known identifier (system URI + value)
   * @param targetSystem - The FHIR system URI to look up (e.g., "urn:oid:2.16.840.1.113883.1.111")
   * @returns MpiResult — never throws for MPI-level failures
   */
  crossReference(
    source: { system: string; value: string },
    targetSystem: string,
  ): Promise<MpiResult>;

  /**
   * IHE PDQm demographic match (ITI-119).
   *
   * Queries the MPI using patient demographics. Probabilistic — result confidence
   * is checked against the configured matchThreshold.
   *
   * HTTP: POST [base]/Patient/$match with Patient resource built from demographics
   *
   * @param demographics - Patient demographics from PID segment
   * @param targetSystem - The FHIR system URI to look up the result identifier in
   * @returns MpiResult — never throws for MPI-level failures
   */
  match(
    demographics: PatientDemographics,
    targetSystem: string,
  ): Promise<MpiResult>;
}

// =============================================================================
// Stub implementation
// =============================================================================

/**
 * Stub MPI client that always returns { status: 'not-found' }.
 *
 * Use this when:
 *   - No MPI is configured for the deployment
 *   - MPI integration is not yet implemented
 *   - Unit testing selectPatientId() without network dependency
 *
 * When MPI integration is prioritized, replace this with a real client
 * (e.g., FhirMpiClient) that implements crossReference() and match()
 * via HTTP calls to the configured MPI endpoint.
 *
 * Note: Because StubMpiClient always returns 'not-found', any MpiLookupRule
 * in config.identifierPriority will always be skipped (not an error — 'not-found'
 * falls through to the next rule). This means adding an mpiLookup rule to config
 * with the stub client is safe — it degrades gracefully to the next match rule.
 */
export class StubMpiClient implements MpiClient {
  async crossReference(
    _source: { system: string; value: string },
    _targetSystem: string,
  ): Promise<MpiResult> {
    return { status: "not-found" };
  }

  async match(
    _demographics: PatientDemographics,
    _targetSystem: string,
  ): Promise<MpiResult> {
    return { status: "not-found" };
  }
}

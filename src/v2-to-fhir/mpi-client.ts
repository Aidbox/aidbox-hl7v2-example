/**
 * DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity.md
 *
 * MPI (Master Patient Index) client interface and stub implementation.
 * Current status: STUB ONLY — StubMpiClient always returns { status: 'not-found' }.
 */

export type MpiResult =
  | { status: "found"; identifier: { value: string } }
  | { status: "not-found" }
  | { status: "unavailable"; error: string };

export type PatientDemographics = {
  familyName?: string;
  givenName?: string;
  birthDate?: string;
  gender?: string;
};

/**
 * Injectable interface for querying an external Master Patient Index.
 * Returns MpiResult for all outcomes — never throws for MPI-level failures.
 */
export interface MpiClient {
  /**
   * IHE PIXm cross-reference (ITI-83).
   * @param source - The known identifier (system URI + value)
   * @param targetSystem - The FHIR system URI to look up
   * @returns MpiResult — never throws for MPI-level failures
   */
  crossReference(
    source: { system: string; value: string },
    targetSystem: string,
  ): Promise<MpiResult>;

  /**
   * IHE PDQm demographic match (ITI-119).
   * @param demographics - Patient demographics from PID segment
   * @param targetSystem - The FHIR system URI to look up the result identifier in
   * @returns MpiResult — never throws for MPI-level failures
   */
  match(
    demographics: PatientDemographics,
    targetSystem: string,
  ): Promise<MpiResult>;
}

/** Stub MPI client that always returns { status: 'not-found' }. */
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

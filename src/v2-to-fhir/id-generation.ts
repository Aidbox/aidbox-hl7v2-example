/**
 * HL7 v2.8.2 CX Datatype Authority Rules (from Section 2.A.14):
 *
 * At least one of CX.4, CX.9, or CX.10 must be populated:
 * - CX.4 (Assigning Authority) is required if neither CX.9 nor CX.10 are populated
 * - CX.9 (Assigning Jurisdiction) is required if neither CX.4 nor CX.10 are populated
 * - CX.10 (Assigning Agency/Department) is required if neither CX.4 nor CX.9 are populated
 *
 * All three may be valued. If values in CX.9 and/or CX.10 conflict with CX.4,
 * the Message Profile defines precedence. Without a profile, conflicts are errors.
 *
 * These components serve different semantic purposes:
 * - CX.4: Assigning Authority (HD type) - organization/system that assigned the ID
 * - CX.9: Assigning Jurisdiction (CWE type) - geo-political body
 * - CX.10: Assigning Agency/Department (CWE type) - organization unit
 *
 * Ref: https://www.hl7.eu/HL7v2x/v282/std282/ch02a.html#Heading158
 */

import type { CX, HD, CWE } from "../hl7v2/generated/fields";
import type { Encounter } from "../fhir/hl7-fhir-r4-core";

// =============================================================================
// DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity.md
//
// Patient ID priority-list algorithm for cross-EHR identity resolution.
// Replaces ad-hoc PID-2/PID-3[0] logic in adt-a01.ts and oru-r01.ts.
//
// Full spec: tasks/plans/2026-02-19-patient-encounter-identity.md
// MpiClient and StubMpiClient: src/v2-to-fhir/mpi-client.ts
// =============================================================================

// DESIGN PROTOTYPE: Import MpiClient from mpi-client.ts when implemented
// import type { MpiClient } from "./mpi-client";

/**
 * DESIGN PROTOTYPE: PatientIdResolver
 *
 * Opaque resolver function injected into converters via converter.ts.
 * Converters call resolvePatientId(pid.$3_identifier ?? []) without knowing
 * the algorithm, rule list, or MPI client.
 *
 * Created by converter.ts as a closure:
 *   const resolvePatientId: PatientIdResolver = (ids) =>
 *     selectPatientId(ids, config.identitySystem.patient.rules, mpiClient);
 *
 * Pattern matches PatientLookupFn / EncounterLookupFn already used in oru-r01.ts.
 */
// DESIGN PROTOTYPE:
// export type PatientIdResolver = (identifiers: CX[]) => Promise<PatientIdResult>;

/**
 * DESIGN PROTOTYPE: MatchRule
 *
 * Selects the first CX from the identifier pool where:
 *   - CX.4.1 (HD Namespace ID) matches `authority` exactly (if specified)
 *   - CX.5 matches `type` (if specified)
 * At least one of authority or type must be present (validated at config load time).
 *
 * Matching uses CX.4.1 only (not extractHDAuthority which prefers CX.4.2 Universal ID).
 * Config entries are human namespace strings ("UNIPAT", "ST01"), not OIDs.
 *
 * ID formation authority prefix: CX.4.1 if non-empty, else CX.4.2 if non-empty,
 * else the raw CX.4 string (e.g. "&&ISO" → "--iso" after sanitization).
 * This differs from extractHDAuthority used for Encounter.id (which prefers CX.4.2).
 */
// DESIGN PROTOTYPE:
// export type MatchRule = {
//   authority?: string; // match CX.4.1 (HD Namespace ID) exactly — human namespace string, not OID
//   type?: string;      // match CX.5 exactly
// };

/**
 * DESIGN PROTOTYPE: MpiLookupRule
 *
 * Queries an external MPI using a source identifier from the pool.
 * Participates in the same ordered fallback chain as MatchRule.
 *
 * Behavior:
 *   - No source identifier found in pool → skip to next rule
 *   - MPI returns found → use returned value as Patient.id
 *   - MPI returns not-found → skip to next rule
 *   - MPI unavailable → HARD ERROR, does NOT fall through
 */
// DESIGN PROTOTYPE:
// export type MpiLookupRule = {
//   mpiLookup: {
//     endpoint: {
//       baseUrl: string;
//       timeout?: number; // ms, default 5000
//     };
//     strategy: 'pix' | 'match';
//     source?: MatchRule[];    // For 'pix': which identifier to send to MPI
//     target: {
//       system: string;        // FHIR system URI for PIXm targetSystem param
//       authority: string;     // HL7v2 authority for the resulting Patient.id
//       type?: string;
//     };
//     matchThreshold?: number; // For 'match' strategy, default 0.95
//   };
// };

/**
 * DESIGN PROTOTYPE: IdentifierPriorityRule
 * Union of the two rule types. Config is an ordered array of these.
 */
// DESIGN PROTOTYPE:
// export type IdentifierPriorityRule = MatchRule | MpiLookupRule;

/**
 * DESIGN PROTOTYPE: PatientIdResult
 * Discriminated union result from selectPatientId.
 */
// DESIGN PROTOTYPE:
// export type PatientIdResult =
//   | { id: string }
//   | { error: string };

/**
 * DESIGN PROTOTYPE: selectPatientId
 *
 * Selects Patient.id from a pool of CX identifiers (PID-3 after preprocessing)
 * using an ordered list of IdentifierPriorityRule entries.
 *
 * Algorithm (executed top-to-bottom through rules):
 *   1. Filter out CX entries with empty CX.1 — they are never candidates.
 *   2. For each rule:
 *      a. MatchRule { authority?, type? }:
 *         - authority check: CX.4.1 === rule.authority (if set)
 *         - type check: CX.5 === rule.type (if set)
 *         - Both must pass when both are set.
 *         - On match — derive authority prefix for the ID:
 *             authorityPrefix = CX.4.1 if non-empty,
 *                               else CX.4.2 if non-empty,
 *                               else sanitize(raw CX.4 string) — handles "&&ISO" → "--iso"
 *             return { id: `${sanitize(authorityPrefix)}-${sanitize(cx1Value)}` }
 *         - No match: continue to next rule.
 *      b. MpiLookupRule { mpiLookup }:
 *         - Find source CX using mpiLookup.source match rules (same CX.4.1 matching)
 *         - No source: skip to next rule (fallthrough)
 *         - Query mpiClient.crossReference (pix) or mpiClient.match (match strategy)
 *         - status='found': return { id: `${sanitize(target.authority)}-${sanitize(result.value)}` }
 *         - status='not-found': skip to next rule (fallthrough)
 *         - status='unavailable': return { error: `MPI unavailable: ${result.error}` } (HARD ERROR)
 *   3. All rules exhausted without match: return { error: 'No identifier priority rule matched ...' }
 *
 * HD subcomponent semantics — deliberately different from extractHDAuthority:
 *   Matching uses CX.4.1 because config entries are namespace strings, not OIDs.
 *   ID formation uses CX.4.1 first for consistency with matching, falls back to CX.4.2
 *   then the raw CX.4 string to ensure a usable prefix even for bare `&&ISO` identifiers.
 *   Encounter.id formation uses extractHDAuthority (prefers CX.4.2) — unaffected.
 *
 * Sanitization: `s.toLowerCase().replace(/[^a-z0-9-]/g, "-")` — same as Encounter.id.
 *
 * @param identifiers - CX[] from PID-3 after preprocessing (merge-pid2-into-pid3 has already run)
 * @param rules       - ordered IdentifierPriorityRule[] from config.identitySystem.patient.rules
 * @param mpiClient   - injectable MpiClient; pass StubMpiClient when no MPI is configured
 */
// DESIGN PROTOTYPE:
// export async function selectPatientId(
//   identifiers: CX[],
//   rules: IdentifierPriorityRule[],
//   mpiClient: MpiClient,
// ): Promise<PatientIdResult> {
//   throw new Error('Not implemented — see 2026-02-19-patient-encounter-identity.md');
// }

// END DESIGN PROTOTYPE
// =============================================================================

export type EncounterIdentifierResult = {
  identifier?: Encounter["identifier"];
  error?: string;
};

/**
 * Builds an Encounter identifier from PV1-19 (Visit Number).
 * Enforces HL7 v2.8.2 CX authority requirements.
 */
export function buildEncounterIdentifier(
  visitNumber: CX | undefined,
): EncounterIdentifierResult {
  if (!visitNumber) {
    return {
      error: "PV1-19 (Visit Number) is required but missing",
    };
  }

  const value = visitNumber.$1_value?.trim();
  if (!value) {
    return {
      error: "PV1-19 (Visit Number) value is required but missing",
    };
  }

  // Extract authority from CX.4, CX.9, CX.10
  const cx4Authority = extractHDAuthority(visitNumber.$4_system);
  const cx9Authority = extractCWEAuthority(visitNumber.$9_jurisdiction);
  const cx10Authority = extractCWEAuthority(visitNumber.$10_department);

  const authorities = [cx4Authority, cx9Authority, cx10Authority].filter(
    (a): a is string => a !== null,
  );

  if (authorities.length === 0) {
    return {
      error:
        "PV1-19 authority is required: CX.4, CX.9, or CX.10 must be populated (HL7 v2.8.2)",
    };
  }

  // Check for conflicts
  const uniqueAuthorities = [...new Set(authorities)];
  if (uniqueAuthorities.length > 1) {
    return {
      error:
        "PV1-19 has conflicting authority values in CX.4/9/10; Message Profile required to resolve precedence",
    };
  }

  const system = uniqueAuthorities[0];

  return {
    identifier: [
      {
        system,
        value,
        type: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0203",
              code: "VN",
              display: "Visit Number",
            },
          ],
        },
      },
    ],
  };
}

/**
 * Extracts authority string from HD (Hierarchic Designator) type.
 * Returns null if empty/whitespace.
 */
function extractHDAuthority(hd: HD | undefined): string | null {
  if (!hd) return null;

  // Prefer Universal ID (HD.2), fall back to Namespace ID (HD.1)
  const value = hd.$2_system?.trim() || hd.$1_namespace?.trim();
  return value || null;
}

/**
 * Extracts authority string from CWE (Coded with Exceptions) type.
 * Returns null if empty/whitespace.
 */
function extractCWEAuthority(cwe: CWE | undefined): string | null {
  if (!cwe) return null;

  // Use coding system (CWE.3) if available, otherwise use code (CWE.1)
  const value = cwe.$3_system?.trim() || cwe.$1_code?.trim();
  return value || null;
}

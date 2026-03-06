import type { CX } from "../../hl7v2/generated/fields";
import type { MpiClient, MpiResult } from "./mpi-lookup";
import { StubMpiClient } from "./mpi-lookup";
import type { Hl7v2ToFhirConfig } from "../config";

export type MatchRule = {
  assigner?: string;
  type?: string;
  any?: true;
};

export type MpiLookupRule = {
  mpiLookup: {
    endpoint: { baseUrl: string; timeout?: number };
    strategy: "pix" | "match";
    source?: MatchRule[];
    target: { system: string; assigner: string; type?: string };
    matchThreshold?: number;
  };
};

export type IdentifierPriorityRule = MatchRule | MpiLookupRule;

export type PatientIdResult = { id: string } | { error: string };

/** Resolves Patient.id from a pool of CX identifiers. Injected into converters by converter.ts. */
export type PatientIdResolver = (identifiers: CX[]) => Promise<PatientIdResult>;

/** Creates a PatientIdResolver from the given config and StubMpiClient. */
export function defaultPatientIdResolver(config: Hl7v2ToFhirConfig): PatientIdResolver {
  const mpiClient = new StubMpiClient();
  return (ids) => selectPatientId(ids, config.identitySystem!.patient!.rules, mpiClient);
}

import { sanitizeForId } from "./utils";

/**
 * Select Patient.id from CX identifiers using ordered priority rules.
 * Returns `{ id }` on match or `{ error }` when no rule matches or MPI is unavailable.
 */
export async function selectPatientId(
  identifiers: CX[],
  rules: IdentifierPriorityRule[],
  mpiClient: MpiClient,
): Promise<PatientIdResult> {
  const pool = identifiers.filter((cx) => cx.$1_value?.trim());

  for (const rule of rules) {
    const result =
      "mpiLookup" in rule
        ? await tryMpiLookupRule(pool, rule, mpiClient)
        : tryMatchRule(pool, rule);
    if (result) return result;
  }

  const ids = pool
    .map((cx) => `${cx.$1_value}/${cx.$5_type ?? ""}`)
    .join(", ");
  return {
    error: `No identifier priority rule matched for identifiers: [${ids}]`,
  };
}

function buildPatientId(
  assigner: string,
  value: string,
): PatientIdResult {
  return { id: `${sanitizeForId(assigner)}-${sanitizeForId(value)}` };
}

function tryMatchRule(pool: CX[], rule: MatchRule): PatientIdResult | null {
  if (rule.any) {
    return tryAnyRule(pool);
  }

  for (const cx of pool) {
    let assignerId: string | null = null;

    if (rule.type && cx.$5_type?.trim() !== rule.type)
      continue;

    if (rule.assigner) {
      const matchedAssigner = matchAssigner(cx, rule.assigner);
      if (!matchedAssigner)
        continue;

      assignerId = getMatchedAssignerId(cx, matchedAssigner);
    } else {
      assignerId = getAnyAssignerId(cx);
    }

    if (!assignerId)
      continue;

    return buildPatientId(assignerId, cx.$1_value!.trim());
  }

  return null;
}

function tryAnyRule(pool: CX[]): PatientIdResult | null {
  for (const cx of pool) {
    const assignerId = getAnyAssignerId(cx);
    if (assignerId) {
      return buildPatientId(assignerId, cx.$1_value!.trim());
    }
  }
  return null;
}

async function tryMpiLookupRule(
  pool: CX[],
  rule: MpiLookupRule,
  mpiClient: MpiClient,
): Promise<PatientIdResult | null> {
  const { mpiLookup } = rule;

  let mpiResult: MpiResult | null;
  if (mpiLookup.strategy === "pix") {
    mpiResult = await tryPixLookup(mpiLookup, mpiClient);
  } else {
    // 'match' strategy: demographics-based, deferred to MPI implementation ticket
    mpiResult = await mpiClient.match({}, mpiLookup.target.system);
  }

  if (!mpiResult) return null;
  return handleMpiResult(mpiResult);
}

async function tryPixLookup(
  mpiLookup: MpiLookupRule["mpiLookup"],
  mpiClient: MpiClient,
): Promise<MpiResult | null> {
  // Source selection and system/value extraction deferred to MPI implementation ticket
  return mpiClient.crossReference(
    { system: "", value: "" },
    mpiLookup.target.system,
  );
}

function handleMpiResult(result: MpiResult): PatientIdResult | null {
  switch (result.status) {
    case "found":
      throw new Error(
        "MPI 'found' result handling not implemented — replace StubMpiClient with a real implementation",
      );
    case "not-found":
      return null;
    case "unavailable":
      return { error: `MPI unavailable: ${result.error}` };
  }
}

type AssignerMatchSource = "cx4" | "cx9" | "cx10";

/** Check CX.4.1 → CX.9.1 → CX.10.1 for a match against the given assigner string. */
function matchAssigner(
  cx: CX,
  assigner: string,
): AssignerMatchSource | null {
  if (cx.$4_system?.$1_namespace?.trim() === assigner) return "cx4";
  if (cx.$9_jurisdiction?.$1_code?.trim() === assigner) return "cx9";
  if (cx.$10_department?.$1_code?.trim() === assigner) return "cx10";
  return null;
}

/** Get assigner ID from the specific component that matched. Returns null if the component is unexpectedly empty. */
function getMatchedAssignerId(
  cx: CX,
  matchedVia: AssignerMatchSource,
): string | null {
  switch (matchedVia) {
    case "cx4": {
      const cx4_1 = cx.$4_system?.$1_namespace?.trim();
      if (cx4_1) return cx4_1;
      return cx.$4_system?.$2_system?.trim() || null;
    }
    case "cx9":
      return cx.$9_jurisdiction?.$1_code?.trim() || null;
    case "cx10":
      return cx.$10_department?.$1_code?.trim() || null;
  }
}

/** Get assigner ID from any CX authority component. Priority: CX.4.1 → CX.4.2 → CX.9.1 → CX.10.1. */
function getAnyAssignerId(cx: CX): string | null {
  const cx4_1 = cx.$4_system?.$1_namespace?.trim();
  if (cx4_1) return cx4_1;
  const cx4_2 = cx.$4_system?.$2_system?.trim();
  if (cx4_2) return cx4_2;
  const cx9_1 = cx.$9_jurisdiction?.$1_code?.trim();
  if (cx9_1) return cx9_1;
  const cx10_1 = cx.$10_department?.$1_code?.trim();
  if (cx10_1) return cx10_1;
  return null;
}

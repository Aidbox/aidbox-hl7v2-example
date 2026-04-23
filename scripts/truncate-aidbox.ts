/**
 * Truncate project-created data from Aidbox — including history tables.
 *
 * Runs raw SQL via Aidbox's `$psql` endpoint to TRUNCATE both the live table
 * (`<type>`) and the history table (`<type>_history`) for every resource
 * type this pipeline writes. That is the only way to purge history —
 * a REST DELETE leaves a tombstone row in `<type>_history`.
 *
 * Preserved:
 *   - Terminology / profiles seeded via init-bundle.json
 *     (CodeSystem, ValueSet, StructureDefinition, SearchParameter)
 *   - ConceptMaps whose id does NOT start with "hl7v2-" (the ~80 canonical
 *     FHIR R4 `*CanonicalMap`, `v2.*`, `v3.*` ConceptMaps loaded by Aidbox's
 *     hybrid terminology engine). Project-owned ConceptMaps have id prefix
 *     `hl7v2-` (seed `hl7v2-acme-lab-acme-hosp-*` + sender-dynamic
 *     `hl7v2-{app}-{facility}-{type}` from code-mapping).
 *   - Aidbox system resources (Client, User, AccessPolicy, ...)
 *
 * Note: with BOX_FHIR_TERMINOLOGY_ENGINE=hybrid, ConceptMaps live in
 *   `far.conceptmap` + `far.conceptmapelement`, not `public.conceptmap`.
 *
 * Usage:
 *   bun scripts/truncate-aidbox.ts          # prompt before running
 *   bun scripts/truncate-aidbox.ts --yes    # skip prompt
 */

import { aidboxFetch } from "../src/aidbox";

// Resource types this project writes. Every live row + history row for these
// types is removed. Anything absent here is left untouched.
const RESOURCE_TYPES = [
  "OutgoingBarMessage",
  "IncomingHL7v2Message",
  "Task",
  "Observation",
  "DiagnosticReport",
  "Specimen",
  "Immunization",
  "AllergyIntolerance",
  "MedicationRequest",
  "ServiceRequest",
  "Condition",
  "Procedure",
  "Coverage",
  "Encounter",
  "Account",
  "Patient",
  "PractitionerRole",
  "Practitioner",
  "Location",
  "Organization",
];

const PROJECT_CONCEPTMAP_PREFIX = "hl7v2-";

interface PsqlResponse {
  result?: Array<Record<string, unknown>>;
  error?: string;
  status: "success" | "error";
  query: string;
  duration?: number;
}

async function psql(query: string): Promise<PsqlResponse> {
  const response = await aidboxFetch<PsqlResponse[]>("/$psql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const first = response[0];
  if (!first) throw new Error(`Empty response from $psql: ${query}`);
  // Aidbox reports `status: "success"` with an `error` field when a
  // non-SELECT statement produced no rows — treat that as OK.
  if (first.status !== "success") {
    throw new Error(`$psql failed: ${first.error ?? "unknown"} — ${query}`);
  }
  return first;
}

async function tableExists(table: string): Promise<boolean> {
  const res = await psql(
    `SELECT 1 FROM pg_tables WHERE tablename = '${table}' LIMIT 1`,
  );
  return (res.result?.length ?? 0) > 0;
}

async function countRows(table: string): Promise<number> {
  const res = await psql(`SELECT count(*)::int AS n FROM "${table}"`);
  return (res.result?.[0]?.n as number | undefined) ?? 0;
}

async function confirm(): Promise<boolean> {
  const url = process.env.AIDBOX_URL || "http://localhost:8080";
  process.stdout.write(
    `About to TRUNCATE all project resource + history tables on Aidbox at ${url}\nType 'yes' to continue: `,
  );
  for await (const line of console) {
    return line.trim().toLowerCase() === "yes";
  }
  return false;
}

async function truncateResourceTypes(types: string[]): Promise<number> {
  const tables: string[] = [];
  for (const type of types) {
    const t = type.toLowerCase();
    const h = `${t}_history`;
    if (await tableExists(t)) tables.push(t);
    if (await tableExists(h)) tables.push(h);
  }
  if (tables.length === 0) return 0;

  let before = 0;
  for (const t of tables) before += await countRows(t);

  const quoted = tables.map((t) => `"${t}"`).join(", ");
  await psql(`TRUNCATE ${quoted} RESTART IDENTITY`);

  return before;
}

async function schemaTableExists(
  schema: string,
  table: string,
): Promise<boolean> {
  const res = await psql(
    `SELECT 1 FROM pg_tables WHERE schemaname = '${schema}' AND tablename = '${table}' LIMIT 1`,
  );
  return (res.result?.length ?? 0) > 0;
}

async function truncateProjectConceptMaps(): Promise<number> {
  // Aidbox's hybrid terminology engine stores ConceptMaps in `far.conceptmap`
  // (live) + `far.conceptmapelement` (group/element rows keyed by `conceptmap`
  // column). The `public.conceptmap` table is bypassed entirely. We must also
  // clean `public.conceptmap*` as a fallback in case terminology engine
  // settings change later.
  const idPattern = `'${PROJECT_CONCEPTMAP_PREFIX}%'`;
  let deleted = 0;

  if (await schemaTableExists("far", "conceptmap")) {
    const n = (
      await psql(
        `SELECT count(*)::int AS n FROM far.conceptmap WHERE id LIKE ${idPattern}`,
      )
    ).result?.[0]?.n as number | undefined;
    deleted += n ?? 0;

    if (await schemaTableExists("far", "conceptmapelement")) {
      await psql(
        `DELETE FROM far.conceptmapelement WHERE conceptmap LIKE ${idPattern}`,
      );
    }
    await psql(`DELETE FROM far.conceptmap WHERE id LIKE ${idPattern}`);
  }

  // Fallback: public.conceptmap + history (unused by hybrid engine, but
  // wipe any stragglers / tombstones if engine was ever switched).
  if (await schemaTableExists("public", "conceptmap")) {
    await psql(`DELETE FROM public.conceptmap WHERE id LIKE ${idPattern}`);
  }
  if (await schemaTableExists("public", "conceptmap_history")) {
    await psql(
      `DELETE FROM public.conceptmap_history WHERE id LIKE ${idPattern}`,
    );
  }

  return deleted;
}

async function main() {
  const args = process.argv.slice(2);
  const skipPrompt = args.includes("--yes") || args.includes("-y");

  const url = process.env.AIDBOX_URL || "http://localhost:8080";
  console.log(`Aidbox: ${url}`);

  if (!skipPrompt) {
    const ok = await confirm();
    if (!ok) {
      console.log("Aborted.");
      process.exit(1);
    }
  }

  console.log("\nTruncating project resource + history tables...");
  const truncated = await truncateResourceTypes(RESOURCE_TYPES);
  console.log(`  resource types: ${truncated} live rows removed`);

  const cmDeleted = await truncateProjectConceptMaps();
  console.log(
    `  ConceptMap (id LIKE '${PROJECT_CONCEPTMAP_PREFIX}%'): ${cmDeleted} live rows removed`,
  );

  console.log("\n✓ Done. History tables purged.");
}

main().catch((err) => {
  console.error("Truncate failed:", err);
  process.exit(1);
});

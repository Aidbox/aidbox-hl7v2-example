/**
 * Terminology suggestion scoring.
 *
 * Wraps `searchLoincCodes()` with a lightweight substring scorer so the
 * Unmapped Codes editor can show ranked LOINC candidates without a full
 * fuzzy-search backend. Scoring rules (v1):
 *   100 — query is an exact case-insensitive substring of the result display
 *    70 — at least one whitespace-separated token from the query appears in display
 *    40 — fallback (returned by the ValueSet $expand, but no token match)
 *
 * Callers cap the result length:
 *   - Editor's pre-shown "Suggested LOINC matches" list: 3 (default)
 *   - Typeahead popovers (manual search): 10 (all of upstream's results)
 */

import { searchLoincCodes } from "../code-mapping/terminology-api";

export interface SuggestedCode {
  code: string;
  display: string;
  score: number;
  system: "LOINC";
}

function scoreMatch(query: string, display: string): number {
  const q = query.trim().toLowerCase();
  const d = display.toLowerCase();
  if (!q) {return 40;}
  if (d.includes(q)) {return 100;}
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.some((t) => d.includes(t))) {return 70;}
  return 40;
}

export async function suggestCodes(
  display: string,
  _field?: string,
  limit = 3,
  // Injectable for tests — defaults to the real searchLoincCodes.
  // Exists because `mock.module` on terminology-api is process-wide in
  // Bun and leaks across test files under Bun 1.3.12 on CI (see
  // test/unit/code-mapping/terminology-api.test.ts for details).
  searchFn: typeof searchLoincCodes = searchLoincCodes,
): Promise<SuggestedCode[]> {
  if (!display.trim()) {return [];}
  try {
    const results = await searchFn(display);
    return results
      .map((r) => ({
        code: r.code,
        display: r.display,
        score: scoreMatch(display, r.display),
        system: "LOINC" as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch {
    return [];
  }
}

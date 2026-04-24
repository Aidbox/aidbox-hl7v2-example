/**
 * Tests for suggestCodes (LOINC ranking).
 *
 * Why this file does NOT use `mock.module`:
 * `mock.module` is process-wide in Bun and does not cleanly reverse —
 * a module-level stub installed here was leaking into
 * `test/unit/code-mapping/terminology-api.test.ts` on CI under Bun
 * 1.3.12 (Ubuntu), even with `afterAll(mock.restore)`. See that file's
 * header for the full story.
 *
 * Instead we exercise `suggestCodes` via its injectable `searchFn`
 * parameter — each test passes an in-place fake and asserts on its
 * behavior. No module mocking, no cross-file pollution.
 */
import { describe, it, expect } from "bun:test";
import { suggestCodes } from "../../../src/api/terminology-suggest";
import type { LoincSearchResult } from "../../../src/code-mapping/terminology-api";

function fakeSearch(
  rows: LoincSearchResult[],
  opts: { throwOnCall?: Error } = {},
) {
  return async (_query: string): Promise<LoincSearchResult[]> => {
    if (opts.throwOnCall) {throw opts.throwOnCall;}
    return rows;
  };
}

describe("suggestCodes", () => {
  it("returns empty array when display is blank", async () => {
    const results = await suggestCodes("   ", undefined, 3, fakeSearch([]));
    expect(results).toEqual([]);
  });

  it("scores 100 for exact case-insensitive substring match", async () => {
    const results = await suggestCodes(
      "glucose",
      undefined,
      3,
      fakeSearch([
        { code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma" },
      ]),
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.score).toBe(100);
    expect(results[0]!.code).toBe("2345-7");
    expect(results[0]!.system).toBe("LOINC");
  });

  it("scores 100 for mixed-case query that is substring of display", async () => {
    const results = await suggestCodes(
      "Glucose [Mass",
      undefined,
      3,
      fakeSearch([
        { code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma" },
      ]),
    );
    expect(results[0]!.score).toBe(100);
  });

  it("scores 70 when a token (>2 chars) from the query appears in display", async () => {
    // "blood panel CBC" — "blood" token (5 chars) matches "Blood" in display; not a full-query substring match
    const results = await suggestCodes(
      "blood panel CBC",
      undefined,
      3,
      fakeSearch([
        { code: "9999-1", display: "Hemoglobin [Mass/volume] in Blood" },
      ]),
    );
    expect(results[0]!.score).toBe(70);
  });

  it("scores 40 as fallback when no token or substring matches", async () => {
    const results = await suggestCodes(
      "UNKNOWN_TEST_XYZ",
      undefined,
      3,
      fakeSearch([
        { code: "1111-1", display: "Potassium [Moles/volume] in Serum or Plasma" },
      ]),
    );
    expect(results[0]!.score).toBe(40);
  });

  it("ignores tokens shorter than 3 characters for the 70 rule", async () => {
    // "Na" and "K" are both <3 chars — should not trigger the 70 rule
    const results = await suggestCodes(
      "Na K",
      undefined,
      3,
      fakeSearch([
        { code: "2222-2", display: "Sodium [Moles/volume] in Serum or Plasma" },
      ]),
    );
    expect(results[0]!.score).toBe(40);
  });

  it("returns top 3 sorted by score descending", async () => {
    const results = await suggestCodes(
      "glucose",
      undefined,
      3,
      fakeSearch([
        { code: "A", display: "Unrelated thing" }, // score 40
        { code: "B", display: "Glucose token match here" }, // score 100
        { code: "C", display: "Glucose [Mass/volume]" }, // score 100
        { code: "D", display: "Another glucose result" }, // score 100
      ]),
    );
    expect(results).toHaveLength(3);
    expect(results[0]!.score).toBe(100);
    expect(results[1]!.score).toBe(100);
    expect(results[2]!.score).toBe(100);
    // "A" (score 40) is excluded — only top 3 returned
    expect(results.map((r) => r.code)).not.toContain("A");
  });

  it("returns empty array when searchLoincCodes throws", async () => {
    const results = await suggestCodes(
      "glucose",
      undefined,
      3,
      fakeSearch([], { throwOnCall: new Error("network error") }),
    );
    expect(results).toEqual([]);
  });

  it("passes field parameter through to caller context (no score effect)", async () => {
    const results = await suggestCodes(
      "glucose",
      "OBX-3",
      3,
      fakeSearch([
        { code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma" },
      ]),
    );
    expect(results[0]!.score).toBe(100);
  });
});

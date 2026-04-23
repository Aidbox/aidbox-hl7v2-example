import { describe, it, expect, mock, beforeEach } from "bun:test";

let mockResults: { code: string; display: string }[] = [];
let throwNext: Error | null = null;

mock.module("../../../src/code-mapping/terminology-api", () => ({
  searchLoincCodes: async (_query: string) => {
    if (throwNext) {
      const err = throwNext;
      throwNext = null;
      throw err;
    }
    return mockResults;
  },
}));

const { suggestCodes } = await import("../../../src/api/terminology-suggest");

describe("suggestCodes", () => {
  beforeEach(() => {
    mockResults = [];
    throwNext = null;
  });

  it("returns empty array when display is blank", async () => {
    const results = await suggestCodes("   ");
    expect(results).toEqual([]);
  });

  it("scores 100 for exact case-insensitive substring match", async () => {
    mockResults = [
      { code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma" },
    ];
    const results = await suggestCodes("glucose");
    expect(results).toHaveLength(1);
    expect(results[0]!.score).toBe(100);
    expect(results[0]!.code).toBe("2345-7");
    expect(results[0]!.system).toBe("LOINC");
  });

  it("scores 100 for mixed-case query that is substring of display", async () => {
    mockResults = [
      { code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma" },
    ];
    const results = await suggestCodes("Glucose [Mass");
    expect(results[0]!.score).toBe(100);
  });

  it("scores 70 when a token (>2 chars) from the query appears in display", async () => {
    mockResults = [
      { code: "9999-1", display: "Hemoglobin [Mass/volume] in Blood" },
    ];
    // "blood panel CBC" — "blood" token (5 chars) matches "Blood" in display; not a full-query substring match
    const results = await suggestCodes("blood panel CBC");
    expect(results[0]!.score).toBe(70);
  });

  it("scores 40 as fallback when no token or substring matches", async () => {
    mockResults = [
      { code: "1111-1", display: "Potassium [Moles/volume] in Serum or Plasma" },
    ];
    const results = await suggestCodes("UNKNOWN_TEST_XYZ");
    expect(results[0]!.score).toBe(40);
  });

  it("ignores tokens shorter than 3 characters for the 70 rule", async () => {
    mockResults = [
      { code: "2222-2", display: "Sodium [Moles/volume] in Serum or Plasma" },
    ];
    // "Na" and "K" are both <3 chars — should not trigger the 70 rule
    const results = await suggestCodes("Na K");
    expect(results[0]!.score).toBe(40);
  });

  it("returns top 3 sorted by score descending", async () => {
    mockResults = [
      { code: "A", display: "Unrelated thing" },          // score 40
      { code: "B", display: "Glucose token match here" }, // score 100 (substring)
      { code: "C", display: "Glucose [Mass/volume]" },    // score 100
      { code: "D", display: "Another glucose result" },   // score 100
    ];
    const results = await suggestCodes("glucose");
    expect(results).toHaveLength(3);
    expect(results[0]!.score).toBe(100);
    expect(results[1]!.score).toBe(100);
    expect(results[2]!.score).toBe(100);
    // "A" (score 40) is excluded — only top 3 returned
    expect(results.map((r) => r.code)).not.toContain("A");
  });

  it("returns empty array when searchLoincCodes throws", async () => {
    throwNext = new Error("network error");
    const results = await suggestCodes("glucose");
    expect(results).toEqual([]);
  });

  it("passes field parameter through to caller context (no score effect)", async () => {
    mockResults = [
      { code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma" },
    ];
    const results = await suggestCodes("glucose", "OBX-3");
    expect(results[0]!.score).toBe(100);
  });
});

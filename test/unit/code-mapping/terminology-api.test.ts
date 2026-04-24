/**
 * Tests for Terminology API (LOINC search + validation).
 *
 * Imports from `terminology-api-impl` (not `terminology-api`) on purpose:
 * `test/unit/api/terminology-suggest.test.ts` installs a process-wide
 * `mock.module("../../../src/code-mapping/terminology-api", ...)` that
 * stubs `searchLoincCodes`. In Bun 1.3.12+, `mock.restore()` doesn't
 * reliably revert a file-level `mock.module` once the module is cached,
 * so any test file that runs after terminology-suggest.test.ts and
 * imports from the public `terminology-api` path gets the stub rather
 * than the real implementation. Importing the impl module directly
 * bypasses that stub.
 *
 * Uses the mutable-factory mock pattern (same as
 * test/unit/ui/unmapped.test.ts): `mock.module` runs once at file load
 * with a factory whose `aidboxFetch` delegates to a mutable `fetchImpl`.
 * Tests swap `fetchImpl` per case instead of re-registering `mock.module`
 * per test — re-registering is unreliable under Bun 1.3.12+ once the
 * dependent module has been imported.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";
import * as realAidbox from "../../../src/aidbox";

const sampleValueSetExpansion = {
  expansion: {
    contains: [
      {
        code: "2823-3",
        display: "Potassium [Moles/volume] in Serum or Plasma",
        designation: [
          { use: { code: "COMPONENT" }, value: "Potassium" },
          { use: { code: "PROPERTY" }, value: "SCnc" },
          { use: { code: "TIME_ASPCT" }, value: "Pt" },
          { use: { code: "SCALE_TYP" }, value: "Qn" },
        ],
      },
      {
        code: "6298-4",
        display: "Potassium [Moles/volume] in Blood",
        designation: [
          { use: { code: "COMPONENT" }, value: "Potassium" },
          { use: { code: "PROPERTY" }, value: "SCnc" },
          { use: { code: "TIME_ASPCT" }, value: "Pt" },
          { use: { code: "SCALE_TYP" }, value: "Qn" },
        ],
      },
      {
        code: "39789-3",
        display: "Potassium [Moles/volume] in Venous blood",
      },
    ],
  },
};

const sampleCodeSystemLookup = {
  parameter: [
    { name: "name", valueString: "LOINC" },
    { name: "display", valueString: "Potassium [Moles/volume] in Serum or Plasma" },
    { name: "property", valueCode: "COMPONENT", valueString: "Potassium" },
  ],
};

// Mutable fetch implementation swapped per test.
let fetchImpl: (path: string) => Promise<unknown> = () =>
  Promise.reject(new Error("aidboxFetch not stubbed for this test"));

mock.module("../../../src/aidbox", () => ({
  ...realAidbox,
  aidboxFetch: (path: string) => fetchImpl(path),
}));

const { searchLoincCodes, validateLoincCode } = await import(
  "../../../src/code-mapping/terminology-api-impl"
);

describe("searchLoincCodes", () => {
  beforeEach(() => {
    fetchImpl = () => Promise.reject(new Error("fetchImpl not set in test"));
  });

  test("searches by text query and returns up to 10 results", async () => {
    let calledPath = "";
    const spy = mock((path: string) => {
      calledPath = path;
      return Promise.resolve(sampleValueSetExpansion);
    });
    fetchImpl = spy;

    const results = await searchLoincCodes("potassium");

    expect(spy).toHaveBeenCalled();
    expect(calledPath).toContain("ValueSet/$expand");
    expect(calledPath).toContain("filter=potassium");
    expect(calledPath).toContain("count=10");
    expect(results.length).toBeLessThanOrEqual(10);
  });

  test("searches by code (numeric-looking query)", async () => {
    let calledPath = "";
    fetchImpl = (path: string) => {
      calledPath = path;
      return Promise.resolve(sampleValueSetExpansion);
    };

    await searchLoincCodes("2823");

    expect(calledPath).toContain("filter=2823");
  });

  test("returns results with code, display, and optional component/property/timing/scale", async () => {
    fetchImpl = () => Promise.resolve(sampleValueSetExpansion);

    const results = await searchLoincCodes("potassium");

    expect(results[0]!.code).toBe("2823-3");
    expect(results[0]!.display).toBe("Potassium [Moles/volume] in Serum or Plasma");
    expect(results[0]!.component).toBe("Potassium");
    expect(results[0]!.property).toBe("SCnc");
    expect(results[0]!.timing).toBe("Pt");
    expect(results[0]!.scale).toBe("Qn");
  });

  test("handles results without designation (optional fields)", async () => {
    fetchImpl = () => Promise.resolve(sampleValueSetExpansion);

    const results = await searchLoincCodes("potassium");
    const resultWithoutDesignation = results.find((r) => r.code === "39789-3");

    expect(resultWithoutDesignation).toBeDefined();
    expect(resultWithoutDesignation!.code).toBe("39789-3");
    expect(resultWithoutDesignation!.component).toBeUndefined();
  });

  test("returns empty array when no results found", async () => {
    fetchImpl = () => Promise.resolve({ expansion: { contains: [] } });

    const results = await searchLoincCodes("nonexistent");

    expect(results).toEqual([]);
  });

  test("returns empty array when expansion.contains is undefined", async () => {
    fetchImpl = () => Promise.resolve({ expansion: {} });

    const results = await searchLoincCodes("test");

    expect(results).toEqual([]);
  });

  test("retries on transient failure (2 retries)", async () => {
    let callCount = 0;
    fetchImpl = () => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error("HTTP 503: Service Unavailable"));
      }
      return Promise.resolve(sampleValueSetExpansion);
    };

    const results = await searchLoincCodes("potassium");

    expect(callCount).toBe(3);
    expect(results.length).toBeGreaterThan(0);
  });

  test("throws after max retries exceeded", async () => {
    fetchImpl = () => Promise.reject(new Error("HTTP 503: Service Unavailable"));

    await expect(searchLoincCodes("potassium")).rejects.toThrow();
  });

  test("does not retry on 4xx errors", async () => {
    let callCount = 0;
    fetchImpl = () => {
      callCount++;
      return Promise.reject(new Error("HTTP 400: Bad Request"));
    };

    await expect(searchLoincCodes("potassium")).rejects.toThrow("400");
    expect(callCount).toBe(1);
  });

  test("encodes special characters in query", async () => {
    let calledPath = "";
    fetchImpl = (path: string) => {
      calledPath = path;
      return Promise.resolve({ expansion: {} });
    };

    await searchLoincCodes("test & query");

    expect(calledPath).toContain("filter=test%20%26%20query");
  });
});

describe("validateLoincCode", () => {
  beforeEach(() => {
    fetchImpl = () => Promise.reject(new Error("fetchImpl not set in test"));
  });

  test("returns code details when valid", async () => {
    let calledPath = "";
    fetchImpl = (path: string) => {
      calledPath = path;
      return Promise.resolve(sampleCodeSystemLookup);
    };

    const result = await validateLoincCode("2823-3");

    expect(calledPath).toContain("CodeSystem/$lookup");
    expect(calledPath).toContain("system=http://loinc.org");
    expect(calledPath).toContain("code=2823-3");
    expect(result).toBeDefined();
    expect(result!.code).toBe("2823-3");
    expect(result!.display).toBe("Potassium [Moles/volume] in Serum or Plasma");
  });

  test("returns null for invalid code", async () => {
    fetchImpl = () => Promise.reject(new Error("HTTP 404: Not Found"));

    const result = await validateLoincCode("INVALID-CODE");

    expect(result).toBeNull();
  });

  test("retries on transient failure", async () => {
    let callCount = 0;
    fetchImpl = () => {
      callCount++;
      if (callCount < 2) {
        return Promise.reject(new Error("HTTP 503: Service Unavailable"));
      }
      return Promise.resolve(sampleCodeSystemLookup);
    };

    const result = await validateLoincCode("2823-3");

    expect(callCount).toBe(2);
    expect(result).toBeDefined();
  });

  test("throws after max retries on non-404 errors", async () => {
    fetchImpl = () => Promise.reject(new Error("HTTP 500: Internal Server Error"));

    await expect(validateLoincCode("2823-3")).rejects.toThrow("500");
  });
});

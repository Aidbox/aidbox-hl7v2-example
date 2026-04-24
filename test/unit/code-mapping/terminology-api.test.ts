/**
 * Tests for Terminology API (LOINC search + validation).
 *
 * Why this file does NOT use `mock.module`:
 * Other test files install process-wide `mock.module` stubs that can
 * bleed into this file's imports. In Bun 1.3.12 the effect is
 * test-order- and filesystem-dependent: CI (Ubuntu) consistently
 * inherits `test/unit/api/terminology-suggest.test.ts`'s stub on
 * `terminology-api` even when we import from a different path, and
 * even with `afterAll(mock.restore)`. Re-registering `mock.module`
 * per-test is also unreliable after the target module has been cached.
 *
 * Instead we test the impl module (`loinc-terminology.ts`) via its
 * injectable `fetchFn` parameter — each test passes an in-place fake
 * and asserts on its behavior. No module mocking, no cross-file
 * pollution, no ordering sensitivity.
 */
import { describe, test, expect, mock, beforeEach } from "bun:test";
import {
  searchLoincCodes,
  validateLoincCode,
} from "../../../src/code-mapping/loinc-terminology";

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

/**
 * Build a minimal fake aidboxFetch whose T-parameter is discarded —
 * good enough for stubbing the two callsites inside loinc-terminology.
 */
function fakeFetch<T>(handler: (path: string) => Promise<unknown>) {
  return (async (path: string) => handler(path)) as unknown as <U = T>(
    path: string,
  ) => Promise<U>;
}

describe("searchLoincCodes", () => {
  let calledPath = "";

  beforeEach(() => {
    calledPath = "";
  });

  test("searches by text query and returns up to 10 results", async () => {
    const spy = mock((path: string) => {
      calledPath = path;
      return Promise.resolve(sampleValueSetExpansion);
    });
    const results = await searchLoincCodes("potassium", fakeFetch(spy));

    expect(spy).toHaveBeenCalled();
    expect(calledPath).toContain("ValueSet/$expand");
    expect(calledPath).toContain("filter=potassium");
    expect(calledPath).toContain("count=10");
    expect(results.length).toBeLessThanOrEqual(10);
  });

  test("searches by code (numeric-looking query)", async () => {
    await searchLoincCodes(
      "2823",
      fakeFetch((path) => {
        calledPath = path;
        return Promise.resolve(sampleValueSetExpansion);
      }),
    );

    expect(calledPath).toContain("filter=2823");
  });

  test("returns results with code, display, and optional component/property/timing/scale", async () => {
    const results = await searchLoincCodes(
      "potassium",
      fakeFetch(() => Promise.resolve(sampleValueSetExpansion)),
    );

    expect(results[0]!.code).toBe("2823-3");
    expect(results[0]!.display).toBe("Potassium [Moles/volume] in Serum or Plasma");
    expect(results[0]!.component).toBe("Potassium");
    expect(results[0]!.property).toBe("SCnc");
    expect(results[0]!.timing).toBe("Pt");
    expect(results[0]!.scale).toBe("Qn");
  });

  test("handles results without designation (optional fields)", async () => {
    const results = await searchLoincCodes(
      "potassium",
      fakeFetch(() => Promise.resolve(sampleValueSetExpansion)),
    );
    const resultWithoutDesignation = results.find((r) => r.code === "39789-3");

    expect(resultWithoutDesignation).toBeDefined();
    expect(resultWithoutDesignation!.code).toBe("39789-3");
    expect(resultWithoutDesignation!.component).toBeUndefined();
  });

  test("returns empty array when no results found", async () => {
    const results = await searchLoincCodes(
      "nonexistent",
      fakeFetch(() => Promise.resolve({ expansion: { contains: [] } })),
    );

    expect(results).toEqual([]);
  });

  test("returns empty array when expansion.contains is undefined", async () => {
    const results = await searchLoincCodes(
      "test",
      fakeFetch(() => Promise.resolve({ expansion: {} })),
    );

    expect(results).toEqual([]);
  });

  test("retries on transient failure (2 retries)", async () => {
    let callCount = 0;
    const results = await searchLoincCodes(
      "potassium",
      fakeFetch(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error("HTTP 503: Service Unavailable"));
        }
        return Promise.resolve(sampleValueSetExpansion);
      }),
    );

    expect(callCount).toBe(3);
    expect(results.length).toBeGreaterThan(0);
  });

  test("throws after max retries exceeded", async () => {
    await expect(
      searchLoincCodes(
        "potassium",
        fakeFetch(() => Promise.reject(new Error("HTTP 503: Service Unavailable"))),
      ),
    ).rejects.toThrow();
  });

  test("does not retry on 4xx errors", async () => {
    let callCount = 0;
    await expect(
      searchLoincCodes(
        "potassium",
        fakeFetch(() => {
          callCount++;
          return Promise.reject(new Error("HTTP 400: Bad Request"));
        }),
      ),
    ).rejects.toThrow("400");
    expect(callCount).toBe(1);
  });

  test("encodes special characters in query", async () => {
    await searchLoincCodes(
      "test & query",
      fakeFetch((path) => {
        calledPath = path;
        return Promise.resolve({ expansion: {} });
      }),
    );

    expect(calledPath).toContain("filter=test%20%26%20query");
  });
});

describe("validateLoincCode", () => {
  test("returns code details when valid", async () => {
    let calledPath = "";
    const result = await validateLoincCode(
      "2823-3",
      fakeFetch((path) => {
        calledPath = path;
        return Promise.resolve(sampleCodeSystemLookup);
      }),
    );

    expect(calledPath).toContain("CodeSystem/$lookup");
    expect(calledPath).toContain("system=http://loinc.org");
    expect(calledPath).toContain("code=2823-3");
    expect(result).toBeDefined();
    expect(result!.code).toBe("2823-3");
    expect(result!.display).toBe("Potassium [Moles/volume] in Serum or Plasma");
  });

  test("returns null for invalid code", async () => {
    const result = await validateLoincCode(
      "INVALID-CODE",
      fakeFetch(() => Promise.reject(new Error("HTTP 404: Not Found"))),
    );

    expect(result).toBeNull();
  });

  test("retries on transient failure", async () => {
    let callCount = 0;
    const result = await validateLoincCode(
      "2823-3",
      fakeFetch(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject(new Error("HTTP 503: Service Unavailable"));
        }
        return Promise.resolve(sampleCodeSystemLookup);
      }),
    );

    expect(callCount).toBe(2);
    expect(result).toBeDefined();
  });

  test("throws after max retries on non-404 errors", async () => {
    await expect(
      validateLoincCode(
        "2823-3",
        fakeFetch(() => Promise.reject(new Error("HTTP 500: Internal Server Error"))),
      ),
    ).rejects.toThrow("500");
  });
});

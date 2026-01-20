/**
 * Tests for Terminology API
 *
 * The terminology API calls external terminology server for LOINC operations.
 */
import { describe, test, expect, mock, afterEach } from "bun:test";

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

describe("searchLoincCodes", () => {
  afterEach(() => {
    mock.restore();
  });

  test("searches by text query and returns up to 10 results", async () => {
    let calledPath = "";
    const mockAidbox = {
      aidboxFetch: mock((path: string) => {
        calledPath = path;
        return Promise.resolve(sampleValueSetExpansion);
      }),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchLoincCodes } = await import("../../src/code-mapping/terminology-api");
    const results = await searchLoincCodes("potassium");

    expect(mockAidbox.aidboxFetch).toHaveBeenCalled();
    expect(calledPath).toContain("ValueSet/$expand");
    expect(calledPath).toContain("filter=potassium");
    expect(calledPath).toContain("count=10");
    expect(results.length).toBeLessThanOrEqual(10);
  });

  test("searches by code (numeric-looking query)", async () => {
    let calledPath = "";
    const mockAidbox = {
      aidboxFetch: mock((path: string) => {
        calledPath = path;
        return Promise.resolve(sampleValueSetExpansion);
      }),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchLoincCodes } = await import("../../src/code-mapping/terminology-api");
    await searchLoincCodes("2823");

    expect(calledPath).toContain("filter=2823");
  });

  test("returns results with code, display, and optional component/property/timing/scale", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve(sampleValueSetExpansion)),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchLoincCodes } = await import("../../src/code-mapping/terminology-api");
    const results = await searchLoincCodes("potassium");

    expect(results[0].code).toBe("2823-3");
    expect(results[0].display).toBe("Potassium [Moles/volume] in Serum or Plasma");
    expect(results[0].component).toBe("Potassium");
    expect(results[0].property).toBe("SCnc");
    expect(results[0].timing).toBe("Pt");
    expect(results[0].scale).toBe("Qn");
  });

  test("handles results without designation (optional fields)", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve(sampleValueSetExpansion)),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchLoincCodes } = await import("../../src/code-mapping/terminology-api");
    const results = await searchLoincCodes("potassium");
    const resultWithoutDesignation = results.find((r) => r.code === "39789-3");

    expect(resultWithoutDesignation).toBeDefined();
    expect(resultWithoutDesignation!.code).toBe("39789-3");
    expect(resultWithoutDesignation!.component).toBeUndefined();
  });

  test("returns empty array when no results found", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve({ expansion: { contains: [] } })),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchLoincCodes } = await import("../../src/code-mapping/terminology-api");
    const results = await searchLoincCodes("nonexistent");

    expect(results).toEqual([]);
  });

  test("returns empty array when expansion.contains is undefined", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve({ expansion: {} })),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchLoincCodes } = await import("../../src/code-mapping/terminology-api");
    const results = await searchLoincCodes("test");

    expect(results).toEqual([]);
  });

  test("retries on transient failure (2 retries)", async () => {
    let callCount = 0;
    const mockAidbox = {
      aidboxFetch: mock(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error("HTTP 503: Service Unavailable"));
        }
        return Promise.resolve(sampleValueSetExpansion);
      }),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchLoincCodes } = await import("../../src/code-mapping/terminology-api");
    const results = await searchLoincCodes("potassium");

    expect(callCount).toBe(3);
    expect(results.length).toBeGreaterThan(0);
  });

  test("throws after max retries exceeded", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.reject(new Error("HTTP 503: Service Unavailable"))),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchLoincCodes } = await import("../../src/code-mapping/terminology-api");

    await expect(searchLoincCodes("potassium")).rejects.toThrow();
  });

  test("does not retry on 4xx errors", async () => {
    let callCount = 0;
    const mockAidbox = {
      aidboxFetch: mock(() => {
        callCount++;
        return Promise.reject(new Error("HTTP 400: Bad Request"));
      }),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchLoincCodes } = await import("../../src/code-mapping/terminology-api");

    await expect(searchLoincCodes("potassium")).rejects.toThrow("400");
    expect(callCount).toBe(1);
  });

  test("encodes special characters in query", async () => {
    let calledPath = "";
    const mockAidbox = {
      aidboxFetch: mock((path: string) => {
        calledPath = path;
        return Promise.resolve({ expansion: {} });
      }),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchLoincCodes } = await import("../../src/code-mapping/terminology-api");
    await searchLoincCodes("test & query");

    expect(calledPath).toContain("filter=test%20%26%20query");
  });
});

describe("validateLoincCode", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns code details when valid", async () => {
    const mockAidbox = {
      aidboxFetch: mock((path: string) => {
        expect(path).toContain("CodeSystem/$lookup");
        expect(path).toContain("system=http://loinc.org");
        expect(path).toContain("code=2823-3");
        return Promise.resolve(sampleCodeSystemLookup);
      }),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { validateLoincCode } = await import("../../src/code-mapping/terminology-api");
    const result = await validateLoincCode("2823-3");

    expect(result).toBeDefined();
    expect(result!.code).toBe("2823-3");
    expect(result!.display).toBe("Potassium [Moles/volume] in Serum or Plasma");
  });

  test("returns null for invalid code", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.reject(new Error("HTTP 404: Not Found"))),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { validateLoincCode } = await import("../../src/code-mapping/terminology-api");
    const result = await validateLoincCode("INVALID-CODE");

    expect(result).toBeNull();
  });

  test("retries on transient failure", async () => {
    let callCount = 0;
    const mockAidbox = {
      aidboxFetch: mock(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject(new Error("HTTP 503: Service Unavailable"));
        }
        return Promise.resolve(sampleCodeSystemLookup);
      }),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { validateLoincCode } = await import("../../src/code-mapping/terminology-api");
    const result = await validateLoincCode("2823-3");

    expect(callCount).toBe(2);
    expect(result).toBeDefined();
  });

  test("throws after max retries on non-404 errors", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.reject(new Error("HTTP 500: Internal Server Error"))),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { validateLoincCode } = await import("../../src/code-mapping/terminology-api");

    await expect(validateLoincCode("2823-3")).rejects.toThrow("500");
  });
});

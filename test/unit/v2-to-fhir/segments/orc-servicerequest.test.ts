import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { ORC } from "../../../../src/hl7v2/generated/fields";
import type { SenderContext } from "../../../../src/code-mapping/concept-map";

/**
 * Mock aidboxFetch to return 404 (ConceptMap not found) by default.
 * This ensures translateCode returns { status: "not_found" } for ConceptMap lookups,
 * which triggers the mapping error path for non-standard ORC-5 values.
 */
class MockHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const mockAidboxFetch = mock(() => {
  throw new MockHttpError("Not Found", 404);
});

mock.module("../../../../src/aidbox", () => ({
  aidboxFetch: mockAidboxFetch,
  HttpError: MockHttpError,
  PreconditionFailedError: class extends Error { status = 412; },
  NotFoundError: class extends Error { status = 404; },
  getResources: mock(() => Promise.resolve([])),
  putResource: mock(() => Promise.resolve({})),
  resourceExists: mock(() => Promise.resolve(false)),
  getResourceWithETag: mock(() => Promise.resolve(null)),
  updateResourceWithETag: mock(() => Promise.resolve({})),
}));

// Import after mocking
const { resolveOrderStatus, convertORCToServiceRequest } = await import(
  "../../../../src/v2-to-fhir/segments/orc-servicerequest"
);

const TEST_SENDER: SenderContext = {
  sendingApplication: "TestApp",
  sendingFacility: "TestFacility",
};

function makeORC(overrides: Partial<ORC> = {}): ORC {
  return {
    $1_orderControl: "NW",
    ...overrides,
  };
}

beforeEach(() => {
  mockAidboxFetch.mockClear();
});

// ============================================================================
// resolveOrderStatus
// ============================================================================

describe("resolveOrderStatus", () => {
  describe("Tier 1: ORC-5 standard map (Table 0038)", () => {
    const standardMappings = [
      ["CA", "revoked"],
      ["CM", "completed"],
      ["DC", "revoked"],
      ["ER", "entered-in-error"],
      ["HD", "on-hold"],
      ["IP", "active"],
      ["RP", "revoked"],
      ["SC", "active"],
    ];

    for (const mapping of standardMappings) {
      const orcValue = mapping[0]!;
      const expectedStatus = mapping[1]!;
      test(`ORC-5="${orcValue}" -> status="${expectedStatus}"`, async () => {
        const orc = makeORC({ $5_orderStatus: orcValue });

        const result = await resolveOrderStatus(orc, TEST_SENDER);

        expect(result.status as string).toBe(expectedStatus);
        expect(result.mappingError).toBeUndefined();
      });
    }

    test("ORC-5 is case-insensitive", async () => {
      const orc = makeORC({ $5_orderStatus: "ip" });

      const result = await resolveOrderStatus(orc, TEST_SENDER);

      expect(result.status).toBe("active");
    });
  });

  describe("Tier 2: ORC-5 non-standard -> ConceptMap lookup (mapping error)", () => {
    test("non-standard ORC-5='Final' returns mapping error", async () => {
      const orc = makeORC({ $5_orderStatus: "Final" });

      const result = await resolveOrderStatus(orc, TEST_SENDER);

      expect(result.status).toBe("unknown");
      expect(result.mappingError).toBeDefined();
      expect(result.mappingError!.mappingType).toBe("orc-status");
      expect(result.mappingError!.localCode).toBe("Final");
      expect(result.mappingError!.localSystem).toBe(
        "http://terminology.hl7.org/CodeSystem/v2-0038",
      );
    });

    test("non-standard ORC-5='Pending' returns mapping error", async () => {
      const orc = makeORC({ $5_orderStatus: "Pending" });

      const result = await resolveOrderStatus(orc, TEST_SENDER);

      expect(result.status).toBe("unknown");
      expect(result.mappingError).toBeDefined();
      expect(result.mappingError!.localCode).toBe("Pending");
    });
  });

  describe("Tier 3: ORC-5 empty -> ORC-1 fallback (Table 0119)", () => {
    const controlMappings = [
      ["NW", "active"],
      ["CA", "active"],
      ["OC", "revoked"],
      ["DC", "revoked"],
      ["HD", "active"],
      ["OH", "on-hold"],
      ["HR", "on-hold"],
      ["CR", "revoked"],
      ["DR", "revoked"],
    ];

    for (const mapping of controlMappings) {
      const controlCode = mapping[0]!;
      const expectedStatus = mapping[1]!;
      test(`ORC-5 empty, ORC-1="${controlCode}" -> status="${expectedStatus}"`, async () => {
        const orc = makeORC({
          $1_orderControl: controlCode,
          $5_orderStatus: undefined,
        });

        const result = await resolveOrderStatus(orc, TEST_SENDER);

        expect(result.status as string).toBe(expectedStatus);
        expect(result.mappingError).toBeUndefined();
      });
    }

    test("ORC-1='SC' has no mapping in control code map, falls to unknown", async () => {
      const orc = makeORC({
        $1_orderControl: "SC",
        $5_orderStatus: undefined,
      });

      const result = await resolveOrderStatus(orc, TEST_SENDER);

      expect(result.status).toBe("unknown");
      expect(result.mappingError).toBeUndefined();
    });
  });

  describe("Tier 4: both ORC-1 and ORC-5 empty -> unknown", () => {
    test("both empty -> status='unknown'", async () => {
      const orc: ORC = {
        $1_orderControl: "",
        $5_orderStatus: undefined,
      };

      const result = await resolveOrderStatus(orc, TEST_SENDER);

      expect(result.status).toBe("unknown");
      expect(result.mappingError).toBeUndefined();
    });

    test("ORC-1 undefined and ORC-5 undefined -> status='unknown'", async () => {
      const orc = makeORC({
        $1_orderControl: undefined as unknown as string,
        $5_orderStatus: undefined,
      });

      const result = await resolveOrderStatus(orc, TEST_SENDER);

      expect(result.status).toBe("unknown");
      expect(result.mappingError).toBeUndefined();
    });
  });
});

// ============================================================================
// convertORCToServiceRequest
// ============================================================================

describe("convertORCToServiceRequest", () => {
  test("sets intent to 'order'", async () => {
    const orc = makeORC();

    const result = await convertORCToServiceRequest(orc, TEST_SENDER);

    expect(result.serviceRequest.intent).toBe("order");
  });

  describe("identifiers", () => {
    test("ORC-2 maps to identifier[PLAC]", async () => {
      const orc = makeORC({
        $2_placerOrderNumber: { $1_value: "12345", $2_namespace: "ACME" },
      });

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);
      const placerIdentifier = result.serviceRequest.identifier?.find(
        (id) => id.type?.coding?.[0]?.code === "PLAC",
      );

      expect(placerIdentifier).toBeDefined();
      expect(placerIdentifier!.value).toBe("12345");
      expect(placerIdentifier!.system).toBe("ACME");
    });

    test("ORC-3 maps to identifier[FILL]", async () => {
      const orc = makeORC({
        $3_fillerOrderNumber: { $1_value: "F-99", $2_namespace: "LAB" },
      });

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);
      const fillerIdentifier = result.serviceRequest.identifier?.find(
        (id) => id.type?.coding?.[0]?.code === "FILL",
      );

      expect(fillerIdentifier).toBeDefined();
      expect(fillerIdentifier!.value).toBe("F-99");
      expect(fillerIdentifier!.system).toBe("LAB");
    });

    test("both ORC-2 and ORC-3 present -> two identifiers", async () => {
      const orc = makeORC({
        $2_placerOrderNumber: { $1_value: "P1" },
        $3_fillerOrderNumber: { $1_value: "F1" },
      });

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.serviceRequest.identifier).toHaveLength(2);
    });

    test("no ORC-2 or ORC-3 -> no identifiers", async () => {
      const orc = makeORC();

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.serviceRequest.identifier).toBeUndefined();
    });
  });

  describe("ORC-4 -> requisition", () => {
    test("ORC-4 maps to requisition Identifier", async () => {
      const orc = makeORC({
        $4_placerGroupNumber: { $1_value: "GRP-001", $2_namespace: "ORDER_SYS" },
      });

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.serviceRequest.requisition).toBeDefined();
      expect(result.serviceRequest.requisition!.value).toBe("GRP-001");
      expect(result.serviceRequest.requisition!.system).toBe("ORDER_SYS");
    });

    test("no ORC-4 -> no requisition", async () => {
      const orc = makeORC();

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.serviceRequest.requisition).toBeUndefined();
    });
  });

  describe("ORC-9 -> authoredOn (conditional on ORC-1='NW')", () => {
    test("ORC-1='NW' with ORC-9 -> authoredOn set", async () => {
      const orc = makeORC({
        $1_orderControl: "NW",
        $9_transactionDateTime: "20250115120000",
      });

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.serviceRequest.authoredOn).toBe("2025-01-15T12:00:00Z");
    });

    test("ORC-1='CA' with ORC-9 -> authoredOn NOT set", async () => {
      const orc = makeORC({
        $1_orderControl: "CA",
        $9_transactionDateTime: "20250115120000",
      });

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.serviceRequest.authoredOn).toBeUndefined();
    });

    test("ORC-1='NW' without ORC-9 -> authoredOn undefined", async () => {
      const orc = makeORC({
        $1_orderControl: "NW",
        $9_transactionDateTime: undefined,
      });

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.serviceRequest.authoredOn).toBeUndefined();
    });
  });

  describe("ORC-12 -> requester", () => {
    test("ORC-12 maps to requester display reference", async () => {
      const orc = makeORC({
        $12_orderingProvider: [
          {
            $1_value: "DR123",
            $2_family: { $1_family: "Smith" },
            $3_given: "John",
            $9_system: { $1_namespace: "NPI" },
          },
        ],
      });

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.serviceRequest.requester).toBeDefined();
      expect(result.serviceRequest.requester!.display).toContain("Smith");
      expect(result.serviceRequest.requester!.display).toContain("John");
      expect(result.serviceRequest.requester!.identifier).toBeDefined();
      expect(result.serviceRequest.requester!.identifier!.value).toBe("DR123");
    });

    test("no ORC-12 -> no requester", async () => {
      const orc = makeORC();

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.serviceRequest.requester).toBeUndefined();
    });
  });

  describe("ORC-29 -> locationCode", () => {
    test("ORC-29 maps to locationCode", async () => {
      const orc = makeORC({
        $29_orderType: { $1_code: "I", $2_text: "Inpatient", $3_system: "HL70482" },
      });

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.serviceRequest.locationCode).toBeDefined();
      expect(result.serviceRequest.locationCode).toHaveLength(1);
      expect(result.serviceRequest.locationCode![0]!.coding![0]!.code).toBe("I");
      expect(result.serviceRequest.locationCode![0]!.coding![0]!.display).toBe("Inpatient");
    });

    test("no ORC-29 -> no locationCode", async () => {
      const orc = makeORC();

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.serviceRequest.locationCode).toBeUndefined();
    });
  });

  describe("mapping error propagation", () => {
    test("non-standard ORC-5 returns mappingError in result", async () => {
      const orc = makeORC({ $5_orderStatus: "Final" });

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.mappingError).toBeDefined();
      expect(result.mappingError!.mappingType).toBe("orc-status");
      expect(result.serviceRequest.status).toBe("unknown");
    });

    test("standard ORC-5 returns no mappingError", async () => {
      const orc = makeORC({ $5_orderStatus: "IP" });

      const result = await convertORCToServiceRequest(orc, TEST_SENDER);

      expect(result.mappingError).toBeUndefined();
      expect(result.serviceRequest.status).toBe("active");
    });
  });
});

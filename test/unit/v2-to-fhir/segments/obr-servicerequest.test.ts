import { describe, test, expect } from "bun:test";
import type { OBR, ORC, CE } from "../../../../src/hl7v2/generated/fields";
import type { ServiceRequest } from "../../../../src/fhir/hl7-fhir-r4-core";
import { mergeOBRIntoServiceRequest } from "../../../../src/v2-to-fhir/segments/obr-servicerequest";

function makeServiceRequest(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    resourceType: "ServiceRequest",
    status: "active",
    intent: "order",
    subject: { reference: "Patient/test-patient" },
    ...overrides,
  };
}

function makeOBR(overrides: Partial<OBR> = {}): OBR {
  return {
    $4_service: { $1_code: "12345", $2_text: "CBC", $3_system: "LN" },
    ...overrides,
  };
}

function makeORC(overrides: Partial<ORC> = {}): ORC {
  return {
    $1_orderControl: "NW",
    ...overrides,
  };
}

// ============================================================================
// OBR-4 -> code
// ============================================================================

describe("OBR-4 -> ServiceRequest.code", () => {
  test("OBR-4 maps to code via CE->CodeableConcept", () => {
    const serviceRequest = makeServiceRequest();
    const obr = makeOBR({
      $4_service: { $1_code: "85025", $2_text: "CBC with Differential", $3_system: "LN" },
    });

    mergeOBRIntoServiceRequest(obr, serviceRequest, makeORC());

    expect(serviceRequest.code).toBeDefined();
    expect(serviceRequest.code!.coding![0]!.code).toBe("85025");
    expect(serviceRequest.code!.coding![0]!.display).toBe("CBC with Differential");
    expect(serviceRequest.code!.coding![0]!.system).toBe("LN");
  });

  test("OBR-4 with alternate coding includes both codings", () => {
    const serviceRequest = makeServiceRequest();
    const obr = makeOBR({
      $4_service: {
        $1_code: "85025",
        $2_text: "CBC",
        $3_system: "LN",
        $4_altCode: "CBC",
        $5_altDisplay: "Complete Blood Count",
        $6_altSystem: "LOCAL",
      },
    });

    mergeOBRIntoServiceRequest(obr, serviceRequest, makeORC());

    expect(serviceRequest.code!.coding).toHaveLength(2);
    expect(serviceRequest.code!.coding![1]!.code).toBe("CBC");
    expect(serviceRequest.code!.coding![1]!.system).toBe("LOCAL");
  });
});

// ============================================================================
// OBR-2 -> identifier[PLAC] (conditional on ORC-2)
// ============================================================================

describe("OBR-2 -> identifier[PLAC] (conditional)", () => {
  test("OBR-2 used as PLAC identifier when ORC-2 empty", () => {
    const serviceRequest = makeServiceRequest();
    const obr = makeOBR({
      $2_placerOrderNumber: { $1_value: "OBR-PLACER-1", $2_namespace: "LAB" },
    });
    const orc = makeORC({ $2_placerOrderNumber: undefined });

    mergeOBRIntoServiceRequest(obr, serviceRequest, orc);

    const placerIdentifier = serviceRequest.identifier?.find(
      (id) => id.type?.coding?.[0]?.code === "PLAC",
    );
    expect(placerIdentifier).toBeDefined();
    expect(placerIdentifier!.value).toBe("OBR-PLACER-1");
    expect(placerIdentifier!.system).toBe("LAB");
  });

  test("OBR-2 NOT used when ORC-2 present", () => {
    const serviceRequest = makeServiceRequest({
      identifier: [
        {
          value: "ORC-PLACER-1",
          system: "ACME",
          type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "PLAC" }] },
        },
      ],
    });
    const obr = makeOBR({
      $2_placerOrderNumber: { $1_value: "OBR-PLACER-SHOULD-NOT-APPEAR" },
    });
    const orc = makeORC({
      $2_placerOrderNumber: { $1_value: "ORC-PLACER-1", $2_namespace: "ACME" },
    });

    mergeOBRIntoServiceRequest(obr, serviceRequest, orc);

    const placerIdentifiers = serviceRequest.identifier?.filter(
      (id) => id.type?.coding?.[0]?.code === "PLAC",
    );
    expect(placerIdentifiers).toHaveLength(1);
    expect(placerIdentifiers![0]!.value).toBe("ORC-PLACER-1");
  });

  test("ORC-2 with empty $1_value treated as not valued -> OBR-2 used", () => {
    const serviceRequest = makeServiceRequest();
    const obr = makeOBR({
      $2_placerOrderNumber: { $1_value: "OBR-PLACER-2" },
    });
    const orc = makeORC({
      $2_placerOrderNumber: { $1_value: "" },
    });

    mergeOBRIntoServiceRequest(obr, serviceRequest, orc);

    const placerIdentifier = serviceRequest.identifier?.find(
      (id) => id.type?.coding?.[0]?.code === "PLAC",
    );
    expect(placerIdentifier).toBeDefined();
    expect(placerIdentifier!.value).toBe("OBR-PLACER-2");
  });
});

// ============================================================================
// OBR-3 -> identifier[FILL] (conditional on ORC-3)
// ============================================================================

describe("OBR-3 -> identifier[FILL] (conditional)", () => {
  test("OBR-3 used as FILL identifier when ORC-3 empty", () => {
    const serviceRequest = makeServiceRequest();
    const obr = makeOBR({
      $3_fillerOrderNumber: { $1_value: "OBR-FILLER-1", $2_namespace: "LAB" },
    });
    const orc = makeORC({ $3_fillerOrderNumber: undefined });

    mergeOBRIntoServiceRequest(obr, serviceRequest, orc);

    const fillerIdentifier = serviceRequest.identifier?.find(
      (id) => id.type?.coding?.[0]?.code === "FILL",
    );
    expect(fillerIdentifier).toBeDefined();
    expect(fillerIdentifier!.value).toBe("OBR-FILLER-1");
    expect(fillerIdentifier!.system).toBe("LAB");
  });

  test("OBR-3 NOT used when ORC-3 present", () => {
    const serviceRequest = makeServiceRequest({
      identifier: [
        {
          value: "ORC-FILLER-1",
          type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "FILL" }] },
        },
      ],
    });
    const obr = makeOBR({
      $3_fillerOrderNumber: { $1_value: "OBR-FILLER-SHOULD-NOT-APPEAR" },
    });
    const orc = makeORC({
      $3_fillerOrderNumber: { $1_value: "ORC-FILLER-1" },
    });

    mergeOBRIntoServiceRequest(obr, serviceRequest, orc);

    const fillerIdentifiers = serviceRequest.identifier?.filter(
      (id) => id.type?.coding?.[0]?.code === "FILL",
    );
    expect(fillerIdentifiers).toHaveLength(1);
    expect(fillerIdentifiers![0]!.value).toBe("ORC-FILLER-1");
  });
});

// ============================================================================
// OBR-5 -> priority
// ============================================================================

describe("OBR-5 -> ServiceRequest.priority", () => {
  test("OBR-5 'S' maps to 'stat'", () => {
    const serviceRequest = makeServiceRequest();
    mergeOBRIntoServiceRequest(makeOBR({ $5_priorityObr: "S" }), serviceRequest, makeORC());
    expect(serviceRequest.priority).toBe("stat");
  });

  test("OBR-5 'A' maps to 'stat'", () => {
    const serviceRequest = makeServiceRequest();
    mergeOBRIntoServiceRequest(makeOBR({ $5_priorityObr: "A" }), serviceRequest, makeORC());
    expect(serviceRequest.priority).toBe("stat");
  });

  test("OBR-5 'R' maps to 'routine'", () => {
    const serviceRequest = makeServiceRequest();
    mergeOBRIntoServiceRequest(makeOBR({ $5_priorityObr: "R" }), serviceRequest, makeORC());
    expect(serviceRequest.priority).toBe("routine");
  });

  test("OBR-5 'T' maps to 'urgent'", () => {
    const serviceRequest = makeServiceRequest();
    mergeOBRIntoServiceRequest(makeOBR({ $5_priorityObr: "T" }), serviceRequest, makeORC());
    expect(serviceRequest.priority).toBe("urgent");
  });

  test("OBR-5 is case-insensitive", () => {
    const serviceRequest = makeServiceRequest();
    mergeOBRIntoServiceRequest(makeOBR({ $5_priorityObr: "s" }), serviceRequest, makeORC());
    expect(serviceRequest.priority).toBe("stat");
  });

  test("unknown OBR-5 value does not set priority", () => {
    const serviceRequest = makeServiceRequest();
    mergeOBRIntoServiceRequest(makeOBR({ $5_priorityObr: "X" }), serviceRequest, makeORC());
    expect(serviceRequest.priority).toBeUndefined();
  });

  test("empty OBR-5 does not set priority", () => {
    const serviceRequest = makeServiceRequest();
    mergeOBRIntoServiceRequest(makeOBR({ $5_priorityObr: undefined }), serviceRequest, makeORC());
    expect(serviceRequest.priority).toBeUndefined();
  });
});

// ============================================================================
// OBR-6 -> occurrenceDateTime
// ============================================================================

describe("OBR-6 -> ServiceRequest.occurrenceDateTime", () => {
  test("OBR-6 maps to occurrenceDateTime", () => {
    const serviceRequest = makeServiceRequest();
    mergeOBRIntoServiceRequest(makeOBR({ $6_requestedDateTime: "20250115120000" }), serviceRequest, makeORC());
    expect(serviceRequest.occurrenceDateTime).toBe("2025-01-15T12:00:00Z");
  });

  test("OBR-6 partial date (YYYYMMDD) maps correctly", () => {
    const serviceRequest = makeServiceRequest();
    mergeOBRIntoServiceRequest(makeOBR({ $6_requestedDateTime: "20250115" }), serviceRequest, makeORC());
    expect(serviceRequest.occurrenceDateTime).toBe("2025-01-15");
  });

  test("empty OBR-6 does not set occurrenceDateTime", () => {
    const serviceRequest = makeServiceRequest();
    mergeOBRIntoServiceRequest(makeOBR({ $6_requestedDateTime: undefined }), serviceRequest, makeORC());
    expect(serviceRequest.occurrenceDateTime).toBeUndefined();
  });
});

// ============================================================================
// OBR-11 -> intent override
// ============================================================================

describe("OBR-11 -> ServiceRequest.intent override", () => {
  test("OBR-11 'G' overrides intent to 'reflex-order'", () => {
    const serviceRequest = makeServiceRequest({ intent: "order" });
    mergeOBRIntoServiceRequest(makeOBR({ $11_specimenActionCode: "G" }), serviceRequest, makeORC());
    expect(serviceRequest.intent).toBe("reflex-order");
  });

  test("OBR-11 'g' (lowercase) overrides intent to 'reflex-order'", () => {
    const serviceRequest = makeServiceRequest({ intent: "order" });
    mergeOBRIntoServiceRequest(makeOBR({ $11_specimenActionCode: "g" as any }), serviceRequest, makeORC());
    expect(serviceRequest.intent).toBe("reflex-order");
  });

  test("OBR-11 'A' keeps intent as 'order' (IG #add-on# is non-standard)", () => {
    const serviceRequest = makeServiceRequest({ intent: "order" });
    mergeOBRIntoServiceRequest(makeOBR({ $11_specimenActionCode: "A" }), serviceRequest, makeORC());
    expect(serviceRequest.intent).toBe("order");
  });

  test("OBR-11 other value keeps existing intent", () => {
    const serviceRequest = makeServiceRequest({ intent: "order" });
    mergeOBRIntoServiceRequest(makeOBR({ $11_specimenActionCode: "L" as any }), serviceRequest, makeORC());
    expect(serviceRequest.intent).toBe("order");
  });

  test("empty OBR-11 keeps existing intent", () => {
    const serviceRequest = makeServiceRequest({ intent: "order" });
    mergeOBRIntoServiceRequest(makeOBR({ $11_specimenActionCode: undefined }), serviceRequest, makeORC());
    expect(serviceRequest.intent).toBe("order");
  });
});

// ============================================================================
// OBR-16 -> requester (fallback when ORC-12 empty)
// ============================================================================

describe("OBR-16 -> ServiceRequest.requester (fallback)", () => {
  test("OBR-16 used as requester when ORC-12 empty", () => {
    const serviceRequest = makeServiceRequest();
    const obr = makeOBR({
      $16_orderingProvider: [
        {
          $1_value: "OBR-DR001",
          $2_family: { $1_family: "Jones" },
          $3_given: "Mary",
          $9_system: { $1_namespace: "NPI" },
        },
      ],
    });
    const orc = makeORC({ $12_orderingProvider: undefined });

    mergeOBRIntoServiceRequest(obr, serviceRequest, orc);

    expect(serviceRequest.requester).toBeDefined();
    expect(serviceRequest.requester!.display).toContain("Jones");
    expect(serviceRequest.requester!.display).toContain("Mary");
    expect(serviceRequest.requester!.identifier!.value).toBe("OBR-DR001");
  });

  test("OBR-16 NOT used when ORC-12 present (ORC takes precedence)", () => {
    const serviceRequest = makeServiceRequest({
      requester: { display: "Dr. Smith", identifier: { value: "ORC-DR001" } },
    });
    const obr = makeOBR({
      $16_orderingProvider: [
        {
          $1_value: "OBR-DR002",
          $2_family: { $1_family: "Jones" },
          $3_given: "Mary",
        },
      ],
    });
    const orc = makeORC({
      $12_orderingProvider: [
        {
          $1_value: "ORC-DR001",
          $2_family: { $1_family: "Smith" },
          $3_given: "John",
        },
      ],
    });

    mergeOBRIntoServiceRequest(obr, serviceRequest, orc);

    // Requester should remain from ORC-12 (not overwritten by OBR-16)
    expect(serviceRequest.requester!.display).toBe("Dr. Smith");
    expect(serviceRequest.requester!.identifier!.value).toBe("ORC-DR001");
  });

  test("ORC-12 empty array treated as not valued -> OBR-16 used", () => {
    const serviceRequest = makeServiceRequest();
    const obr = makeOBR({
      $16_orderingProvider: [
        {
          $1_value: "OBR-DR003",
          $2_family: { $1_family: "Williams" },
          $3_given: "Bob",
        },
      ],
    });
    const orc = makeORC({ $12_orderingProvider: [] });

    mergeOBRIntoServiceRequest(obr, serviceRequest, orc);

    expect(serviceRequest.requester).toBeDefined();
    expect(serviceRequest.requester!.display).toContain("Williams");
  });
});

// ============================================================================
// OBR-31 -> reasonCode
// ============================================================================

describe("OBR-31 -> ServiceRequest.reasonCode", () => {
  test("OBR-31 maps to reasonCode", () => {
    const serviceRequest = makeServiceRequest();
    const reasonCE: CE = { $1_code: "R10.9", $2_text: "Abdominal pain", $3_system: "ICD-10" };
    const obr = makeOBR({ $31_reasonForStudy: [reasonCE] });

    mergeOBRIntoServiceRequest(obr, serviceRequest, makeORC());

    expect(serviceRequest.reasonCode).toBeDefined();
    expect(serviceRequest.reasonCode).toHaveLength(1);
    expect(serviceRequest.reasonCode![0]!.coding![0]!.code).toBe("R10.9");
    expect(serviceRequest.reasonCode![0]!.coding![0]!.display).toBe("Abdominal pain");
  });

  test("multiple OBR-31 entries map to multiple reasonCodes", () => {
    const serviceRequest = makeServiceRequest();
    const reason1: CE = { $1_code: "R10.9", $2_text: "Abdominal pain" };
    const reason2: CE = { $1_code: "K21.0", $2_text: "GERD" };
    const obr = makeOBR({ $31_reasonForStudy: [reason1, reason2] });

    mergeOBRIntoServiceRequest(obr, serviceRequest, makeORC());

    expect(serviceRequest.reasonCode).toHaveLength(2);
  });

  test("empty OBR-31 does not set reasonCode", () => {
    const serviceRequest = makeServiceRequest();
    mergeOBRIntoServiceRequest(makeOBR({ $31_reasonForStudy: undefined }), serviceRequest, makeORC());
    expect(serviceRequest.reasonCode).toBeUndefined();
  });
});

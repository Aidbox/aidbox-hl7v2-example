import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { Task } from "../../src/fhir/hl7-fhir-r4-core/Task";
import type { IncomingHL7v2Message } from "../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";

const sampleTask: Task = {
  resourceType: "Task",
  id: "map-hl7v2-acme-lab-acme-hosp-to-loinc-acme-lab-codes-k-serum",
  status: "requested",
  intent: "order",
  code: {
    coding: [
      {
        system: "http://example.org/task-codes",
        code: "local-to-loinc-mapping",
        display: "Local code to LOINC mapping",
      },
    ],
    text: "Map local lab code to LOINC",
  },
  authoredOn: "2025-02-12T14:20:00Z",
  lastModified: "2025-02-12T14:20:00Z",
  requester: { display: "ORU Processor" },
  owner: { display: "Mapping Team" },
  input: [
    { type: { text: "Sending application" }, valueString: "ACME_LAB" },
    { type: { text: "Sending facility" }, valueString: "ACME_HOSP" },
    { type: { text: "Local code" }, valueString: "K_SERUM" },
    {
      type: { text: "Local display" },
      valueString: "Potassium [Serum/Plasma]",
    },
    { type: { text: "Local system" }, valueString: "ACME-LAB-CODES" },
  ],
};

const sampleMessage: IncomingHL7v2Message = {
  resourceType: "IncomingHL7v2Message",
  id: "msg-001",
  type: "ORU_R01",
  message: "MSH|...",
  status: "mapping_error",
  sendingApplication: "ACME_LAB",
  sendingFacility: "ACME_HOSP",
  unmappedCodes: [
    {
      localCode: "K_SERUM",
      localDisplay: "Potassium [Serum/Plasma]",
      localSystem: "ACME-LAB-CODES",
      mappingTask: {
        reference:
          "Task/map-hl7v2-acme-lab-acme-hosp-to-loinc-acme-lab-codes-k-serum",
      },
    },
  ],
};

describe("generateMappingTaskId", () => {
  test("generates deterministic ID for same inputs", async () => {
    const { generateMappingTaskId } =
      await import("../../src/code-mapping/mapping-task-service");
    const { generateConceptMapId } =
      await import("../../src/code-mapping/concept-map");

    const conceptMapId = generateConceptMapId({
      sendingApplication: "ACME_LAB",
      sendingFacility: "ACME_HOSP",
    });

    const id1 = generateMappingTaskId(
      conceptMapId,
      "ACME-LAB-CODES",
      "K_SERUM",
    );
    const id2 = generateMappingTaskId(
      conceptMapId,
      "ACME-LAB-CODES",
      "K_SERUM",
    );

    expect(id1).toBe(id2);
  });

  test("generates different IDs for different codes", async () => {
    const { generateMappingTaskId } =
      await import("../../src/code-mapping/mapping-task-service");
    const { generateConceptMapId } =
      await import("../../src/code-mapping/concept-map");

    const conceptMapId = generateConceptMapId({
      sendingApplication: "ACME_LAB",
      sendingFacility: "ACME_HOSP",
    });

    const id1 = generateMappingTaskId(
      conceptMapId,
      "ACME-LAB-CODES",
      "K_SERUM",
    );
    const id2 = generateMappingTaskId(
      conceptMapId,
      "ACME-LAB-CODES",
      "NA_SERUM",
    );

    expect(id1).not.toBe(id2);
  });

  test("generates different IDs for different concept maps", async () => {
    const { generateMappingTaskId } =
      await import("../../src/code-mapping/mapping-task-service");
    const { generateConceptMapId } =
      await import("../../src/code-mapping/concept-map");

    const conceptMapId1 = generateConceptMapId({
      sendingApplication: "ACME_LAB",
      sendingFacility: "ACME_HOSP",
    });
    const conceptMapId2 = generateConceptMapId({
      sendingApplication: "OTHER_LAB",
      sendingFacility: "OTHER_HOSP",
    });

    const id1 = generateMappingTaskId(
      conceptMapId1,
      "ACME-LAB-CODES",
      "K_SERUM",
    );
    const id2 = generateMappingTaskId(
      conceptMapId2,
      "ACME-LAB-CODES",
      "K_SERUM",
    );

    expect(id1).not.toBe(id2);
  });

  test("ID format starts with 'map-'", async () => {
    const { generateMappingTaskId } =
      await import("../../src/code-mapping/mapping-task-service");
    const { generateConceptMapId } =
      await import("../../src/code-mapping/concept-map");

    const conceptMapId = generateConceptMapId({
      sendingApplication: "ACME_LAB",
      sendingFacility: "ACME_HOSP",
    });
    const id = generateMappingTaskId(conceptMapId, "ACME-LAB-CODES", "K_SERUM");

    expect(id.startsWith("map-")).toBe(true);
  });
});

describe("resolveMappingTask", () => {
  test("updates task status to completed and adds output", async () => {
    let savedTask: Task | null = null;
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve(structuredClone(sampleTask))),
      putResource: mock((resourceType: string, id: string, resource: Task) => {
        savedTask = resource;
        return Promise.resolve(resource);
      }),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { resolveMappingTask } =
      await import("../../src/code-mapping/mapping-task-service");

    await resolveMappingTask(
      sampleTask.id!,
      "2823-3",
      "Potassium [Moles/volume] in Serum or Plasma",
    );

    expect(savedTask!.status).toBe("completed");
    expect(savedTask!.output).toBeDefined();

    const output = savedTask!.output?.[0];
    expect(output?.type?.text).toBe("Resolved LOINC");
    expect(output?.valueCodeableConcept?.coding?.[0]?.code).toBe("2823-3");
    expect(output?.valueCodeableConcept?.coding?.[0]?.system).toBe(
      "http://loinc.org",
    );
    expect(output?.valueCodeableConcept?.coding?.[0]?.display).toBe(
      "Potassium [Moles/volume] in Serum or Plasma",
    );
  });
});

describe("findAffectedMessages", () => {
  test("queries messages by task reference", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve({
          total: 1,
          entry: [{ resource: sampleMessage }],
        }),
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { findAffectedMessages } =
      await import("../../src/code-mapping/mapping-task-service");

    const results = await findAffectedMessages(sampleTask.id!);

    expect(mockAidbox.aidboxFetch).toHaveBeenCalledWith(
      expect.stringContaining("status=mapping_error"),
    );
    expect(mockAidbox.aidboxFetch).toHaveBeenCalledWith(
      expect.stringContaining("unmapped-task=Task"),
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("msg-001");
  });

  test("returns empty array when no messages found", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve({
          total: 0,
          entry: [],
        }),
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { findAffectedMessages } =
      await import("../../src/code-mapping/mapping-task-service");

    const results = await findAffectedMessages("nonexistent-task");

    expect(results).toHaveLength(0);
  });
});

describe("removeResolvedTaskFromMessage", () => {
  test("removes task entry from unmappedCodes and updates status to received when empty", async () => {
    let updatedMessage: IncomingHL7v2Message | null = null;
    const mockAidbox = {
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleMessage),
          etag: '"version-1"',
        }),
      ),
      updateResourceWithETag: mock(
        (resourceType: string, id: string, resource: IncomingHL7v2Message) => {
          updatedMessage = resource;
          return Promise.resolve(resource);
        },
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { removeResolvedTaskFromMessage } =
      await import("../../src/code-mapping/mapping-task-service");

    await removeResolvedTaskFromMessage(
      sampleMessage,
      "map-hl7v2-acme-lab-acme-hosp-to-loinc-acme-lab-codes-k-serum",
    );

    expect(mockAidbox.updateResourceWithETag).toHaveBeenCalledWith(
      "IncomingHL7v2Message",
      "msg-001",
      expect.any(Object),
      '"version-1"',
    );

    expect(updatedMessage!.unmappedCodes).toHaveLength(0);
    expect(updatedMessage!.status).toBe("received");
  });

  test("keeps status as mapping_error when other unmapped codes remain", async () => {
    const messageWithMultipleUnmapped: IncomingHL7v2Message = {
      ...sampleMessage,
      unmappedCodes: [
        {
          localCode: "K_SERUM",
          localSystem: "ACME-LAB-CODES",
          mappingTask: {
            reference:
              "Task/map-hl7v2-acme-lab-acme-hosp-to-loinc-acme-lab-codes-k-serum",
          },
        },
        {
          localCode: "NA_SERUM",
          localSystem: "ACME-LAB-CODES",
          mappingTask: {
            reference:
              "Task/map-hl7v2-acme-lab-acme-hosp-to-loinc-acme-lab-codes-na-serum",
          },
        },
      ],
    };

    let updatedMessage: IncomingHL7v2Message | null = null;
    const mockAidbox = {
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(messageWithMultipleUnmapped),
          etag: '"version-1"',
        }),
      ),
      updateResourceWithETag: mock(
        (resourceType: string, id: string, resource: IncomingHL7v2Message) => {
          updatedMessage = resource;
          return Promise.resolve(resource);
        },
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { removeResolvedTaskFromMessage } =
      await import("../../src/code-mapping/mapping-task-service");

    await removeResolvedTaskFromMessage(
      messageWithMultipleUnmapped,
      "map-hl7v2-acme-lab-acme-hosp-to-loinc-acme-lab-codes-k-serum",
    );

    expect(updatedMessage!.unmappedCodes).toHaveLength(1);
    expect(updatedMessage!.unmappedCodes![0].localCode).toBe("NA_SERUM");
    expect(updatedMessage!.status).toBe("mapping_error");
  });

  test("uses ETag for optimistic concurrency", async () => {
    const mockAidbox = {
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleMessage),
          etag: '"specific-etag-value"',
        }),
      ),
      updateResourceWithETag: mock(() => Promise.resolve(sampleMessage)),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { removeResolvedTaskFromMessage } =
      await import("../../src/code-mapping/mapping-task-service");

    await removeResolvedTaskFromMessage(
      sampleMessage,
      "map-hl7v2-acme-lab-acme-hosp-to-loinc-acme-lab-codes-k-serum",
    );

    expect(mockAidbox.updateResourceWithETag).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Object),
      '"specific-etag-value"',
    );
  });
});

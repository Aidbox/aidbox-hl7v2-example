import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { Task } from "../../../src/fhir/hl7-fhir-r4-core/Task";
import type { IncomingHL7v2Message } from "../../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import {
  createMappingTask,
  createTaskBundleEntry,
} from "../../../src/code-mapping/mapping-task-service";
import type { SenderContext } from "../../../src/code-mapping/concept-map/lookup";
import { MAPPING_TYPES } from "../../../src/code-mapping/mapping-types";

const sampleTask: Task = {
  resourceType: "Task",
  id: "map-hl7v2-acme-lab-acme-hosp-loinc-acme-lab-codes-k-serum",
  status: "requested",
  intent: "order",
  code: {
    coding: [
      {
        system: "urn:aidbox-hl7v2-converter:task-code",
        code: "loinc-mapping",
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
          "Task/map-hl7v2-acme-lab-acme-hosp-loinc-acme-lab-codes-k-serum",
      },
    },
  ],
};

describe("generateMappingTaskId", () => {
  test("generates deterministic ID for same inputs", async () => {
    const { generateMappingTaskId } =
      await import("../../../src/code-mapping/mapping-task-service");
    const { generateConceptMapId } =
      await import("../../../src/code-mapping/concept-map");

    const conceptMapId = generateConceptMapId(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      "loinc",
    );

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
      await import("../../../src/code-mapping/mapping-task-service");
    const { generateConceptMapId } =
      await import("../../../src/code-mapping/concept-map");

    const conceptMapId = generateConceptMapId(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      "loinc",
    );

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
      await import("../../../src/code-mapping/mapping-task-service");
    const { generateConceptMapId } =
      await import("../../../src/code-mapping/concept-map");

    const conceptMapId1 = generateConceptMapId(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      "loinc",
    );
    const conceptMapId2 = generateConceptMapId(
      { sendingApplication: "OTHER_LAB", sendingFacility: "OTHER_HOSP" },
      "loinc",
    );

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
      await import("../../../src/code-mapping/mapping-task-service");
    const { generateConceptMapId } =
      await import("../../../src/code-mapping/concept-map");

    const conceptMapId = generateConceptMapId(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      "loinc",
    );
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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { resolveMappingTask } =
      await import("../../../src/code-mapping/mapping-task-service");

    await resolveMappingTask(
      sampleTask.id!,
      "2823-3",
      "Potassium [Moles/volume] in Serum or Plasma",
    );

    expect(savedTask!.status).toBe("completed");
    expect(savedTask!.output).toBeDefined();

    const output = savedTask!.output?.[0];
    expect(output?.type?.text).toBe("Resolved mapping");
    expect(output?.valueCodeableConcept?.coding?.[0]?.code).toBe("2823-3");
    expect(output?.valueCodeableConcept?.coding?.[0]?.system).toBe(
      "http://loinc.org",
    );
    expect(output?.valueCodeableConcept?.coding?.[0]?.display).toBe(
      "Potassium [Moles/volume] in Serum or Plasma",
    );
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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { removeResolvedTaskFromMessage } =
      await import("../../../src/code-mapping/mapping-task-service");

    await removeResolvedTaskFromMessage(
      sampleMessage,
      "map-hl7v2-acme-lab-acme-hosp-loinc-acme-lab-codes-k-serum",
    );

    expect(mockAidbox.updateResourceWithETag).toHaveBeenCalledWith(
      "IncomingHL7v2Message",
      "msg-001",
      expect.any(Object),
      '"version-1"',
    );

    expect(updatedMessage!.unmappedCodes).toBeUndefined();
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
              "Task/map-hl7v2-acme-lab-acme-hosp-loinc-acme-lab-codes-k-serum",
          },
        },
        {
          localCode: "NA_SERUM",
          localSystem: "ACME-LAB-CODES",
          mappingTask: {
            reference:
              "Task/map-hl7v2-acme-lab-acme-hosp-loinc-acme-lab-codes-na-serum",
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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { removeResolvedTaskFromMessage } =
      await import("../../../src/code-mapping/mapping-task-service");

    await removeResolvedTaskFromMessage(
      messageWithMultipleUnmapped,
      "map-hl7v2-acme-lab-acme-hosp-loinc-acme-lab-codes-k-serum",
    );

    expect(updatedMessage!.unmappedCodes).toHaveLength(1);
    expect(updatedMessage!.unmappedCodes![0]!.localCode).toBe("NA_SERUM");
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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { removeResolvedTaskFromMessage } =
      await import("../../../src/code-mapping/mapping-task-service");

    await removeResolvedTaskFromMessage(
      sampleMessage,
      "map-hl7v2-acme-lab-acme-hosp-loinc-acme-lab-codes-k-serum",
    );

    expect(mockAidbox.updateResourceWithETag).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Object),
      '"specific-etag-value"',
    );
  });
});

describe("createMappingTask", () => {
  const sender: SenderContext = {
    sendingApplication: "ACME_LAB",
    sendingFacility: "ACME_HOSP",
  };

  test("creates LOINC mapping task with correct code and inputs", () => {
    const task = createMappingTask(
      sender,
      {
        localCode: "K_SERUM",
        localDisplay: "Potassium [Serum/Plasma]",
        localSystem: "ACME-LAB-CODES",
      },
      "loinc",
    );

    expect(task.resourceType).toBe("Task");
    expect(task.status).toBe("requested");
    expect(task.intent).toBe("order");

    // Check task code matches registry
    expect(task.code?.coding?.[0]?.code).toBe("loinc-mapping");
    expect(task.code?.coding?.[0]?.display).toBe("Local code to LOINC mapping");
    expect(task.code?.coding?.[0]?.system).toBe("urn:aidbox-hl7v2-converter:task-code");

    // Check inputs
    const inputs = task.input || [];
    const inputMap = new Map(inputs.map((i) => [i.type?.text, i.valueString]));

    expect(inputMap.get("Sending application")).toBe("ACME_LAB");
    expect(inputMap.get("Sending facility")).toBe("ACME_HOSP");
    expect(inputMap.get("Local code")).toBe("K_SERUM");
    expect(inputMap.get("Local display")).toBe("Potassium [Serum/Plasma]");
    expect(inputMap.get("Local system")).toBe("ACME-LAB-CODES");
    expect(inputMap.get("Source field")).toBe("OBX-3");
    expect(inputMap.get("Target field")).toBe("Observation.code");
  });

  test("creates obr-status mapping task with correct code and fields", () => {
    const task = createMappingTask(
      sender,
      {
        localCode: "Y",
        localDisplay: "Unknown OBR status",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0123",
      },
      "obr-status",
    );

    expect(task.code?.coding?.[0]?.code).toBe("obr-status-mapping");
    expect(task.code?.coding?.[0]?.display).toBe("OBR result status mapping");

    const inputs = task.input || [];
    const inputMap = new Map(inputs.map((i) => [i.type?.text, i.valueString]));

    expect(inputMap.get("Source field")).toBe("OBR-25");
    expect(inputMap.get("Target field")).toBe("DiagnosticReport.status");
  });

  test("creates obx-status mapping task with correct code and fields", () => {
    const task = createMappingTask(
      sender,
      {
        localCode: "N",
        localDisplay: "Unknown OBX status",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0085",
      },
      "obx-status",
    );

    expect(task.code?.coding?.[0]?.code).toBe("obx-status-mapping");
    expect(task.code?.coding?.[0]?.display).toBe("OBX observation status mapping");

    const inputs = task.input || [];
    const inputMap = new Map(inputs.map((i) => [i.type?.text, i.valueString]));

    expect(inputMap.get("Source field")).toBe("OBX-11");
    expect(inputMap.get("Target field")).toBe("Observation.status");
  });

  test("creates patient-class mapping task with correct code and fields", () => {
    const task = createMappingTask(
      sender,
      {
        localCode: "1",
        localDisplay: "Unknown patient class",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0004",
      },
      "patient-class",
    );

    expect(task.code?.coding?.[0]?.code).toBe("patient-class-mapping");
    expect(task.code?.coding?.[0]?.display).toBe("Patient class mapping");

    const inputs = task.input || [];
    const inputMap = new Map(inputs.map((i) => [i.type?.text, i.valueString]));

    expect(inputMap.get("Source field")).toBe("PV1.2");
    expect(inputMap.get("Target field")).toBe("Encounter.class");
  });

  test("generates deterministic task ID including mapping type", () => {
    const task1 = createMappingTask(
      sender,
      { localCode: "TEST", localSystem: "LOCAL" },
      "loinc",
    );
    const task2 = createMappingTask(
      sender,
      { localCode: "TEST", localSystem: "LOCAL" },
      "loinc",
    );
    const task3 = createMappingTask(
      sender,
      { localCode: "TEST", localSystem: "LOCAL" },
      "obr-status",
    );

    // Same inputs, same mapping type -> same ID
    expect(task1.id).toBe(task2.id);

    // Same inputs, different mapping type -> different ID (due to different conceptMapId)
    expect(task1.id).not.toBe(task3.id);
  });

  test("omits optional fields when not provided", () => {
    const task = createMappingTask(
      sender,
      { localCode: "TEST", localSystem: "LOCAL" }, // No localDisplay
      "loinc",
    );

    const inputs = task.input || [];
    const inputMap = new Map(inputs.map((i) => [i.type?.text, i.valueString]));

    expect(inputMap.has("Local display")).toBe(false);
    expect(inputMap.get("Local code")).toBe("TEST");
    expect(inputMap.get("Local system")).toBe("LOCAL");
  });

  test("includes authoredOn and lastModified timestamps", () => {
    const task = createMappingTask(
      sender,
      { localCode: "TEST", localSystem: "LOCAL" },
      "loinc",
    );

    expect(task.authoredOn).toBeDefined();
    expect(task.lastModified).toBeDefined();
    expect(task.authoredOn).toBe(task.lastModified);
  });

  test("sets requester and owner", () => {
    const task = createMappingTask(
      sender,
      { localCode: "TEST", localSystem: "LOCAL" },
      "loinc",
    );

    expect(task.requester?.display).toBe("ORU Processor");
    expect(task.owner?.display).toBe("Mapping Team");
  });
});

describe("createTaskBundleEntry", () => {
  test("creates PUT bundle entry for task", () => {
    const task: Task = {
      resourceType: "Task",
      id: "test-task-123",
      status: "requested",
      intent: "order",
    };

    const entry = createTaskBundleEntry(task);

    expect(entry.resource).toBe(task);
    expect(entry.request?.method).toBe("PUT");
    expect(entry.request?.url).toBe("Task/test-task-123");
  });
});

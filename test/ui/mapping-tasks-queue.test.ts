/**
 * Tests for Mapping Tasks Queue - Task Resolution
 *
 * Covers:
 * - Atomic bundle transaction (Task + ConceptMap)
 * - ETag concurrency control
 * - Integration: resolve flow, message updates, edge cases
 */
import { describe, test, expect, beforeEach, mock, afterEach } from "bun:test";
import type {
  Task,
  TaskInput,
  TaskOutput,
} from "../../src/fhir/hl7-fhir-r4-core/Task";
import type { ConceptMap } from "../../src/fhir/hl7-fhir-r4-core/ConceptMap";
import type { IncomingHL7v2Message } from "../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";

interface Bundle<T> {
  total?: number;
  entry?: Array<{ resource: T }>;
}

const samplePendingTask: Task = {
  resourceType: "Task",
  id: "map-hl7v2-acme-lab-acme-hosp-to-loinc-1a2b3c-4d5e6f",
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
    { type: { text: "Sample value" }, valueString: "4.2" },
    { type: { text: "Sample units" }, valueString: "mmol/L" },
  ],
};

const sampleConceptMap: ConceptMap = {
  resourceType: "ConceptMap",
  id: "hl7v2-acme-lab-acme-hosp-to-loinc",
  name: "HL7v2 ACME_LAB/ACME_HOSP to LOINC",
  status: "active",
  sourceUri: "http://example.org/fhir/CodeSystem/hl7v2-acme-lab-acme-hosp",
  targetUri: "http://loinc.org",
  group: [],
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
        reference: "Task/map-hl7v2-acme-lab-acme-hosp-to-loinc-1a2b3c-4d5e6f",
      },
    },
  ],
};

const sampleMessageWithMultipleUnmapped: IncomingHL7v2Message = {
  ...sampleMessage,
  id: "msg-002",
  unmappedCodes: [
    {
      localCode: "K_SERUM",
      localSystem: "ACME-LAB-CODES",
      mappingTask: {
        reference: "Task/map-hl7v2-acme-lab-acme-hosp-to-loinc-1a2b3c-4d5e6f",
      },
    },
    {
      localCode: "NA_SERUM",
      localSystem: "ACME-LAB-CODES",
      mappingTask: {
        reference: "Task/map-hl7v2-acme-lab-acme-hosp-to-loinc-7g8h9i-0j1k2l",
      },
    },
  ],
};

describe("resolveTaskWithMapping", () => {
  afterEach(() => {
    mock.restore();
  });

  test("executes atomic bundle with Task update and ConceptMap entry", async () => {
    let executedBundle: any = null;

    const mockAidbox = {
      aidboxFetch: mock((path: string, options?: RequestInit) => {
        if (path === "/fhir" && options?.method === "POST") {
          executedBundle = JSON.parse(options.body as string);
          return Promise.resolve({
            type: "transaction-response",
            entry: [
              { response: { status: "200 OK" } },
              { response: { status: "200 OK" } },
            ],
          });
        }
        if (path.includes("/fhir/Task/")) {
          return Promise.resolve(structuredClone(samplePendingTask));
        }
        if (path.includes("/fhir/ConceptMap/")) {
          return Promise.resolve(structuredClone(sampleConceptMap));
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock((resourceType: string, id: string) => {
        if (resourceType === "Task") {
          return Promise.resolve({
            resource: structuredClone(samplePendingTask),
            etag: '"task-v1"',
          });
        }
        if (resourceType === "ConceptMap") {
          return Promise.resolve({
            resource: structuredClone(sampleConceptMap),
            etag: '"cm-v1"',
          });
        }
        return Promise.resolve({ resource: {}, etag: '""' });
      }),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
      updateResourceWithETag: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { resolveTaskWithMapping } =
      await import("../../src/ui/mapping-tasks-queue");

    await resolveTaskWithMapping(
      samplePendingTask.id!,
      "2823-3",
      "Potassium [Moles/volume] in Serum or Plasma",
    );

    expect(executedBundle).not.toBeNull();
    expect(executedBundle.type).toBe("transaction");
    expect(executedBundle.entry).toHaveLength(2);

    const taskEntry = executedBundle.entry.find(
      (e: any) => e.resource?.resourceType === "Task",
    );
    expect(taskEntry).toBeDefined();
    expect(taskEntry.resource.status).toBe("completed");
    expect(taskEntry.resource.output).toBeDefined();
    expect(
      taskEntry.resource.output[0].valueCodeableConcept.coding[0].code,
    ).toBe("2823-3");
    expect(taskEntry.request.method).toBe("PUT");
    expect(taskEntry.request.ifMatch).toBe('"task-v1"');

    const conceptMapEntry = executedBundle.entry.find(
      (e: any) => e.resource?.resourceType === "ConceptMap",
    );
    expect(conceptMapEntry).toBeDefined();
    expect(conceptMapEntry.request.method).toBe("PUT");
    expect(conceptMapEntry.request.ifMatch).toBe('"cm-v1"');
  });

  test("adds new mapping entry to existing ConceptMap group", async () => {
    let executedBundle: any = null;

    const existingConceptMap: ConceptMap = {
      ...sampleConceptMap,
      group: [
        {
          source: "ACME-LAB-CODES",
          target: "http://loinc.org",
          element: [
            {
              code: "EXISTING_CODE",
              display: "Existing Test",
              target: [
                {
                  code: "12345-6",
                  display: "Existing LOINC",
                  equivalence: "equivalent",
                },
              ],
            },
          ],
        },
      ],
    };

    const mockAidbox = {
      aidboxFetch: mock((path: string, options?: RequestInit) => {
        if (path === "/fhir" && options?.method === "POST") {
          executedBundle = JSON.parse(options.body as string);
          return Promise.resolve({ type: "transaction-response", entry: [] });
        }
        if (path.includes("/fhir/Task/")) {
          return Promise.resolve(structuredClone(samplePendingTask));
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock((resourceType: string) => {
        if (resourceType === "Task") {
          return Promise.resolve({
            resource: structuredClone(samplePendingTask),
            etag: '"v1"',
          });
        }
        if (resourceType === "ConceptMap") {
          return Promise.resolve({
            resource: structuredClone(existingConceptMap),
            etag: '"v1"',
          });
        }
        return Promise.resolve({ resource: {}, etag: '""' });
      }),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
      updateResourceWithETag: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { resolveTaskWithMapping } =
      await import("../../src/ui/mapping-tasks-queue");

    await resolveTaskWithMapping(samplePendingTask.id!, "2823-3", "Potassium");

    const conceptMapEntry = executedBundle.entry.find(
      (e: any) => e.resource?.resourceType === "ConceptMap",
    );
    const group = conceptMapEntry.resource.group.find(
      (g: any) => g.source === "ACME-LAB-CODES",
    );

    expect(group.element).toHaveLength(2);
    expect(group.element.some((e: any) => e.code === "EXISTING_CODE")).toBe(
      true,
    );
    expect(group.element.some((e: any) => e.code === "K_SERUM")).toBe(true);
  });

  test("creates new group when local system not found", async () => {
    let executedBundle: any = null;

    const mockAidbox = {
      aidboxFetch: mock((path: string, options?: RequestInit) => {
        if (path === "/fhir" && options?.method === "POST") {
          executedBundle = JSON.parse(options.body as string);
          return Promise.resolve({ type: "transaction-response", entry: [] });
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock((resourceType: string) => {
        if (resourceType === "Task") {
          return Promise.resolve({
            resource: structuredClone(samplePendingTask),
            etag: '"v1"',
          });
        }
        if (resourceType === "ConceptMap") {
          return Promise.resolve({
            resource: structuredClone(sampleConceptMap),
            etag: '"v1"',
          });
        }
        return Promise.resolve({ resource: {}, etag: '""' });
      }),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
      updateResourceWithETag: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { resolveTaskWithMapping } =
      await import("../../src/ui/mapping-tasks-queue");

    await resolveTaskWithMapping(samplePendingTask.id!, "2823-3", "Potassium");

    const conceptMapEntry = executedBundle.entry.find(
      (e: any) => e.resource?.resourceType === "ConceptMap",
    );

    expect(conceptMapEntry.resource.group).toHaveLength(1);
    expect(conceptMapEntry.resource.group[0].source).toBe("ACME-LAB-CODES");
    expect(conceptMapEntry.resource.group[0].target).toBe("http://loinc.org");
    expect(conceptMapEntry.resource.group[0].element).toHaveLength(1);
    expect(conceptMapEntry.resource.group[0].element[0].code).toBe("K_SERUM");
  });

  test("creates new ConceptMap when none exists (404)", async () => {
    let executedBundle: any = null;

    const mockAidbox = {
      aidboxFetch: mock((path: string, options?: RequestInit) => {
        if (path === "/fhir" && options?.method === "POST") {
          executedBundle = JSON.parse(options.body as string);
          return Promise.resolve({ type: "transaction-response", entry: [] });
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock((resourceType: string) => {
        if (resourceType === "Task") {
          return Promise.resolve({
            resource: structuredClone(samplePendingTask),
            etag: '"v1"',
          });
        }
        if (resourceType === "ConceptMap") {
          return Promise.reject(new Error("HTTP 404: Not Found"));
        }
        return Promise.resolve({ resource: {}, etag: '""' });
      }),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
      updateResourceWithETag: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { resolveTaskWithMapping } =
      await import("../../src/ui/mapping-tasks-queue");

    await resolveTaskWithMapping(samplePendingTask.id!, "2823-3", "Potassium");

    const conceptMapEntry = executedBundle.entry.find(
      (e: any) => e.resource?.resourceType === "ConceptMap",
    );

    expect(conceptMapEntry).toBeDefined();
    expect(conceptMapEntry.resource.resourceType).toBe("ConceptMap");
    expect(conceptMapEntry.resource.status).toBe("active");
    expect(conceptMapEntry.request.ifNoneMatch).toBe("*");
  });

  test("throws PreconditionFailedError on ETag mismatch (412)", async () => {
    const mockAidbox = {
      aidboxFetch: mock((path: string, options?: RequestInit) => {
        if (path === "/fhir" && options?.method === "POST") {
          return Promise.reject(new Error("HTTP 412: Precondition Failed"));
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock((resourceType: string) => {
        return Promise.resolve({
          resource:
            resourceType === "Task"
              ? structuredClone(samplePendingTask)
              : structuredClone(sampleConceptMap),
          etag: '"v1"',
        });
      }),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
      updateResourceWithETag: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      PreconditionFailedError: class extends Error {
        constructor(msg: string) {
          super(msg);
          this.name = "PreconditionFailedError";
        }
      },
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { resolveTaskWithMapping } =
      await import("../../src/ui/mapping-tasks-queue");

    await expect(
      resolveTaskWithMapping(samplePendingTask.id!, "2823-3", "Potassium"),
    ).rejects.toThrow("412");
  });

  test("extracts sender info from Task.input", async () => {
    let executedBundle: any = null;

    const mockAidbox = {
      aidboxFetch: mock((path: string, options?: RequestInit) => {
        if (path === "/fhir" && options?.method === "POST") {
          executedBundle = JSON.parse(options.body as string);
          return Promise.resolve({ type: "transaction-response", entry: [] });
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock((resourceType: string) => {
        if (resourceType === "Task") {
          return Promise.resolve({
            resource: structuredClone(samplePendingTask),
            etag: '"v1"',
          });
        }
        if (resourceType === "ConceptMap") {
          return Promise.resolve({
            resource: structuredClone(sampleConceptMap),
            etag: '"v1"',
          });
        }
        return Promise.resolve({ resource: {}, etag: '""' });
      }),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
      updateResourceWithETag: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { resolveTaskWithMapping } =
      await import("../../src/ui/mapping-tasks-queue");

    await resolveTaskWithMapping(samplePendingTask.id!, "2823-3", "Potassium");

    const conceptMapEntry = executedBundle.entry.find(
      (e: any) => e.resource?.resourceType === "ConceptMap",
    );

    expect(conceptMapEntry.resource.id).toContain("acme");
  });
});

describe("resolveTaskWithMapping - already completed task", () => {
  afterEach(() => {
    mock.restore();
  });

  test("throws error when task is already completed", async () => {
    const completedTask: Task = {
      ...samplePendingTask,
      status: "completed",
      output: [
        {
          type: { text: "Resolved LOINC" },
          valueCodeableConcept: {
            coding: [
              {
                system: "http://loinc.org",
                code: "12345-6",
                display: "Already mapped",
              },
            ],
          },
        },
      ],
    };

    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve({})),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: completedTask,
          etag: '"v1"',
        }),
      ),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
      updateResourceWithETag: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { resolveTaskWithMapping } =
      await import("../../src/ui/mapping-tasks-queue");

    await expect(
      resolveTaskWithMapping(samplePendingTask.id!, "2823-3", "Potassium"),
    ).rejects.toThrow(/already completed/i);
  });
});

describe("updateAffectedMessages", () => {
  afterEach(() => {
    mock.restore();
  });

  test("removes resolved task from message unmappedCodes", async () => {
    let updatedMessage: IncomingHL7v2Message | null = null;

    const mockAidbox = {
      aidboxFetch: mock((path: string) => {
        if (path.includes("IncomingHL7v2Message?")) {
          return Promise.resolve({
            entry: [{ resource: structuredClone(sampleMessage) }],
          });
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleMessage),
          etag: '"msg-v1"',
        }),
      ),
      updateResourceWithETag: mock(
        (
          resourceType: string,
          id: string,
          resource: IncomingHL7v2Message,
          etag: string,
        ) => {
          updatedMessage = resource;
          return Promise.resolve(resource);
        },
      ),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { updateAffectedMessages } =
      await import("../../src/ui/mapping-tasks-queue");

    await updateAffectedMessages(samplePendingTask.id!);

    expect(updatedMessage).not.toBeNull();
    expect(updatedMessage!.unmappedCodes).toBeUndefined();
    expect(updatedMessage!.status).toBe("received");
  });

  test("changes status to received when all unmappedCodes removed", async () => {
    let updatedMessage: IncomingHL7v2Message | null = null;

    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve({
          entry: [{ resource: structuredClone(sampleMessage) }],
        }),
      ),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleMessage),
          etag: '"v1"',
        }),
      ),
      updateResourceWithETag: mock(
        (rt: string, id: string, resource: IncomingHL7v2Message) => {
          updatedMessage = resource;
          return Promise.resolve(resource);
        },
      ),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { updateAffectedMessages } =
      await import("../../src/ui/mapping-tasks-queue");

    await updateAffectedMessages(
      "map-hl7v2-acme-lab-acme-hosp-to-loinc-1a2b3c-4d5e6f",
    );

    expect(updatedMessage!.status).toBe("received");
  });

  test("keeps mapping_error status when other unmappedCodes remain", async () => {
    let updatedMessage: IncomingHL7v2Message | null = null;

    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve({
          entry: [
            { resource: structuredClone(sampleMessageWithMultipleUnmapped) },
          ],
        }),
      ),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleMessageWithMultipleUnmapped),
          etag: '"v1"',
        }),
      ),
      updateResourceWithETag: mock(
        (rt: string, id: string, resource: IncomingHL7v2Message) => {
          updatedMessage = resource;
          return Promise.resolve(resource);
        },
      ),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { updateAffectedMessages } =
      await import("../../src/ui/mapping-tasks-queue");

    await updateAffectedMessages(
      "map-hl7v2-acme-lab-acme-hosp-to-loinc-1a2b3c-4d5e6f",
    );

    expect(updatedMessage!.unmappedCodes).toHaveLength(1);
    expect(updatedMessage!.unmappedCodes![0].localCode).toBe("NA_SERUM");
    expect(updatedMessage!.status).toBe("mapping_error");
  });

  test("uses ETag for optimistic concurrency on message update", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve({
          entry: [{ resource: structuredClone(sampleMessage) }],
        }),
      ),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleMessage),
          etag: '"specific-etag"',
        }),
      ),
      updateResourceWithETag: mock(() => Promise.resolve(sampleMessage)),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { updateAffectedMessages } =
      await import("../../src/ui/mapping-tasks-queue");

    await updateAffectedMessages(samplePendingTask.id!);

    expect(mockAidbox.updateResourceWithETag).toHaveBeenCalledWith(
      "IncomingHL7v2Message",
      "msg-001",
      expect.any(Object),
      '"specific-etag"',
    );
  });

  test("handles no affected messages gracefully", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve({
          entry: [],
        }),
      ),
      getResourceWithETag: mock(),
      updateResourceWithETag: mock(),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { updateAffectedMessages } =
      await import("../../src/ui/mapping-tasks-queue");

    // Should not throw when no affected messages
    await updateAffectedMessages("nonexistent-task");

    expect(mockAidbox.getResourceWithETag).not.toHaveBeenCalled();
    expect(mockAidbox.updateResourceWithETag).not.toHaveBeenCalled();
  });

  test("handles message without unmappedCodes array", async () => {
    const messageWithoutUnmapped: IncomingHL7v2Message = {
      ...sampleMessage,
      unmappedCodes: undefined,
    };

    let updatedMessage: IncomingHL7v2Message | null = null;

    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve({
          entry: [{ resource: structuredClone(messageWithoutUnmapped) }],
        }),
      ),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(messageWithoutUnmapped),
          etag: '"v1"',
        }),
      ),
      updateResourceWithETag: mock(
        (rt: string, id: string, resource: IncomingHL7v2Message) => {
          updatedMessage = resource;
          return Promise.resolve(resource);
        },
      ),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { updateAffectedMessages } =
      await import("../../src/ui/mapping-tasks-queue");

    await updateAffectedMessages(samplePendingTask.id!);

    expect(updatedMessage!.unmappedCodes).toBeUndefined();
    expect(updatedMessage!.status).toBe("received");
  });
});

describe("getTaskInputValue - helper function", () => {
  afterEach(() => {
    mock.restore();
  });

  const mockAidboxBase = {
    aidboxFetch: mock(() => Promise.resolve({})),
    getResourceWithETag: mock(() =>
      Promise.resolve({ resource: {}, etag: '""' }),
    ),
    putResource: mock((rt: string, id: string, resource: any) =>
      Promise.resolve(resource),
    ),
    getResources: mock(() => Promise.resolve([])),
    updateResourceWithETag: mock((rt: string, id: string, resource: any) =>
      Promise.resolve(resource),
    ),
  };

  test("extracts input value by type text", async () => {
    mock.module("../../src/aidbox", () => mockAidboxBase);
    const { getTaskInputValue } =
      await import("../../src/ui/mapping-tasks-queue");

    const result = getTaskInputValue(samplePendingTask, "Local code");
    expect(result).toBe("K_SERUM");
  });

  test("returns undefined for missing input type", async () => {
    mock.module("../../src/aidbox", () => mockAidboxBase);
    const { getTaskInputValue } =
      await import("../../src/ui/mapping-tasks-queue");

    const result = getTaskInputValue(samplePendingTask, "Nonexistent");
    expect(result).toBeUndefined();
  });

  test("returns undefined when task has no inputs", async () => {
    mock.module("../../src/aidbox", () => mockAidboxBase);
    const { getTaskInputValue } =
      await import("../../src/ui/mapping-tasks-queue");

    const taskWithoutInputs: Task = {
      ...samplePendingTask,
      input: undefined,
    };

    const result = getTaskInputValue(taskWithoutInputs, "Local code");
    expect(result).toBeUndefined();
  });
});

describe("full resolution flow integration", () => {
  afterEach(() => {
    mock.restore();
  });

  test("resolves task, creates mapping, and updates messages in sequence", async () => {
    const calls: string[] = [];
    let executedBundle: any = null;
    let updatedMessage: IncomingHL7v2Message | null = null;

    const mockAidbox = {
      aidboxFetch: mock((path: string, options?: RequestInit) => {
        calls.push(`aidboxFetch:${path}`);
        if (path === "/fhir" && options?.method === "POST") {
          executedBundle = JSON.parse(options.body as string);
          return Promise.resolve({ type: "transaction-response", entry: [] });
        }
        if (path.includes("IncomingHL7v2Message?")) {
          return Promise.resolve({
            entry: [{ resource: structuredClone(sampleMessage) }],
          });
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock((resourceType: string, id: string) => {
        calls.push(`getResourceWithETag:${resourceType}/${id}`);
        if (resourceType === "Task") {
          return Promise.resolve({
            resource: structuredClone(samplePendingTask),
            etag: '"task-v1"',
          });
        }
        if (resourceType === "ConceptMap") {
          return Promise.resolve({
            resource: structuredClone(sampleConceptMap),
            etag: '"cm-v1"',
          });
        }
        if (resourceType === "IncomingHL7v2Message") {
          return Promise.resolve({
            resource: structuredClone(sampleMessage),
            etag: '"msg-v1"',
          });
        }
        return Promise.resolve({ resource: {}, etag: '""' });
      }),
      updateResourceWithETag: mock((rt: string, id: string, resource: any) => {
        calls.push(`updateResourceWithETag:${rt}/${id}`);
        if (rt === "IncomingHL7v2Message") {
          updatedMessage = resource;
        }
        return Promise.resolve(resource);
      }),
      putResource: mock((rt: string, id: string, resource: any) =>
        Promise.resolve(resource),
      ),
      getResources: mock(() => Promise.resolve([])),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { resolveTaskAndUpdateMessages } =
      await import("../../src/ui/mapping-tasks-queue");

    await resolveTaskAndUpdateMessages(
      samplePendingTask.id!,
      "2823-3",
      "Potassium [Moles/volume] in Serum or Plasma",
    );

    expect(executedBundle).not.toBeNull();
    expect(executedBundle.type).toBe("transaction");

    const taskInBundle = executedBundle.entry.find(
      (e: any) => e.resource?.resourceType === "Task",
    );
    expect(taskInBundle.resource.status).toBe("completed");

    expect(updatedMessage).not.toBeNull();
    expect(updatedMessage!.unmappedCodes).toBeUndefined();
    expect(updatedMessage!.status).toBe("received");

    const bundleCallIndex = calls.findIndex((c) =>
      c.includes("aidboxFetch:/fhir"),
    );
    const messageUpdateIndex = calls.findIndex((c) =>
      c.includes("updateResourceWithETag:IncomingHL7v2Message"),
    );
    expect(bundleCallIndex).toBeLessThan(messageUpdateIndex);
  });
});

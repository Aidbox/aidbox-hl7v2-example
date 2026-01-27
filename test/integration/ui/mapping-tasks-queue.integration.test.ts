/**
 * Integration tests for Mapping Tasks Queue.
 *
 * These tests verify task resolution and message updates against a real Aidbox instance.
 * They test: task resolution → ConceptMap creation/update → affected message updates.
 */
import { describe, test, expect } from "bun:test";
import {
  testAidboxFetch,
  createTestConceptMap,
} from "../helpers";
import {
  resolveTaskWithMapping,
  updateAffectedMessages,
  resolveTaskAndUpdateMessages,
} from "../../../src/ui/mapping-tasks-queue";
import type { Task } from "../../../src/fhir/hl7-fhir-r4-core/Task";
import type { ConceptMap } from "../../../src/fhir/hl7-fhir-r4-core/ConceptMap";
import type { IncomingHL7v2Message } from "../../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";

async function createPendingTask(
  id: string,
  options: {
    sendingApplication?: string;
    sendingFacility?: string;
    localCode?: string;
    localDisplay?: string;
    localSystem?: string;
  } = {},
): Promise<Task> {
  const {
    sendingApplication = "ACME_LAB",
    sendingFacility = "ACME_HOSP",
    localCode = "K_SERUM",
    localDisplay = "Potassium [Serum/Plasma]",
    localSystem = "ACME-LAB-CODES",
  } = options;

  return testAidboxFetch<Task>(`/fhir/Task/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      resourceType: "Task",
      id,
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
        { type: { text: "Sending application" }, valueString: sendingApplication },
        { type: { text: "Sending facility" }, valueString: sendingFacility },
        { type: { text: "Local code" }, valueString: localCode },
        { type: { text: "Local display" }, valueString: localDisplay },
        { type: { text: "Local system" }, valueString: localSystem },
        { type: { text: "Sample value" }, valueString: "4.2" },
        { type: { text: "Sample units" }, valueString: "mmol/L" },
      ],
    }),
  });
}

async function createCompletedTask(id: string): Promise<Task> {
  return testAidboxFetch<Task>(`/fhir/Task/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      resourceType: "Task",
      id,
      status: "completed",
      intent: "order",
      code: {
        coding: [
          {
            system: "http://example.org/task-codes",
            code: "local-to-loinc-mapping",
          },
        ],
      },
      input: [
        { type: { text: "Sending application" }, valueString: "ACME_LAB" },
        { type: { text: "Sending facility" }, valueString: "ACME_HOSP" },
        { type: { text: "Local code" }, valueString: "K_SERUM" },
        { type: { text: "Local system" }, valueString: "ACME-LAB-CODES" },
      ],
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
    }),
  });
}

async function createMappingErrorMessage(
  id: string,
  taskId: string,
  options: {
    localCode?: string;
    localSystem?: string;
    extraUnmappedCodes?: Array<{
      localCode: string;
      localSystem: string;
      taskId: string;
    }>;
  } = {},
): Promise<IncomingHL7v2Message> {
  const { localCode = "K_SERUM", localSystem = "ACME-LAB-CODES" } = options;

  const unmappedCodes = [
    {
      localCode,
      localDisplay: "Potassium [Serum/Plasma]",
      localSystem,
      mappingTask: { reference: `Task/${taskId}` },
    },
    ...(options.extraUnmappedCodes ?? []).map((c) => ({
      localCode: c.localCode,
      localSystem: c.localSystem,
      mappingTask: { reference: `Task/${c.taskId}` },
    })),
  ];

  return testAidboxFetch<IncomingHL7v2Message>(
    `/fhir/IncomingHL7v2Message/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        resourceType: "IncomingHL7v2Message",
        id,
        type: "ORU^R01",
        message: "MSH|^~\\&|ACME_LAB|ACME_HOSP|||20250212||ORU^R01|MSG001|P|2.5",
        status: "mapping_error",
        sendingApplication: "ACME_LAB",
        sendingFacility: "ACME_HOSP",
        unmappedCodes,
      }),
    },
  );
}

async function fetchTask(id: string): Promise<Task> {
  return testAidboxFetch<Task>(`/fhir/Task/${id}`);
}

async function fetchConceptMap(id: string): Promise<ConceptMap> {
  return testAidboxFetch<ConceptMap>(`/fhir/ConceptMap/${id}`);
}

async function fetchMessage(id: string): Promise<IncomingHL7v2Message> {
  return testAidboxFetch<IncomingHL7v2Message>(
    `/fhir/IncomingHL7v2Message/${id}`,
  );
}

describe("Mapping Tasks Queue E2E Integration", () => {
  describe("resolveTaskWithMapping", () => {
    test("completes Task and creates ConceptMap with mapping entry", async () => {
      await createPendingTask("task-resolve-1");

      await resolveTaskWithMapping(
        "task-resolve-1",
        "2823-3",
        "Potassium [Moles/volume] in Serum or Plasma",
      );

      const task = await fetchTask("task-resolve-1");
      expect(task.status).toBe("completed");
      expect(task.output).toBeDefined();
      expect(task.output![0]!.valueCodeableConcept!.coding![0]!.code).toBe("2823-3");

      const conceptMap = await fetchConceptMap("hl7v2-acme-lab-acme-hosp-to-loinc");
      expect(conceptMap).toBeDefined();
      expect(conceptMap.status).toBe("active");

      const group = conceptMap.group?.find(
        (g) => g.source === "ACME-LAB-CODES",
      );
      expect(group).toBeDefined();
      expect(group!.element!.some((e) => e.code === "K_SERUM")).toBe(true);

      const element = group!.element!.find((e) => e.code === "K_SERUM");
      expect(element!.target![0]!.code).toBe("2823-3");
    });

    test("adds new mapping entry to existing ConceptMap group", async () => {
      await createTestConceptMap("ACME_LAB", "ACME_HOSP", [
        {
          localCode: "EXISTING_CODE",
          localSystem: "ACME-LAB-CODES",
          loincCode: "12345-6",
          loincDisplay: "Existing LOINC",
        },
      ]);

      await createPendingTask("task-resolve-2");

      await resolveTaskWithMapping("task-resolve-2", "2823-3", "Potassium");

      const conceptMap = await fetchConceptMap("hl7v2-acme-lab-acme-hosp-to-loinc");
      const group = conceptMap.group?.find(
        (g) => g.source === "ACME-LAB-CODES",
      );

      expect(group!.element!.length).toBe(2);
      expect(group!.element!.some((e) => e.code === "EXISTING_CODE")).toBe(true);
      expect(group!.element!.some((e) => e.code === "K_SERUM")).toBe(true);
    });

    test("creates new group when local system not found in ConceptMap", async () => {
      await createTestConceptMap("ACME_LAB", "ACME_HOSP", [
        {
          localCode: "OTHER_CODE",
          localSystem: "OTHER-SYSTEM",
          loincCode: "99999-9",
          loincDisplay: "Other",
        },
      ]);

      await createPendingTask("task-resolve-3");

      await resolveTaskWithMapping("task-resolve-3", "2823-3", "Potassium");

      const conceptMap = await fetchConceptMap("hl7v2-acme-lab-acme-hosp-to-loinc");
      const acmeGroup = conceptMap.group?.find(
        (g) => g.source === "ACME-LAB-CODES",
      );
      const otherGroup = conceptMap.group?.find(
        (g) => g.source === "OTHER-SYSTEM",
      );

      expect(acmeGroup).toBeDefined();
      expect(otherGroup).toBeDefined();
      expect(acmeGroup!.element![0]!.code).toBe("K_SERUM");
    });

    test("creates new ConceptMap when none exists", async () => {
      await createPendingTask("task-resolve-new-cm", {
        sendingApplication: "NEW_LAB",
        sendingFacility: "NEW_HOSP",
      });

      await resolveTaskWithMapping("task-resolve-new-cm", "2823-3", "Potassium");

      const conceptMap = await fetchConceptMap("hl7v2-new-lab-new-hosp-to-loinc");
      expect(conceptMap).toBeDefined();
      expect(conceptMap.resourceType).toBe("ConceptMap");
      expect(conceptMap.status).toBe("active");
      expect(conceptMap.group!.length).toBe(1);
      expect(conceptMap.group![0]!.element![0]!.code).toBe("K_SERUM");
    });

    test("throws error when task is already completed", async () => {
      await createCompletedTask("task-already-done");

      await expect(
        resolveTaskWithMapping("task-already-done", "2823-3", "Potassium"),
      ).rejects.toThrow(/already completed/i);
    });
  });

  describe("updateAffectedMessages", () => {
    test("removes resolved task from message unmappedCodes and sets status to received", async () => {
      await createPendingTask("task-msg-1");
      await createMappingErrorMessage("msg-affected-1", "task-msg-1");

      await updateAffectedMessages("task-msg-1");

      const message = await fetchMessage("msg-affected-1");
      expect(message.unmappedCodes).toBeUndefined();
      expect(message.status).toBe("received");
    });

    test("keeps mapping_error status when other unmappedCodes remain", async () => {
      await createPendingTask("task-msg-partial");
      await createPendingTask("task-msg-other", { localCode: "NA_SERUM" });
      await createMappingErrorMessage("msg-partial", "task-msg-partial", {
        extraUnmappedCodes: [
          {
            localCode: "NA_SERUM",
            localSystem: "ACME-LAB-CODES",
            taskId: "task-msg-other",
          },
        ],
      });

      await updateAffectedMessages("task-msg-partial");

      const message = await fetchMessage("msg-partial");
      expect(message.unmappedCodes).toHaveLength(1);
      expect(message.unmappedCodes![0]!.localCode).toBe("NA_SERUM");
      expect(message.status).toBe("mapping_error");
    });

    test("handles no affected messages gracefully", async () => {
      // Should not throw when no affected messages exist
      await updateAffectedMessages("nonexistent-task-id");
    });
  });

  describe("resolveTaskAndUpdateMessages (full flow)", () => {
    test("resolves task, creates mapping, and updates messages", async () => {
      await createPendingTask("task-full-flow");
      await createMappingErrorMessage("msg-full-flow", "task-full-flow");

      await resolveTaskAndUpdateMessages(
        "task-full-flow",
        "2823-3",
        "Potassium [Moles/volume] in Serum or Plasma",
      );

      const task = await fetchTask("task-full-flow");
      expect(task.status).toBe("completed");
      expect(task.output![0]!.valueCodeableConcept!.coding![0]!.code).toBe("2823-3");

      const conceptMap = await fetchConceptMap("hl7v2-acme-lab-acme-hosp-to-loinc");
      expect(conceptMap).toBeDefined();

      const message = await fetchMessage("msg-full-flow");
      expect(message.unmappedCodes).toBeUndefined();
      expect(message.status).toBe("received");
    });
  });
});

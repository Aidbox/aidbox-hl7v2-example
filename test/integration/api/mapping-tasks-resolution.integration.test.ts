/**
 * Integration tests for task resolution with validation.
 *
 * Tests the task resolution flow with type detection and validation for different mapping types.
 * Tests the underlying functions directly since the HTTP routing is trivial.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  aidboxFetch,
  cleanupTestResources,
} from "../helpers";
import type { Task } from "../../../src/fhir/hl7-fhir-r4-core/Task";
import type { ConceptMap } from "../../../src/fhir/hl7-fhir-r4-core/ConceptMap";
import { MAPPING_TYPES, type MappingTypeName, isMappingTypeName } from "../../../src/code-mapping/mapping-types";
import { validateResolvedCode } from "../../../src/code-mapping/validation";
import { resolveTaskAndUpdateMessages } from "../../../src/api/task-resolution";

// ============================================================================
// Test Helpers
// ============================================================================

async function createTaskForType(
  id: string,
  mappingType: MappingTypeName,
  options: {
    localCode?: string;
    localDisplay?: string;
    localSystem?: string;
  } = {},
): Promise<Task> {
  const {
    localCode = "TEST_CODE",
    localDisplay = "Test Code Display",
    localSystem = "TEST-SYSTEM",
  } = options;

  const typeConfig = MAPPING_TYPES[mappingType];

  const task: Task = {
    resourceType: "Task",
    id,
    status: "requested",
    intent: "order",
    code: {
      coding: [
        {
          system: "urn:aidbox-hl7v2-converter:mapping-type",
          code: mappingType,
          display: typeConfig.taskDisplay,
        },
      ],
      text: `Map ${typeConfig.sourceFieldLabel} to ${typeConfig.targetFieldLabel}`,
    },
    authoredOn: new Date().toISOString(),
    input: [
      { type: { text: "Sending application" }, valueString: "TEST_APP" },
      { type: { text: "Sending facility" }, valueString: "TEST_FACILITY" },
      { type: { text: "Local code" }, valueString: localCode },
      { type: { text: "Local display" }, valueString: localDisplay },
      { type: { text: "Local system" }, valueString: localSystem },
      { type: { text: "Source field" }, valueString: typeConfig.sourceFieldLabel },
      { type: { text: "Target field" }, valueString: typeConfig.targetFieldLabel },
    ],
  };

  return aidboxFetch<Task>(`/fhir/Task/${id}`, {
    method: "PUT",
    body: JSON.stringify(task),
  });
}


/**
 * Simulates the API endpoint logic: fetch task, validate code, resolve.
 * This mirrors what /api/mapping/tasks/:id/resolve does.
 */
async function resolveTaskWithValidation(
  taskId: string,
  resolvedCode: string,
  resolvedDisplay: string = "",
): Promise<{ success: boolean; error?: string }> {
  // Fetch the task to get its type
  let task: Task;
  try {
    task = await aidboxFetch<Task>(`/fhir/Task/${taskId}`);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Task not found",
    };
  }

  // Get mapping type from task code
  const mappingType = task.code?.coding?.[0]?.code;
  if (!mappingType) {
    return { success: false, error: "Task has no code" };
  }

  if (!isMappingTypeName(mappingType)) {
    return {
      success: false,
      error: `Unknown mapping type: ${mappingType}`,
    };
  }

  // Validate the resolved code
  const validation = validateResolvedCode(mappingType, resolvedCode);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Resolve the task
  try {
    await resolveTaskAndUpdateMessages(taskId, resolvedCode, resolvedDisplay);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Resolution failed",
    };
  }
}

async function fetchTask(id: string): Promise<Task> {
  return aidboxFetch<Task>(`/fhir/Task/${id}`);
}

async function fetchConceptMap(id: string): Promise<ConceptMap | null> {
  try {
    return await aidboxFetch<ConceptMap>(`/fhir/ConceptMap/${id}`);
  } catch {
    return null;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("Task resolution with type detection and validation", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  describe("LOINC task resolution", () => {
    test("resolves LOINC task with valid code", async () => {
      await createTaskForType("task-loinc-valid", "observation-code-loinc");

      const result = await resolveTaskWithValidation("task-loinc-valid", "2823-3", "Potassium");

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      const task = await fetchTask("task-loinc-valid");
      expect(task.status).toBe("completed");
      expect(task.output?.[0]?.valueCodeableConcept?.coding?.[0]?.code).toBe("2823-3");
    });

    test("rejects empty LOINC code", async () => {
      await createTaskForType("task-loinc-empty", "observation-code-loinc");

      const result = await resolveTaskWithValidation("task-loinc-empty", "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });
  });

  describe("OBR status task resolution", () => {
    test("resolves OBR status task with valid status code", async () => {
      await createTaskForType("task-obr-valid", "obr-status", {
        localCode: "Y",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0123",
      });

      const result = await resolveTaskWithValidation("task-obr-valid", "final", "Final");

      expect(result.success).toBe(true);

      const task = await fetchTask("task-obr-valid");
      expect(task.status).toBe("completed");
      expect(task.output?.[0]?.valueCodeableConcept?.coding?.[0]?.code).toBe("final");
      expect(task.output?.[0]?.valueCodeableConcept?.coding?.[0]?.system).toBe(
        "http://hl7.org/fhir/diagnostic-report-status",
      );
    });

    test("accepts various DiagnosticReport status values", async () => {
      // Test representative values - full validation is done in unit tests
      const testCases: Array<[string, string]> = [
        ["preliminary", "Preliminary"],
        ["final", "Final"],
        ["cancelled", "Cancelled"],
      ];

      for (const [status, display] of testCases) {
        const taskId = `task-obr-all-${status}`;
        await createTaskForType(taskId, "obr-status");
        const result = await resolveTaskWithValidation(taskId, status, display);
        expect(result.success).toBe(true);
      }
    });

    test("rejects invalid OBR status code", async () => {
      await createTaskForType("task-obr-invalid", "obr-status");

      const result = await resolveTaskWithValidation("task-obr-invalid", "invalid-status");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid DiagnosticReport status");
      expect(result.error).toContain("invalid-status");
    });
  });

  describe("OBX status task resolution", () => {
    test("resolves OBX status task with valid status code", async () => {
      await createTaskForType("task-obx-valid", "obx-status", {
        localCode: "N",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0085",
      });

      const result = await resolveTaskWithValidation("task-obx-valid", "preliminary", "Preliminary");

      expect(result.success).toBe(true);

      const task = await fetchTask("task-obx-valid");
      expect(task.status).toBe("completed");
      expect(task.output?.[0]?.valueCodeableConcept?.coding?.[0]?.code).toBe("preliminary");
      expect(task.output?.[0]?.valueCodeableConcept?.coding?.[0]?.system).toBe(
        "http://hl7.org/fhir/observation-status",
      );
    });

    test("accepts various Observation status values", async () => {
      // Test representative values - full validation is done in unit tests
      const testCases: Array<[string, string]> = [
        ["preliminary", "Preliminary"],
        ["final", "Final"],
        ["amended", "Amended"],
      ];

      for (const [status, display] of testCases) {
        await createTaskForType(`task-obx-${status}`, "obx-status");
        const result = await resolveTaskWithValidation(`task-obx-${status}`, status, display);
        expect(result.success).toBe(true);
      }
    });

    test("rejects invalid OBX status code", async () => {
      await createTaskForType("task-obx-invalid", "obx-status");

      const result = await resolveTaskWithValidation("task-obx-invalid", "bad-status");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid Observation status");
    });
  });

  describe("Patient class task resolution", () => {
    test("resolves patient-class task with valid class code", async () => {
      await createTaskForType("task-class-valid", "patient-class", {
        localCode: "1",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0004",
      });

      const result = await resolveTaskWithValidation("task-class-valid", "AMB", "Ambulatory");

      expect(result.success).toBe(true);

      const task = await fetchTask("task-class-valid");
      expect(task.status).toBe("completed");
      expect(task.output?.[0]?.valueCodeableConcept?.coding?.[0]?.code).toBe("AMB");
      expect(task.output?.[0]?.valueCodeableConcept?.coding?.[0]?.system).toBe(
        "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      );
    });

    test("accepts various Encounter class values", async () => {
      // Test representative values - full validation is done in unit tests
      const testCases: Array<[string, string]> = [
        ["AMB", "Ambulatory"],
        ["EMER", "Emergency"],
        ["IMP", "Inpatient"],
      ];

      for (const [classCode, display] of testCases) {
        await createTaskForType(`task-class-${classCode.toLowerCase()}`, "patient-class");
        const result = await resolveTaskWithValidation(`task-class-${classCode.toLowerCase()}`, classCode, display);
        expect(result.success).toBe(true);
      }
    });

    test("rejects invalid patient class code", async () => {
      await createTaskForType("task-class-invalid", "patient-class");

      const result = await resolveTaskWithValidation("task-class-invalid", "INVALID");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid Encounter class");
    });
  });

  describe("Error handling", () => {
    test("returns error for non-existent task", async () => {
      const result = await resolveTaskWithValidation("non-existent-task", "12345-6");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("creates ConceptMap entry on successful resolution", async () => {
      await createTaskForType("task-cm-test", "obr-status", {
        localCode: "X",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0123",
      });

      const result = await resolveTaskWithValidation("task-cm-test", "cancelled", "Cancelled");
      expect(result.success).toBe(true);

      const conceptMap = await fetchConceptMap(
        "hl7v2-test-app-test-facility-obr-status",
      );
      expect(conceptMap).toBeDefined();
      expect(conceptMap!.status).toBe("active");

      const group = conceptMap!.group?.find(
        (g) => g.source === "http://terminology.hl7.org/CodeSystem/v2-0123",
      );
      expect(group).toBeDefined();
      expect(group!.element?.some((e) => e.code === "X")).toBe(true);
      const element = group!.element?.find((e) => e.code === "X");
      expect(element!.target?.[0]?.code).toBe("cancelled");
    });
  });
});

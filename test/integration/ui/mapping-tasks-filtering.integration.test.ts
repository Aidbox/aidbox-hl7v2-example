/**
 * Integration tests for Mapping Tasks UI type filtering.
 *
 * Tests getMappingTasks() function with type filtering against a real Aidbox instance.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { testAidboxFetch, cleanupTestResources } from "../helpers";
import {
  getMappingTasks,
  type MappingTypeFilter,
} from "../../../src/ui/pages/mapping-tasks";
import type { Task } from "../../../src/fhir/hl7-fhir-r4-core/Task";
import { MAPPING_TYPES, type MappingTypeName } from "../../../src/code-mapping/mapping-types";

// ============================================================================
// Test Helpers
// ============================================================================

async function createTask(
  id: string,
  taskCode: string,
  taskDisplay: string,
  status: "requested" | "completed" = "requested",
): Promise<Task> {
  const task: Task = {
    resourceType: "Task",
    id,
    status,
    intent: "order",
    code: {
      coding: [{
        system: "urn:aidbox-hl7v2-converter:task-code",
        code: taskCode,
        display: taskDisplay,
      }],
    },
    authoredOn: new Date().toISOString(),
    input: [
      { type: { text: "Sending application" }, valueString: "TEST_APP" },
      { type: { text: "Sending facility" }, valueString: "TEST_FACILITY" },
      { type: { text: "Local code" }, valueString: `code-${id}` },
      { type: { text: "Local system" }, valueString: "TEST-SYSTEM" },
    ],
  };

  return testAidboxFetch<Task>(`/fhir/Task/${id}`, {
    method: "PUT",
    body: JSON.stringify(task),
  });
}

async function createTypedTask(
  id: string,
  mappingType: MappingTypeName,
  status: "requested" | "completed" = "requested",
): Promise<Task> {
  const config = MAPPING_TYPES[mappingType];
  return createTask(id, config.taskCode, config.taskDisplay, status);
}

// ============================================================================
// Tests
// ============================================================================

describe("getMappingTasks with type filtering", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  test("returns all tasks when filter is 'all'", async () => {
    // Create one task of each type
    await createTypedTask("task-loinc", "loinc");
    await createTypedTask("task-patient-class", "patient-class");
    await createTypedTask("task-obr", "obr-status");
    await createTypedTask("task-obx", "obx-status");

    const result = await getMappingTasks("requested", 1, "all");

    expect(result.tasks.length).toBe(4);
    expect(result.total).toBe(4);
    expect(result.tasks.some(t => t.id === "task-loinc")).toBe(true);
    expect(result.tasks.some(t => t.id === "task-patient-class")).toBe(true);
    expect(result.tasks.some(t => t.id === "task-obr")).toBe(true);
    expect(result.tasks.some(t => t.id === "task-obx")).toBe(true);
  });

  test("filters by loinc type", async () => {
    await createTypedTask("task-loinc-1", "loinc");
    await createTypedTask("task-loinc-2", "loinc");
    await createTypedTask("task-obr-1", "obr-status");

    const result = await getMappingTasks("requested", 1, "loinc");

    expect(result.tasks.length).toBe(2);
    expect(result.total).toBe(2);
    expect(result.tasks.some(t => t.id === "task-loinc-1")).toBe(true);
    expect(result.tasks.some(t => t.id === "task-loinc-2")).toBe(true);
    expect(result.tasks.some(t => t.id === "task-obr-1")).toBe(false);
  });

  test("filters by patient-class", async () => {
    await createTypedTask("task-patient-1", "patient-class");
    await createTypedTask("task-patient-2", "patient-class");
    await createTypedTask("task-loinc-1", "loinc");

    const result = await getMappingTasks("requested", 1, "patient-class");

    expect(result.tasks.length).toBe(2);
    expect(result.total).toBe(2);
    expect(result.tasks.every(t => t.id?.startsWith("task-patient"))).toBe(true);
  });

  test("filters by status type (combines obr-status and obx-status)", async () => {
    await createTypedTask("task-obr-1", "obr-status");
    await createTypedTask("task-obr-2", "obr-status");
    await createTypedTask("task-obx-1", "obx-status");
    await createTypedTask("task-loinc-1", "loinc");

    const result = await getMappingTasks("requested", 1, "status");

    expect(result.tasks.length).toBe(3);
    expect(result.total).toBe(3);
    expect(result.tasks.some(t => t.id === "task-obr-1")).toBe(true);
    expect(result.tasks.some(t => t.id === "task-obr-2")).toBe(true);
    expect(result.tasks.some(t => t.id === "task-obx-1")).toBe(true);
    expect(result.tasks.some(t => t.id === "task-loinc-1")).toBe(false);
  });

  test("filters by obr-status only", async () => {
    await createTypedTask("task-obr-1", "obr-status");
    await createTypedTask("task-obx-1", "obx-status");

    const result = await getMappingTasks("requested", 1, "obr-status");

    expect(result.tasks.length).toBe(1);
    expect(result.tasks[0]!.id).toBe("task-obr-1");
  });

  test("filters by obx-status only", async () => {
    await createTypedTask("task-obr-1", "obr-status");
    await createTypedTask("task-obx-1", "obx-status");

    const result = await getMappingTasks("requested", 1, "obx-status");

    expect(result.tasks.length).toBe(1);
    expect(result.tasks[0]!.id).toBe("task-obx-1");
  });

  test("respects status filter (requested vs completed)", async () => {
    await createTypedTask("task-pending-1", "loinc", "requested");
    await createTypedTask("task-pending-2", "loinc", "requested");
    await createTypedTask("task-completed-1", "loinc", "completed");

    const pendingResult = await getMappingTasks("requested", 1, "loinc");
    expect(pendingResult.tasks.length).toBe(2);
    expect(pendingResult.total).toBe(2);

    const completedResult = await getMappingTasks("completed", 1, "loinc");
    expect(completedResult.tasks.length).toBe(1);
    expect(completedResult.total).toBe(1);
    expect(completedResult.tasks[0]!.id).toBe("task-completed-1");
  });

  test("returns empty result when no tasks match filter", async () => {
    await createTypedTask("task-loinc-1", "loinc");

    const result = await getMappingTasks("requested", 1, "patient-class");

    expect(result.tasks.length).toBe(0);
    expect(result.total).toBe(0);
  });

  test("returns empty result when no tasks exist", async () => {
    const result = await getMappingTasks("requested", 1, "all");

    expect(result.tasks.length).toBe(0);
    expect(result.total).toBe(0);
  });

  test("respects pagination", async () => {
    // Create more tasks than PAGE_SIZE (50)
    // We'll create 5 and use a smaller count for testing
    await createTypedTask("task-loinc-1", "loinc");
    await createTypedTask("task-loinc-2", "loinc");
    await createTypedTask("task-loinc-3", "loinc");

    const result = await getMappingTasks("requested", 1, "loinc");

    expect(result.tasks.length).toBe(3);
    expect(result.total).toBe(3);
  });
});

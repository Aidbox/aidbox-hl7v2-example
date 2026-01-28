/**
 * Unit tests for Mapping Tasks UI module.
 *
 * Tests pure rendering functions and helper utilities with fixture data.
 * No Aidbox calls - these are pure function tests.
 */
import { describe, test, expect } from "bun:test";
import type { Task } from "../../../src/fhir/hl7-fhir-r4-core/Task";
import {
  getMappingTypeFilterDisplay,
  getMappingTypeShortLabel,
  parseTypeFilter,
  getTaskInputValue,
  getTaskMappingType,
  getTaskOutputMapping,
  renderMappingTaskPanel,
  renderMappingTasksPage,
  type MappingTypeFilter,
} from "../../../src/ui/pages/mapping-tasks";
import type { NavData } from "../../../src/ui/shared-layout";
import type { PaginationData } from "../../../src/ui/pagination";
import { MAPPING_TYPES } from "../../../src/code-mapping/mapping-types";

// ============================================================================
// Test Fixtures
// ============================================================================

function createLoincTask(overrides: Partial<Task> = {}): Task {
  return {
    resourceType: "Task",
    id: "task-loinc-1",
    status: "requested",
    intent: "order",
    code: {
      coding: [{
        system: "http://example.org/task-codes",
        code: "loinc-mapping",
        display: "Local code to LOINC mapping",
      }],
      text: "Map OBX-3 to Observation.code",
    },
    authoredOn: "2025-02-12T14:20:00Z",
    input: [
      { type: { text: "Sending application" }, valueString: "ACME_LAB" },
      { type: { text: "Sending facility" }, valueString: "ACME_HOSP" },
      { type: { text: "Local code" }, valueString: "K_SERUM" },
      { type: { text: "Local display" }, valueString: "Potassium [Serum/Plasma]" },
      { type: { text: "Local system" }, valueString: "ACME-LAB-CODES" },
      { type: { text: "Source field" }, valueString: "OBX-3" },
      { type: { text: "Target field" }, valueString: "Observation.code" },
    ],
    ...overrides,
  };
}

function createObrStatusTask(overrides: Partial<Task> = {}): Task {
  return {
    resourceType: "Task",
    id: "task-obr-status-1",
    status: "requested",
    intent: "order",
    code: {
      coding: [{
        system: "http://example.org/task-codes",
        code: "obr-status-mapping",
        display: "OBR result status mapping",
      }],
      text: "Map OBR-25 to DiagnosticReport.status",
    },
    authoredOn: "2025-02-12T14:20:00Z",
    input: [
      { type: { text: "Sending application" }, valueString: "ACME_LAB" },
      { type: { text: "Sending facility" }, valueString: "ACME_HOSP" },
      { type: { text: "Local code" }, valueString: "Y" },
      { type: { text: "Local display" }, valueString: "Order received" },
      { type: { text: "Local system" }, valueString: "http://terminology.hl7.org/CodeSystem/v2-0123" },
      { type: { text: "Source field" }, valueString: "OBR-25" },
      { type: { text: "Target field" }, valueString: "DiagnosticReport.status" },
    ],
    ...overrides,
  };
}

function createAddressTypeTask(overrides: Partial<Task> = {}): Task {
  return {
    resourceType: "Task",
    id: "task-address-type-1",
    status: "requested",
    intent: "order",
    code: {
      coding: [{
        system: "http://example.org/task-codes",
        code: "address-type-mapping",
        display: "Address type mapping",
      }],
      text: "Map PID.11 (XAD.7) to Address.type",
    },
    authoredOn: "2025-02-12T14:20:00Z",
    input: [
      { type: { text: "Sending application" }, valueString: "ACME_LAB" },
      { type: { text: "Sending facility" }, valueString: "ACME_HOSP" },
      { type: { text: "Local code" }, valueString: "P" },
      { type: { text: "Local display" }, valueString: "Permanent" },
      { type: { text: "Local system" }, valueString: "http://terminology.hl7.org/CodeSystem/v2-0190" },
      { type: { text: "Source field" }, valueString: "PID.11 (XAD.7)" },
      { type: { text: "Target field" }, valueString: "Address.type" },
    ],
    ...overrides,
  };
}

function createCompletedLoincTask(): Task {
  return {
    ...createLoincTask(),
    id: "task-loinc-completed",
    status: "completed",
    output: [{
      type: { text: "Resolved mapping" },
      valueCodeableConcept: {
        coding: [{
          system: "http://loinc.org",
          code: "2823-3",
          display: "Potassium [Moles/volume] in Serum or Plasma",
        }],
      },
    }],
  };
}

function createLegacyLoincTask(): Task {
  return {
    resourceType: "Task",
    id: "task-legacy-loinc",
    status: "completed",
    intent: "order",
    code: {
      coding: [{
        system: "http://example.org/task-codes",
        code: "local-to-loinc-mapping",
        display: "Local code to LOINC mapping",
      }],
    },
    authoredOn: "2025-02-12T14:20:00Z",
    input: [
      { type: { text: "Sending application" }, valueString: "ACME_LAB" },
      { type: { text: "Sending facility" }, valueString: "ACME_HOSP" },
      { type: { text: "Local code" }, valueString: "NA_SERUM" },
      { type: { text: "Local system" }, valueString: "ACME-LAB-CODES" },
    ],
    output: [{
      type: { text: "Resolved LOINC" },
      valueCodeableConcept: {
        coding: [{
          system: "http://loinc.org",
          code: "2951-2",
          display: "Sodium [Moles/volume] in Serum or Plasma",
        }],
      },
    }],
  };
}

const mockNavData: NavData = {
  pendingMappingTasksCount: 10,
};

const mockPagination: PaginationData = {
  currentPage: 1,
  total: 25,
  totalPages: 1,
};

// ============================================================================
// Tests for Helper Functions
// ============================================================================

describe("getMappingTypeFilterDisplay", () => {
  test("returns 'All' for 'all' filter", () => {
    expect(getMappingTypeFilterDisplay("all")).toBe("All");
  });

  test("returns 'Status' for 'status' filter", () => {
    expect(getMappingTypeFilterDisplay("status")).toBe("Status");
  });

  test("returns task display without ' mapping' suffix for mapping types", () => {
    expect(getMappingTypeFilterDisplay("loinc")).toBe("Local code to LOINC");
    expect(getMappingTypeFilterDisplay("address-type")).toBe("Address type");
    expect(getMappingTypeFilterDisplay("patient-class")).toBe("Patient class");
    expect(getMappingTypeFilterDisplay("obr-status")).toBe("OBR result status");
    expect(getMappingTypeFilterDisplay("obx-status")).toBe("OBX observation status");
  });
});

describe("getMappingTypeShortLabel", () => {
  test("returns short labels for each mapping type", () => {
    expect(getMappingTypeShortLabel("loinc")).toBe("LOINC");
    expect(getMappingTypeShortLabel("address-type")).toBe("Address");
    expect(getMappingTypeShortLabel("patient-class")).toBe("Patient Class");
    expect(getMappingTypeShortLabel("obr-status")).toBe("OBR Status");
    expect(getMappingTypeShortLabel("obx-status")).toBe("OBX Status");
  });
});

describe("parseTypeFilter", () => {
  test("returns 'all' for null parameter", () => {
    expect(parseTypeFilter(null)).toBe("all");
  });

  test("returns 'all' for 'all' parameter", () => {
    expect(parseTypeFilter("all")).toBe("all");
  });

  test("returns 'status' for 'status' parameter", () => {
    expect(parseTypeFilter("status")).toBe("status");
  });

  test("returns mapping type name for valid type parameters", () => {
    expect(parseTypeFilter("loinc")).toBe("loinc");
    expect(parseTypeFilter("address-type")).toBe("address-type");
    expect(parseTypeFilter("patient-class")).toBe("patient-class");
    expect(parseTypeFilter("obr-status")).toBe("obr-status");
    expect(parseTypeFilter("obx-status")).toBe("obx-status");
  });

  test("returns 'all' for invalid parameter", () => {
    expect(parseTypeFilter("invalid")).toBe("all");
    expect(parseTypeFilter("unknown-type")).toBe("all");
    expect(parseTypeFilter("")).toBe("all");
  });
});

describe("getTaskInputValue", () => {
  test("returns value for existing input", () => {
    const task = createLoincTask();
    expect(getTaskInputValue(task, "Local code")).toBe("K_SERUM");
    expect(getTaskInputValue(task, "Sending application")).toBe("ACME_LAB");
  });

  test("returns undefined for non-existing input", () => {
    const task = createLoincTask();
    expect(getTaskInputValue(task, "Non-existing")).toBeUndefined();
  });

  test("returns undefined for task without inputs", () => {
    const task: Task = {
      resourceType: "Task",
      status: "requested",
      intent: "order",
    };
    expect(getTaskInputValue(task, "Local code")).toBeUndefined();
  });
});

describe("getTaskMappingType", () => {
  test("returns mapping type for LOINC task", () => {
    expect(getTaskMappingType(createLoincTask())).toBe("loinc");
  });

  test("returns mapping type for OBR status task", () => {
    expect(getTaskMappingType(createObrStatusTask())).toBe("obr-status");
  });

  test("returns mapping type for address type task", () => {
    expect(getTaskMappingType(createAddressTypeTask())).toBe("address-type");
  });

  test("returns mapping type for legacy LOINC task", () => {
    expect(getTaskMappingType(createLegacyLoincTask())).toBe("loinc");
  });

  test("returns undefined for task without code", () => {
    const task: Task = {
      resourceType: "Task",
      status: "requested",
      intent: "order",
    };
    expect(getTaskMappingType(task)).toBeUndefined();
  });

  test("returns undefined for task with unknown code", () => {
    const task: Task = {
      resourceType: "Task",
      status: "requested",
      intent: "order",
      code: {
        coding: [{
          system: "http://example.org/task-codes",
          code: "unknown-code",
        }],
      },
    };
    expect(getTaskMappingType(task)).toBeUndefined();
  });
});

describe("getTaskOutputMapping", () => {
  test("returns resolved mapping for completed task", () => {
    const task = createCompletedLoincTask();
    const output = getTaskOutputMapping(task);
    expect(output).toEqual({
      code: "2823-3",
      display: "Potassium [Moles/volume] in Serum or Plasma",
    });
  });

  test("returns resolved mapping for legacy task with 'Resolved LOINC' output", () => {
    const task = createLegacyLoincTask();
    const output = getTaskOutputMapping(task);
    expect(output).toEqual({
      code: "2951-2",
      display: "Sodium [Moles/volume] in Serum or Plasma",
    });
  });

  test("returns undefined for pending task", () => {
    const task = createLoincTask();
    expect(getTaskOutputMapping(task)).toBeUndefined();
  });

  test("returns undefined for task without output", () => {
    const task: Task = {
      resourceType: "Task",
      status: "completed",
      intent: "order",
    };
    expect(getTaskOutputMapping(task)).toBeUndefined();
  });
});

// ============================================================================
// Tests for Rendering Functions
// ============================================================================

describe("renderMappingTaskPanel", () => {
  test("renders pending LOINC task with LOINC autocomplete input", () => {
    const task = createLoincTask();
    const html = renderMappingTaskPanel(task, true);

    // Check type badge
    expect(html).toContain("LOINC");
    expect(html).toContain("bg-purple-100 text-purple-800");

    // Check pending status badge
    expect(html).toContain("Pending");
    expect(html).toContain("bg-yellow-100 text-yellow-800");

    // Check sender info
    expect(html).toContain("ACME_LAB | ACME_HOSP");

    // Check local code info
    expect(html).toContain("K_SERUM");
    expect(html).toContain("Potassium [Serum/Plasma]");

    // Check source/target field info
    expect(html).toContain("Source Field:");
    expect(html).toContain("OBX-3");
    expect(html).toContain("Target Field:");
    expect(html).toContain("Observation.code");

    // Check LOINC autocomplete form
    expect(html).toContain("data-loinc-autocomplete");
    expect(html).toContain("Map to LOINC Code");
    expect(html).toContain('name="loincCode"');
  });

  test("renders pending OBR status task with dropdown select", () => {
    const task = createObrStatusTask();
    const html = renderMappingTaskPanel(task, true);

    // Check type badge
    expect(html).toContain("OBR Status");
    expect(html).toContain("bg-orange-100 text-orange-800");

    // Check source/target field info
    expect(html).toContain("OBR-25");
    expect(html).toContain("DiagnosticReport.status");

    // Check dropdown select (not autocomplete)
    expect(html).not.toContain("data-loinc-autocomplete");
    expect(html).toContain("<select");
    expect(html).toContain("Map to status");

    // Check dropdown options
    expect(html).toContain("final");
    expect(html).toContain("preliminary");
    expect(html).toContain("registered");
  });

  test("renders pending address type task with dropdown select", () => {
    const task = createAddressTypeTask();
    const html = renderMappingTaskPanel(task, true);

    // Check type badge
    expect(html).toContain("Address");
    expect(html).toContain("bg-blue-100 text-blue-800");

    // Check dropdown options
    expect(html).toContain("postal");
    expect(html).toContain("physical");
    expect(html).toContain("both");
  });

  test("renders completed task with resolved mapping", () => {
    const task = createCompletedLoincTask();
    const html = renderMappingTaskPanel(task, false);

    // Check completed status badge
    expect(html).toContain("Completed");
    expect(html).toContain("bg-green-100 text-green-800");

    // Check resolved mapping display
    expect(html).toContain("Resolved to:");
    expect(html).toContain("2823-3");
    expect(html).toContain("Potassium [Moles/volume] in Serum or Plasma");

    // Should not have form
    expect(html).not.toContain("<form");
  });

  test("renders legacy LOINC task with resolved mapping", () => {
    const task = createLegacyLoincTask();
    const html = renderMappingTaskPanel(task, false);

    // Check resolved mapping display
    expect(html).toContain("Resolved to:");
    expect(html).toContain("2951-2");
  });

  test("escapes HTML in local code and display", () => {
    const task = createLoincTask({
      input: [
        { type: { text: "Sending application" }, valueString: "ACME_LAB" },
        { type: { text: "Sending facility" }, valueString: "ACME_HOSP" },
        { type: { text: "Local code" }, valueString: "<script>alert('xss')</script>" },
        { type: { text: "Local display" }, valueString: "Test & Display" },
        { type: { text: "Local system" }, valueString: "TEST" },
      ],
    });
    const html = renderMappingTaskPanel(task, true);

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Test &amp; Display");
    expect(html).not.toContain("<script>alert('xss')</script>");
  });
});

describe("renderMappingTasksPage", () => {
  test("renders page with type filter tabs", () => {
    const html = renderMappingTasksPage(
      mockNavData,
      [],
      "requested",
      "all",
      mockPagination,
      null,
    );

    // Check page title
    expect(html).toContain("Mapping Tasks");

    // Check status filter tabs
    expect(html).toContain("Pending");
    expect(html).toContain("History");

    // Check type filter tabs
    expect(html).toContain(">All</a>");
    expect(html).toContain(">Local code to LOINC</a>");
    expect(html).toContain(">Address type</a>");
    expect(html).toContain(">Patient class</a>");
    expect(html).toContain(">Status</a>");
  });

  test("highlights active type filter", () => {
    const html = renderMappingTasksPage(
      mockNavData,
      [],
      "requested",
      "loinc",
      mockPagination,
      null,
    );

    // LOINC filter should be active (blue)
    expect(html).toContain('class="px-2 py-1 rounded text-xs font-medium bg-blue-600 text-white">Local code to LOINC</a>');
  });

  test("includes type parameter in filter URLs when not 'all'", () => {
    const html = renderMappingTasksPage(
      mockNavData,
      [],
      "requested",
      "obr-status",
      mockPagination,
      null,
    );

    // Status tabs should preserve type filter
    expect(html).toContain('href="/mapping/tasks?status=requested&type=obr-status"');
    expect(html).toContain('href="/mapping/tasks?status=completed&type=obr-status"');
  });

  test("omits type parameter in URLs when filter is 'all'", () => {
    const html = renderMappingTasksPage(
      mockNavData,
      [],
      "requested",
      "all",
      mockPagination,
      null,
    );

    // Should not have type=all in URLs
    expect(html).not.toContain("type=all");
    expect(html).toContain('href="/mapping/tasks?status=requested"');
  });

  test("renders error message when provided", () => {
    const html = renderMappingTasksPage(
      mockNavData,
      [],
      "requested",
      "all",
      mockPagination,
      "Something went wrong",
    );

    expect(html).toContain("Something went wrong");
    expect(html).toContain("bg-red-50");
  });

  test("renders empty state when no tasks", () => {
    const html = renderMappingTasksPage(
      mockNavData,
      [],
      "requested",
      "all",
      mockPagination,
      null,
    );

    expect(html).toContain("No tasks found");
  });

  test("renders tasks list when tasks provided", () => {
    const tasks = [createLoincTask(), createObrStatusTask()];
    const html = renderMappingTasksPage(
      mockNavData,
      tasks,
      "requested",
      "all",
      { ...mockPagination, total: 2 },
      null,
    );

    // Should contain both task codes
    expect(html).toContain("K_SERUM");
    expect(html).toContain("task-obr-status-1");
    expect(html).toContain("Total: 2 tasks");
  });

  test("includes pending count in Pending tab", () => {
    const html = renderMappingTasksPage(
      mockNavData,
      [],
      "requested",
      "all",
      mockPagination,
      null,
    );

    expect(html).toContain("Pending (10)");
  });

  test("preserves type filter in pagination params", () => {
    const html = renderMappingTasksPage(
      mockNavData,
      [],
      "requested",
      "address-type",
      { currentPage: 1, total: 100, totalPages: 2 },
      null,
    );

    // Pagination should include type filter
    expect(html).toContain("type=address-type");
  });
});

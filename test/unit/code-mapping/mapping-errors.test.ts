import { describe, test, expect } from "bun:test";
import {
  buildMappingErrorResult,
  type MappingError,
} from "../../../src/code-mapping/mapping-errors";
import type { SenderContext } from "../../../src/code-mapping/concept-map/lookup";
import type { Reference } from "../../../src/fhir/hl7-fhir-r4-core";
import type { Task } from "../../../src/fhir/hl7-fhir-r4-core/Task";

const sender: SenderContext = {
  sendingApplication: "ACME_LAB",
  sendingFacility: "ACME_HOSP",
};

const patientRef: Reference<"Patient"> = { reference: "Patient/123" };

describe("buildMappingErrorResult", () => {
  test("returns mapping_error status with empty unmappedCodes for empty errors array", () => {
    const result = buildMappingErrorResult(sender, [], patientRef);

    expect(result.messageUpdate.status).toBe("mapping_error");
    expect(result.messageUpdate.unmappedCodes).toBeUndefined();
    expect(result.messageUpdate.patient).toBe(patientRef);
    expect(result.bundle.entry).toBeUndefined();
  });

  test("creates Task for LOINC mapping error", () => {
    const errors: MappingError[] = [
      {
        localCode: "K_SERUM",
        localDisplay: "Potassium [Serum/Plasma]",
        localSystem: "ACME-LAB-CODES",
        mappingType: "loinc",
      },
    ];

    const result = buildMappingErrorResult(sender, errors, patientRef);

    expect(result.messageUpdate.status).toBe("mapping_error");
    expect(result.messageUpdate.unmappedCodes).toHaveLength(1);
    expect(result.messageUpdate.unmappedCodes![0]!.localCode).toBe("K_SERUM");
    expect(result.messageUpdate.unmappedCodes![0]!.localDisplay).toBe(
      "Potassium [Serum/Plasma]",
    );
    expect(result.messageUpdate.unmappedCodes![0]!.localSystem).toBe(
      "ACME-LAB-CODES",
    );
    expect(
      result.messageUpdate.unmappedCodes![0]!.mappingTask.reference,
    ).toMatch(/^Task\/map-hl7v2-acme-lab-acme-hosp-loinc-/);

    // Check that Task is created with correct type
    expect(result.bundle.entry).toHaveLength(1);
    const task = result.bundle.entry![0]!.resource as Task;
    expect(task.resourceType).toBe("Task");
    expect(task.status).toBe("requested");
    expect(task.code?.coding?.[0]?.code).toBe("loinc-mapping");
    expect(task.code?.coding?.[0]?.display).toBe("Local code to LOINC mapping");
  });

  test("creates Task for obr-status mapping error", () => {
    const errors: MappingError[] = [
      {
        localCode: "Y",
        localDisplay: "Unknown status",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0123",
        mappingType: "obr-status",
      },
    ];

    const result = buildMappingErrorResult(sender, errors, patientRef);

    expect(
      result.messageUpdate.unmappedCodes![0]!.mappingTask.reference,
    ).toMatch(/^Task\/map-hl7v2-acme-lab-acme-hosp-obr-status-/);

    const task = result.bundle.entry![0]!.resource as Task;
    expect(task.code?.coding?.[0]?.code).toBe("obr-status-mapping");
  });

  test("creates Task for obx-status mapping error", () => {
    const errors: MappingError[] = [
      {
        localCode: "N",
        localDisplay: "Not applicable",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0085",
        mappingType: "obx-status",
      },
    ];

    const result = buildMappingErrorResult(sender, errors, patientRef);

    expect(
      result.messageUpdate.unmappedCodes![0]!.mappingTask.reference,
    ).toMatch(/^Task\/map-hl7v2-acme-lab-acme-hosp-obx-status-/);

    const task = result.bundle.entry![0]!.resource as Task;
    expect(task.code?.coding?.[0]?.code).toBe("obx-status-mapping");
  });

  test("creates Task for patient-class mapping error", () => {
    const errors: MappingError[] = [
      {
        localCode: "1",
        localDisplay: "Unknown class",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0004",
        mappingType: "patient-class",
      },
    ];

    const result = buildMappingErrorResult(sender, errors, patientRef);

    expect(
      result.messageUpdate.unmappedCodes![0]!.mappingTask.reference,
    ).toMatch(/^Task\/map-hl7v2-acme-lab-acme-hosp-patient-class-/);

    const task = result.bundle.entry![0]!.resource as Task;
    expect(task.code?.coding?.[0]?.code).toBe("patient-class-mapping");
  });

  test("creates multiple Tasks for errors of different types", () => {
    const errors: MappingError[] = [
      {
        localCode: "K_SERUM",
        localDisplay: "Potassium",
        localSystem: "ACME-LAB",
        mappingType: "loinc",
      },
      {
        localCode: "Y",
        localDisplay: "Unknown",
        localSystem: "v2-0123",
        mappingType: "obr-status",
      },
      {
        localCode: "N",
        localDisplay: "NA",
        localSystem: "v2-0085",
        mappingType: "obx-status",
      },
    ];

    const result = buildMappingErrorResult(sender, errors, patientRef);

    expect(result.messageUpdate.unmappedCodes).toHaveLength(3);
    expect(result.bundle.entry).toHaveLength(3);

    const taskCodes = result.bundle.entry!.map(
      (e) => (e.resource as Task).code?.coding?.[0]?.code,
    );
    expect(taskCodes).toContain("loinc-mapping");
    expect(taskCodes).toContain("obr-status-mapping");
    expect(taskCodes).toContain("obx-status-mapping");
  });

  test("deduplicates Tasks with same ID (same code and type)", () => {
    const errors: MappingError[] = [
      {
        localCode: "K_SERUM",
        localDisplay: "Potassium",
        localSystem: "ACME-LAB",
        mappingType: "loinc",
      },
      {
        localCode: "K_SERUM",
        localDisplay: "Potassium [Serum]",
        localSystem: "ACME-LAB",
        mappingType: "loinc",
      },
    ];

    const result = buildMappingErrorResult(sender, errors, patientRef);

    // Should have only 1 Task since both errors have same code/system/type
    expect(result.messageUpdate.unmappedCodes).toHaveLength(1);
    expect(result.bundle.entry).toHaveLength(1);
  });

  test("creates separate Tasks for same code but different mapping types", () => {
    const errors: MappingError[] = [
      {
        localCode: "F",
        localDisplay: "Final",
        localSystem: "LOCAL",
        mappingType: "obr-status",
      },
      {
        localCode: "F",
        localDisplay: "Final",
        localSystem: "LOCAL",
        mappingType: "obx-status",
      },
    ];

    const result = buildMappingErrorResult(sender, errors, patientRef);

    // Should have 2 Tasks since mapping types are different
    expect(result.messageUpdate.unmappedCodes).toHaveLength(2);
    expect(result.bundle.entry).toHaveLength(2);

    const taskCodes = result.bundle.entry!.map(
      (e) => (e.resource as Task).code?.coding?.[0]?.code,
    );
    expect(taskCodes).toContain("obr-status-mapping");
    expect(taskCodes).toContain("obx-status-mapping");
  });

  test("skips errors with empty localCode", () => {
    const errors: MappingError[] = [
      {
        localCode: "",
        localDisplay: "Empty code",
        localSystem: "ACME-LAB",
        mappingType: "loinc",
      },
      {
        localCode: "K_SERUM",
        localDisplay: "Potassium",
        localSystem: "ACME-LAB",
        mappingType: "loinc",
      },
    ];

    const result = buildMappingErrorResult(sender, errors, patientRef);

    // Only the second error should create a Task
    expect(result.messageUpdate.unmappedCodes).toHaveLength(1);
    expect(result.messageUpdate.unmappedCodes![0]!.localCode).toBe("K_SERUM");
  });

  test("throws error for missing localSystem", () => {
    const errors: MappingError[] = [
      {
        localCode: "TEST",
        mappingType: "loinc",
      },
    ];

    expect(() => buildMappingErrorResult(sender, errors, patientRef)).toThrow(
      "localSystem is required",
    );
  });

  test("creates transaction bundle", () => {
    const errors: MappingError[] = [
      {
        localCode: "K_SERUM",
        localDisplay: "Potassium",
        localSystem: "ACME-LAB",
        mappingType: "loinc",
      },
    ];

    const result = buildMappingErrorResult(sender, errors, patientRef);

    expect(result.bundle.resourceType).toBe("Bundle");
    expect(result.bundle.type).toBe("transaction");
  });

  test("Task bundle entry uses PUT method", () => {
    const errors: MappingError[] = [
      {
        localCode: "K_SERUM",
        localDisplay: "Potassium",
        localSystem: "ACME-LAB",
        mappingType: "loinc",
      },
    ];

    const result = buildMappingErrorResult(sender, errors, patientRef);

    const taskEntry = result.bundle.entry![0]!;
    expect(taskEntry.request?.method).toBe("PUT");
    expect(taskEntry.request?.url).toMatch(/^Task\//);
  });
});

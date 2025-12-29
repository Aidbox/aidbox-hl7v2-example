/**
 * HL7v2 ADT_A01 Message to FHIR Bundle Converter
 * Based on: HL7 Message - FHIR R4_ ADT_A01 - Sheet1.csv
 *
 * ADT_A01 - Admit/Visit Notification
 *
 * Creates:
 * - Patient from PID
 * - Encounter from PV1
 * - RelatedPerson[] from NK1[]
 * - Condition[] from DG1[]
 * - AllergyIntolerance[] from AL1[]
 * - Coverage[] from IN1[]
 */

import { parseMessage } from "@atomic-ehr/hl7v2";
import type { HL7v2Message, HL7v2Segment } from "../../hl7v2/generated/types";
import {
  fromMSH,
  fromPID,
  fromPV1,
  fromNK1,
  fromDG1,
  fromAL1,
  fromIN1,
  type MSH,
} from "../../hl7v2/generated/fields";
import type {
  Bundle,
  BundleEntry,
  Patient,
  Encounter,
  RelatedPerson,
  Condition,
  AllergyIntolerance,
  Coverage,
  Coding,
  Meta,
  Resource,
} from "../../fhir/hl7-fhir-r4-core";
import { convertPIDToPatient } from "../segments/pid-patient";
import { convertPV1ToEncounter } from "../segments/pv1-encounter";
import { convertNK1ToRelatedPerson } from "../segments/nk1-relatedperson";
import { convertDG1ToCondition } from "../segments/dg1-condition";
import { convertAL1ToAllergyIntolerance } from "../segments/al1-allergyintolerance";
import { convertIN1ToCoverage } from "../segments/in1-coverage";

// ============================================================================
// Helper Functions
// ============================================================================

function findSegment(
  message: HL7v2Message,
  name: string,
): HL7v2Segment | undefined {
  return message.find((s) => s.segment === name);
}

function findAllSegments(message: HL7v2Message, name: string): HL7v2Segment[] {
  return message.filter((s) => s.segment === name);
}

/**
 * Generate a deterministic ID from segment data
 */
function generateId(prefix: string, index: number, controlId?: string): string {
  const suffix = controlId ? `-${controlId}` : "";
  return `${prefix}-${index}${suffix}`;
}

/**
 * Extract meta tags from MSH segment
 */
function extractMetaTags(msh: MSH): Coding[] {
  const tags: Coding[] = [];

  if (msh.$10_messageControlId) {
    tags.push({
      code: msh.$10_messageControlId,
      system: "urn:aidbox:hl7v2:message-id",
    });
  }

  if (msh.$9_messageType) {
    const code = msh.$9_messageType.$1_code;
    const event = msh.$9_messageType.$2_event;
    if (code && event) {
      tags.push({
        code: `${code}_${event}`,
        system: "urn:aidbox:hl7v2:message-type",
      });
    }
  }

  return tags;
}

/**
 * Create a bundle entry for a resource
 */
function createBundleEntry(
  resource: Resource,
  method: "PUT" | "POST" = "PUT",
): BundleEntry {
  const resourceType = resource.resourceType;
  const id = (resource as { id?: string }).id;

  return {
    resource,
    request: {
      method,
      url: id ? `/${resourceType}/${id}` : `/${resourceType}`,
    },
  };
}

/**
 * Convert string to kebab-case
 * "Essential Hypertension" → "essential-hypertension"
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
}

/**
 * Deduplicate DG1 segments by diagnosis code+display
 * When duplicates exist, keep the one with lowest priority (1 < 2 < 3...)
 * Null priorities are ranked last
 */
function prepareDG1ForExtraction(segments: HL7v2Segment[]): HL7v2Segment[] {
  // Group segments by diagnosis key (code|display)
  const grouped = new Map<
    string,
    { segment: HL7v2Segment; priority: number | null }[]
  >();

  for (const segment of segments) {
    const dg1 = fromDG1(segment);

    // Parse priority from DG1.15
    const priorityStr = dg1.$15_diagnosisPriority;
    const priority = priorityStr ? parseInt(priorityStr, 10) : null;
    const validPriority =
      priority && !isNaN(priority) && priority > 0 ? priority : null;

    // Generate diagnosis key from code + display (or description)
    const code = dg1.$3_diagnosisCodeDg1?.$1_code || "";
    const display =
      dg1.$3_diagnosisCodeDg1?.$2_text || dg1.$4_diagnosisDescription || "";
    const key = `${code}|${display}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push({ segment, priority: validPriority });
  }

  // For each group, select the one with lowest priority
  const deduplicated: HL7v2Segment[] = [];
  for (const items of grouped.values()) {
    // Sort by priority: null last, then ascending (1 < 2 < 3)
    items.sort((a, b) => {
      if (a.priority === null && b.priority === null) return 0;
      if (a.priority === null) return 1; // null ranks last
      if (b.priority === null) return -1;
      return a.priority - b.priority; // ascending
    });

    deduplicated.push(items[0].segment);
  }

  return deduplicated;
}

/**
 * Generate composite condition ID
 * Format: {encounterId}-{kebab-case-name}
 * Encounter ID is mandatory for ADT_A01
 */
function generateConditionId(dg1: DG1, encounterId: string): string {
  // Extract condition name (prefer description, then display, then code)
  const conditionName =
    dg1.$4_diagnosisDescription ||
    dg1.$3_diagnosisCodeDg1?.$2_text ||
    dg1.$3_diagnosisCodeDg1?.$1_code ||
    "condition";

  const kebabName = toKebabCase(conditionName);
  return `${encounterId}-${kebabName}`;
}

/**
 * Generate composite coverage ID
 * Format: {patientId}-{payor-identifier}
 * Payor identifier extracted from IN1-3 or IN1-2
 */
function generateCoverageId(in1: IN1, patientId: string | undefined): string {
  const prefix = patientId || "unknown";

  // Try to get payor identifier from IN1-3 (Insurance Company ID)
  let payorId: string | undefined;

  if (in1.$3_insuranceCompanyId && in1.$3_insuranceCompanyId.length > 0) {
    payorId = in1.$3_insuranceCompanyId[0].$1_value;
  }

  // Fallback to first payor organization name
  if (
    !payorId &&
    in1.$4_insuranceCompanyName &&
    in1.$4_insuranceCompanyName.length > 0
  ) {
    const orgName = in1.$4_insuranceCompanyName[0].$1_name;
    if (orgName) {
      payorId = toKebabCase(orgName);
    }
  }

  // Final fallback to "coverage"
  if (!payorId) {
    payorId = "coverage";
  }

  return `${prefix}-${toKebabCase(payorId)}`;
}

/**
 * Check if IN1 segment has valid payor information
 * Returns true if IN1 has either:
 * - Insurance Company Name (IN1-4), OR
 * - Insurance Company ID (IN1-3)
 */
function hasValidPayorInfo(in1: IN1): boolean {
  // Check for Insurance Company Name (IN1-4)
  if (in1.$4_insuranceCompanyName && in1.$4_insuranceCompanyName.length > 0) {
    const hasName = in1.$4_insuranceCompanyName.some((xon) => xon.$1_name);
    if (hasName) return true;
  }

  // Check for Insurance Company ID (IN1-3)
  if (in1.$3_insuranceCompanyId && in1.$3_insuranceCompanyId.length > 0) {
    const hasId = in1.$3_insuranceCompanyId.some((cx) => cx.$1_value);
    if (hasId) return true;
  }

  return false;
}

// ============================================================================
// Main Converter Function
// ============================================================================

/**
 * Convert HL7v2 ADT_A01 message to FHIR Transaction Bundle
 *
 * Message Structure:
 * MSH - Message Header (1)
 * EVN - Event Type (1)
 * PID - Patient Identification (1)
 * PV1 - Patient Visit (1)
 * NK1 - Next of Kin (0..*)
 * DG1 - Diagnosis (0..*)
 * AL1 - Allergy Information (0..*)
 * IN1 - Insurance (0..*)
 */
export function convertADT_A01(message: string): Bundle {
  const parsed = parseMessage(message);

  // =========================================================================
  // Extract MSH
  // =========================================================================

  const mshSegment = findSegment(parsed, "MSH");
  if (!mshSegment) {
    throw new Error("MSH segment not found in ADT_A01 message");
  }
  const msh = fromMSH(mshSegment);
  const messageControlId = msh.$10_messageControlId;

  // Create base meta with tags
  const baseMeta: Meta = {
    tag: extractMetaTags(msh),
  };

  // =========================================================================
  // Extract PID -> Patient
  // =========================================================================

  const pidSegment = findSegment(parsed, "PID");
  if (!pidSegment) {
    throw new Error("PID segment not found in ADT_A01 message");
  }
  const pid = fromPID(pidSegment);
  const patient = convertPIDToPatient(pid);

  // Set patient ID from PID-2 or generate one
  if (pid.$2_patientId?.$1_value) {
    patient.id = pid.$2_patientId.$1_value;
  } else if (pid.$3_identifier?.[0]?.$1_value) {
    patient.id = pid.$3_identifier[0].$1_value;
  }

  // Add meta tags
  patient.meta = { ...patient.meta, ...baseMeta };

  // Add sender tag from MR identifier
  if (pid.$3_identifier) {
    for (const cx of pid.$3_identifier) {
      if (cx.$5_type === "MR" && cx.$4_system?.$1_namespace) {
        const senderTag: Coding = {
          code: cx.$4_system.$1_namespace.toLowerCase(),
          system: "urn:aidbox:hl7v2:sender",
        };
        if (!patient.meta?.tag?.some((t) => t.system === senderTag.system)) {
          patient.meta?.tag?.push(senderTag);
        }
      }
    }
  }

  const patientRef = patient.id ? `Patient/${patient.id}` : "Patient/unknown";

  // =========================================================================
  // Extract PV1 -> Encounter
  // =========================================================================

  let encounter: Encounter | undefined;
  const pv1Segment = findSegment(parsed, "PV1");
  if (pv1Segment) {
    const pv1 = fromPV1(pv1Segment);
    encounter = convertPV1ToEncounter(pv1);
    (encounter as { subject: { reference?: string } }).subject = {
      reference: patientRef,
    };

    // Generate encounter ID
    if (pv1.$19_visitNumber?.$1_value) {
      encounter.id = pv1.$19_visitNumber.$1_value;
    } else {
      encounter.id = generateId("encounter", 1, messageControlId);
    }
  }

  const encounterRef = encounter?.id ? `Encounter/${encounter.id}` : undefined;

  // =========================================================================
  // Extract NK1[] -> RelatedPerson[]
  // =========================================================================

  const relatedPersons: RelatedPerson[] = [];
  const nk1Segments = findAllSegments(parsed, "NK1");

  for (let i = 0; i < nk1Segments.length; i++) {
    const nk1 = fromNK1(nk1Segments[i]!);
    const relatedPerson = convertNK1ToRelatedPerson(nk1) as RelatedPerson;
    relatedPerson.patient = {
      reference: patientRef,
    } as RelatedPerson["patient"];
    relatedPerson.id = generateId("related-person", i + 1, messageControlId);
    relatedPersons.push(relatedPerson);
  }

  // =========================================================================
  // Extract DG1[] -> Condition[] (with deduplication)
  // =========================================================================

  const conditions: Condition[] = [];
  const dg1Segments = findAllSegments(parsed, "DG1");

  // Deduplicate by diagnosis code+display, keeping lowest priority
  const deduplicatedDG1 = prepareDG1ForExtraction(dg1Segments);

  for (let i = 0; i < deduplicatedDG1.length; i++) {
    const dg1 = fromDG1(deduplicatedDG1[i]!);
    const condition = convertDG1ToCondition(dg1) as Condition;
    condition.subject = { reference: patientRef } as Condition["subject"];

    // Link to encounter if available
    if (encounterRef) {
      condition.encounter = {
        reference: encounterRef,
      } as Condition["encounter"];
    }

    // Generate composite ID (encounter.id is mandatory for ADT_A01)
    condition.id = generateConditionId(dg1, encounter!.id!);
    conditions.push(condition);
  }

  // =========================================================================
  // Extract AL1[] -> AllergyIntolerance[]
  // =========================================================================

  const allergies: AllergyIntolerance[] = [];
  const al1Segments = findAllSegments(parsed, "AL1");

  for (let i = 0; i < al1Segments.length; i++) {
    const al1 = fromAL1(al1Segments[i]!);
    const allergy = convertAL1ToAllergyIntolerance(al1) as AllergyIntolerance;
    allergy.patient = {
      reference: patientRef,
    } as AllergyIntolerance["patient"];

    // Link to encounter if available
    if (encounterRef) {
      allergy.encounter = {
        reference: encounterRef,
      } as AllergyIntolerance["encounter"];
    }

    allergy.id = generateId("allergy", i + 1, messageControlId);
    allergies.push(allergy);
  }

  // =========================================================================
  // Extract IN1[] -> Coverage[] (with filtering)
  // =========================================================================

  const coverages: Coverage[] = [];
  const in1Segments = findAllSegments(parsed, "IN1");

  for (let i = 0; i < in1Segments.length; i++) {
    const in1 = fromIN1(in1Segments[i]!);

    // Skip IN1 segments without valid payor information
    if (!hasValidPayorInfo(in1)) {
      continue;
    }

    const coverage = convertIN1ToCoverage(in1) as Coverage;
    coverage.beneficiary = { reference: patientRef } as Coverage["beneficiary"];

    // Generate composite ID
    coverage.id = generateCoverageId(in1, patient.id);
    coverages.push(coverage);
  }

  // =========================================================================
  // Build Transaction Bundle
  // =========================================================================

  const entries: BundleEntry[] = [];

  // Add Patient (always first)
  entries.push(createBundleEntry(patient));

  // Add Encounter
  if (encounter) {
    entries.push(createBundleEntry(encounter));
  }

  // Add RelatedPersons
  for (const rp of relatedPersons) {
    entries.push(createBundleEntry(rp));
  }

  // Add Conditions
  for (const cond of conditions) {
    entries.push(createBundleEntry(cond));
  }

  // Add Allergies
  for (const allergy of allergies) {
    entries.push(createBundleEntry(allergy));
  }

  // Add Coverages
  for (const coverage of coverages) {
    entries.push(createBundleEntry(coverage));
  }

  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };

  return bundle;
}

export default convertADT_A01;

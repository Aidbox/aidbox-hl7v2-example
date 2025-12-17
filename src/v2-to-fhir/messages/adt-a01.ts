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
// Types
// ============================================================================

export interface ADT_A01_Bundle extends Bundle {
  type: "transaction";
  entry: BundleEntry[];
}

interface ConversionResult {
  bundle: ADT_A01_Bundle;
  patient?: Patient;
  encounter?: Encounter;
  relatedPersons: RelatedPerson[];
  conditions: Condition[];
  allergies: AllergyIntolerance[];
  coverages: Coverage[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function findSegment(
  message: HL7v2Message,
  name: string
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
  method: "PUT" | "POST" = "PUT"
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
export function convertADT_A01(message: string): ConversionResult {
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

  const patientRef = patient.id
    ? `Patient/${patient.id}`
    : "Patient/unknown";

  // =========================================================================
  // Extract PV1 -> Encounter
  // =========================================================================

  let encounter: Encounter | undefined;
  const pv1Segment = findSegment(parsed, "PV1");
  if (pv1Segment) {
    const pv1 = fromPV1(pv1Segment);
    encounter = convertPV1ToEncounter(pv1);
    (encounter as { subject: { reference?: string } }).subject = { reference: patientRef };

    // Generate encounter ID
    if (pv1.$19_visitNumber?.$1_value) {
      encounter.id = pv1.$19_visitNumber.$1_value;
    } else {
      encounter.id = generateId("encounter", 1, messageControlId);
    }
  }

  const encounterRef = encounter?.id
    ? `Encounter/${encounter.id}`
    : undefined;

  // =========================================================================
  // Extract NK1[] -> RelatedPerson[]
  // =========================================================================

  const relatedPersons: RelatedPerson[] = [];
  const nk1Segments = findAllSegments(parsed, "NK1");

  for (let i = 0; i < nk1Segments.length; i++) {
    const nk1 = fromNK1(nk1Segments[i]!);
    const relatedPerson = convertNK1ToRelatedPerson(nk1) as RelatedPerson;
    relatedPerson.patient = { reference: patientRef } as RelatedPerson["patient"];
    relatedPerson.id = generateId("related-person", i + 1, messageControlId);
    relatedPersons.push(relatedPerson);
  }

  // =========================================================================
  // Extract DG1[] -> Condition[]
  // =========================================================================

  const conditions: Condition[] = [];
  const dg1Segments = findAllSegments(parsed, "DG1");

  for (let i = 0; i < dg1Segments.length; i++) {
    const dg1 = fromDG1(dg1Segments[i]!);
    const condition = convertDG1ToCondition(dg1) as Condition;
    condition.subject = { reference: patientRef } as Condition["subject"];

    // Link to encounter if available
    if (encounterRef) {
      condition.encounter = { reference: encounterRef } as Condition["encounter"];
    }

    condition.id = generateId("condition", i + 1, messageControlId);
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
    allergy.patient = { reference: patientRef } as AllergyIntolerance["patient"];

    // Link to encounter if available
    if (encounterRef) {
      allergy.encounter = { reference: encounterRef } as AllergyIntolerance["encounter"];
    }

    allergy.id = generateId("allergy", i + 1, messageControlId);
    allergies.push(allergy);
  }

  // =========================================================================
  // Extract IN1[] -> Coverage[]
  // =========================================================================

  const coverages: Coverage[] = [];
  const in1Segments = findAllSegments(parsed, "IN1");

  for (let i = 0; i < in1Segments.length; i++) {
    const in1 = fromIN1(in1Segments[i]!);
    const coverage = convertIN1ToCoverage(in1) as Coverage;
    coverage.beneficiary = { reference: patientRef } as Coverage["beneficiary"];
    coverage.id = generateId("coverage", i + 1, messageControlId);
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

  const bundle: ADT_A01_Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };

  return {
    bundle,
    patient,
    encounter,
    relatedPersons,
    conditions,
    allergies,
    coverages,
  };
}

export default convertADT_A01;

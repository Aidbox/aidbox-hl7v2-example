/**
 * HL7v2 ADT_A03 Message to FHIR Bundle Converter
 * Based on: HL7 Message - FHIR R4_ ADT_A01 - Sheet1.csv (reused for A03)
 *
 * ADT_A03 - Discharge/End Visit
 *
 * Creates:
 * - Patient from PID
 * - Encounter from PV1 (status MUST be "finished")
 * - RelatedPerson[] from NK1[]
 * - Condition[] from DG1[]
 * - AllergyIntolerance[] from AL1[]
 * - Coverage[] from IN1[]
 *
 * Key difference from A01: Encounter.status = "finished" (unconditional), not derived from PV1-2.
 */

import type { HL7v2Message, HL7v2Segment } from "../../hl7v2/generated/types";
import { findSegment, findAllSegments, type ConversionResult } from "../converter";
import {
  fromMSH,
  fromPID,
  fromPV1,
  fromPV2,
  fromNK1,
  fromDG1,
  fromAL1,
  fromIN1,
  type DG1,
  type AL1,
} from "../../hl7v2/generated/fields";
import type {
  Encounter,
  RelatedPerson,
  Condition,
  AllergyIntolerance,
  Coverage,
  Coding,
  Meta,
} from "../../fhir/hl7-fhir-r4-core";
import type { DomainResource } from "../../fhir/hl7-fhir-r4-core/DomainResource";
import { convertPIDToPatient } from "../segments/pid-patient";
import { convertPV1WithMappingSupport } from "../segments/pv1-encounter";
import { convertNK1ToRelatedPerson } from "../segments/nk1-relatedperson";
import { convertDG1ToCondition } from "../segments/dg1-condition";
import { convertAL1ToAllergyIntolerance } from "../segments/al1-allergyintolerance";
import { convertIN1ToCoverage, generateCoverageId, hasValidPayorInfo } from "../segments/in1-coverage";
import { resourceExists } from "../../aidbox";
import { toKebabCase } from "../../utils/string";
import {
  buildMappingErrorResult,
  type MappingError,
} from "../../code-mapping/mapping-errors";
import type { SenderContext } from "../../code-mapping/concept-map";
import type { ConverterContext } from "../converter-context";
import { extractMetaTags } from "../segments/msh-parsing";

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(prefix: string, index: number, controlId?: string): string {
  const suffix = controlId ? `-${controlId}` : "";
  return `${prefix}-${index}${suffix}`;
}

function prepareDG1ForExtraction(segments: HL7v2Segment[]): HL7v2Segment[] {
  const grouped = new Map<
    string,
    { segment: HL7v2Segment; priority: number | null }[]
  >();

  for (const segment of segments) {
    const dg1 = fromDG1(segment);
    const priorityStr = dg1.$15_diagnosisPriority;
    const priority = priorityStr ? parseInt(priorityStr, 10) : null;
    const validPriority =
      priority && !isNaN(priority) && priority > 0 ? priority : null;

    const code = dg1.$3_diagnosisCodeDg1?.$1_code || "";
    const display =
      dg1.$3_diagnosisCodeDg1?.$2_text || dg1.$4_diagnosisDescription || "";
    const key = `${code}|${display}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push({ segment, priority: validPriority });
  }

  const deduplicated: HL7v2Segment[] = [];
  for (const items of grouped.values()) {
    items.sort((a, b) => {
      if (a.priority === null && b.priority === null) {return 0;}
      if (a.priority === null) {return 1;}
      if (b.priority === null) {return -1;}
      return a.priority - b.priority;
    });

    const first = items[0];
    if (first) {deduplicated.push(first.segment);}
  }

  return deduplicated;
}

function generateConditionId(dg1: DG1, prefix: string): string {
  const conditionName =
    dg1.$4_diagnosisDescription ||
    dg1.$3_diagnosisCodeDg1?.$2_text ||
    dg1.$3_diagnosisCodeDg1?.$1_code ||
    "condition";

  const kebabName = toKebabCase(conditionName);
  return `${prefix}-${kebabName}`;
}

function generateAllergyId(al1: AL1, patientId: string | undefined): string {
  const prefix = patientId || "unknown";
  const allergen = al1.$3_allergenCodeMnemonicDescription;
  const allergenName = allergen?.$1_code ?? allergen?.$2_text ?? "";

  return `${prefix}-${toKebabCase(allergenName)}`;
}

function hasValidAllergenInfo(al1: AL1): boolean {
  return !!(
    al1.$3_allergenCodeMnemonicDescription?.$1_code ||
    al1.$3_allergenCodeMnemonicDescription?.$2_text
  );
}

// ============================================================================
// Main Converter Function
// ============================================================================

/**
 * Convert HL7v2 ADT_A03 message to FHIR Transaction Bundle
 *
 * Discharge/End Visit notification. Encounter status is unconditionally "finished".
 * Reuses ADT_A01 segment converters and structure.
 */
export async function convertADT_A03(
  parsed: HL7v2Message,
  context: ConverterContext,
): Promise<ConversionResult> {
  const { resolvePatientId, config } = context;

  // =========================================================================
  // Extract MSH
  // =========================================================================

  const mshSegment = findSegment(parsed, "MSH");
  if (!mshSegment) {
    throw new Error("MSH segment not found in ADT_A03 message");
  }
  const msh = fromMSH(mshSegment);
  const messageControlId = msh.$10_messageControlId;
  const sendingApplication = msh.$3_sendingApplication?.$1_namespace;
  const sendingFacility = msh.$4_sendingFacility?.$1_namespace;

  if (!sendingApplication || !sendingFacility) {
    throw new Error(
      `MSH-3 (sending application) and MSH-4 (sending facility) are required. ` +
        `Got: MSH-3="${sendingApplication || ""}", MSH-4="${sendingFacility || ""}"`,
    );
  }

  const senderContext: SenderContext = { sendingApplication, sendingFacility };
  const baseMeta: Meta = {
    tag: extractMetaTags(msh),
  };

  // =========================================================================
  // Extract PID -> Patient
  // =========================================================================

  const pidSegment = findSegment(parsed, "PID");
  if (!pidSegment) {
    throw new Error("PID segment not found in ADT_A03 message");
  }
  const pid = fromPID(pidSegment);
  const patient = convertPIDToPatient(pid, context.patientPolicy);
  const mappingErrors: MappingError[] = [];

  const patientIdResult = await resolvePatientId(pid.$3_identifier ?? []);
  if ("error" in patientIdResult) {
    return {
      messageUpdate: { status: "conversion_error", error: patientIdResult.error },
    };
  }
  patient.id = patientIdResult.id;
  patient.meta = { ...patient.meta, ...baseMeta };

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
  const patientKnown = patient.id && await resourceExists("Patient", patient.id);

  // =========================================================================
  // Extract PV1 -> Encounter (required for A03, status="finished")
  // =========================================================================

  const pv1Required = config.messages?.["ADT-A03"]?.converter?.PV1?.required ?? true;

  let encounter: Encounter | undefined;
  let encounterWarning: string | undefined;
  const pv1Segment = findSegment(parsed, "PV1");

  if (!pv1Segment) {
    if (pv1Required) {
      return {
        messageUpdate: {
          status: "conversion_error",
          error: "PV1 segment is required for ADT-A03 but missing",
          patient: patientKnown ? { reference: `Patient/${patient.id}` } : undefined,
        },
      };
    }
    encounterWarning = "PV1 segment is missing; Encounter creation skipped";
  } else {
    const pv1 = fromPV1(pv1Segment);
    const pv1Result = await convertPV1WithMappingSupport(pv1, senderContext);

    if (pv1Result.mappingError) {
      mappingErrors.push(pv1Result.mappingError);
    }

    if (pv1Result.identifierError) {
      if (pv1Required) {
        return {
          messageUpdate: {
            status: "conversion_error",
            error: pv1Result.identifierError,
            patient: patientKnown ? { reference: `Patient/${patient.id}` } : undefined,
          },
        };
      }
      encounterWarning = pv1Result.identifierError;
    } else {
      encounter = pv1Result.encounter;
      encounter.subject = { reference: patientRef } as Encounter["subject"];

      // REQ-1: Override status to "finished" unconditionally for A03 discharge
      encounter.status = "finished";

      // Handle PV2 fields if present
      const pv2Segment = findSegment(parsed, "PV2");
      if (pv2Segment) {
        const pv2 = fromPV2(pv2Segment);

        // REQ-9: PV2-3 Admit Reason → Encounter.reasonCode
        if (pv2.$3_admitReason) {
          if (!encounter.reasonCode) {
            encounter.reasonCode = [];
          }
          encounter.reasonCode.push({
            coding: [
              {
                code: pv2.$3_admitReason.$1_code,
                display: pv2.$3_admitReason.$2_text,
              },
            ],
          });
        }

        // REQ-10: PV2-11 Actual Length of Inpatient Stay → Encounter.length
        if (pv2.$11_actualLengthOfInpatientStay) {
          const los = parseInt(pv2.$11_actualLengthOfInpatientStay, 10);
          if (!isNaN(los) && los > 0) {
            encounter.length = {
              value: los,
              unit: "days",
              system: "http://unitsofmeasure.org",
              code: "d",
            };
          }
        }

        // REQ-11: PV2-12 Visit Description → Encounter.text.div
        if (pv2.$12_visitDescription) {
          encounter.text = {
            status: "generated",
            div: pv2.$12_visitDescription,
          };
        }

        // REQ-12: PV2-25 Visit Priority Code → Encounter.priority
        if (pv2.$25_visitPriorityCode) {
          const priority = pv2.$25_visitPriorityCode;
          const code = typeof priority === "string" ? priority : priority;
          encounter.priority = {
            coding: [
              {
                code: code,
              },
            ],
          };
        }
      }
    }
  }

  if (mappingErrors.length > 0) {
    return buildMappingErrorResult(senderContext, mappingErrors);
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
  const deduplicatedDG1 = prepareDG1ForExtraction(dg1Segments);

  for (let i = 0; i < deduplicatedDG1.length; i++) {
    const dg1 = fromDG1(deduplicatedDG1[i]!);
    const condition = convertDG1ToCondition(dg1) as Condition;
    condition.subject = { reference: patientRef } as Condition["subject"];

    if (encounterRef) {
      condition.encounter = {
        reference: encounterRef,
      } as Condition["encounter"];
    }

    const conditionIdPrefix = encounter?.id ?? patient.id ?? "unknown";
    condition.id = generateConditionId(dg1, conditionIdPrefix);
    conditions.push(condition);
  }

  // =========================================================================
  // Extract AL1[] -> AllergyIntolerance[] (with filtering)
  // =========================================================================

  const allergies: AllergyIntolerance[] = [];
  const al1Segments = findAllSegments(parsed, "AL1");

  for (let i = 0; i < al1Segments.length; i++) {
    const al1 = fromAL1(al1Segments[i]!);

    if (!hasValidAllergenInfo(al1)) {
      continue;
    }

    const allergy = convertAL1ToAllergyIntolerance(al1) as AllergyIntolerance;
    allergy.patient = {
      reference: patientRef,
    } as AllergyIntolerance["patient"];

    if (encounterRef) {
      allergy.encounter = {
        reference: encounterRef,
      } as AllergyIntolerance["encounter"];
    }

    allergy.id = generateAllergyId(al1, patient.id);
    allergies.push(allergy);
  }

  // =========================================================================
  // Extract IN1[] -> Coverage[] (with filtering)
  // =========================================================================

  const coverages: Coverage[] = [];
  const in1Segments = findAllSegments(parsed, "IN1");

  for (let i = 0; i < in1Segments.length; i++) {
    const in1 = fromIN1(in1Segments[i]!);

    if (!hasValidPayorInfo(in1)) {
      continue;
    }

    const coverage = convertIN1ToCoverage(in1) as Coverage;
    coverage.beneficiary = { reference: patientRef } as Coverage["beneficiary"];
    coverage.id = generateCoverageId(in1, patient.id);
    coverages.push(coverage);
  }

  // =========================================================================
  // Collect Entries
  // =========================================================================

  const entries: DomainResource[] = [patient];
  if (encounter) {entries.push(encounter);}
  entries.push(...relatedPersons, ...conditions, ...allergies, ...coverages);

  if (encounterWarning) {
    return {
      entries,
      messageUpdate: {
        status: "warning",
        error: encounterWarning,
        patient: patient.id ? { reference: `Patient/${patient.id}` } : undefined,
      },
    };
  }

  return {
    entries,
    messageUpdate: {
      status: "processed",
      patient: patient.id ? { reference: `Patient/${patient.id}` } : undefined,
    },
  };
}

export default convertADT_A03;

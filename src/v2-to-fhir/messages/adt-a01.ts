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

import type { HL7v2Message, HL7v2Segment } from "../../hl7v2/generated/types";
import { findSegment, findAllSegments, type ConversionResult } from "../converter";
import {
  fromMSH,
  fromPID,
  fromPV1,
  fromNK1,
  fromDG1,
  fromAL1,
  fromIN1,
  type MSH,
  type DG1,
  type IN1,
  type AL1,
  type XON,
  type CX,
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
import { convertPV1WithMappingSupport } from "../segments/pv1-encounter";
import { convertNK1ToRelatedPerson } from "../segments/nk1-relatedperson";
import { convertDG1ToCondition } from "../segments/dg1-condition";
import { convertAL1ToAllergyIntolerance } from "../segments/al1-allergyintolerance";
import { convertIN1ToCoverage } from "../segments/in1-coverage";
import { resourceExists } from "../../aidbox";
import { toKebabCase } from "../../utils/string";
import {
  buildMappingErrorResult,
  type MappingError,
} from "../../code-mapping/mapping-errors";
import type { SenderContext } from "../../code-mapping/concept-map";
import { hl7v2ToFhirConfig } from "../config";

// ============================================================================
// Helper Functions
// ============================================================================

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

    const first = items[0];
    if (first) deduplicated.push(first.segment);
  }

  return deduplicated;
}

/**
 * Generate composite condition ID
 * Format: {prefix}-{kebab-case-name}
 * Prefix is encounter.id when available, falls back to patient.id
 */
function generateConditionId(dg1: DG1, prefix: string): string {
  // Extract condition name (prefer description, then display, then code)
  const conditionName =
    dg1.$4_diagnosisDescription ||
    dg1.$3_diagnosisCodeDg1?.$2_text ||
    dg1.$3_diagnosisCodeDg1?.$1_code ||
    "condition";

  const kebabName = toKebabCase(conditionName);
  return `${prefix}-${kebabName}`;
}

/**
 * Generate composite coverage ID
 * Format: {patientId}-{payor-identifier}
 * Payor identifier extracted from IN1-3 or IN1-4
 */
function generateCoverageId(in1: IN1, patientId: string | undefined): string {
  const prefix = patientId || "unknown";

  // Try to get payor identifier from IN1-3 (Insurance Company ID)
  let payorId: string | undefined;

  if (in1.$3_insuranceCompanyId && in1.$3_insuranceCompanyId.length > 0) {
    payorId = in1.$3_insuranceCompanyId[0]?.$1_value;
  }

  // Fallback to first payor organization name
  if (
    !payorId &&
    in1.$4_insuranceCompanyName &&
    in1.$4_insuranceCompanyName.length > 0
  ) {
    const orgName = in1.$4_insuranceCompanyName[0]?.$1_name;
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
    const hasName = in1.$4_insuranceCompanyName.some((xon: XON) => xon.$1_name);
    if (hasName) return true;
  }

  // Check for Insurance Company ID (IN1-3)
  if (in1.$3_insuranceCompanyId && in1.$3_insuranceCompanyId.length > 0) {
    const hasId = in1.$3_insuranceCompanyId.some((cx: CX) => cx.$1_value);
    if (hasId) return true;
  }

  return false;
}

/**
 * Generate composite allergy ID
 * Format: {patientId}-{kebab-case-allergen-name}
 * Patient ID is mandatory for ADT_A01
 */
function generateAllergyId(al1: AL1, patientId: string | undefined): string {
  const prefix = patientId || "unknown";

  // Extract allergen name from AL1.3 (guaranteed to exist by hasValidAllergenInfo filter)
  const allergenName =
    al1.$3_allergenCodeMnemonicDescription?.$1_code ||
    al1.$3_allergenCodeMnemonicDescription?.$2_text!;

  return `${prefix}-${toKebabCase(allergenName)}`;
}

/**
 * Check if AL1 segment has valid allergen information
 * AL1.3 (Allergen Code/Mnemonic/Description) is required per HL7v2 spec
 */
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
export async function convertADT_A01(parsed: HL7v2Message): Promise<ConversionResult> {
  // =========================================================================
  // Extract MSH
  // =========================================================================

  const mshSegment = findSegment(parsed, "MSH");
  if (!mshSegment) {
    throw new Error("MSH segment not found in ADT_A01 message");
  }
  const msh = fromMSH(mshSegment);
  const messageControlId = msh.$10_messageControlId;

  // Extract sender context for mapping error handling
  const sendingApplication = msh.$3_sendingApplication?.$1_namespace;
  const sendingFacility = msh.$4_sendingFacility?.$1_namespace;

  if (!sendingApplication || !sendingFacility) {
    throw new Error(
      `MSH-3 (sending application) and MSH-4 (sending facility) are required. ` +
        `Got: MSH-3="${sendingApplication || ""}", MSH-4="${sendingFacility || ""}"`,
    );
  }

  const senderContext: SenderContext = { sendingApplication, sendingFacility };

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
  const mappingErrors: MappingError[] = [];

  // Set patient ID from PID-2 or generate one
  if (pid.$2_patientId?.$1_value) {
    patient.id = pid.$2_patientId.$1_value;
  } else if (pid.$3_identifier?.[0]?.$1_value) {
    patient.id = pid.$3_identifier[0].$1_value;
  }
  // DESIGN PROTOTYPE: 2026-02-19-patient-encounter-identity.md
  // Replace the ad-hoc block above (lines 331-335) with:
  //
  //   const patientIdResult = await selectPatientId(
  //     pid.$3_identifier ?? [],       // PID-3 after preprocessing (merge-pid2-into-pid3 already ran)
  //     config.identifierPriority,     // config now has top-level identifierPriority (not config["ADT-A01"])
  //     mpiClient,                     // injected MpiClient (StubMpiClient by default)
  //   );
  //   if ('error' in patientIdResult) {
  //     throw new Error(`Patient ID selection failed: ${patientIdResult.error}`);
  //   }
  //   patient.id = patientIdResult.id;
  //
  // Also update config access below from config["ADT-A01"] to config.messages["ADT-A01"].
  // END DESIGN PROTOTYPE

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

  // NOTE: only used for pv1 error handling right now, but will be used to avoid a new patient generation in the future
  const patientKnown = patient.id && await resourceExists("Patient", patient.id);

  // =========================================================================
  // Extract PV1 -> Encounter (config-driven PV1 policy)
  // =========================================================================
  const config = hl7v2ToFhirConfig();
  const pv1Required = config["ADT-A01"]?.converter?.PV1?.required ?? true;

  let encounter: Encounter | undefined;
  let encounterWarning: string | undefined;
  const pv1Segment = findSegment(parsed, "PV1");

  if (!pv1Segment) {
    if (pv1Required) {
      return {
        messageUpdate: {
          status: "error",
          error: "PV1 segment is required for ADT-A01 but missing",
          patient: patientKnown ? { reference: `Patient/${patient.id}` } : undefined,
        },
      };
    }
    // PV1 not required and missing: skip Encounter, warn
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
            status: "error",
            error: pv1Result.identifierError,
            patient: patientKnown ? { reference: `Patient/${patient.id}` } : undefined,
          },
        };
      }
      encounterWarning = pv1Result.identifierError;
    } else {
      encounter = pv1Result.encounter;
      encounter.subject = { reference: patientRef } as Encounter["subject"];
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

    // Skip AL1 segments without valid allergen information
    if (!hasValidAllergenInfo(al1)) {
      continue;
    }

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

    // Generate composite ID
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

  if (encounterWarning) {
    return {
      bundle,
      messageUpdate: {
        status: "warning",
        error: encounterWarning,
        patient: patient.id ? { reference: `Patient/${patient.id}` } : undefined,
      },
    };
  }

  return {
    bundle,
    messageUpdate: {
      status: "processed",
      patient: patient.id ? { reference: `Patient/${patient.id}` } : undefined,
    },
  };
}

export default convertADT_A01;

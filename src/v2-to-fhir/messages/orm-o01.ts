/**
 * HL7v2 ORM_O01 Message to FHIR Bundle Converter
 *
 * ORM_O01 - General Order Message
 *
 * Creates:
 * - ServiceRequest from ORC + OBR (diagnostic/lab/radiology orders)
 * - MedicationRequest from ORC + RXO (pharmacy/medication orders)
 * - Condition from DG1
 * - Observation from OBX (supporting observations, no LOINC resolution)
 * - Coverage from IN1
 *
 * Supports multiple ORDER groups per message with independent order types.
 */

import type { HL7v2Message, HL7v2Segment } from "../../hl7v2/generated/types";
import type { ORC, PV1, EI } from "../../hl7v2/generated/fields";
import { fromORC, fromPID, fromOBR, fromDG1, fromIN1, fromNTE } from "../../hl7v2/generated/fields";
import { fromOBX, fromRXO } from "../../hl7v2/wrappers";
import { sanitizeForId } from "../identity-system/utils";
import { findSegment, findAllSegments, type ConversionResult } from "../converter";
import type {
  Bundle,
  BundleEntry,
  ServiceRequest,
  MedicationRequest,
  Condition,
  Observation,
  Coverage,
  Annotation,
  Meta,
  Reference,
} from "../../fhir/hl7-fhir-r4-core";
import type { SenderContext } from "../../code-mapping/concept-map";
import type { ConverterContext } from "../converter-context";
import type { MappingError } from "../../code-mapping/mapping-errors";
import { buildMappingErrorResult } from "../../code-mapping/mapping-errors";
import { parseMSH, addSenderTagToMeta } from "../segments/msh-parsing";
import { handlePatient, extractSenderTag } from "../segments/pid-patient";
import { parsePV1, handleEncounter } from "../segments/pv1-encounter";
import { convertORCToServiceRequest, resolveOrderStatus } from "../segments/orc-servicerequest";
import { mergeOBRIntoServiceRequest } from "../segments/obr-servicerequest";
import { convertRXOToMedicationRequest } from "../segments/rxo-medicationrequest";
import { convertDG1ToCondition } from "../segments/dg1-condition";
import { convertNTEsToAnnotation } from "../segments/nte-annotation";
import { convertOBXWithMappingSupportAsync } from "../segments/obx-observation";
import { convertIN1ToCoverage, generateCoverageId, hasValidPayorInfo } from "../segments/in1-coverage";
import { createBundleEntry } from "../fhir-bundle";

// ============================================================================
// Order Grouping Types
// ============================================================================

export interface ORMOrderGroup {
  orc: HL7v2Segment;
  orderChoice?: HL7v2Segment;
  orderChoiceType: "OBR" | "RXO" | "unknown";
  ntes: HL7v2Segment[];
  dg1s: HL7v2Segment[];
  observations: Array<{ obx: HL7v2Segment; ntes: HL7v2Segment[] }>;
}

// ============================================================================
// Order Grouping
// ============================================================================

/**
 * Group ORM message segments by ORC boundaries.
 *
 * Each ORC starts a new ORDER group. Segments between ORCs belong to
 * the current group. The ORDER_CHOICE type is detected by scanning for
 * the first OBR or RXO segment within the group.
 *
 * NTE placement: NTEs after an OBX attach to that observation;
 * NTEs after OBR/RXO (before any OBX) attach as order-level notes.
 *
 * Only processes segments after the first ORC (PID, PV1, IN1 etc.
 * are handled separately by the main converter).
 */
export function groupORMOrders(message: HL7v2Message): ORMOrderGroup[] {
  const groups: ORMOrderGroup[] = [];
  let currentGroup: ORMOrderGroup | null = null;
  let currentObservation: { obx: HL7v2Segment; ntes: HL7v2Segment[] } | null = null;
  let firstOrcSeen = false;

  for (const segment of message) {
    switch (segment.segment) {
      case "ORC": {
        // Flush pending observation from previous group
        if (currentObservation && currentGroup) {
          currentGroup.observations.push(currentObservation);
          currentObservation = null;
        }

        firstOrcSeen = true;
        currentGroup = {
          orc: segment,
          orderChoiceType: "unknown",
          ntes: [],
          dg1s: [],
          observations: [],
        };
        groups.push(currentGroup);
        break;
      }

      case "OBR": {
        if (!firstOrcSeen || !currentGroup) break;
        if (!currentGroup.orderChoice) {
          currentGroup.orderChoice = segment;
          currentGroup.orderChoiceType = "OBR";
        }
        break;
      }

      case "RXO": {
        if (!firstOrcSeen || !currentGroup) break;
        if (!currentGroup.orderChoice) {
          currentGroup.orderChoice = segment;
          currentGroup.orderChoiceType = "RXO";
        }
        break;
      }

      case "NTE": {
        if (!firstOrcSeen || !currentGroup) break;
        if (currentObservation) {
          // NTE after OBX -> observation-level note
          currentObservation.ntes.push(segment);
        } else {
          // NTE before any OBX -> order-level note
          currentGroup.ntes.push(segment);
        }
        break;
      }

      case "DG1": {
        if (!firstOrcSeen || !currentGroup) break;
        currentGroup.dg1s.push(segment);
        break;
      }

      case "OBX": {
        if (!firstOrcSeen || !currentGroup) break;
        // Flush previous observation
        if (currentObservation) {
          currentGroup.observations.push(currentObservation);
        }
        currentObservation = { obx: segment, ntes: [] };
        break;
      }
    }
  }

  // Flush last pending observation
  if (currentObservation && currentGroup) {
    currentGroup.observations.push(currentObservation);
  }

  return groups;
}

// ============================================================================
// Order Number Resolution
// ============================================================================

export interface OrderNumberResult {
  orderNumber: string;
  error?: never;
}

export interface OrderNumberError {
  orderNumber?: never;
  error: string;
}

/**
 * Resolve the deterministic order number for an ORDER group.
 *
 * Priority:
 * 1. ORC-2 (Placer Order Number) - EI.1, optionally suffixed with -EI.2 when namespace present
 * 2. OBR-2 (Placer Order Number) fallback - only for OBR-based orders, same format
 * 3. Reject with error if neither provides a usable identifier
 *
 * @param orc - Parsed ORC segment
 * @param obrPlacerOrderNumber - OBR-2 Placer Order Number (only for OBR-based orders)
 */
export function resolveOrderNumber(
  orc: ORC,
  obrPlacerOrderNumber?: EI,
): OrderNumberResult | OrderNumberError {
  const orcId = buildIdFromEI(orc.$2_placerOrderNumber);
  if (orcId) {
    return { orderNumber: orcId };
  }

  if (obrPlacerOrderNumber) {
    const obrId = buildIdFromEI(obrPlacerOrderNumber);
    if (obrId) {
      return { orderNumber: obrId };
    }
  }

  return { error: "No usable order number: ORC-2 empty and OBR-2 empty (or not applicable)" };
}

/**
 * Build a sanitized ID string from an EI (Entity Identifier) field.
 *
 * Uses EI.1 as the base. If EI.2 (namespace) is present and different
 * from EI.1, appends it as a suffix: `{EI.1}-{EI.2}`.
 */
function buildIdFromEI(ei: EI | undefined): string | undefined {
  const value = ei?.$1_value?.trim();
  if (!value) return undefined;

  const namespace = ei?.$2_namespace?.trim();
  const namespaceDiffers = namespace && namespace !== value;

  const raw = namespaceDiffers ? `${value}-${namespace}` : value;
  return sanitizeForId(raw);
}

// ============================================================================
// Empty PV1 Detection
// ============================================================================

/**
 * Detect whether a PV1 segment has no meaningful clinical content.
 *
 * An empty PV1 (e.g., `PV1|`) has no PV1-2 (patient class) and no PV1-19
 * (visit number). Such segments are treated as absent by the ORM converter
 * to avoid generating spurious warnings.
 */
export function isEmptyPV1(pv1: PV1): boolean {
  const hasPatientClass = pv1.$2_class !== undefined && pv1.$2_class !== "";
  const hasVisitNumber = pv1.$19_visitNumber?.$1_value !== undefined
    && pv1.$19_visitNumber.$1_value !== "";

  return !hasPatientClass && !hasVisitNumber;
}

// ============================================================================
// PID Parsing
// ============================================================================

function parseORMPID(message: HL7v2Message) {
  const pidSegment = findSegment(message, "PID");
  if (!pidSegment) {
    throw new Error("PID segment is required for ORM_O01 messages");
  }
  return fromPID(pidSegment);
}

// ============================================================================
// Coverage Processing
// ============================================================================

function processIN1Segments(
  message: HL7v2Message,
  patientId: string | undefined,
  patientRef: Reference<"Patient">,
  baseMeta: Meta,
): BundleEntry[] {
  const in1Segments = findAllSegments(message, "IN1");
  const entries: BundleEntry[] = [];

  for (const segment of in1Segments) {
    const in1 = fromIN1(segment);

    if (!hasValidPayorInfo(in1)) continue;

    const coverage = convertIN1ToCoverage(in1) as Coverage;
    coverage.beneficiary = patientRef as Coverage["beneficiary"];
    coverage.id = generateCoverageId(in1, patientId);
    coverage.meta = { ...coverage.meta, ...baseMeta };
    entries.push(createBundleEntry(coverage));
  }

  return entries;
}

// ============================================================================
// DG1 -> Condition Processing
// ============================================================================

function processDG1Segments(
  dg1Segments: HL7v2Segment[],
  orderNumber: string,
  patientRef: Reference<"Patient">,
  encounterRef: Reference<"Encounter"> | null,
  baseMeta: Meta,
): { conditions: Condition[]; entries: BundleEntry[] } {
  const conditions: Condition[] = [];
  const entries: BundleEntry[] = [];

  for (let i = 0; i < dg1Segments.length; i++) {
    const dg1 = fromDG1(dg1Segments[i]!);
    const condition = convertDG1ToCondition(dg1) as Condition;

    condition.subject = patientRef as Condition["subject"];
    if (encounterRef) {
      condition.encounter = encounterRef as Condition["encounter"];
    }

    // Positional ID: {orderNumber}-dg1-{1-based index}
    condition.id = `${orderNumber}-dg1-${i + 1}`;
    condition.meta = { ...condition.meta, ...baseMeta };

    conditions.push(condition);
    entries.push(createBundleEntry(condition));
  }

  return { conditions, entries };
}

// ============================================================================
// NTE -> Annotation Processing
// ============================================================================

function processOrderNTEs(nteSegments: HL7v2Segment[]): Annotation[] {
  if (nteSegments.length === 0) return [];

  const parsedNtes = nteSegments.map((seg) => fromNTE(seg));
  const annotation = convertNTEsToAnnotation(parsedNtes);
  return annotation ? [annotation] : [];
}

// ============================================================================
// OBX -> Observation Processing (ORM context: no LOINC resolution)
// ============================================================================

/**
 * Process OBX segments in ORM context.
 *
 * ORM OBX segments are supporting observations (ask-at-order-entry questions,
 * clinical context), NOT lab results. They are NOT subject to LOINC resolution.
 * When OBX-11 is missing, defaults to "registered" instead of creating a mapping error.
 */
async function processORMObservations(
  observationGroups: ORMOrderGroup["observations"],
  orderNumber: string,
  senderContext: SenderContext,
  baseMeta: Meta,
): Promise<{ observations: Observation[]; mappingErrors: MappingError[] }> {
  const observations: Observation[] = [];
  const mappingErrors: MappingError[] = [];

  for (let i = 0; i < observationGroups.length; i++) {
    const group = observationGroups[i]!;
    const obx = fromOBX(group.obx);

    // Default missing OBX-11 to "registered" in ORM context
    if (!obx.$11_observationResultStatus?.trim()) {
      obx.$11_observationResultStatus = "I"; // "I" maps to "registered" in OBX11_STATUS_MAP
    }

    // Use positional ID: {orderNumber}-obx-{1-based index}
    const positionalOrderNumber = `${orderNumber}-obx-${i + 1}`.replace(/[^a-z0-9-]/g, "-");

    // convertOBXWithMappingSupportAsync handles status mapping but not LOINC
    const result = await convertOBXWithMappingSupportAsync(obx, orderNumber, senderContext);

    if (result.error) {
      mappingErrors.push(result.error);
      continue;
    }

    const observation = result.observation;
    // Override the ID with positional ID
    observation.id = positionalOrderNumber;
    observation.meta = { ...observation.meta, ...baseMeta };

    // Add observation-level NTEs
    if (group.ntes.length > 0) {
      const ntes = group.ntes.map((seg) => fromNTE(seg));
      const annotation = convertNTEsToAnnotation(ntes);
      if (annotation) {
        observation.note = [annotation];
      }
    }

    observations.push(observation);
  }

  return { observations, mappingErrors };
}

// ============================================================================
// OBR-Based Order Group Processing
// ============================================================================

interface ProcessOrderGroupResult {
  entries: BundleEntry[];
  mappingErrors: MappingError[];
}

async function processOBROrderGroup(
  group: ORMOrderGroup,
  senderContext: SenderContext,
  baseMeta: Meta,
  patientRef: Reference<"Patient">,
  patientId: string | undefined,
  encounterRef: Reference<"Encounter"> | null,
): Promise<ProcessOrderGroupResult> {
  const entries: BundleEntry[] = [];
  const mappingErrors: MappingError[] = [];

  const orc = fromORC(group.orc);
  const obr = fromOBR(group.orderChoice!);

  // Resolve order number (ORC-2, fallback to OBR-2)
  const orderNumberResult = resolveOrderNumber(orc, obr.$2_placerOrderNumber);
  if ("error" in orderNumberResult) {
    return { entries: [], mappingErrors: [] };
  }
  const orderNumber = orderNumberResult.orderNumber;

  // Build ServiceRequest from ORC
  const orcResult = await convertORCToServiceRequest(orc, senderContext);
  if (orcResult.mappingError) {
    mappingErrors.push(orcResult.mappingError);
    return { entries: [], mappingErrors };
  }

  const serviceRequest = orcResult.serviceRequest as ServiceRequest;
  serviceRequest.resourceType = "ServiceRequest";

  // Merge OBR fields
  mergeOBRIntoServiceRequest(obr, serviceRequest, orc);

  // Set ID, subject, encounter, meta
  serviceRequest.id = orderNumber;
  serviceRequest.subject = patientRef as ServiceRequest["subject"];
  if (encounterRef) {
    serviceRequest.encounter = encounterRef;
  }
  serviceRequest.meta = { ...serviceRequest.meta, ...baseMeta };

  // Process DG1 -> Conditions
  const { conditions, entries: conditionEntries } = processDG1Segments(
    group.dg1s, orderNumber, patientRef, encounterRef, baseMeta,
  );
  entries.push(...conditionEntries);

  // Link Conditions to ServiceRequest.reasonReference
  if (conditions.length > 0) {
    serviceRequest.reasonReference = conditions.map(
      (c) => ({ reference: `Condition/${c.id}` }) as Reference<"Condition">,
    );
  }

  // Process NTEs -> ServiceRequest.note
  const notes = processOrderNTEs(group.ntes);
  if (notes.length > 0) {
    serviceRequest.note = notes;
  }

  // Process OBX -> Observations (no LOINC resolution)
  const { observations, mappingErrors: obxErrors } = await processORMObservations(
    group.observations, orderNumber, senderContext, baseMeta,
  );
  mappingErrors.push(...obxErrors);

  // Link Observations to Patient and Encounter
  for (const obs of observations) {
    obs.subject = patientRef as Observation["subject"];
    if (encounterRef) {
      obs.encounter = encounterRef as Observation["encounter"];
    }
  }

  // Link Observations to ServiceRequest.supportingInfo
  if (observations.length > 0) {
    serviceRequest.supportingInfo = observations.map(
      (o) => ({ reference: `Observation/${o.id}` } as unknown as Reference<"Resource">),
    );
  }

  if (mappingErrors.length > 0) {
    return { entries: [], mappingErrors };
  }

  // Add ServiceRequest entry first, then observations
  entries.unshift(createBundleEntry(serviceRequest));
  for (const obs of observations) {
    entries.push(createBundleEntry(obs));
  }

  return { entries, mappingErrors: [] };
}

// ============================================================================
// RXO-Based Order Group Processing
// ============================================================================

async function processRXOOrderGroup(
  group: ORMOrderGroup,
  senderContext: SenderContext,
  baseMeta: Meta,
  patientRef: Reference<"Patient">,
  encounterRef: Reference<"Encounter"> | null,
): Promise<ProcessOrderGroupResult> {
  const entries: BundleEntry[] = [];
  const mappingErrors: MappingError[] = [];

  const orc = fromORC(group.orc);

  // Resolve order number (ORC-2 only for RXO, no OBR fallback)
  const orderNumberResult = resolveOrderNumber(orc);
  if ("error" in orderNumberResult) {
    return { entries: [], mappingErrors: [] };
  }
  const orderNumber = orderNumberResult.orderNumber;

  // Resolve ORC status (same three-tier logic as OBR orders)
  const statusResult = await resolveOrderStatus(orc, senderContext);
  if (statusResult.mappingError) {
    mappingErrors.push(statusResult.mappingError);
    return { entries: [], mappingErrors };
  }

  // Build MedicationRequest from RXO
  const rxo = fromRXO(group.orderChoice!);
  const medicationRequest = convertRXOToMedicationRequest(rxo, statusResult.status) as MedicationRequest;

  // Set ID, subject, encounter, meta
  medicationRequest.id = orderNumber;
  medicationRequest.subject = patientRef as MedicationRequest["subject"];
  if (encounterRef) {
    medicationRequest.encounter = encounterRef;
  }
  medicationRequest.meta = { ...medicationRequest.meta, ...baseMeta };

  // Process DG1 -> Conditions, linked via MedicationRequest.reasonReference
  const { conditions, entries: conditionEntries } = processDG1Segments(
    group.dg1s, orderNumber, patientRef, encounterRef, baseMeta,
  );
  entries.push(...conditionEntries);

  if (conditions.length > 0) {
    medicationRequest.reasonReference = conditions.map(
      (c) => ({ reference: `Condition/${c.id}` }) as Reference<"Condition">,
    );
  }

  // Process NTEs -> MedicationRequest.note
  const notes = processOrderNTEs(group.ntes);
  if (notes.length > 0) {
    medicationRequest.note = notes;
  }

  // Process OBX -> Observations (no LOINC resolution)
  const { observations, mappingErrors: obxErrors } = await processORMObservations(
    group.observations, orderNumber, senderContext, baseMeta,
  );
  mappingErrors.push(...obxErrors);

  // Link Observations to Patient and Encounter
  for (const obs of observations) {
    obs.subject = patientRef as Observation["subject"];
    if (encounterRef) {
      obs.encounter = encounterRef as Observation["encounter"];
    }
  }

  // Link Observations to MedicationRequest.supportingInformation
  if (observations.length > 0) {
    medicationRequest.supportingInformation = observations.map(
      (o) => ({ reference: `Observation/${o.id}` } as unknown as Reference<"Resource">),
    );
  }

  if (mappingErrors.length > 0) {
    return { entries: [], mappingErrors };
  }

  // Add MedicationRequest entry first, then observations
  entries.unshift(createBundleEntry(medicationRequest));
  for (const obs of observations) {
    entries.push(createBundleEntry(obs));
  }

  return { entries, mappingErrors: [] };
}

// ============================================================================
// Main Converter
// ============================================================================

/**
 * Convert HL7v2 ORM_O01 message to FHIR Transaction Bundle.
 *
 * Message Structure (v2.5):
 * MSH [1..1]
 * PATIENT [0..1]
 *   PID [1..1]
 *   PV1 [0..1]  (via PATIENT_VISIT)
 *   IN1 [0..*]  (via INSURANCE)
 * ORDER [1..*]
 *   ORC [1..1]
 *   ORDER_DETAIL [0..1]
 *     OBR | RXO (ORDER_CHOICE)
 *     NTE [0..*]
 *     DG1 [0..*]
 *     OBSERVATION [0..*]
 *       OBX [1..1]
 *       NTE [0..*]
 *
 * Patient/Encounter handling follows ORU pattern:
 * - PID required; creates draft Patient if not found
 * - PV1 optional; empty PV1 treated as absent
 * - PV1-19 absent -> skip Encounter, status=processed
 *
 * OBX in ORM context does NOT go through LOINC resolution.
 * Missing OBX-11 defaults to "registered".
 */
export async function convertORM_O01(
  parsed: HL7v2Message,
  context: ConverterContext,
): Promise<ConversionResult> {
  const { resolvePatientId, lookupPatient, lookupEncounter, config } = context;
  const { senderContext, baseMeta } = parseMSH(parsed, "ORM_O01");

  // Parse PID (required)
  let pid;
  try {
    pid = parseORMPID(parsed);
  } catch {
    return {
      messageUpdate: { status: "error", error: "PID segment is required for ORM_O01 messages" },
    };
  }

  const senderTag = extractSenderTag(pid);
  addSenderTagToMeta(baseMeta, senderTag);

  // Handle Patient (lookup or create draft)
  const patientResult = await handlePatient(pid, baseMeta, lookupPatient, resolvePatientId);
  if ("error" in patientResult) {
    return {
      messageUpdate: { status: "error", error: patientResult.error },
    };
  }
  const { patientRef, patientEntry } = patientResult;
  const patientId = patientRef.reference?.replace("Patient/", "");

  // Parse PV1 (optional for ORM) -- treat empty PV1 as absent
  let pv1 = parsePV1(parsed);
  if (pv1 && isEmptyPV1(pv1)) {
    pv1 = undefined;
  }

  const encounterResult = await handleEncounter(
    pv1, patientRef, baseMeta, senderContext, lookupEncounter, config, "ORM-O01",
  );

  if (encounterResult.error) {
    return {
      messageUpdate: {
        status: "error",
        error: encounterResult.error,
        patient: patientRef,
      },
    };
  }

  const { encounterRef, encounterEntry, patientClassTaskEntry } = encounterResult;

  // Process IN1 -> Coverage[]
  const coverageEntries = processIN1Segments(parsed, patientId, patientRef, baseMeta);

  // Group ORDER segments
  const orderGroups = groupORMOrders(parsed);

  if (orderGroups.length === 0) {
    return {
      messageUpdate: { status: "error", error: "No ORDER groups found in ORM_O01 message" },
    };
  }

  // Process each ORDER group
  const allEntries: BundleEntry[] = [];
  const allMappingErrors: MappingError[] = [];
  let processableGroupCount = 0;

  for (const group of orderGroups) {
    if (group.orderChoiceType === "OBR" && group.orderChoice) {
      const result = await processOBROrderGroup(
        group, senderContext, baseMeta, patientRef, patientId, encounterRef,
      );
      allEntries.push(...result.entries);
      allMappingErrors.push(...result.mappingErrors);
      if (result.entries.length > 0) processableGroupCount++;
    } else if (group.orderChoiceType === "RXO" && group.orderChoice) {
      const result = await processRXOOrderGroup(
        group, senderContext, baseMeta, patientRef, encounterRef,
      );
      allEntries.push(...result.entries);
      allMappingErrors.push(...result.mappingErrors);
      if (result.entries.length > 0) processableGroupCount++;
    } else if (group.orderChoiceType === "unknown" || !group.orderChoice) {
      // ORC without ORDER_DETAIL -- skip this group
      continue;
    }
  }

  // If mapping errors, return mapping error result
  if (allMappingErrors.length > 0) {
    return buildMappingErrorResult(senderContext, allMappingErrors);
  }

  // If no groups were processable, return error
  if (processableGroupCount === 0) {
    return {
      messageUpdate: { status: "error", error: "No processable order groups found in ORM_O01 message" },
    };
  }

  // Build transaction bundle
  const entries: BundleEntry[] = [];

  if (patientEntry) {
    entries.push(patientEntry);
  }

  if (encounterEntry) {
    entries.push(encounterEntry);
  }

  entries.push(...coverageEntries);
  entries.push(...allEntries);

  if (patientClassTaskEntry) {
    entries.push(patientClassTaskEntry);
  }

  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };

  if (encounterResult.warning) {
    return {
      bundle,
      messageUpdate: {
        status: "warning",
        error: encounterResult.warning,
        patient: patientRef,
      },
    };
  }

  return {
    bundle,
    messageUpdate: {
      status: "processed",
      patient: patientRef,
    },
  };
}

import type { ConceptMap } from "../../src/fhir/hl7-fhir-r4-core/ConceptMap";
import type { Task } from "../../src/fhir/hl7-fhir-r4-core/Task";
import type {
  DiagnosticReport,
  Observation,
  Encounter,
  Patient,
  Condition,
  AllergyIntolerance,
  Coverage,
  RelatedPerson,
  Invoice,
} from "../../src/fhir/hl7-fhir-r4-core";
import type { OutgoingBarMessage } from "../../src/fhir/aidbox-hl7v2-custom";
import type { IncomingHL7v2Message } from "../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import { processNextMessage } from "../../src/v2-to-fhir/processor-service";
import { toKebabCase } from "../../src/utils/string";
import { aidboxFetch } from "../../src/aidbox";
import { MAPPING_TYPES, type MappingTypeName } from "../../src/code-mapping/mapping-types";
export { aidboxFetch };

export async function loadFixture(fixturePath: string): Promise<string> {
  return Bun.file(`test/fixtures/hl7v2/${fixturePath}`).text();
}

interface Bundle<T> {
  resourceType: "Bundle";
  entry?: Array<{ resource: T }>;
}

export async function createTestConceptMap(
  sendingApp: string,
  sendingFacility: string,
  mappings: Array<{
    localCode: string;
    localSystem: string;
    loincCode: string;
    loincDisplay: string;
  }>,
): Promise<void> {
  const id = `hl7v2-${toKebabCase(sendingApp)}-${toKebabCase(sendingFacility)}-observation-code-loinc`;

  const groups: Record<string, NonNullable<ConceptMap["group"]>[0]> = {};
  for (const m of mappings) {
    if (!groups[m.localSystem]) {
      groups[m.localSystem] = {
        source: m.localSystem,
        target: "http://loinc.org",
        element: [],
      };
    }
    groups[m.localSystem]!.element!.push({
      code: m.localCode,
      target: [
        {
          code: m.loincCode,
          display: m.loincDisplay,
          equivalence: "equivalent",
        },
      ],
    });
  }

  const conceptMap: ConceptMap = {
    resourceType: "ConceptMap",
    id,
    status: "active",
    sourceUri: `http://example.org/fhir/CodeSystem/hl7v2-${id.replace("-observation-code-loinc", "")}`,
    targetUri: "http://loinc.org",
    group: Object.values(groups),
  };

  await aidboxFetch(`/fhir/ConceptMap/${id}`, {
    method: "PUT",
    body: JSON.stringify(conceptMap),
  });
}

/**
 * Create a test ConceptMap for any mapping type.
 */
export async function createTestConceptMapForType(
  sendingApp: string,
  sendingFacility: string,
  mappingType: MappingTypeName,
  mappings: Array<{
    localCode: string;
    localSystem: string;
    targetCode: string;
    targetDisplay: string;
  }>,
): Promise<void> {
  const typeConfig = MAPPING_TYPES[mappingType];
  const baseId = `hl7v2-${toKebabCase(sendingApp)}-${toKebabCase(sendingFacility)}`;
  const id = `${baseId}-${mappingType}`;

  const groups: Record<string, NonNullable<ConceptMap["group"]>[0]> = {};
  for (const m of mappings) {
    if (!groups[m.localSystem]) {
      groups[m.localSystem] = {
        source: m.localSystem,
        target: typeConfig.targetSystem,
        element: [],
      };
    }
    groups[m.localSystem]!.element!.push({
      code: m.localCode,
      target: [
        {
          code: m.targetCode,
          display: m.targetDisplay,
          equivalence: "equivalent",
        },
      ],
    });
  }

  const conceptMap: ConceptMap = {
    resourceType: "ConceptMap",
    id,
    status: "active",
    sourceUri: `http://example.org/fhir/CodeSystem/${baseId}`,
    targetUri: typeConfig.targetSystem,
    group: Object.values(groups),
  };

  await aidboxFetch(`/fhir/ConceptMap/${id}`, {
    method: "PUT",
    body: JSON.stringify(conceptMap),
  });
}

export async function getMappingTasks(): Promise<Task[]> {
  const bundle = await aidboxFetch<Bundle<Task>>(
    `/fhir/Task?status=requested`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function getDiagnosticReports(patientRef: string): Promise<DiagnosticReport[]> {
  const bundle = await aidboxFetch<Bundle<DiagnosticReport>>(
    `/fhir/DiagnosticReport?subject=${encodeURIComponent(patientRef)}`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function getObservations(patientRef: string): Promise<Observation[]> {
  const bundle = await aidboxFetch<Bundle<Observation>>(
    `/fhir/Observation?subject=${encodeURIComponent(patientRef)}`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function getEncounters(patientRef: string): Promise<Encounter[]> {
  const bundle = await aidboxFetch<Bundle<Encounter>>(
    `/fhir/Encounter?subject=${encodeURIComponent(patientRef)}`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function getPatient(patientId: string): Promise<Patient> {
  return aidboxFetch<Patient>(`/fhir/Patient/${patientId}`);
}

export async function getConditions(patientRef: string): Promise<Condition[]> {
  const bundle = await aidboxFetch<Bundle<Condition>>(
    `/fhir/Condition?subject=${encodeURIComponent(patientRef)}`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function getAllergies(patientRef: string): Promise<AllergyIntolerance[]> {
  const bundle = await aidboxFetch<Bundle<AllergyIntolerance>>(
    `/fhir/AllergyIntolerance?patient=${encodeURIComponent(patientRef)}`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function getCoverages(patientRef: string): Promise<Coverage[]> {
  const bundle = await aidboxFetch<Bundle<Coverage>>(
    `/fhir/Coverage?beneficiary=${encodeURIComponent(patientRef)}`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function getRelatedPersons(patientRef: string): Promise<RelatedPerson[]> {
  const bundle = await aidboxFetch<Bundle<RelatedPerson>>(
    `/fhir/RelatedPerson?patient=${encodeURIComponent(patientRef)}`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function getInvoices(patientRef: string): Promise<Invoice[]> {
  const bundle = await aidboxFetch<Bundle<Invoice>>(
    `/fhir/Invoice?subject=${encodeURIComponent(patientRef)}`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function getOutgoingBarMessages(): Promise<OutgoingBarMessage[]> {
  const bundle = await aidboxFetch<Bundle<OutgoingBarMessage>>(
    `/fhir/OutgoingBarMessage`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function submitAndProcess(
  hl7Message: string,
  messageType: string,
): Promise<IncomingHL7v2Message> {
  const createdMessage = await aidboxFetch<IncomingHL7v2Message>(
    "/fhir/IncomingHL7v2Message",
    {
      method: "POST",
      body: JSON.stringify({
        resourceType: "IncomingHL7v2Message",
        message: hl7Message,
        status: "received",
        type: messageType,
      }),
    },
  );

  await processNextMessage().catch(() => {});

  return aidboxFetch<IncomingHL7v2Message>(
    `/fhir/IncomingHL7v2Message/${createdMessage.id}`,
  );
}

export async function cleanupTestResources(): Promise<void> {
  // Truncate most resources via SQL (fast)
  await aidboxFetch("/$sql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      "TRUNCATE task, incominghl7v2message, diagnosticreport, observation, specimen, encounter, patient, condition, allergyintolerance, coverage, relatedperson, invoice, outgoingbarmessage, account, organization, practitioner, chargeitem CASCADE",
    ]),
  });

  // Delete test ConceptMaps via FHIR batch (needed because Aidbox caches terminology)
  const conceptMaps = await aidboxFetch<Bundle<ConceptMap>>(
    "/fhir/ConceptMap?_count=100",
  );

  const testConceptMapIds = (conceptMaps.entry ?? [])
    .filter((e) => e.resource.status === "active")
    .map((e) => e.resource.id);

  if (testConceptMapIds.length > 0) {
    await aidboxFetch("/fhir", {
      method: "POST",
      body: JSON.stringify({
        resourceType: "Bundle",
        type: "batch",
        entry: testConceptMapIds.map((id) => ({
          request: {
            method: "DELETE",
            url: `ConceptMap/${id}`,
          },
        })),
      }),
    });
  }
}

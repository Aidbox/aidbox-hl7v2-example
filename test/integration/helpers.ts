import { describe } from "bun:test";
import type { ConceptMap } from "../../src/fhir/hl7-fhir-r4-core/ConceptMap";
import type { Task } from "../../src/fhir/hl7-fhir-r4-core/Task";
import { resolveTaskAndUpdateMessages } from "../../src/ui/mapping-tasks-queue";

export const TEST_AIDBOX_URL = "http://localhost:8888";

// Check if integration tests should run (set by preload.ts)
const integrationTestsEnabled = process.env.INTEGRATION_TESTS_ENABLED === "true";

export const describeIntegration = integrationTestsEnabled ? describe : describe.skip;
export const TEST_CLIENT_ID = "root";
export const TEST_CLIENT_SECRET = "test_secret";

export async function loadFixture(fixturePath: string): Promise<string> {
  return Bun.file(`test/fixtures/hl7v2/${fixturePath}`).text();
}

interface Bundle<T> {
  resourceType: "Bundle";
  entry?: Array<{ resource: T }>;
}

export async function testAidboxFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const auth = Buffer.from(
    `${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`,
  ).toString("base64");
  const response = await fetch(`${TEST_AIDBOX_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/fhir+json",
      Authorization: `Basic ${auth}`,
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Aidbox error: ${response.status} ${await response.text()}`,
    );
  }
  return response.json();
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
  const id = `hl7v2-${sendingApp.toLowerCase()}-${sendingFacility.toLowerCase()}-to-loinc`;

  const groups: Record<string, NonNullable<ConceptMap["group"]>[0]> = {};
  for (const m of mappings) {
    if (!groups[m.localSystem]) {
      groups[m.localSystem] = {
        source: m.localSystem,
        target: "http://loinc.org",
        element: [],
      };
    }
    groups[m.localSystem].element!.push({
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
    sourceUri: `http://example.org/fhir/CodeSystem/hl7v2-${id.replace("-to-loinc", "")}`,
    targetUri: "http://loinc.org",
    group: Object.values(groups),
  };

  await testAidboxFetch(`/fhir/ConceptMap/${id}`, {
    method: "PUT",
    body: JSON.stringify(conceptMap),
  });
}

export async function getMappingTasks(): Promise<Task[]> {
  const bundle = await testAidboxFetch<Bundle<Task>>(
    `/fhir/Task?status=requested`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function resolveTask(
  taskId: string,
  loincCode: string,
  loincDisplay: string,
): Promise<void> {
  await resolveTaskAndUpdateMessages(taskId, loincCode, loincDisplay);
}

export async function cleanupTestResources(): Promise<void> {
  const auth = Buffer.from(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`).toString(
    "base64",
  );

  // Truncate most resources via SQL (fast)
  await fetch(`${TEST_AIDBOX_URL}/$sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify([
      "TRUNCATE task, incominghl7v2message, diagnosticreport, observation, specimen, encounter, patient CASCADE",
    ]),
  });

  // Delete test ConceptMaps via FHIR batch (needed because Aidbox caches terminology)
  const conceptMaps = await testAidboxFetch<Bundle<{ id: string }>>(
    "/fhir/ConceptMap?_count=100",
  );

  const testConceptMapIds = (conceptMaps.entry ?? [])
    .map((e) => e.resource.id);

  if (testConceptMapIds.length > 0) {
    await fetch(`${TEST_AIDBOX_URL}/fhir`, {
      method: "POST",
      headers: {
        "Content-Type": "application/fhir+json",
        Authorization: `Basic ${auth}`,
      },
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

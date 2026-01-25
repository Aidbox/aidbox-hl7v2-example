import type { ConceptMap } from "../../src/fhir/hl7-fhir-r4-core/ConceptMap";
import type { Task } from "../../src/fhir/hl7-fhir-r4-core/Task";

export const TEST_AIDBOX_URL = "http://localhost:8888";
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
    `/fhir/Task?code=loinc-mapping&status=requested`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function resolveTaskViaApi(
  taskId: string,
  loincCode: string,
  loincDisplay: string,
): Promise<void> {
  const formData = new FormData();
  formData.append("loincCode", loincCode);
  formData.append("loincDisplay", loincDisplay);

  const auth = Buffer.from(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`).toString(
    "base64",
  );
  const response = await fetch(
    `${TEST_AIDBOX_URL}/api/mapping/tasks/${taskId}/resolve`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body: formData,
      redirect: "manual",
    },
  );

  if (response.status !== 302 && !response.ok) {
    throw new Error(
      `Task resolve error: ${response.status} ${await response.text()}`,
    );
  }
}

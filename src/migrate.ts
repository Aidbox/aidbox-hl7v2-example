import { putResource } from "./aidbox";
import { Glob } from "bun";

interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: unknown;
}

async function loadFhirResources(): Promise<FHIRResource[]> {
  const glob = new Glob("*.json");
  const fhirDir = new URL("../fhir", import.meta.url).pathname;
  const resources: FHIRResource[] = [];

  for await (const file of glob.scan(fhirDir)) {
    const filePath = `${fhirDir}/${file}`;
    const content = await Bun.file(filePath).text();
    const resource = JSON.parse(content) as FHIRResource;
    resources.push(resource);
  }

  return resources;
}

async function migrate() {
  console.log("Loading FHIR resources from fhir/ folder...\n");

  const resources = await loadFhirResources();

  for (const resource of resources) {
    console.log(`Creating ${resource.resourceType}/${resource.id}...`);
    await putResource(resource.resourceType, resource.id, resource);
    console.log("  Done.");
  }

  console.log(`\nMigration complete. Loaded ${resources.length} resources.`);
}

migrate().catch(console.error);

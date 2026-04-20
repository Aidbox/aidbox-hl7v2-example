import { aidboxFetch } from "./aidbox";

export async function migrate() {
  console.log("Loading init-bundle.json...");

  const bundleUrl = new URL("../init-bundle.json", import.meta.url);
  const bundle = await Bun.file(bundleUrl).json();

  console.log(`Submitting bundle with ${bundle.entry.length} entries...`);

  await aidboxFetch("/fhir", {
    method: "POST",
    body: JSON.stringify(bundle),
  });

  console.log("Migration complete.");
}

if (import.meta.main) {
  migrate().catch(console.error);
}

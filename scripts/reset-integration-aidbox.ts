import { $ } from "bun";

const TEST_AIDBOX_URL = "http://localhost:8888";
const TEST_CLIENT_SECRET = "test_secret";

process.env.AIDBOX_URL = TEST_AIDBOX_URL;
process.env.AIDBOX_CLIENT_SECRET = TEST_CLIENT_SECRET;

console.log("Destroying test Aidbox containers and volumes...");
await $`docker compose -f docker-compose.test.yaml down -v`;

console.log("Starting fresh test Aidbox...");
await $`docker compose -f docker-compose.test.yaml up -d`;

// Wait for health
let healthy = false;
for (let i = 0; i < 90; i++) {
  try {
    const response = await fetch(`${TEST_AIDBOX_URL}/health`);
    if (response.ok) {
      healthy = true;
      break;
    }
  } catch {
    // Not ready yet
  }
  await new Promise((r) => setTimeout(r, 1000));
}

if (!healthy) {
  console.error("Test Aidbox not reachable within 90 seconds");
  process.exit(1);
}

const { migrate } = await import("../src/migrate");
await migrate();

console.log("Test Aidbox is ready");

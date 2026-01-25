import { beforeAll, afterAll, setDefaultTimeout } from "bun:test";
import { $ } from "bun";

// Increase default timeout to 2 minutes for Aidbox startup
setDefaultTimeout(120_000);

const TEST_AIDBOX_URL = "http://localhost:8888";
const TEST_CLIENT_SECRET = "test_secret";

// Set environment variables for the test Aidbox instance
// This must happen before any imports that use these values
process.env.AIDBOX_URL = TEST_AIDBOX_URL;
process.env.AIDBOX_CLIENT_SECRET = TEST_CLIENT_SECRET;

beforeAll(async () => {
  console.log("Starting test Aidbox...");

  // Stop and remove existing
  await $`docker compose -f docker-compose.test.yaml down -v`.quiet();

  // Start fresh
  await $`docker compose -f docker-compose.test.yaml up -d`.quiet();

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
    throw new Error("Test Aidbox failed to start within 90 seconds");
  }

  // Run migrations
  await $`bun src/migrate.ts`.quiet();

  console.log("Test Aidbox ready");
});

afterAll(async () => {
  console.log("Stopping test Aidbox...");
  await $`docker compose -f docker-compose.test.yaml down -v`.quiet();
});

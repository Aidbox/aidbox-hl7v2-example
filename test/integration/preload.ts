import { beforeAll, beforeEach, afterAll, setDefaultTimeout } from "bun:test";
import { $ } from "bun";

// Fail fast if AIDBOX_LICENSE is not set
if (!process.env.AIDBOX_LICENSE) {
  console.error("ERROR: AIDBOX_LICENSE environment variable is required for integration tests");
  console.error("Run unit tests with: bun test test/unit");
  process.exit(1);
}

// Signal to integration tests that they should run (preload is active)
process.env.INTEGRATION_TESTS_ENABLED = "true";

// Reset docker volumes and run migrations (for clean test runs)
const resetAidbox = process.env.TEST_RESET_AIDBOX === "true";

// Increase default timeout to 2 minutes for Aidbox startup
setDefaultTimeout(120_000);

const TEST_AIDBOX_URL = "http://localhost:8888";
const TEST_CLIENT_SECRET = "test_secret";

// Set environment variables for the test Aidbox instance
// This must happen before any imports that use these values
process.env.AIDBOX_URL = TEST_AIDBOX_URL;
process.env.AIDBOX_CLIENT_SECRET = TEST_CLIENT_SECRET;

beforeAll(async () => {
  if (resetAidbox) {
    console.log("Resetting test Aidbox (TEST_RESET_AIDBOX=true)...");
    await $`docker compose -f docker-compose.test.yaml down -v`.quiet();
  }

  // Start containers (noop if already running)
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
    throw new Error("Test Aidbox not reachable within 90 seconds");
  }

  if (resetAidbox) {
    await $`bun src/migrate.ts`.quiet();
  }

  console.log("Test Aidbox ready");
});

beforeEach(async () => {
  const { cleanupTestResources } = await import("./helpers");
  await cleanupTestResources();
});

afterAll(async () => {
  if (resetAidbox) {
    console.log("Stopping test Aidbox...");
    await $`docker compose -f docker-compose.test.yaml down -v`.quiet();
  }
});

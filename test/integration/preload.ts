import { beforeAll, beforeEach, setDefaultTimeout } from "bun:test";
import { $ } from "bun";
import { join } from "path";

// Fail fast if AIDBOX_LICENSE is not set
if (!process.env.AIDBOX_LICENSE) {
  console.error("ERROR: AIDBOX_LICENSE environment variable is required for integration tests");
  console.error("Run unit tests with: bun test");
  process.exit(1);
}

// Aidbox cold-start on CI runners can be slow: container boot (~90s) +
// init-bundle submission can exceed 2 minutes combined. Bun's
// setDefaultTimeout covers both hooks and tests, so the beforeAll that
// does boot+migrate has to fit inside this window.
setDefaultTimeout(300_000);

const TEST_AIDBOX_URL = "http://localhost:8888";
const TEST_CLIENT_SECRET = "test_secret";

// Set environment variables for the test Aidbox instance
// This must happen before any imports that use these values
process.env.AIDBOX_URL = TEST_AIDBOX_URL;
process.env.AIDBOX_CLIENT_SECRET = TEST_CLIENT_SECRET;
process.env.HL7V2_TO_FHIR_CONFIG = join(__dirname, "../fixtures/config/hl7v2-to-fhir.json");

beforeAll(async () => {
  // Check if Aidbox is already running
  let alreadyRunning = false;
  try {
    const response = await fetch(`${TEST_AIDBOX_URL}/health`);
    alreadyRunning = response.ok;
  } catch {
    // Not running
  }

  if (alreadyRunning) {
    console.log("Test Aidbox already running");
    return;
  }

  // Start containers and wait for health
  await $`docker compose -f docker-compose.test.yaml up -d`.quiet();

  let healthy = false;
  const HEALTH_CHECK_SECONDS = 180;
  for (let i = 0; i < HEALTH_CHECK_SECONDS; i++) {
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
    throw new Error(`Test Aidbox not reachable within ${HEALTH_CHECK_SECONDS} seconds`);
  }

  console.log("Test Aidbox ready, running migrations...");
  const { migrate } = await import("../../src/migrate");
  await migrate();
});

beforeEach(async () => {
  const { cleanupTestResources } = await import("./helpers");
  await cleanupTestResources();
});

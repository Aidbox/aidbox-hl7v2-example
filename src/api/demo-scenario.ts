/**
 * Scripted demo scenario for the Dashboard's "Run demo now" action.
 *
 * Fires 4 HL7v2 messages through MLLP with 2s spacing — ADT^A01 →
 * ORU^R01 (known LOINC) → VXU^V04 → ORU^R01 (unknown LOINC) — so a
 * prospect sees admit, result, immunization, and the triage flow in
 * under a minute. The last message intentionally routes to
 * `code_mapping_error` to show the Unmapped Codes page in action.
 *
 * The HTTP handler returns 202 immediately and fire-and-forgets the
 * loop; the UI learns about the results through the stats partial and
 * live ticker, not the response body.
 */

import {
  SAMPLE_BUILDERS,
  buildTemplateContext,
} from "../ui/pages/simulate-sender";
import { sendMLLPMessage, rewriteMessageControlId } from "../mllp/client";
import { aidboxFetch, type Bundle } from "../aidbox";
import type { IncomingHL7v2Message } from "../fhir/aidbox-hl7v2-custom";

export const DEMO_SAMPLE_IDS = [
  "adt-a01-full",
  "oru-r01-known-loinc",
  "vxu-v04-covid-flu",
  "oru-r01-unknown-loinc",
] as const;

/**
 * How long to wait per-send for the previous message to leave `received`
 * before firing the next. Workers poll every 5s by default (see
 * POLL_INTERVAL_MS), so 8s comfortably covers the worst case: send lands
 * right after a poll finishes, we wait ~5s for the next poll + a couple
 * hundred ms of processing, then move on.
 *
 * If the deadline elapses with the message still in `received`, we fire
 * the next send anyway — demo loses the "sequential" vibe but the
 * prospect sees all 4 rows rather than the loop hanging.
 */
export const DEMO_WAIT_DEADLINE_MS = 8000;
export const DEMO_POLL_INTERVAL_MS = 500;

export interface RunDemoScenarioOptions {
  send?: (host: string, port: number, message: string) => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
  /** Fetch current status for a message by MSH-10. Inject for tests. */
  fetchStatus?: (mcid: string) => Promise<string | undefined>;
  /** Max time to wait for the previous send to leave `received`. */
  waitDeadlineMs?: number;
  /** Poll cadence for the wait loop. */
  pollIntervalMs?: number;
  onFired?: (sampleId: string, index: number) => void;
  onError?: (sampleId: string, index: number, error: unknown) => void;
}

async function defaultFetchStatus(mcid: string): Promise<string | undefined> {
  try {
    const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
      `/fhir/IncomingHL7v2Message?message-control-id=${encodeURIComponent(
        mcid,
      )}&_elements=status&_count=1`,
    );
    return bundle.entry?.[0]?.resource?.status;
  } catch {
    // Aidbox blip shouldn't abort the demo — swallow and return undefined
    // so the wait loop just keeps polling until the deadline.
    return undefined;
  }
}

async function waitForProcessed(
  mcid: string,
  fetchStatus: (mcid: string) => Promise<string | undefined>,
  sleep: (ms: number) => Promise<void>,
  deadlineMs: number,
  pollIntervalMs: number,
): Promise<void> {
  const start = Date.now();
  // Belt-and-suspenders: bound by both wall time AND iteration count.
  // Observed in dev that the wall-time check alone let a loop run for
  // 289s despite an 8s deadline — suspected event-loop contention with
  // the dashboard ticker/stats refresh and worker polling stretching
  // each `sleep` far beyond its requested pollIntervalMs. Iteration cap
  // provides a hard upper bound independent of clock time.
  const maxIterations = Math.ceil(deadlineMs / pollIntervalMs) + 2;
  for (let iter = 0; iter < maxIterations; iter++) {
    if (Date.now() - start >= deadlineMs) return;
    const status = await fetchStatus(mcid);
    // Anything other than `received` means the worker has made a verdict —
    // terminal for our purposes. Matches `outcomeFromStatus` in simulate-sender.
    if (status && status !== "received") return;
    await sleep(pollIntervalMs);
  }
}

function newDemoMCID(index: number): string {
  // HL7v2 2.5.1 caps MSH-10 at 20 chars; 5 + 8 + 2 = 15 leaves headroom.
  return `DEMO-${Date.now().toString(36)}-${index}`;
}

export async function runDemoScenario(
  options: RunDemoScenarioOptions = {},
): Promise<void> {
  const send = options.send ?? sendMLLPMessage;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const fetchStatus = options.fetchStatus ?? defaultFetchStatus;
  const waitDeadlineMs = options.waitDeadlineMs ?? DEMO_WAIT_DEADLINE_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEMO_POLL_INTERVAL_MS;
  const host = process.env.MLLP_HOST || "localhost";
  const port = Number.parseInt(process.env.MLLP_PORT || "2575", 10);

  for (const [i, id] of DEMO_SAMPLE_IDS.entries()) {
    const builder = SAMPLE_BUILDERS[id];
    if (!builder) {
      console.error(`[demo] missing sample builder: ${id}`);
      continue;
    }

    let sentMcid: string | null = null;

    try {
      // Builder is inside the try/catch too — a future sample with
      // runtime-data requirements could throw, and the plan's invariant
      // is "one failure shouldn't abort the remaining sends".
      const raw = builder(buildTemplateContext());
      const mcid = newDemoMCID(i);
      const rewritten = rewriteMessageControlId(raw, mcid);
      const normalized = rewritten.replace(/\r\n/g, "\r").replace(/\n/g, "\r");
      await send(host, port, normalized);
      sentMcid = mcid;
      options.onFired?.(id, i);
    } catch (error) {
      console.error(
        `[demo] send failed for ${id}:`,
        error instanceof Error ? error.message : error,
      );
      options.onError?.(id, i, error);
    }

    // Wait for the previous send to exit `received` before firing the
    // next — this gives each ticker refresh time to show the row land
    // one-at-a-time instead of the processor poll cycle batching all 4.
    // Skip the wait after the final send (nothing to gate) and when the
    // send itself failed (no mcid to poll on).
    if (sentMcid && i < DEMO_SAMPLE_IDS.length - 1) {
      await waitForProcessed(
        sentMcid,
        fetchStatus,
        sleep,
        waitDeadlineMs,
        pollIntervalMs,
      );
    }
  }
}

export function isDemoEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  // Default-on: unset, empty, or any non-"off" value enables the endpoint.
  // Only DEMO_MODE=off disables. Matches the plan's env-flag semantics so
  // the demo ships as part of the default-dev experience.
  return env.DEMO_MODE !== "off";
}

export async function handleRunDemoScenario(): Promise<Response> {
  if (!isDemoEnabled()) {
    return new Response("Demo mode disabled", { status: 403 });
  }
  runDemoScenario().catch((error) => {
    console.error(
      "[demo] scenario failed:",
      error instanceof Error ? error.message : error,
    );
  });
  return new Response(null, { status: 202 });
}

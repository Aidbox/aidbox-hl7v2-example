/**
 * Integration tests for the Inbound Messages detail pane — specifically the
 * Timeline tab, which is the only tab that fires an extra Aidbox call
 * (`_history`). Runs against the test Aidbox (port 8888).
 *
 * What we verify:
 *   1. Aidbox records a distinct history version for each PUT — so two PUTs
 *      (received → processed) yield 2 entries in `_history`, each with its own
 *      `meta.versionId` and `meta.lastUpdated`.
 *   2. `getHistoryVersions()` collapses the raw history correctly and returns
 *      the two meaningful transitions.
 *   3. `handleInboundDetailPartial` returns 200 + an `#detail` card containing
 *      the four tab buttons and a Replay button.
 *   4. `handleInboundDetailTabPartial` with `tab=timeline` returns only the
 *      tab body (no outer `#detail` wrapper) including "Received by MLLP".
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { aidboxFetch, cleanupTestResources } from "../helpers";
import type { IncomingHL7v2Message } from "../../../src/fhir/aidbox-hl7v2-custom";
import { getHistoryVersions } from "../../../src/ui/pages/inbound-detail";
import {
  handleInboundDetailPartial,
  handleInboundDetailTabPartial,
} from "../../../src/ui/pages/inbound-detail";

// Attach `.params` the same way `src/index.ts` router does.
function reqWithParams(url: string, params: Record<string, string>): Request {
  const r = new Request(url) as Request & { params: Record<string, string> };
  r.params = params;
  return r;
}

const SAMPLE_HL7 =
  "MSH|^~\\&|LAB|HOSP|EMR|DEST|20260423120000||ORU^R01|TEST-MCID|P|2.5.1\r" +
  "PID|1||TEST-001||Smith^John";

describe("smoke: inbound detail pane — _history integration", () => {
  // Pre-test cleanup is handled globally via preload.ts beforeEach.

  test("_history returns 2 distinct versions after received → processed transition", async () => {
    // 1. Create a message at status=received.
    const created = await aidboxFetch<IncomingHL7v2Message>(
      "/fhir/IncomingHL7v2Message",
      {
        method: "POST",
        body: JSON.stringify({
          resourceType: "IncomingHL7v2Message",
          status: "received",
          type: "ORU_R01^ORU_R01",
          message: SAMPLE_HL7,
          date: new Date().toISOString(),
        }),
      },
    );
    const id = created.id!;

    // 2. Update to processed — Aidbox records a new version.
    const updated: IncomingHL7v2Message = {
      ...created,
      status: "processed",
    };
    await aidboxFetch<IncomingHL7v2Message>(`/fhir/IncomingHL7v2Message/${id}`, {
      method: "PUT",
      body: JSON.stringify(updated),
    });

    // 3. `getHistoryVersions` should collapse and return 2 distinct transitions.
    const versions = await getHistoryVersions(id);
    expect(versions.length).toBeGreaterThanOrEqual(2);

    // Newest-first ordering — index 0 is the `processed` version.
    const statuses = versions.map((v) => v.status);
    expect(statuses).toContain("processed");
    expect(statuses).toContain("received");

    // Each entry must have a distinct versionId and a lastUpdated.
    const vids = versions.map((v) => v.versionId);
    const unique = new Set(vids);
    expect(unique.size).toBe(versions.length);
    for (const v of versions) {
      expect(v.lastUpdated).toBeTruthy();
    }
  });

  test("handleInboundDetailPartial returns 200 + detail card with all 4 tabs", async () => {
    const created = await aidboxFetch<IncomingHL7v2Message>(
      "/fhir/IncomingHL7v2Message",
      {
        method: "POST",
        body: JSON.stringify({
          resourceType: "IncomingHL7v2Message",
          status: "processed",
          type: "ADT_A01^ADT_A01",
          message: SAMPLE_HL7,
          date: new Date().toISOString(),
        }),
      },
    );
    const id = created.id!;

    const res = await handleInboundDetailPartial(
      reqWithParams(
        `http://localhost:3000/incoming-messages/${encodeURIComponent(id)}/partials/detail`,
        { id },
      ),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain('id="detail"');
    expect(body).toContain(`data-selected="${id}"`);
    // All 4 tab labels present.
    expect(body).toContain("Structured");
    expect(body).toContain("Raw HL7");
    expect(body).toContain("FHIR resources");
    expect(body).toContain("Timeline");
    // Replay button wired to mark-for-retry.
    expect(body).toContain("hx-post=\"/mark-for-retry/");
  });

  test("handleInboundDetailTabPartial with tab=timeline returns Timeline body only", async () => {
    const created = await aidboxFetch<IncomingHL7v2Message>(
      "/fhir/IncomingHL7v2Message",
      {
        method: "POST",
        body: JSON.stringify({
          resourceType: "IncomingHL7v2Message",
          status: "received",
          type: "ORU_R01^ORU_R01",
          message: SAMPLE_HL7,
          date: new Date().toISOString(),
        }),
      },
    );
    const id = created.id!;

    const res = await handleInboundDetailTabPartial(
      reqWithParams(
        `http://localhost:3000/incoming-messages/${encodeURIComponent(id)}/partials/detail/timeline`,
        { id, tab: "timeline" },
      ),
    );

    expect(res.status).toBe(200);
    const body = await res.text();
    // Tab body only — no outer #detail wrapper.
    expect(body).not.toContain('id="detail"');
    // Timeline renders the received status.
    expect(body).toContain("Received by MLLP");
  });
});

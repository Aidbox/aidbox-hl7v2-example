/**
 * Integration test: the MLLP listener stores MSH-10 as messageControlId
 * and the corresponding SearchParameter makes it queryable by
 * `?message-control-id=`.
 *
 * Covers both the schema change in init-bundle.json (new field + new
 * SearchParameter) and the listener-side write in src/mllp/mllp-server.ts.
 */
import { describe, test, expect } from "bun:test";
import { aidboxFetch } from "../helpers";
import { storeMessage } from "../../../src/mllp/mllp-server";
import type { IncomingHL7v2Message } from "../../../src/fhir/aidbox-hl7v2-custom";

interface Bundle<T> {
  resourceType: "Bundle";
  entry?: Array<{ resource: T }>;
  total?: number;
}

function uniqueControlId(label: string): string {
  return `TEST-${label}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

describe("IncomingHL7v2Message message-control-id search", () => {
  test("storeMessage persists MSH-10 and SearchParameter finds it by that id", async () => {
    const controlId = uniqueControlId("roundtrip");
    const hl7 = [
      `MSH|^~\\&|ACME_LAB|ACME_LAB_FACILITY|ACME_HOSP|DEST|20260422142151||ADT^A01|${controlId}|P|2.5.1`,
      `EVN|A01|20260422142151`,
      `PID|1||P12345^^^HOSPITAL^MR||DOE^JANE||19850707|F`,
    ].join("\r");

    await storeMessage(hl7);

    const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
      `/fhir/IncomingHL7v2Message?message-control-id=${encodeURIComponent(controlId)}`,
    );
    const hits = bundle.entry ?? [];
    expect(hits.length).toBe(1);
    expect(hits[0]?.resource.messageControlId).toBe(controlId);
    expect(hits[0]?.resource.type).toBe("ADT_A01");
  });

  test("two sends with distinct MSH-10 produce two distinct, retrievable resources", async () => {
    const idA = uniqueControlId("dup-a");
    const idB = uniqueControlId("dup-b");
    const baseSegments = [
      `PID|1||P-DUP^^^HOSPITAL^MR||DUPLICATE^TEST||19901225|M`,
    ];

    const mkMessage = (controlId: string) =>
      [
        `MSH|^~\\&|ACME_LAB|ACME_LAB_FACILITY|ACME_HOSP|DEST|20260422142151||ADT^A01|${controlId}|P|2.5.1`,
        ...baseSegments,
      ].join("\r");

    await storeMessage(mkMessage(idA));
    await storeMessage(mkMessage(idB));

    const resultA = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
      `/fhir/IncomingHL7v2Message?message-control-id=${encodeURIComponent(idA)}`,
    );
    const resultB = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
      `/fhir/IncomingHL7v2Message?message-control-id=${encodeURIComponent(idB)}`,
    );
    expect(resultA.entry?.length).toBe(1);
    expect(resultB.entry?.length).toBe(1);
    expect(resultA.entry?.[0]?.resource.id).not.toBe(
      resultB.entry?.[0]?.resource.id,
    );
  });
});

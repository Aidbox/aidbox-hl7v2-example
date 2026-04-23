/**
 * Integration tests for the Terminology Map page — specifically the facet
 * handlers, which aggregate counts across every ConceptMap in the real test
 * Aidbox. Runs against the test Aidbox (port 8888).
 *
 * What we verify:
 *   1. Two ConceptMaps with different targetUri (LOINC + v3-ActCode) produce
 *      two entries in the FHIR facet with correct per-bucket counts.
 *   2. The sender facet correctly groups by ConceptMap.title regardless of
 *      targetUri.
 *   3. Detail partial finds a specific row via URL params and returns HTML
 *      containing the row's local + target code.
 */
import { describe, test, expect } from "bun:test";
import { aidboxFetch } from "../helpers";
import type { ConceptMap } from "../../../src/fhir/hl7-fhir-r4-core/ConceptMap";
import {
  handleTerminologyFhirFacet,
  handleTerminologySenderFacet,
  handleTerminologyDetailPartial,
} from "../../../src/ui/pages/terminology";

function reqWithParams(url: string, params: Record<string, string>): Request {
  const r = new Request(url) as Request & { params: Record<string, string> };
  r.params = params;
  return r;
}

const SENDER_TITLE = "TERMINOLOGY_TEST | FACILITY";

describe("smoke: terminology facets and detail — real Aidbox integration", () => {
  test("FHIR facet counts group by target field across ConceptMaps", async () => {
    // Seed: one ConceptMap per target system (LOINC, v3-ActCode).
    const loincMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: `terminology-test-loinc-${Date.now()}`,
      title: SENDER_TITLE,
      status: "active",
      targetUri: "http://loinc.org",
      group: [
        {
          source: "LOCAL",
          target: "http://loinc.org",
          element: [
            {
              code: "TERM_GLUC",
              display: "Glucose",
              target: [{ code: "2345-7", display: "Glucose [Mass/volume]", equivalence: "equivalent" }],
            },
            {
              code: "TERM_HGB",
              display: "Hemoglobin",
              target: [{ code: "718-7", display: "Hemoglobin", equivalence: "equivalent" }],
            },
          ],
        },
      ],
    };
    const actCodeMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: `terminology-test-actcode-${Date.now()}`,
      title: SENDER_TITLE,
      status: "active",
      targetUri: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      group: [
        {
          source: "LOCAL",
          target: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          element: [
            {
              code: "TERM_INP",
              display: "Inpatient",
              target: [{ code: "IMP", display: "Inpatient encounter", equivalence: "equivalent" }],
            },
          ],
        },
      ],
    };

    try {
      await aidboxFetch(`/fhir/ConceptMap/${loincMap.id}`, {
        method: "PUT",
        body: JSON.stringify(loincMap),
      });
      await aidboxFetch(`/fhir/ConceptMap/${actCodeMap.id}`, {
        method: "PUT",
        body: JSON.stringify(actCodeMap),
      });

      const res = await handleTerminologyFhirFacet(
        new Request("http://localhost:3000/terminology/partials/facets/fhir"),
      );
      expect(res.status).toBe(200);
      const body = await res.text();

      // Both FHIR targets should appear as facet rows with the right counts.
      // Observation.code has 2 entries; Encounter.class has 1.
      expect(body).toContain('data-name="Observation.code"');
      expect(body).toContain('data-name="Encounter.class"');
      // Counts appear inside <span class="font-mono ...">N</span>.
      expect(body).toMatch(/data-name="Observation\.code"[\s\S]*?>2</);
      expect(body).toMatch(/data-name="Encounter\.class"[\s\S]*?>1</);
    } finally {
      await aidboxFetch(`/fhir/ConceptMap/${loincMap.id}`, { method: "DELETE" }).catch(() => {});
      await aidboxFetch(`/fhir/ConceptMap/${actCodeMap.id}`, { method: "DELETE" }).catch(() => {});
    }
  });

  test("sender facet groups by ConceptMap.title", async () => {
    const cm: ConceptMap = {
      resourceType: "ConceptMap",
      id: `terminology-test-sender-${Date.now()}`,
      title: SENDER_TITLE,
      status: "active",
      targetUri: "http://loinc.org",
      group: [
        {
          source: "LOCAL",
          target: "http://loinc.org",
          element: [
            {
              code: "TERM_K",
              display: "Potassium",
              target: [{ code: "2823-3", display: "Potassium", equivalence: "equivalent" }],
            },
          ],
        },
      ],
    };

    try {
      await aidboxFetch(`/fhir/ConceptMap/${cm.id}`, {
        method: "PUT",
        body: JSON.stringify(cm),
      });

      const res = await handleTerminologySenderFacet(
        new Request("http://localhost:3000/terminology/partials/facets/sender"),
      );
      const body = await res.text();
      expect(body).toContain(`data-name="${SENDER_TITLE}"`);
    } finally {
      await aidboxFetch(`/fhir/ConceptMap/${cm.id}`, { method: "DELETE" }).catch(() => {});
    }
  });

  test("detail partial returns HTML for a specific row identified by URL params", async () => {
    const cm: ConceptMap = {
      resourceType: "ConceptMap",
      id: `terminology-test-detail-${Date.now()}`,
      title: SENDER_TITLE,
      status: "active",
      targetUri: "http://loinc.org",
      group: [
        {
          source: "LOCAL",
          target: "http://loinc.org",
          element: [
            {
              code: "TERM_A1C",
              display: "Hemoglobin A1c",
              target: [{ code: "4548-4", display: "HbA1c", equivalence: "equivalent" }],
            },
          ],
        },
      ],
    };

    try {
      await aidboxFetch(`/fhir/ConceptMap/${cm.id}`, {
        method: "PUT",
        body: JSON.stringify(cm),
      });

      const res = await handleTerminologyDetailPartial(
        reqWithParams(
          `http://localhost:3000/terminology/partials/detail/${encodeURIComponent(cm.id!)}/TERM_A1C?localSystem=LOCAL`,
          { conceptMapId: cm.id!, code: "TERM_A1C" },
        ),
      );

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('id="terminology-detail"');
      expect(body).toContain("TERM_A1C");
      expect(body).toContain("4548-4");
      expect(body).toContain("HbA1c");
      expect(body).toContain(SENDER_TITLE);
    } finally {
      await aidboxFetch(`/fhir/ConceptMap/${cm.id}`, { method: "DELETE" }).catch(() => {});
    }
  });
});

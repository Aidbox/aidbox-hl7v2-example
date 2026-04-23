/**
 * Unit tests for Task 12 — Terminology Add/Edit modal partial.
 *
 * Tests run in a separate file from terminology.test.ts to avoid the
 * aidboxFetch URL-routing conflict: the modal handler calls listConceptMaps()
 * which queries a URL shape (with _elements) that matters to some assertions.
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

// ============================================================================
// Mocks — aidboxFetch routes to either ConceptMap bundle or direct resource
// ============================================================================

type ConceptMapLike = {
  id: string;
  title?: string;
  targetUri?: string;
  group?: Array<{
    source?: string;
    target?: string;
    element?: Array<{ code?: string; display?: string; target?: Array<{ code?: string; display?: string }> }>;
  }>;
};

let mockConceptMaps: ConceptMapLike[] = [];

// Preserve HttpError / NotFoundError from the real module — other tests rely
// on the exact `HTTP {status}: {body}` message format. Import them first so
// mock.module only overrides the fetch-layer exports.
const realAidbox = await import("../../../src/aidbox");

mock.module("../../../src/aidbox", () => ({
  aidboxFetch: async (path: string) => {
    if (path.startsWith("/fhir/ConceptMap")) {
      return {
        resourceType: "Bundle",
        entry: mockConceptMaps.map((resource) => ({ resource })),
      };
    }
    if (path.includes("status=processed") || path.includes("status=code_mapping_error")) {
      return { resourceType: "Bundle", total: 0 };
    }
    return { resourceType: "Bundle", entry: [] };
  },
  putResource: async () => undefined,
  getResourceWithETag: async () => {
    throw new realAidbox.NotFoundError("Task", "mock");
  },
  updateResourceWithETag: async () => undefined,
  HttpError: realAidbox.HttpError,
  NotFoundError: realAidbox.NotFoundError,
}));

const {
  renderModalPartial,
  handleTerminologyModalPartial,
} = await import("../../../src/ui/pages/terminology");

const OBS_CODE = "http://loinc.org";

// ============================================================================
// renderModalPartial — structure
// ============================================================================

describe("renderModalPartial (add mode)", () => {
  const options = [
    { conceptMapId: "cm-a", label: "LAB_A | HOSP → Observation.code", fhirField: "Observation.code" },
    { conceptMapId: "cm-b", label: "LAB_B | HOSP → Encounter.class", fhirField: "Encounter.class" },
  ];

  it("renders 'Add new mapping' heading and creation copy", () => {
    const html = renderModalPartial({ mode: "add", options });
    expect(html).toContain("Add new mapping");
    expect(html).toContain("every future message");
    expect(html).toContain("Create mapping");
  });

  it("renders ConceptMap target dropdown with every option", () => {
    const html = renderModalPartial({ mode: "add", options });
    expect(html).toContain('<option value="cm-a">LAB_A | HOSP → Observation.code</option>');
    expect(html).toContain('<option value="cm-b">LAB_B | HOSP → Encounter.class</option>');
  });

  it("shows empty-state warning when no ConceptMaps exist", () => {
    const html = renderModalPartial({ mode: "add", options: [] });
    expect(html).toContain("No ConceptMaps exist yet");
  });

  it("form uses Alpine `:hx-post` to read picked.cmId at submit time", () => {
    const html = renderModalPartial({ mode: "add", options });
    expect(html).toContain(":hx-post=\"'/api/concept-maps/' + encodeURIComponent(picked.cmId) + '/entries'\"");
  });

  it("localSystem + localCode inputs are writable (no readonly)", () => {
    const html = renderModalPartial({ mode: "add", options });
    expect(html).toMatch(/<input[^>]*name="localSystem"(?![^>]*readonly)/);
    expect(html).toMatch(/<input[^>]*name="localCode"(?![^>]*readonly)/);
  });

  it("submit button is gated on ALL required fields for add mode", () => {
    const html = renderModalPartial({ mode: "add", options });
    // The gate expression references all four required fields
    expect(html).toContain("picked.cmId && picked.localSystem.trim() && picked.localCode.trim() && picked.targetCode.trim()");
  });

  it("ESC, backdrop mousedown, and save-event all remove the modal", () => {
    const html = renderModalPartial({ mode: "add", options });
    expect(html).toContain('x-on:keyup.escape.window="$root.remove()"');
    // Using mousedown.self (not click.self) so a drag-to-select that starts
    // inside an input and releases on the backdrop doesn't accidentally
    // close the modal on mouseup.
    expect(html).toContain('x-on:mousedown.self="$root.remove()"');
    expect(html).toContain('x-on:concept-map-entry-saved.window="$root.remove()"');
  });

  it("listens for concept-map-entry-error and surfaces the message in a banner", () => {
    const html = renderModalPartial({ mode: "add", options });
    // Listener wired on the modal root — sets errorMessage from event.detail.
    expect(html).toContain("x-on:concept-map-entry-error.window");
    expect(html).toContain("$event.detail?.message");
    // Error banner element exists and is gated by x-show.
    expect(html).toMatch(/<div[^>]*x-show="errorMessage"[^>]*>/s);
    expect(html).toContain('x-text="errorMessage"');
  });

  it("clears errorMessage when submit is pressed (so stale errors don't stick)", () => {
    const html = renderModalPartial({ mode: "add", options });
    // Submit button resets the error state so a retry doesn't show old text.
    expect(html).toMatch(/type="submit"[^>]*x-on:click="errorMessage = ''"/s);
  });

  it("emits hidden q/fhir/sender inputs so filter state is preserved through CRUD", () => {
    const html = renderModalPartial({ mode: "add", options });
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="q"[^>]*x-init/);
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="fhir"[^>]*x-init/);
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="sender"[^>]*x-init/);
  });
});

describe("renderModalPartial (edit mode)", () => {
  const row = {
    conceptMapId: "cm-obs",
    localCode: "GLUC",
    localDisplay: "Glucose",
    localSystem: "LOCAL",
    targetCode: "2345-7",
    targetDisplay: "Glucose [Mass/volume] in Serum or Plasma",
    targetSystem: OBS_CODE,
    sender: "LAB | HOSP",
    fhirField: "Observation.code",
    hl7Field: "OBX-3",
    mappingType: "observation-code-loinc" as const,
  };

  it("renders 'Edit mapping' heading with locked-target copy", () => {
    const html = renderModalPartial({ mode: "edit", row });
    expect(html).toContain("Edit mapping");
    expect(html).toContain("target is locked");
    expect(html).toContain("Observation.code");
    expect(html).toContain("Save changes");
  });

  it("does NOT render the ConceptMap picker (target is locked)", () => {
    const html = renderModalPartial({ mode: "edit", row });
    expect(html).not.toContain("Select a target ConceptMap");
  });

  it("form uses static hx-post URL with encoded cmId + code", () => {
    const html = renderModalPartial({ mode: "edit", row });
    expect(html).toContain(`hx-post="/api/concept-maps/cm-obs/entries/GLUC"`);
  });

  it("pre-fills Alpine state with row values for every field", () => {
    const html = renderModalPartial({ mode: "edit", row });
    // x-data JSON is HTML-escaped (quotes become &quot;) to protect against
    // single-quote injection in user-controlled fields like targetDisplay.
    // The picked-state JSON (escaped) + the `errorMessage: ""` init are both
    // inside the x-data attribute.
    expect(html).toContain("&quot;cmId&quot;:&quot;cm-obs&quot;");
    expect(html).toContain("&quot;localCode&quot;:&quot;GLUC&quot;");
    expect(html).toContain("&quot;targetCode&quot;:&quot;2345-7&quot;");
    expect(html).toContain(`errorMessage: ""`);
  });

  it("escapes single quotes in user data so x-data attr doesn't break", () => {
    const tricky = { ...row, localDisplay: "Patient's glucose", targetDisplay: "O'Leary [Test]" };
    const html = renderModalPartial({ mode: "edit", row: tricky });
    // Raw apostrophe in an attribute value would terminate the single-quoted
    // x-data attribute; escaped form &#39; is safe.
    expect(html).not.toMatch(/x-data='[^']*Patient's/);
    expect(html).toContain("Patient&#39;s glucose");
  });

  it("localSystem + localCode inputs are READONLY (target locked per plan)", () => {
    const html = renderModalPartial({ mode: "edit", row });
    expect(html).toMatch(/<input[^>]*name="localSystem"[^>]*readonly/);
    expect(html).toMatch(/<input[^>]*name="localCode"[^>]*readonly/);
  });

  it("submit gate in edit mode only requires targetCode (rest is locked)", () => {
    const html = renderModalPartial({ mode: "edit", row });
    expect(html).toContain("picked.targetCode.trim()");
    expect(html).not.toContain("picked.cmId && picked.localSystem.trim() && picked.localCode.trim() && picked.targetCode.trim()");
  });

  it("URL-encodes localCode with ^ in the form hx-post", () => {
    const caret = { ...row, localCode: "UNKNOWN^TEST" };
    const html = renderModalPartial({ mode: "edit", row: caret });
    expect(html).toContain("UNKNOWN%5ETEST");
    expect(html).not.toMatch(/hx-post="[^"]*\^[^"]*"/);
  });
});

// ============================================================================
// handleTerminologyModalPartial
// ============================================================================

describe("handleTerminologyModalPartial", () => {
  beforeEach(() => {
    mockConceptMaps = [];
  });

  it("returns 400 on invalid mode", async () => {
    const req = new Request("http://localhost/terminology/partials/modal?mode=bogus");
    const res = await handleTerminologyModalPartial(req);
    expect(res.status).toBe(400);
  });

  it("add mode returns the add modal with options list", async () => {
    mockConceptMaps = [
      {
        id: "cm-a",
        title: "LAB | HOSP",
        targetUri: OBS_CODE,
        group: [
          { source: "LOCAL", target: OBS_CODE, element: [{ code: "X", target: [{ code: "1" }] }] },
        ],
      },
    ];
    const req = new Request("http://localhost/terminology/partials/modal?mode=add");
    const res = await handleTerminologyModalPartial(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Add new mapping");
    expect(text).toContain('value="cm-a"');
  });

  it("edit mode returns 400 when conceptMapId or code missing", async () => {
    const req = new Request("http://localhost/terminology/partials/modal?mode=edit&conceptMapId=x");
    const res = await handleTerminologyModalPartial(req);
    expect(res.status).toBe(400);
  });

  it("edit mode returns 404 when row not found", async () => {
    const req = new Request(
      "http://localhost/terminology/partials/modal?mode=edit&conceptMapId=missing&code=NONE",
    );
    const res = await handleTerminologyModalPartial(req);
    expect(res.status).toBe(404);
  });

  it("edit mode returns 200 with pre-filled modal when row found", async () => {
    mockConceptMaps = [
      {
        id: "cm-a",
        title: "LAB | HOSP",
        targetUri: OBS_CODE,
        group: [
          {
            source: "LOCAL",
            target: OBS_CODE,
            element: [
              { code: "GLUC", display: "Glucose", target: [{ code: "2345-7", display: "Glucose [Mass/volume]" }] },
            ],
          },
        ],
      },
    ];
    const req = new Request(
      "http://localhost/terminology/partials/modal?mode=edit&conceptMapId=cm-a&code=GLUC&localSystem=LOCAL",
    );
    const res = await handleTerminologyModalPartial(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Edit mapping");
    expect(text).toContain("GLUC");
    expect(text).toContain("2345-7");
    expect(text).toContain(`hx-post="/api/concept-maps/cm-a/entries/GLUC"`);
  });

  it("edit mode returns 400 on malformed percent-sequence in params", async () => {
    const req = new Request(
      "http://localhost/terminology/partials/modal?mode=edit&conceptMapId=%E0%A4%A&code=x",
    );
    const res = await handleTerminologyModalPartial(req);
    expect(res.status).toBe(400);
  });

  it("edit mode round-trips a ^-containing localCode", async () => {
    mockConceptMaps = [
      {
        id: "cm-a",
        title: "LAB | HOSP",
        targetUri: OBS_CODE,
        group: [
          {
            source: "SYS",
            target: OBS_CODE,
            element: [{ code: "UNKNOWN^TEST", target: [{ code: "L1" }] }],
          },
        ],
      },
    ];
    const req = new Request(
      `http://localhost/terminology/partials/modal?mode=edit&conceptMapId=cm-a&code=${encodeURIComponent("UNKNOWN^TEST")}&localSystem=SYS`,
    );
    const res = await handleTerminologyModalPartial(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    // Form action uses URL-encoded caret. Alpine state's JSON is HTML-escaped
    // (double-quoted attr now: &quot; instead of raw "), so assert the escaped
    // form of the key-value pair.
    expect(text).toContain("UNKNOWN%5ETEST");
    expect(text).toContain("&quot;localCode&quot;:&quot;UNKNOWN^TEST&quot;");
  });
});

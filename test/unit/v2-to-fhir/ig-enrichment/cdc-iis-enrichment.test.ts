/**
 * Unit tests for CDC IIS Enrichment.
 * Tests ORDER-level OBX mapping and RXA-9 NIP001 interpretation.
 */

import { describe, test, expect } from "bun:test";
import { interpretRXA9Source } from "../../../../src/v2-to-fhir/ig-enrichment/cdc-iis-enrichment";
import type { CE } from "../../../../src/hl7v2/generated/fields";

const TODO = () => { /* placeholder */ };

describe("CDC IIS Enrichment", () => {
  describe("ORDER OBX mapping", () => {
    test.todo("64994-7 (Vaccine funding program eligibility) maps to programEligibility", TODO);
    test.todo("30963-3 (Vaccine funding source) maps to fundingSource", TODO);
    test.todo("30973-2 (Dose number in series) maps to protocolApplied.doseNumber", TODO);
    test.todo("unknown LOINC code produces hard error", TODO);
    test.todo("OBX without LOINC coding system produces hard error", TODO);
  });

  describe("VIS OBX grouping by OBX-4 sub-ID", () => {
    test.todo("69764-9 + 29768-9 + 29769-7 with same sub-ID form single education entry", TODO);
    test.todo("VIS OBX with different sub-IDs form separate education entries", TODO);
    test.todo("partial VIS group (doc type only, no dates) produces valid education entry", TODO);
    test.todo("multiple VIS groups produce education[] array", TODO);
  });

  describe("RXA-9 NIP001 interpretation", () => {
    test("code '00' sets primarySource=true", () => {
      const notes: CE[] = [{ $1_code: "00", $2_text: "New immunization record", $3_system: "NIP001" }];
      const result = interpretRXA9Source(notes);
      expect(result.primarySource).toBe(true);
      expect(result.reportOrigin).toBeUndefined();
    });

    test("code '01' sets primarySource=false with reportOrigin", () => {
      const notes: CE[] = [{ $1_code: "01", $2_text: "Historical", $3_system: "NIP001" }];
      const result = interpretRXA9Source(notes);
      expect(result.primarySource).toBe(false);
      expect(result.reportOrigin).toEqual({
        coding: [{ code: "01", display: "Historical", system: "urn:oid:2.16.840.1.114222.4.5.274" }],
      });
    });

    test("missing RXA-9 defaults to primarySource=true", () => {
      expect(interpretRXA9Source(undefined)).toEqual({ primarySource: true });
      expect(interpretRXA9Source([])).toEqual({ primarySource: true });
    });

    test("non-NIP001 coded RXA-9 entries are ignored, defaults to primarySource=true", () => {
      const notes: CE[] = [
        { $1_code: "ABC", $2_text: "Some note", $3_system: "L" },
        { $1_code: "DEF", $2_text: "Another note", $3_system: "CUSTOM" },
      ];
      const result = interpretRXA9Source(notes);
      expect(result.primarySource).toBe(true);
      expect(result.reportOrigin).toBeUndefined();
    });

    test("multiple RXA-9 entries with one NIP001 → correct one found", () => {
      const notes: CE[] = [
        { $1_code: "ABC", $2_text: "Unrelated", $3_system: "L" },
        { $1_code: "01", $2_text: "Historical", $3_system: "NIP001" },
        { $1_code: "XYZ", $2_text: "Another", $3_system: "OTHER" },
      ];
      const result = interpretRXA9Source(notes);
      expect(result.primarySource).toBe(false);
      expect(result.reportOrigin).toBeDefined();
    });

    test("NIP001 system match is case-insensitive", () => {
      const notes: CE[] = [{ $1_code: "01", $2_text: "Historical", $3_system: "nip001" }];
      const result = interpretRXA9Source(notes);
      expect(result.primarySource).toBe(false);
      expect(result.reportOrigin).toBeDefined();
    });

    test("unknown NIP001 code defaults to primarySource=true", () => {
      const notes: CE[] = [{ $1_code: "99", $2_text: "Unknown", $3_system: "NIP001" }];
      const result = interpretRXA9Source(notes);
      expect(result.primarySource).toBe(true);
      expect(result.reportOrigin).toBeUndefined();
    });
  });

  describe("enrichment correlation", () => {
    test.todo("matches ORDER OBX to correct Immunization by positional index", TODO);
    test.todo("multiple ORDER groups enrich their respective Immunizations positionally", TODO);
    test.todo("ORC-less ORDER group with OBX enriched correctly via positional matching", TODO);
    test.todo("ORDER group count != Immunization count warns on shape mismatch", TODO);
  });
});

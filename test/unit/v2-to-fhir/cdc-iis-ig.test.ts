/**
 * Unit tests for CDC IIS IG helpers.
 * Tests ORDER-level OBX mapping and RXA-9 NIP001 interpretation.
 */

import { describe, test, expect } from "bun:test";
import {
  interpretRXA9Source,
  applyOrderOBXFields,
} from "../../../src/v2-to-fhir/cdc-iis-ig";
import type { CE } from "../../../src/hl7v2/generated/fields";
import type { HL7v2Segment, FieldValue } from "../../../src/hl7v2/generated/types";

function makeDTOBXSegment(
  setId: string,
  loincCode: string,
  loincText: string,
  subId: string | undefined,
  dateValue: string,
): HL7v2Segment {
  return makeOBXSegment(setId, "DT", loincCode, loincText, subId, dateValue);
}

function makeSTOBXSegment(
  setId: string,
  loincCode: string,
  loincText: string,
  subId: string | undefined,
  stringValue: string,
): HL7v2Segment {
  return makeOBXSegment(setId, "ST", loincCode, loincText, subId, stringValue);
}

function makeOBXSegment(
  setId: string,
  valueType: string,
  loincCode: string,
  loincText: string,
  subId: string | undefined,
  value: FieldValue,
): HL7v2Segment {
  const fields: Record<number, FieldValue> = {
    1: setId,
    2: valueType,
    3: { 1: loincCode, 2: loincText, 3: "LN" },
    5: value,
  };
  if (subId !== undefined) {
    fields[4] = subId;
  }
  return { segment: "OBX", fields };
}

function makeCEOBXSegment(
  setId: string,
  loincCode: string,
  loincText: string,
  subId: string | undefined,
  ceValue: { code: string; text: string; system: string },
): HL7v2Segment {
  return makeOBXSegment(setId, "CE", loincCode, loincText, subId, {
    1: ceValue.code,
    2: ceValue.text,
    3: ceValue.system,
  });
}

describe("CDC IIS IG", () => {
  describe("ORDER OBX mapping", () => {
    test("64994-7 (Vaccine funding program eligibility) maps to programEligibility", () => {
      const obx = makeCEOBXSegment("1", "64994-7", "VACCINE FUND PGM ELIG CAT", "1", {
        code: "V02",
        text: "VFC ELIGIBLE-MEDICAID",
        system: "HL70064",
      });

      const result = applyOrderOBXFields([obx]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.programEligibility).toHaveLength(1);
      expect(result.fields.programEligibility![0]!.coding![0]!.code).toBe("V02");
      expect(result.fields.programEligibility![0]!.coding![0]!.display).toBe("VFC ELIGIBLE-MEDICAID");
    });

    test("30963-3 (Vaccine funding source) maps to fundingSource", () => {
      const obx = makeCEOBXSegment("1", "30963-3", "VACCINE FUNDING SOURCE", "1", {
        code: "VXC1",
        text: "MEDICAID",
        system: "CDCPHINVS",
      });

      const result = applyOrderOBXFields([obx]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.fundingSource).toBeDefined();
      expect(result.fields.fundingSource!.coding![0]!.code).toBe("VXC1");
    });

    test("30973-2 (Dose number in series) maps to protocolApplied.doseNumber", () => {
      const obx = makeOBXSegment("1", "NM", "30973-2", "Dose number in series", "1", "2");

      const result = applyOrderOBXFields([obx]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.protocolApplied).toHaveLength(1);
      expect(result.fields.protocolApplied![0]!.doseNumberString).toBe("2");
    });

    test("48767-8 (Annotation comment) maps to note.text", () => {
      const obx = makeOBXSegment(
        "1", "ST", "48767-8", "Annotation comment", "1", "Patient was nervous",
      );

      const result = applyOrderOBXFields([obx]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.note).toHaveLength(1);
      expect(result.fields.note![0]!.text).toBe("Patient was nervous");
    });

    test("multiple OBX segments accumulate fields", () => {
      const eligibility = makeCEOBXSegment("1", "64994-7", "VACCINE FUND PGM ELIG CAT", "1", {
        code: "V02",
        text: "VFC ELIGIBLE",
        system: "HL70064",
      });
      const doseNumber = makeOBXSegment("2", "NM", "30973-2", "Dose number", "1", "3");

      const result = applyOrderOBXFields([eligibility, doseNumber]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.programEligibility).toBeDefined();
      expect(result.fields.protocolApplied).toBeDefined();
      expect(result.fields.protocolApplied![0]!.doseNumberString).toBe("3");
    });

    test("unknown LOINC code produces hard error", () => {
      const obx = makeCEOBXSegment("1", "99999-9", "UNKNOWN CODE", "1", {
        code: "X",
        text: "Unknown",
        system: "L",
      });

      const result = applyOrderOBXFields([obx]);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("99999-9");
        expect(result.error).toContain("Unknown OBX code");
      }
    });

    test("OBX without LOINC coding system produces hard error", () => {
      const obx: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "CE",
          3: { 1: "64994-7", 2: "Some code", 3: "LOCAL" },
          5: { 1: "V02", 2: "text", 3: "sys" },
        },
      };

      const result = applyOrderOBXFields([obx]);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("LOINC");
      }
    });

    test("error on second OBX stops processing and returns that error", () => {
      const good = makeCEOBXSegment("1", "64994-7", "VACCINE FUND PGM ELIG CAT", "1", {
        code: "V02",
        text: "VFC ELIGIBLE",
        system: "HL70064",
      });
      const bad = makeCEOBXSegment("2", "99999-9", "UNKNOWN", "1", {
        code: "X",
        text: "Unknown",
        system: "L",
      });

      const result = applyOrderOBXFields([good, bad]);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("99999-9");
      }
    });

    test("empty OBX list returns empty fields", () => {
      const result = applyOrderOBXFields([]);

      expect("fields" in result).toBe(true);
      if ("fields" in result) {
        expect(Object.keys(result.fields)).toHaveLength(0);
      }
    });
  });

  describe("VIS OBX grouping by OBX-4 sub-ID", () => {
    test("69764-9 + 29768-9 + 29769-7 with same sub-ID form single education entry", () => {
      const docType = makeCEOBXSegment("1", "69764-9", "DOCUMENT TYPE", "3", {
        code: "253088698300026411121116",
        text: "HEPB",
        system: "cdcgs1vis",
      });
      const pubDate = makeDTOBXSegment("2", "29768-9", "VIS PUBLICATION DATE", "3", "20120202");
      const presDate = makeDTOBXSegment("3", "29769-7", "VIS PRESENTATION DATE", "3", "20160701");

      const result = applyOrderOBXFields([docType, pubDate, presDate]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.education).toHaveLength(1);
      const entry = result.fields.education![0]!;
      expect(entry.documentType).toBe("253088698300026411121116^HEPB^cdcgs1vis");
      expect(entry.publicationDate).toBe("2012-02-02");
      expect(entry.presentationDate).toBe("2016-07-01");
    });

    test("30956-7 (VIS document URI) maps to education.reference", () => {
      const visRef = makeSTOBXSegment(
        "1", "30956-7", "VIS Document reference URI", "5",
        "https://www.cdc.gov/vaccines/hcp/vis/vis-statements/hep-b.pdf",
      );

      const result = applyOrderOBXFields([visRef]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.education).toHaveLength(1);
      expect(result.fields.education![0]!.reference).toBe(
        "https://www.cdc.gov/vaccines/hcp/vis/vis-statements/hep-b.pdf",
      );
    });

    test("VIS OBX with different sub-IDs form separate education entries", () => {
      const docType1 = makeCEOBXSegment("1", "69764-9", "DOCUMENT TYPE", "3", {
        code: "HEPB_VIS",
        text: "HEPB",
        system: "cdcgs1vis",
      });
      const pubDate1 = makeDTOBXSegment("2", "29768-9", "VIS PUB DATE", "3", "20120202");
      const docType2 = makeCEOBXSegment("3", "69764-9", "DOCUMENT TYPE", "4", {
        code: "IPV_VIS",
        text: "IPV",
        system: "cdcgs1vis",
      });
      const pubDate2 = makeDTOBXSegment("4", "29768-9", "VIS PUB DATE", "4", "20150101");

      const result = applyOrderOBXFields([docType1, pubDate1, docType2, pubDate2]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.education).toHaveLength(2);
      expect(result.fields.education![0]!.documentType).toBe("HEPB_VIS^HEPB^cdcgs1vis");
      expect(result.fields.education![0]!.publicationDate).toBe("2012-02-02");
      expect(result.fields.education![1]!.documentType).toBe("IPV_VIS^IPV^cdcgs1vis");
      expect(result.fields.education![1]!.publicationDate).toBe("2015-01-01");
    });

    test("partial VIS group (doc type only, no dates) produces valid education entry", () => {
      const docType = makeCEOBXSegment("1", "69764-9", "DOCUMENT TYPE", "3", {
        code: "HEPB_VIS",
        text: "HEPB",
        system: "cdcgs1vis",
      });

      const result = applyOrderOBXFields([docType]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.education).toHaveLength(1);
      expect(result.fields.education![0]!.documentType).toBe("HEPB_VIS^HEPB^cdcgs1vis");
      expect(result.fields.education![0]!.publicationDate).toBeUndefined();
      expect(result.fields.education![0]!.presentationDate).toBeUndefined();
    });

    test("VIS OBX mixed with non-VIS OBX accumulates both fields and education", () => {
      const eligibility = makeCEOBXSegment("1", "64994-7", "VACCINE FUND PGM ELIG CAT", "1", {
        code: "V02",
        text: "VFC ELIGIBLE",
        system: "HL70064",
      });
      const docType = makeCEOBXSegment("2", "69764-9", "DOCUMENT TYPE", "3", {
        code: "HEPB_VIS",
        text: "HEPB",
        system: "cdcgs1vis",
      });
      const pubDate = makeDTOBXSegment("3", "29768-9", "VIS PUB DATE", "3", "20120202");

      const result = applyOrderOBXFields([eligibility, docType, pubDate]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.programEligibility).toBeDefined();
      expect(result.fields.education).toHaveLength(1);
      expect(result.fields.education![0]!.documentType).toBe("HEPB_VIS^HEPB^cdcgs1vis");
    });

    test("VIS OBX without OBX-4 sub-ID groups together under default key", () => {
      const docType = makeCEOBXSegment("1", "69764-9", "DOCUMENT TYPE", undefined, {
        code: "HEPB_VIS",
        text: "HEPB",
        system: "cdcgs1vis",
      });
      const pubDate = makeDTOBXSegment("2", "29768-9", "VIS PUB DATE", undefined, "20120202");

      const result = applyOrderOBXFields([docType, pubDate]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.education).toHaveLength(1);
      expect(result.fields.education![0]!.documentType).toBe("HEPB_VIS^HEPB^cdcgs1vis");
      expect(result.fields.education![0]!.publicationDate).toBe("2012-02-02");
    });

    test("VIS OBX with all four fields (doc type, pub date, pres date, reference)", () => {
      const docType = makeCEOBXSegment("1", "69764-9", "DOCUMENT TYPE", "3", {
        code: "HEPB_VIS",
        text: "HEPB",
        system: "cdcgs1vis",
      });
      const pubDate = makeDTOBXSegment("2", "29768-9", "VIS PUB DATE", "3", "20120202");
      const presDate = makeDTOBXSegment("3", "29769-7", "VIS PRES DATE", "3", "20160701");
      const visRef = makeSTOBXSegment("4", "30956-7", "VIS REF URI", "3", "https://example.com/vis.pdf");

      const result = applyOrderOBXFields([docType, pubDate, presDate, visRef]);

      expect("fields" in result).toBe(true);
      if ("error" in result) throw new Error(result.error);
      expect(result.fields.education).toHaveLength(1);
      const entry = result.fields.education![0]!;
      expect(entry.documentType).toBe("HEPB_VIS^HEPB^cdcgs1vis");
      expect(entry.publicationDate).toBe("2012-02-02");
      expect(entry.presentationDate).toBe("2016-07-01");
      expect(entry.reference).toBe("https://example.com/vis.pdf");
    });
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
});

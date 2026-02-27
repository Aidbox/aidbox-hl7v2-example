import { describe, test, expect } from "bun:test";
import { normalizeSystem } from "../../../src/v2-to-fhir/code-mapping/coding-systems";

describe("normalizeSystem", () => {
  test("LOINC variants", () => {
    expect(normalizeSystem("LN")).toBe("http://loinc.org");
    expect(normalizeSystem("LOINC")).toBe("http://loinc.org");
    expect(normalizeSystem("loinc")).toBe("http://loinc.org");
  });

  test("SNOMED variants", () => {
    expect(normalizeSystem("SCT")).toBe("http://snomed.info/sct");
    expect(normalizeSystem("SNOMED")).toBe("http://snomed.info/sct");
    expect(normalizeSystem("SNOMEDCT")).toBe("http://snomed.info/sct");
  });

  test("ICD-10 variants", () => {
    expect(normalizeSystem("ICD10")).toBe("http://hl7.org/fhir/sid/icd-10");
    expect(normalizeSystem("I10")).toBe("http://hl7.org/fhir/sid/icd-10");
  });

  test("CVX", () => {
    expect(normalizeSystem("CVX")).toBe("http://hl7.org/fhir/sid/cvx");
    expect(normalizeSystem("cvx")).toBe("http://hl7.org/fhir/sid/cvx");
  });

  test("NCIT (NCI Thesaurus)", () => {
    expect(normalizeSystem("NCIT")).toBe("http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl");
    expect(normalizeSystem("ncit")).toBe("http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl");
  });

  test("HL70163 (Body Site)", () => {
    expect(normalizeSystem("HL70163")).toBe("http://terminology.hl7.org/CodeSystem/v2-0163");
    expect(normalizeSystem("hl70163")).toBe("http://terminology.hl7.org/CodeSystem/v2-0163");
  });

  test("unknown system passes through unchanged", () => {
    expect(normalizeSystem("CUSTOM_SYS")).toBe("CUSTOM_SYS");
    expect(normalizeSystem("http://example.com/cs")).toBe("http://example.com/cs");
  });

  test("undefined returns undefined", () => {
    expect(normalizeSystem(undefined)).toBeUndefined();
  });

  test("empty string returns undefined", () => {
    expect(normalizeSystem("")).toBeUndefined();
  });
});

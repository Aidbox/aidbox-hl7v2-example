import { test, expect, describe } from "bun:test";
import { highlightHL7Message, getHighlightStyles } from "@atomic-ehr/hl7v2/src/hl7v2/highlight";

describe("highlightHL7Message", () => {
  test("returns placeholder for undefined input", () => {
    expect(highlightHL7Message(undefined)).toBe(
      '<span class="text-gray-400">No HL7v2 message</span>'
    );
  });

  test("highlights MSH segment with field tooltips", () => {
    const msg = "MSH|^~\\&|APP|FAC|||20231215||ADT^A01|MSG001|P|2.4";
    const result = highlightHL7Message(msg);

    expect(result).toContain('<span class="hl7-segment">MSH</span>');
    expect(result).toContain('title="MSH.1: Field Separator"');
    expect(result).toContain('title="MSH.2: Encoding Characters"');
    expect(result).toContain("ADT");
    expect(result).toContain("A01");
  });

  test("highlights PID segment", () => {
    const msg = "PID|1||12345^^^HOSP^MR||Smith^John";
    const result = highlightHL7Message(msg);

    expect(result).toContain('<span class="hl7-segment">PID</span>');
    expect(result).toContain("Smith");
    expect(result).toContain("John");
  });

  test("highlights component separators", () => {
    const msg = "PID|1||12345||Smith^John^Robert";
    const result = highlightHL7Message(msg);

    expect(result).toContain('<span class="hl7-delim hl7-comp">^</span>');
  });

  test("highlights repetition separators", () => {
    const msg = "PID|1||12345~67890";
    const result = highlightHL7Message(msg);

    expect(result).toContain('<span class="hl7-delim hl7-rep">~</span>');
  });

  test("highlights multi-segment message", () => {
    const msg = "MSH|^~\\&|APP|FAC|||20231215||ADT^A01|MSG001|P|2.4\rPID|1||12345||Smith^John";
    const result = highlightHL7Message(msg);

    expect(result).toContain("MSH");
    expect(result).toContain("PID");
    expect(result.split("\n").length).toBe(2);
  });

  test("handles LF line endings", () => {
    const msg = "MSH|^~\\&|APP|FAC\nPID|1";
    const result = highlightHL7Message(msg);

    expect(result.split("\n").length).toBe(2);
  });
});

describe("getHighlightStyles", () => {
  test("returns CSS styles", () => {
    const styles = getHighlightStyles();

    expect(styles).toContain(".hl7-segment");
    expect(styles).toContain(".hl7-pipe");
    expect(styles).toContain(".hl7-comp");
    expect(styles).toContain(".hl7-rep");
    expect(styles).toContain(".hl7-sub");
  });
});

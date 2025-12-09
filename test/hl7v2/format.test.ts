import { test, expect, describe } from "bun:test";
import { formatMessage, formatSingleSegment } from "../../src/hl7v2/format";
import type { HL7v2Message, HL7v2Segment } from "../../src/hl7v2/types";

describe("formatMessage", () => {
  test("formats empty message", () => {
    expect(formatMessage([])).toBe("");
  });

  test("formats simple MSH segment", () => {
    const message: HL7v2Message = [
      {
        segment: "MSH",
        fields: {
          1: "|",
          2: "^~\\&",
          3: "SENDING_APP",
          4: "SENDING_FAC",
          5: "RECEIVING_APP",
          6: "RECEIVING_FAC",
          7: "202312011200",
          9: { 1: "ADT", 2: "A01" },
          10: "MSG001",
          11: { 1: "P" },
          12: { 1: "2.5.1" },
        },
      },
    ];

    const result = formatMessage(message);
    expect(result).toBe(
      "MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|202312011200||ADT^A01|MSG001|P|2.5.1"
    );
  });

  test("formats message with multiple segments", () => {
    const message: HL7v2Message = [
      {
        segment: "MSH",
        fields: {
          1: "|",
          2: "^~\\&",
          3: "APP",
          9: { 1: "ADT", 2: "A01" },
          10: "MSG001",
        },
      },
      {
        segment: "PID",
        fields: {
          1: "1",
          3: { 1: "12345", 4: { 1: "HOSP" }, 5: "MR" },
          5: { 1: { 1: "Doe" }, 2: "John" },
        },
      },
    ];

    const result = formatMessage(message);
    const segments = result.split("\r");
    expect(segments.length).toBe(2);
    expect(segments[0]).toBe("MSH|^~\\&|APP||||||ADT^A01|MSG001");
    expect(segments[1]).toBe("PID|1||12345^^^HOSP^MR||Doe^John");
  });

  test("formats complex components with subcomponents", () => {
    const message: HL7v2Message = [
      {
        segment: "MSH",
        fields: { 1: "|", 2: "^~\\&" },
      },
      {
        segment: "PID",
        fields: {
          5: { 1: { 1: "Smith", 2: "von" }, 2: "John", 3: "Robert" },
        },
      },
    ];

    const result = formatMessage(message);
    const segments = result.split("\r");
    expect(segments[1]).toBe("PID|||||Smith&von^John^Robert");
  });

  test("formats repeating fields", () => {
    const message: HL7v2Message = [
      {
        segment: "MSH",
        fields: { 1: "|", 2: "^~\\&" },
      },
      {
        segment: "PID",
        fields: {
          3: [
            { 1: "12345", 5: "MR" },
            { 1: "67890", 5: "SS" },
          ],
        },
      },
    ];

    const result = formatMessage(message);
    const segments = result.split("\r");
    expect(segments[1]).toBe("PID|||12345^^^^MR~67890^^^^SS");
  });

  test("uses custom segment separator", () => {
    const message: HL7v2Message = [
      {
        segment: "MSH",
        fields: { 1: "|", 2: "^~\\&", 3: "APP" },
      },
      {
        segment: "PID",
        fields: { 1: "1" },
      },
    ];

    const result = formatMessage(message, { segmentSep: "\n" });
    expect(result).toBe("MSH|^~\\&|APP\nPID|1");
  });

  test("uses custom field separator", () => {
    const message: HL7v2Message = [
      {
        segment: "MSH",
        fields: { 1: "#", 2: "^~\\&", 3: "APP" },
      },
    ];

    const result = formatMessage(message, { fieldSep: "#" });
    expect(result).toBe("MSH#^~\\&#APP");
  });

  test("uses custom encoding characters", () => {
    const message: HL7v2Message = [
      {
        segment: "MSH",
        fields: { 1: "|", 2: "$+\\!", 3: "APP" },
      },
      {
        segment: "PID",
        fields: {
          5: { 1: { 1: "Smith", 2: "Jr" }, 2: "John" },
        },
      },
    ];

    const result = formatMessage(message, { encodingChars: "$+\\!" });
    const segments = result.split("\r");
    expect(segments[0]).toBe("MSH|$+\\!|APP");
    expect(segments[1]).toBe("PID|||||Smith!Jr$John");
  });

  test("trims trailing empty fields", () => {
    const message: HL7v2Message = [
      {
        segment: "MSH",
        fields: { 1: "|", 2: "^~\\&" },
      },
      {
        segment: "PID",
        fields: { 1: "1", 5: { 1: "Doe" } },
      },
    ];

    const result = formatMessage(message);
    const segments = result.split("\r");
    expect(segments[1]).toBe("PID|1||||Doe");
  });

  test("trims trailing empty components", () => {
    const segment: HL7v2Segment = {
      segment: "PID",
      fields: {
        5: { 1: "Smith", 2: "", 3: "" },
      },
    };

    const result = formatSingleSegment(segment);
    expect(result).toBe("PID|||||Smith");
  });
});

describe("formatSingleSegment", () => {
  test("formats a simple segment", () => {
    const segment: HL7v2Segment = {
      segment: "EVN",
      fields: {
        1: "A01",
        2: "202312011200",
      },
    };

    const result = formatSingleSegment(segment);
    expect(result).toBe("EVN|A01|202312011200");
  });

  test("formats MSH segment correctly", () => {
    const segment: HL7v2Segment = {
      segment: "MSH",
      fields: {
        1: "|",
        2: "^~\\&",
        3: "APP",
        4: "FAC",
      },
    };

    const result = formatSingleSegment(segment);
    expect(result).toBe("MSH|^~\\&|APP|FAC");
  });

  test("uses provided delimiters", () => {
    const segment: HL7v2Segment = {
      segment: "PID",
      fields: {
        5: { 1: "Doe", 2: "John" },
      },
    };

    const result = formatSingleSegment(segment, "#", "$+\\!");
    expect(result).toBe("PID#####Doe$John");
  });
});

import { describe, test, expect } from "bun:test";
import { rewriteMessageControlId } from "../../../src/mllp/client";

const crlf = (segments: string[]) => segments.join("\r");
const lf = (segments: string[]) => segments.join("\n");

describe("rewriteMessageControlId", () => {
  test("replaces MSH-10 in a CR-delimited message", () => {
    const raw = crlf([
      "MSH|^~\\&|APP|FAC|RCV|FAC|20260422142151||ADT^A01|ORIG-ID|P|2.5.1",
      "PID|1||12345",
    ]);
    const out = rewriteMessageControlId(raw, "NEW-ID");
    expect(out).toBe(
      crlf([
        "MSH|^~\\&|APP|FAC|RCV|FAC|20260422142151||ADT^A01|NEW-ID|P|2.5.1",
        "PID|1||12345",
      ]),
    );
  });

  test("preserves LF delimiters when present", () => {
    const raw = lf([
      "MSH|^~\\&|APP|FAC|RCV|FAC|20260422142151||ADT^A01|ORIG|P|2.5.1",
      "PID|1||12345",
    ]);
    const out = rewriteMessageControlId(raw, "NEW");
    expect(out).toContain("\n");
    expect(out).not.toContain("\r");
    expect(out).toContain("|ADT^A01|NEW|P|2.5.1");
  });

  test("preserves CRLF delimiters when present", () => {
    const raw = "MSH|^~\\&|A|B|C|D|T||ADT^A01|ORIG|P|2.5.1\r\nPID|1";
    const out = rewriteMessageControlId(raw, "NEW");
    expect(out).toBe("MSH|^~\\&|A|B|C|D|T||ADT^A01|NEW|P|2.5.1\r\nPID|1");
  });

  test("leaves other segments byte-for-byte untouched", () => {
    const raw = crlf([
      "MSH|^~\\&|APP|FAC|RCV|FAC|T||ORU^R01|ORIG|P|2.5.1",
      "PID|1||P12345^^^HOSPITAL^MR||DOE^JANE||19850707|F",
      "OBX|1|NM|UNKNOWN_TEST^Unknown^LOCAL||123|mg/dL|||||F",
    ]);
    const out = rewriteMessageControlId(raw, "NEW");
    expect(out.split("\r")[1]).toBe("PID|1||P12345^^^HOSPITAL^MR||DOE^JANE||19850707|F");
    expect(out.split("\r")[2]).toBe("OBX|1|NM|UNKNOWN_TEST^Unknown^LOCAL||123|mg/dL|||||F");
  });

  test("appends empty fields when MSH is shorter than 10 fields", () => {
    const raw = "MSH|^~\\&|APP|FAC|RCV|FAC|T";
    const out = rewriteMessageControlId(raw, "NEW");
    expect(out).toBe("MSH|^~\\&|APP|FAC|RCV|FAC|T|||NEW");
  });

  test("returns input unchanged when MSH segment is absent", () => {
    const raw = "PID|1||12345\rOBX|1|NM|test";
    expect(rewriteMessageControlId(raw, "NEW")).toBe(raw);
  });

  test("does not alter field-delimiter characters like ^ inside message-type MSH-9", () => {
    const raw = "MSH|^~\\&|APP|FAC|RCV|FAC|T||ORU^R01|ORIG|P|2.5.1";
    const out = rewriteMessageControlId(raw, "NEW");
    expect(out.split("|")[8]).toBe("ORU^R01");
    expect(out.split("|")[9]).toBe("NEW");
  });
});

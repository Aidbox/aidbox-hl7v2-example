import { describe, test, expect } from "bun:test";
import { parseSendingAttempt } from "../../../src/v2-to-fhir/processor-service";

describe("parseSendingAttempt", () => {
  test("returns 0 for undefined error", () => {
    expect(parseSendingAttempt(undefined)).toBe(0);
  });

  test("returns 0 for unrelated error message", () => {
    expect(parseSendingAttempt("PV1-19 is required but missing")).toBe(0);
  });

  test("returns 0 for empty string", () => {
    expect(parseSendingAttempt("")).toBe(0);
  });

  test("parses attempt 1 from error field", () => {
    expect(parseSendingAttempt("Sending failed (attempt 1/3): Connection refused")).toBe(1);
  });

  test("parses attempt 2 from error field", () => {
    expect(parseSendingAttempt("Sending failed (attempt 2/3): timeout")).toBe(2);
  });

  test("parses attempt 3 from error field", () => {
    expect(parseSendingAttempt("Sending failed (attempt 3/3): 422 Unprocessable Entity")).toBe(3);
  });
});

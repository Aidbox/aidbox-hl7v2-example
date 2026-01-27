import { test, expect, describe } from "bun:test";
import { convertEDToAttachment, convertEDToDocumentReference } from "../../../../src/v2-to-fhir/datatypes/ed-attachment";

describe("convertEDToAttachment", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEDToAttachment(undefined)).toBeUndefined();
  });

  test("returns undefined for empty ED", () => {
    expect(convertEDToAttachment({})).toBeUndefined();
  });

  test("returns undefined when only source application is present", () => {
    expect(convertEDToAttachment({ $1_sourceApplication: "APP" })).toBeUndefined();
  });

  test("converts data subtype to contentType", () => {
    const result = convertEDToAttachment({
      $3_dataSubtype: "application/pdf",
    });
    expect(result).toEqual({
      contentType: "application/pdf",
    });
  });

  test("converts data to attachment data", () => {
    const result = convertEDToAttachment({
      $5_data: "SGVsbG8gV29ybGQ=",
    });
    expect(result).toEqual({
      data: "SGVsbG8gV29ybGQ=",
    });
  });

  test("converts full ED to Attachment", () => {
    const result = convertEDToAttachment({
      $1_sourceApplication: "LAB_SYSTEM",
      $2_typeOfData: "TEXT",
      $3_dataSubtype: "text/plain",
      $4_encoding: "A",
      $5_data: "VGVzdCBkYXRh",
    });
    expect(result).toEqual({
      contentType: "text/plain",
      data: "VGVzdCBkYXRh",
    });
  });

  test("handles PDF content type", () => {
    const result = convertEDToAttachment({
      $3_dataSubtype: "application/pdf",
      $5_data: "JVBERi0xLjQK",
    });
    expect(result).toEqual({
      contentType: "application/pdf",
      data: "JVBERi0xLjQK",
    });
  });
});

describe("convertEDToDocumentReference", () => {
  test("returns undefined for undefined input", () => {
    expect(convertEDToDocumentReference(undefined)).toBeUndefined();
  });

  test("returns undefined for empty ED", () => {
    expect(convertEDToDocumentReference({})).toBeUndefined();
  });

  test("returns DocumentReference with status current", () => {
    const result = convertEDToDocumentReference({
      $3_dataSubtype: "text/plain",
      $5_data: "SGVsbG8=",
    });
    expect(result?.status).toBe("current");
  });

  test("converts to DocumentReference with content attachment", () => {
    const result = convertEDToDocumentReference({
      $3_dataSubtype: "application/pdf",
      $5_data: "JVBERi0xLjQK",
    });
    expect(result).toEqual({
      status: "current",
      content: [
        {
          attachment: {
            contentType: "application/pdf",
            data: "JVBERi0xLjQK",
          },
        },
      ],
    });
  });

  test("converts content type only", () => {
    const result = convertEDToDocumentReference({
      $3_dataSubtype: "image/jpeg",
    });
    expect(result).toEqual({
      status: "current",
      content: [
        {
          attachment: {
            contentType: "image/jpeg",
          },
        },
      ],
    });
  });

  test("converts data only", () => {
    const result = convertEDToDocumentReference({
      $5_data: "SGVsbG8gV29ybGQ=",
    });
    expect(result).toEqual({
      status: "current",
      content: [
        {
          attachment: {
            data: "SGVsbG8gV29ybGQ=",
          },
        },
      ],
    });
  });
});

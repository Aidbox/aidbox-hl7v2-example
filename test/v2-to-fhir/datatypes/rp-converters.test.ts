import { test, expect, describe } from "bun:test";
import {
  convertRPToAttachment,
  convertRPToDocumentReference,
} from "../../../src/v2-to-fhir/datatypes/rp-converters";

describe("convertRPToAttachment", () => {
  test("returns undefined for undefined input", () => {
    expect(convertRPToAttachment(undefined)).toBeUndefined();
  });

  test("returns undefined when no pointer or type", () => {
    expect(convertRPToAttachment({})).toBeUndefined();
  });

  test("returns attachment with url only", () => {
    const result = convertRPToAttachment({
      $1_pointer: "http://example.com/document.pdf",
    });
    expect(result).toEqual({
      url: "http://example.com/document.pdf",
    });
  });

  test("returns attachment with contentType from type only", () => {
    const result = convertRPToAttachment({
      $3_typeOfData: "application",
    });
    expect(result).toEqual({
      contentType: "application",
    });
  });

  test("returns attachment with contentType from type and subtype", () => {
    const result = convertRPToAttachment({
      $3_typeOfData: "application",
      $4_subtype: "pdf",
    });
    expect(result).toEqual({
      contentType: "application/pdf",
    });
  });

  test("returns full attachment with url and contentType", () => {
    const result = convertRPToAttachment({
      $1_pointer: "http://example.com/image.png",
      $3_typeOfData: "image",
      $4_subtype: "png",
    });
    expect(result).toEqual({
      url: "http://example.com/image.png",
      contentType: "image/png",
    });
  });
});

describe("convertRPToDocumentReference", () => {
  test("returns undefined for undefined input", () => {
    expect(convertRPToDocumentReference(undefined)).toBeUndefined();
  });

  test("returns undefined when no pointer or type", () => {
    expect(convertRPToDocumentReference({})).toBeUndefined();
  });

  test("returns DocumentReference content with attachment", () => {
    const result = convertRPToDocumentReference({
      $1_pointer: "http://example.com/doc.pdf",
      $3_typeOfData: "application",
      $4_subtype: "pdf",
    });
    expect(result).toEqual({
      content: [
        {
          attachment: {
            url: "http://example.com/doc.pdf",
            contentType: "application/pdf",
          },
        },
      ],
    });
  });
});

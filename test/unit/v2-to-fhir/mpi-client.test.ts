import { describe, test, expect } from "bun:test";
import { StubMpiClient } from "../../../src/v2-to-fhir/mpi-client";

describe("StubMpiClient", () => {
  const client = new StubMpiClient();

  test("crossReference returns not-found", async () => {
    const result = await client.crossReference(
      { system: "urn:oid:1.2.3", value: "12345" },
      "urn:oid:9.8.7",
    );
    expect(result).toEqual({ status: "not-found" });
  });

  test("match returns not-found", async () => {
    const result = await client.match(
      { familyName: "Smith", givenName: "John", birthDate: "1990-01-01", gender: "M" },
      "urn:oid:9.8.7",
    );
    expect(result).toEqual({ status: "not-found" });
  });
});

import { describe, test, expect } from "bun:test";
import { handleStaticAsset } from "../../../src/ui/static";

function request(path: string): Request {
  return new Request(`http://localhost:3000${path}`);
}

describe("handleStaticAsset", () => {
  test("serves vendored htmx bundle with correct content type and body", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/htmx-2.0.10.min.js"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toContain("immutable");
    const body = await response.text();
    expect(body).toContain("htmx");
  });

  test("serves vendored alpine bundle with correct content type and body", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/alpine-3.15.11.min.js"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    const body = await response.text();
    expect(body).toContain("Alpine");
  });

  test("query string does not affect lookup", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/htmx-2.0.10.min.js?v=cachebust"),
    );
    expect(response.status).toBe(200);
  });

  test("returns 404 for missing whitelisted filename", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/does-not-exist.js"),
    );
    expect(response.status).toBe(404);
  });

  test("rejects raw path traversal with ..", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/../../etc/passwd"),
    );
    expect(response.status).toBe(404);
  });

  test("rejects URL-encoded path traversal %2E%2E%2F", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/%2E%2E%2Fsecret"),
    );
    expect(response.status).toBe(404);
  });

  test("rejects half-encoded dot-dot (%2E%2E/secret)", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/%2E%2E/secret"),
    );
    expect(response.status).toBe(404);
  });

  test("rejects absolute path inside vendor segment", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor//etc/passwd"),
    );
    expect(response.status).toBe(404);
  });

  test("rejects backslash in filename", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/htmx.min.js%5Cextra"),
    );
    expect(response.status).toBe(404);
  });

  test("rejects nested subdirectories under vendor", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/sub/htmx.min.js"),
    );
    expect(response.status).toBe(404);
  });

  test("rejects non-whitelisted extension", async () => {
    const response = await handleStaticAsset(request("/static/vendor/secret.env"));
    expect(response.status).toBe(404);
  });

  test("rejects paths outside /static/vendor", async () => {
    const response = await handleStaticAsset(
      request("/static/other/htmx-2.0.10.min.js"),
    );
    expect(response.status).toBe(404);
  });

  test("rejects uppercased /Static/Vendor (path is case-sensitive)", async () => {
    const response = await handleStaticAsset(
      request("/Static/Vendor/htmx-2.0.10.min.js"),
    );
    expect(response.status).toBe(404);
  });

  test("rejects trailing slash on filename", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/htmx-2.0.10.min.js/"),
    );
    expect(response.status).toBe(404);
  });

  test("rejects null byte injection (%00)", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/htmx-2.0.10.min.js%00.png"),
    );
    expect(response.status).toBe(404);
  });

  test("rejects malformed URL encoding (%ZZ)", async () => {
    const response = await handleStaticAsset(
      request("/static/vendor/%ZZ.js"),
    );
    expect(response.status).toBe(404);
  });
});

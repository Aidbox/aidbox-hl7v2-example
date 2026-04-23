import { join } from "node:path";

const PUBLIC_ROOT = join(import.meta.dir, "..", "..", "public");

// Whitelist of allowed static paths. Matches the **raw** (un-decoded) pathname
// so URL-encoded traversal bytes (`%2E`, `%2F`, `%00`, ...) cannot satisfy the
// character class — they contain `%`, which is not allowed. This avoids any
// decode-then-match ordering bugs. `woff2?` extensions are forward-looking for
// self-hosted fonts (a Task 1 non-goal; v1 uses Google Fonts CDN).
const ALLOWED_PATH = /^\/static\/vendor\/(?<filename>[A-Za-z0-9._-]+)\.(?<ext>js|css|svg|woff2?)$/;

const CONTENT_TYPES: Record<string, string> = {
  js: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml; charset=utf-8",
  woff: "font/woff",
  woff2: "font/woff2",
};

export async function handleStaticAsset(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const match = ALLOWED_PATH.exec(url.pathname);

  if (!match) {
    return new Response("Not Found", { status: 404 });
  }

  const { filename, ext } = match.groups as { filename: string; ext: string };
  const filePath = join(PUBLIC_ROOT, "vendor", `${filename}.${ext}`);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(file, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

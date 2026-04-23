import { describe, test, expect } from "bun:test";
import { renderShell, renderLegacyBody, type NavKey } from "../../../src/ui/shell";
import type { NavData } from "../../../src/ui/shared";

const navData: NavData = {
  pendingMappingTasksCount: 3,
  incomingTotal: 42,
};

describe("renderShell", () => {
  test("marks the requested sidebar key as active", () => {
    const html = renderShell({
      active: "accounts",
      title: "Accounts",
      content: "<p>body</p>",
      navData,
    });

    expect(html).toMatch(/class="nav-item active"[^>]*href="\/accounts"/);
    expect(html).not.toMatch(/class="nav-item active"[^>]*href="\/"/);
  });

  test("wires all three sidebar groups with the correct hrefs", () => {
    const html = renderShell({
      active: "dashboard",
      title: "Dashboard",
      content: "",
      navData,
    });

    const expectedLinks: Array<[NavKey, string, string]> = [
      ["dashboard", "/", "Dashboard"],
      ["inbound", "/incoming-messages", "Inbound Messages"],
      ["simulate", "/simulate-sender", "Simulate Sender"],
      ["unmapped", "/unmapped-codes", "Unmapped Codes"],
      ["terminology", "/terminology", "Terminology Map"],
      ["accounts", "/accounts", "Accounts"],
      ["outgoing", "/outgoing-messages", "Outgoing Messages"],
    ];
    for (const [, href, label] of expectedLinks) {
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain(label);
    }

    expect(html).toContain(">Workspace<");
    expect(html).toContain(">Terminology<");
    expect(html).toContain(">Outbound<");
  });

  test("shows inbound total count without the hot-tone utility", () => {
    // Count badges carry `data-count` (stable selector for the test) and a
    // utility stack whose hot/cold tone is the only signal consumers care
    // about. Asserting on `text-accent` presence is the contract.
    const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
    expect(html).toMatch(
      /href="\/incoming-messages"[^<]*[^>]*>[\s\S]*?<span data-count[^>]*class="[^"]*text-ink-3[^"]*"[^>]*>42<\/span>/,
    );
    expect(html).not.toMatch(/data-count[^>]*text-accent[^>]*>42</);
  });

  test("count badges carry ml-auto — layout-critical utility must not regress", () => {
    // Without `ml-auto` the count badge collapses next to the icon+label
    // instead of aligning to the right edge of the nav-item. Guard it.
    const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
    expect(html).toMatch(/<span data-count[^>]*class="[^"]*\bml-auto\b[^"]*"/);
  });

  test("applies hot tone on unmapped count when non-zero", () => {
    const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
    expect(html).toMatch(
      /<span data-count data-hot[^>]*class="[^"]*text-accent[^"]*"[^>]*>3<\/span>/,
    );
  });

  test("omits hot tone on unmapped when count is zero", () => {
    const html = renderShell({
      active: "dashboard",
      title: "D",
      content: "",
      navData: { pendingMappingTasksCount: 0, incomingTotal: 0 },
    });
    expect(html).toMatch(
      /<span data-count[^>]*class="[^"]*text-ink-3[^"]*"[^>]*>0<\/span>/,
    );
    expect(html).not.toContain("data-hot");
  });

  test("embeds the page title", () => {
    const html = renderShell({
      active: "dashboard",
      title: "My Page Title",
      content: "",
      navData,
    });
    expect(html).toContain("<title>My Page Title</title>");
  });

  test("embeds the provided body content inside the page column", () => {
    const html = renderShell({
      active: "dashboard",
      title: "D",
      content: '<p id="unique-body-marker">hi</p>',
      navData,
    });
    expect(html).toContain('<p id="unique-body-marker">hi</p>');
  });

  test("loads vendored htmx, alpine, and tailwind (v4 browser) from the static route", () => {
    const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
    expect(html).toContain('src="/static/vendor/htmx-2.0.10.min.js"');
    expect(html).toContain('src="/static/vendor/alpine-3.15.11.min.js"');
    expect(html).toContain('src="/static/vendor/tailwindcss-browser-4.2.4.min.js"');
  });

  test("does not reference any external CDN (offline-capable)", () => {
    const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
    // Google Fonts is still remote by design (see Task 1 non-goal); only
    // script tags are vetted here.
    expect(html).not.toMatch(/<script[^>]*src="https?:\/\/cdn\./);
    expect(html).not.toContain("cdn.tailwindcss.com");
  });

  test("embeds the icon sprite at the end of the body", () => {
    const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
    expect(html).toContain('id="i-home"');
    expect(html).toContain('id="i-inbox"');
  });

  test("env pill defaults to ok tone when ENV is unset", () => {
    const originalEnv = process.env.ENV;
    delete process.env.ENV;
    try {
      const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
      expect(html).toContain('<span class="dot ok"></span>');
    } finally {
      if (originalEnv !== undefined) process.env.ENV = originalEnv;
    }
  });

  test("env pill uses warn tone for staging", () => {
    const originalEnv = process.env.ENV;
    process.env.ENV = "staging";
    try {
      const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
      expect(html).toContain('<span class="dot warn"></span>');
      expect(html).toContain(">staging<");
    } finally {
      process.env.ENV = originalEnv ?? "";
      if (originalEnv === undefined) delete process.env.ENV;
    }
  });

  test("env pill uses err tone for prod", () => {
    const originalEnv = process.env.ENV;
    process.env.ENV = "prod";
    try {
      const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
      expect(html).toContain('<span class="dot err"></span>');
    } finally {
      process.env.ENV = originalEnv ?? "";
      if (originalEnv === undefined) delete process.env.ENV;
    }
  });

  test("env tone dot is not attached to the health poller", () => {
    const originalEnv = process.env.ENV;
    process.env.ENV = "prod";
    try {
      const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
      expect(html).not.toMatch(/<span class="dot err"[^>]*data-health-dot/);
    } finally {
      process.env.ENV = originalEnv ?? "";
      if (originalEnv === undefined) delete process.env.ENV;
    }
  });

  test("health dot and health label are separate elements from env tone and env label", () => {
    const originalEnv = process.env.ENV;
    process.env.ENV = "prod";
    try {
      const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
      expect(html).toMatch(/<span data-health-dot><\/span>/);
      expect(html).toMatch(/<span[^>]*data-health-label[^>]*>Aidbox<\/span>/);
      expect(html).not.toMatch(/data-health-label[^>]*>prod</);
    } finally {
      process.env.ENV = originalEnv ?? "";
      if (originalEnv === undefined) delete process.env.ENV;
    }
  });

  test("escapes the page title", () => {
    const html = renderShell({
      active: "dashboard",
      title: '</title><script>alert(1)</script>',
      content: "",
      navData,
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("escapes MLLP_HOST from the environment", () => {
    const originalHost = process.env.MLLP_HOST;
    process.env.MLLP_HOST = '"><img src=x>';
    try {
      const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
      expect(html).not.toContain('"><img src=x>');
      expect(html).toContain("&quot;&gt;&lt;img src=x&gt;");
    } finally {
      process.env.MLLP_HOST = originalHost ?? "";
      if (originalHost === undefined) delete process.env.MLLP_HOST;
    }
  });

  test("env pill shows mllp endpoint from env vars with defaults", () => {
    const originalHost = process.env.MLLP_HOST;
    const originalPort = process.env.MLLP_PORT;
    delete process.env.MLLP_HOST;
    delete process.env.MLLP_PORT;
    try {
      const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
      expect(html).toContain("mllp://localhost:2575");
    } finally {
      if (originalHost !== undefined) process.env.MLLP_HOST = originalHost;
      if (originalPort !== undefined) process.env.MLLP_PORT = originalPort;
    }
  });

  test("env pill respects custom MLLP_HOST and MLLP_PORT", () => {
    const originalHost = process.env.MLLP_HOST;
    const originalPort = process.env.MLLP_PORT;
    process.env.MLLP_HOST = "10.1.4.22";
    process.env.MLLP_PORT = "9999";
    try {
      const html = renderShell({ active: "dashboard", title: "D", content: "", navData });
      expect(html).toContain("mllp://10.1.4.22:9999");
    } finally {
      process.env.MLLP_HOST = originalHost ?? "";
      process.env.MLLP_PORT = originalPort ?? "";
      if (originalHost === undefined) delete process.env.MLLP_HOST;
      if (originalPort === undefined) delete process.env.MLLP_PORT;
    }
  });
});

describe("renderLegacyBody", () => {
  test("wraps content in a gray card frame", () => {
    expect(renderLegacyBody("<span>x</span>")).toBe(
      '<div class="bg-gray-100 rounded-lg p-6"><span>x</span></div>',
    );
  });
});

/**
 * Smoke test: every page handler returns a 200 response that embeds the new
 * warm-paper shell (identified by the `.sidebar` marker). Exercises each
 * handler against the test Aidbox — catches regressions where a page hasn't
 * been migrated to `renderShell`, or where the shell import was broken by a
 * refactor.
 */
import { describe, test, expect } from "bun:test";
import { handleAccountsPage } from "../../../src/ui/pages/accounts";
import { handleOutgoingMessagesPage } from "../../../src/ui/pages/messages";
import { handleUnmappedCodesPage } from "../../../src/ui/pages/unmapped";
import { handleTerminologyPage } from "../../../src/ui/pages/terminology";
import { handleSimulateSenderPage } from "../../../src/ui/pages/simulate-sender";
import { handleInboundMessagesPage } from "../../../src/ui/pages/inbound";
import { handleDashboardPage } from "../../../src/ui/pages/dashboard";

interface Route {
  path: string;
  label: string;
  call: () => Promise<Response>;
}

const ROUTES: Route[] = [
  {
    path: "/",
    label: "Dashboard",
    call: () =>
      handleDashboardPage(new Request("http://localhost:3000/"), {
        workersHandle: null,
        demoEnabled: true,
      }),
  },
  {
    path: "/accounts",
    label: "Accounts",
    call: () => handleAccountsPage(new Request("http://localhost:3000/accounts")),
  },
  {
    path: "/outgoing-messages",
    label: "Outgoing Messages",
    call: () =>
      handleOutgoingMessagesPage(new Request("http://localhost:3000/outgoing-messages")),
  },
  {
    path: "/incoming-messages",
    label: "Inbound Messages",
    call: () =>
      handleInboundMessagesPage(
        new Request("http://localhost:3000/incoming-messages"),
      ),
  },
  {
    path: "/simulate-sender",
    label: "Simulate Sender",
    call: () => handleSimulateSenderPage(),
  },
  {
    path: "/unmapped-codes",
    label: "Unmapped Codes",
    call: () =>
      handleUnmappedCodesPage(new Request("http://localhost:3000/unmapped-codes")),
  },
  {
    path: "/terminology",
    label: "Terminology Map",
    call: () => handleTerminologyPage(new Request("http://localhost:3000/terminology")),
  },
];

describe("smoke: every shell page returns 200", () => {
  for (const route of ROUTES) {
    test(`${route.path} (${route.label})`, async () => {
      const response = await route.call();
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain('class="sidebar"');
    });
  }
});

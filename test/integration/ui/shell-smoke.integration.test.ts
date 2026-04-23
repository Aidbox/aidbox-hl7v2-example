/**
 * Smoke test: every page handler returns a 200 response that embeds the new
 * warm-paper shell (identified by the `.sidebar` marker). Exercises each
 * handler against the test Aidbox — catches regressions where a page hasn't
 * been migrated to `renderShell`, or where the shell import was broken by a
 * refactor.
 */
import { describe, test, expect } from "bun:test";
import { handleAccountsPage } from "../../../src/ui/pages/accounts";
import {
  handleIncomingMessagesPage,
  handleOutgoingMessagesPage,
} from "../../../src/ui/pages/messages";
import { handleMappingTasksPage } from "../../../src/ui/pages/mapping-tasks";
import { handleCodeMappingsPage } from "../../../src/ui/pages/code-mappings";
import { handleSimulateSenderPage } from "../../../src/ui/pages/simulate-sender";

interface Route {
  path: string;
  label: string;
  call: () => Promise<Response>;
}

const ROUTES: Route[] = [
  {
    // TODO(task-6): swap to handleDashboardPage once `/` moves off Accounts.
    path: "/",
    label: "Dashboard (currently Accounts)",
    call: () => handleAccountsPage(new Request("http://localhost:3000/")),
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
      handleIncomingMessagesPage(new Request("http://localhost:3000/incoming-messages")),
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
      handleMappingTasksPage(new Request("http://localhost:3000/unmapped-codes")),
  },
  {
    path: "/terminology",
    label: "Terminology Map",
    call: () => handleCodeMappingsPage(new Request("http://localhost:3000/terminology")),
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

import type { Page } from "@playwright/test";
import type { FaultId } from "../src/faults.js";

export interface Observation {
  /** true when the bug is visible (actual differs from expected) */
  failed: boolean;
  actual: string;
}

export interface TicketDef {
  id: string;
  fault: FaultId;
  title: string;
  severity: "critical" | "major" | "minor";
  area: "login" | "content" | "search" | "editor" | "deployment";
  steps: string[];
  expected: string;
  reproduce: (page: Page, baseURL: string) => Promise<Observation>;
}

export async function signIn(page: Page, baseURL: string, password = "editor-pass"): Promise<void> {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Username").fill("editor");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function searchFor(page: Page, baseURL: string, q: string): Promise<string[]> {
  await signIn(page, baseURL);
  await page.goto(`${baseURL}/search?q=${encodeURIComponent(q)}`);
  return page.getByTestId("search-results").locator("li").allTextContents();
}

export const TICKETS: TicketDef[] = [
  {
    id: "BUG-001", fault: "search-case-sensitive", title: "Search is case sensitive", severity: "major", area: "search",
    steps: ["Sign in as editor", "Search for FRACTIONS (upper case)"],
    expected: "\"Fractions: the basics\" is listed",
    reproduce: async (page, base) => {
      const hits = await searchFor(page, base, "FRACTIONS");
      return { failed: !hits.includes("Fractions: the basics"), actual: `${hits.length} result(s): ${hits.join(", ") || "none"}` };
    },
  },
  {
    id: "BUG-002", fault: "search-empty-500", title: "Empty search causes a server error", severity: "major", area: "search",
    steps: ["Sign in as editor", "Open /search?q= (press Search with an empty field)"],
    expected: "HTTP 400 with the message \"Please enter a search term\"",
    reproduce: async (page, base) => {
      await signIn(page, base);
      const res = await page.goto(`${base}/search?q=`);
      const status = res?.status() ?? 0;
      return { failed: status !== 400, actual: `HTTP ${status}` };
    },
  },
  {
    id: "BUG-003", fault: "search-single-result", title: "Search shows only the first match", severity: "major", area: "search",
    steps: ["Sign in as editor", "Search for maths"],
    expected: "2 results (both Maths units)",
    reproduce: async (page, base) => {
      const hits = await searchFor(page, base, "maths");
      return { failed: hits.length !== 2, actual: `${hits.length} result(s): ${hits.join(", ") || "none"}` };
    },
  },
  {
    id: "BUG-004", fault: "search-umlaut", title: "Search does not find words with umlauts", severity: "minor", area: "search",
    steps: ["Sign in as editor", "Search for ubungen"],
    expected: "\"Übungen zur Bruchrechnung\" is listed",
    reproduce: async (page, base) => {
      const hits = await searchFor(page, base, "ubungen");
      return { failed: !hits.includes("Übungen zur Bruchrechnung"), actual: `${hits.length} result(s): ${hits.join(", ") || "none"}` };
    },
  },
  {
    id: "BUG-005", fault: "save-drops-body", title: "Saving a learning unit loses the edited text", severity: "critical", area: "editor",
    steps: ["Sign in as editor", "Open \"Smoke test note\" and press Edit", "Replace the body with \"Updated by ticket repro\"", "Press Save"],
    expected: "Page shows \"Saved\" and the new text",
    reproduce: async (page, base) => {
      await signIn(page, base);
      await page.goto(`${base}/content/smoke-test-note/edit`);
      await page.getByLabel("Body").fill("Updated by ticket repro");
      await page.getByRole("button", { name: "Save" }).click();
      const body = (await page.getByTestId("content-body").textContent()) ?? "";
      return { failed: !body.includes("Updated by ticket repro"), actual: `Body after save: "${body.slice(0, 80)}"` };
    },
  },
  {
    id: "BUG-006", fault: "save-title-unescaped", title: "HTML in a title is rendered instead of escaped", severity: "critical", area: "editor",
    steps: ["Sign in as editor", "Edit \"Smoke test note\"", "Set the title to <i data-testid=\"injected\">x</i> Note", "Press Save"],
    expected: "The title is displayed as plain text; no new element appears",
    reproduce: async (page, base) => {
      await signIn(page, base);
      await page.goto(`${base}/content/smoke-test-note/edit`);
      await page.getByLabel("Title").fill('<i data-testid="injected">x</i> Note');
      await page.getByRole("button", { name: "Save" }).click();
      const injected = await page.locator('[data-testid="injected"]').count();
      return { failed: injected > 0, actual: injected > 0 ? "Markup was rendered as an <i> element" : "Title shown as text" };
    },
  },
  {
    id: "BUG-007", fault: "save-empty-title", title: "Learning unit can be saved with an empty title", severity: "major", area: "editor",
    steps: ["Sign in as editor", "Edit \"Smoke test note\"", "Set the title to three spaces", "Press Save"],
    expected: "Error \"Title must not be empty\", nothing saved",
    reproduce: async (page, base) => {
      await signIn(page, base);
      await page.goto(`${base}/content/smoke-test-note/edit`);
      await page.getByLabel("Title").fill("   ");
      await page.getByRole("button", { name: "Save" }).click();
      const alert = await page.getByRole("alert").count();
      return { failed: alert === 0, actual: alert === 0 ? `Saved; URL ${new URL(page.url()).pathname}${new URL(page.url()).search}` : "Validation message shown" };
    },
  },
  {
    id: "BUG-008", fault: "login-any-password", title: "Login accepts any password", severity: "critical", area: "login",
    steps: ["Open /login", "Enter editor / wrong-password", "Press Sign in"],
    expected: "Message \"Invalid username or password\", user stays on /login",
    reproduce: async (page, base) => {
      await signIn(page, base, "wrong-password");
      const path = new URL(page.url()).pathname;
      return { failed: path !== "/login", actual: `Landed on ${path}` };
    },
  },
  {
    id: "BUG-009", fault: "logout-keeps-session", title: "Session stays valid after logout", severity: "critical", area: "login",
    steps: ["Sign in as editor and copy the sid cookie", "Press Log out", "Call GET /api/content with the old sid cookie"],
    expected: "HTTP 401",
    reproduce: async (page, base) => {
      await signIn(page, base);
      const sid = (await page.context().cookies()).find((c) => c.name === "sid");
      await page.getByTestId("logout").click();
      if (sid) await page.context().addCookies([sid]);
      const res = await page.goto(`${base}/api/content`);
      const status = res?.status() ?? 0;
      return { failed: status !== 401, actual: `HTTP ${status} with the old session cookie` };
    },
  },
  {
    id: "BUG-010", fault: "health-wrong-version", title: "Health endpoint reports the wrong version", severity: "major", area: "deployment",
    steps: ["Deploy version 1.0.0", "Open /api/health"],
    expected: "\"version\": \"1.0.0\"",
    reproduce: async (page, base) => {
      await page.goto(`${base}/api/health`);
      const body = JSON.parse((await page.locator("body").textContent()) ?? "{}") as { version?: string };
      return { failed: body.version !== "1.0.0", actual: `"version": "${body.version}"` };
    },
  },
  {
    id: "BUG-011", fault: "content-missing-500", title: "Unknown content id causes a server error", severity: "minor", area: "content",
    steps: ["Sign in as editor", "Open /content/does-not-exist"],
    expected: "HTTP 404 page",
    reproduce: async (page, base) => {
      await signIn(page, base);
      const res = await page.goto(`${base}/content/does-not-exist`);
      const status = res?.status() ?? 0;
      return { failed: status !== 404, actual: `HTTP ${status}` };
    },
  },
  {
    id: "BUG-012", fault: "list-unsorted", title: "Content list is not sorted by title", severity: "minor", area: "content",
    steps: ["Sign in as editor", "Look at the content list"],
    expected: "Titles in alphabetical order",
    reproduce: async (page, base) => {
      await signIn(page, base);
      const titles = await page.getByTestId("content-list").locator("li a").allTextContents();
      const sorted = [...titles].sort((a, b) => a.localeCompare(b, "en"));
      const ok = titles.every((t, i) => t === sorted[i]);
      return { failed: !ok, actual: `Order: ${titles.slice(0, 3).join(" | ")} ...` };
    },
  },
];

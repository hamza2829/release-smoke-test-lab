import { expect, test, type Page } from "@playwright/test";

/**
 * Post-deployment smoke tests. They run against whichever instance
 * SMOKE_ENV / BASE_URL points to, after every deployment (staging and production).
 * Test titles start with the SMK id used by checklists/release-checklist.md.
 */
const SCREENSHOTS = `reports/screenshots/${process.env.SMOKE_ENV ?? "staging"}`;

async function login(page: Page, username = "editor", password = "editor-pass"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("SMK-01 API health reports ok and the deployed version", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.contentItems).toBeGreaterThan(0);
  if (process.env.EXPECTED_VERSION) expect(body.version).toBe(process.env.EXPECTED_VERSION);
  if (process.env.SMOKE_ENV) expect(body.env).toBe(process.env.SMOKE_ENV);
});

test("SMK-02 anonymous visitor is redirected to sign in", async ({ page }) => {
  await page.goto("/content");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("SMK-03 wrong password is rejected", async ({ page }) => {
  await login(page, "editor", "not-the-password");
  await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
  await expect(page).toHaveURL(/\/login$/);
});

test("SMK-04 editor can sign in", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/content$/);
  await expect(page.getByTestId("current-user")).toHaveText("Erika Editor");
  await page.screenshot({ path: `${SCREENSHOTS}/content-list.png`, fullPage: true });
});

test("SMK-05 content list is shown sorted by title", async ({ page }) => {
  await login(page);
  const titles = await page.getByTestId("content-list").locator("li a").allTextContents();
  expect(titles.length).toBeGreaterThanOrEqual(8);
  expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "en")));
});

test("SMK-06 learning content opens", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Photosynthesis in five steps" }).click();
  await expect(page.getByTestId("content-title")).toHaveText("Photosynthesis in five steps");
  await expect(page.getByTestId("content-body")).toContainText("glucose");
});

test("SMK-07 unknown content shows a 404 page", async ({ page }) => {
  await login(page);
  const res = await page.goto("/content/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("error-status")).toHaveText("404");
});

test("SMK-08 search is case insensitive", async ({ page }) => {
  await login(page);
  await page.getByLabel("Search").fill("FRACTIONS");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("search-results")).toContainText("Fractions: the basics");
});

test("SMK-09 search returns every match and handles umlauts", async ({ page }) => {
  await login(page);
  await page.goto("/search?q=ubungen");
  await expect(page.getByTestId("search-results")).toContainText("Übungen zur Bruchrechnung");
  await page.goto("/search?q=maths");
  await expect(page.getByTestId("search-results").locator("li")).toHaveCount(2);
  await page.screenshot({ path: `${SCREENSHOTS}/search.png`, fullPage: true });
});

test("SMK-10 empty search shows a validation message", async ({ page }) => {
  await login(page);
  const res = await page.goto("/search?q=");
  expect(res?.status()).toBe(400);
  await expect(page.getByRole("alert")).toHaveText("Please enter a search term");
});

test("SMK-11 editor can edit and save content", async ({ page }) => {
  await login(page);
  await page.goto("/content/smoke-test-note");
  const before = Number(await page.getByTestId("revision").textContent());
  const marker = `Smoke run ${Date.now()}`;
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Body").fill(`This page is edited by the automated smoke tests after every deployment. ${marker}`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByTestId("content-body")).toContainText(marker);
  expect(Number(await page.getByTestId("revision").textContent())).toBe(before + 1);
});

test("SMK-12 empty title is rejected on save", async ({ page }) => {
  await login(page);
  await page.goto("/content/smoke-test-note/edit");
  await page.getByLabel("Title").fill("   ");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert")).toHaveText("Title must not be empty");
});

test("SMK-13 logout ends the session", async ({ page }) => {
  await login(page);
  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/content");
  await expect(page).toHaveURL(/\/login$/);
});

test("SMK-14 content API requires authentication", async ({ request }) => {
  const res = await request.get("/api/content", { headers: { cookie: "" } });
  expect(res.status()).toBe(401);
});

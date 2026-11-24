import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";

const envs = JSON.parse(readFileSync(new URL("./envs/environments.json", import.meta.url), "utf8")) as Record<string, { port: number }>;
const smokeEnv = process.env.SMOKE_ENV ?? "staging";
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${envs[smokeEnv]?.port ?? 4101}`;

export default defineConfig({
  testDir: "./smoke",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15_000,
  reporter: [["list"], ["json", { outputFile: `reports/smoke-${smokeEnv}.json` }]],
  use: { baseURL, screenshot: "only-on-failure", trace: "off" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});

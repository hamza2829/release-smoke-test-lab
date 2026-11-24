import type { AddressInfo } from "node:net";
import { chromium, type Browser } from "@playwright/test";
import { Auth } from "../src/auth.js";
import { Faults, type FaultId } from "../src/faults.js";
import { createApp } from "../src/server.js";
import { ContentStore } from "../src/store.js";
import type { Observation, TicketDef } from "./catalog.js";

export const REPRO_VERSION = "1.0.0";

/** Start a throw-away in-memory instance with the given faults switched on. */
export async function startInstance(faultIds: FaultId[]): Promise<{ baseURL: string; close: () => Promise<void> }> {
  const faults = new Faults(faultIds);
  const server = createApp({ store: new ContentStore(null, faults), auth: new Auth(undefined, faults), faults, env: "repro", version: REPRO_VERSION });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return { baseURL: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) };
}

export async function runTicket(browser: Browser, ticket: TicketDef, faultOn: boolean, screenshot?: string): Promise<Observation & { ms: number }> {
  const inst = await startInstance(faultOn ? [ticket.fault] : []);
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const page = await ctx.newPage();
  page.on("console", () => {});
  const t0 = Date.now();
  try {
    const obs = await ticket.reproduce(page, inst.baseURL);
    if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
    return { ...obs, ms: Date.now() - t0 };
  } finally {
    await ctx.close();
    await inst.close();
  }
}

export async function withBrowser<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch();
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
import { ContentStore } from "../src/store.js";
import { Faults } from "../src/faults.js";
import { Auth } from "../src/auth.js";
import { escapeHtml } from "../src/render.js";

let server: Server | null = null;

async function start(faults: Faults = new Faults()): Promise<string> {
  server = createApp({ store: new ContentStore(null, faults), auth: new Auth(undefined, faults), faults, env: "test", version: "9.9.9" });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  server = null;
});

async function login(base: string, user = "editor", pass = "editor-pass"): Promise<{ status: number; cookie: string; setCookie: string }> {
  const r = await fetch(`${base}/login`, { method: "POST", body: new URLSearchParams({ username: user, password: pass }), redirect: "manual" });
  const setCookie = r.headers.get("set-cookie") ?? "";
  return { status: r.status, cookie: setCookie.split(";")[0], setCookie };
}

describe("HTTP app", () => {
  it("health reports env, version and version headers (TC-040)", async () => {
    const base = await start();
    const r = await fetch(`${base}/api/health`);
    expect(await r.json()).toMatchObject({ status: "ok", env: "test", version: "9.9.9", contentItems: 8 });
    expect(r.headers.get("x-app-version")).toBe("9.9.9");
    expect(r.headers.get("x-app-env")).toBe("test");
  });

  it("sets an HttpOnly SameSite session cookie (TC-012)", async () => {
    const base = await start();
    const { status, setCookie } = await login(base);
    expect(status).toBe(303);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("returns 401 on the API without a session and after logout (TC-014)", async () => {
    const base = await start();
    expect((await fetch(`${base}/api/content`)).status).toBe(401);
    const { cookie } = await login(base);
    expect((await fetch(`${base}/api/content`, { headers: { cookie } })).status).toBe(200);
    await fetch(`${base}/logout`, { method: "POST", headers: { cookie }, redirect: "manual" });
    expect((await fetch(`${base}/api/content`, { headers: { cookie } })).status).toBe(401);
  });

  it("forbids the editor for viewers and hides the Edit link (TC-019, TC-020)", async () => {
    const base = await start();
    const { cookie } = await login(base, "viewer", "viewer-pass");
    expect((await fetch(`${base}/content/photosynthesis/edit`, { headers: { cookie } })).status).toBe(403);
    const html = await (await fetch(`${base}/content/photosynthesis`, { headers: { cookie } })).text();
    expect(html).not.toContain(">Edit<");
  });

  it("escapes HTML in saved titles (TC-021)", async () => {
    const base = await start();
    const { cookie } = await login(base);
    await fetch(`${base}/content/photosynthesis`, { method: "POST", headers: { cookie }, body: new URLSearchParams({ title: "<script>alert(1)</script>", body: "b" }), redirect: "manual" });
    const html = await (await fetch(`${base}/content/photosynthesis`, { headers: { cookie } })).text();
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("search API returns JSON hits with scores (TC-028)", async () => {
    const base = await start();
    const { cookie } = await login(base);
    const hits = (await (await fetch(`${base}/api/search?q=essay`, { headers: { cookie } })).json()) as Array<{ id: string; score: number }>;
    expect(hits[0]).toMatchObject({ id: "essay-structure" });
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it("refuses oversized request bodies without changing content (TC-039)", async () => {
    const base = await start();
    const { cookie } = await login(base);
    const r = await fetch(`${base}/content/photosynthesis`, { method: "POST", headers: { cookie }, body: new URLSearchParams({ title: "x", body: "y".repeat(100_000) }), redirect: "manual" });
    expect(r.status).toBe(413);
    const item = (await (await fetch(`${base}/api/content/photosynthesis`, { headers: { cookie } })).json()) as { revision: number };
    expect(item.revision).toBe(1);
  });

  it("returns 404 JSON for unknown API content and 422 for invalid saves", async () => {
    const base = await start();
    const { cookie } = await login(base);
    expect((await fetch(`${base}/api/content/nope`, { headers: { cookie } })).status).toBe(404);
    const r = await fetch(`${base}/content/photosynthesis`, { method: "POST", headers: { cookie }, body: new URLSearchParams({ title: " ", body: "b" }), redirect: "manual" });
    expect(r.status).toBe(422);
  });

  it("seeded fault health-wrong-version reports 0.0.0", async () => {
    const base = await start(new Faults(["health-wrong-version"]));
    expect(((await (await fetch(`${base}/api/health`)).json()) as { version: string }).version).toBe("0.0.0");
  });

  it("escapeHtml escapes all five special characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

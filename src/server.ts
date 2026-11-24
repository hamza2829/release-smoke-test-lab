import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Auth, type User } from "./auth.js";
import { Faults } from "./faults.js";
import { contentPage, editPage, errorPage, layout, listPage, loginPage, searchPage, type PageMeta } from "./render.js";
import { EmptyQueryError, search } from "./search.js";
import { ContentStore, NotFoundError, ValidationError } from "./store.js";

export interface AppOptions {
  store: ContentStore;
  auth?: Auth;
  faults?: Faults;
  env?: string;
  version?: string;
}

const MAX_BODY = 64 * 1024;

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new ValidationError("Request body too large");
    chunks.push(chunk as Buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

export function createApp(opts: AppOptions): Server {
  const faults = opts.faults ?? new Faults();
  const auth = opts.auth ?? new Auth(undefined, faults);
  const store = opts.store;
  const env = opts.env ?? "local";
  const version = opts.version ?? "0.0.0-dev";
  const started = Date.now();

  const send = (res: ServerResponse, status: number, body: string, type = "text/html; charset=utf-8", headers: Record<string, string | string[]> = {}) => {
    res.writeHead(status, { "content-type": type, "x-app-version": version, "x-app-env": env, ...headers });
    res.end(body);
  };
  const json = (res: ServerResponse, status: number, data: unknown) => send(res, status, JSON.stringify(data), "application/json");
  const redirect = (res: ServerResponse, to: string, headers: Record<string, string | string[]> = {}) => {
    res.writeHead(303, { location: to, ...headers });
    res.end();
  };
  const page = (res: ServerResponse, status: number, title: string, user: User | null, body: string) => {
    const meta: PageMeta = { env, version, user };
    send(res, status, layout(title, meta, body));
  };

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    const method = req.method ?? "GET";
    const token = parseCookies(req.headers.cookie).sid;
    const user = auth.userFor(token);

    if (path === "/api/health" && method === "GET") {
      return json(res, 200, {
        status: "ok",
        env,
        version: faults.has("health-wrong-version") ? "0.0.0" : version,
        uptimeSeconds: Math.round((Date.now() - started) / 1000),
        contentItems: store.list().length,
      });
    }
    if (path === "/login" && method === "GET") return page(res, 200, "Sign in", null, loginPage());
    if (path === "/login" && method === "POST") {
      const form = await readForm(req);
      const sid = auth.login(form.get("username") ?? "", form.get("password") ?? "");
      if (!sid) return page(res, 401, "Sign in", null, loginPage("Invalid username or password"));
      return redirect(res, "/content", { "set-cookie": `sid=${sid}; HttpOnly; SameSite=Lax; Path=/` });
    }
    if (path === "/logout" && method === "POST") {
      auth.logout(token);
      return redirect(res, "/login", { "set-cookie": "sid=; Max-Age=0; Path=/" });
    }

    // everything below requires a session
    if (!user) {
      if (path.startsWith("/api/")) return json(res, 401, { error: "authentication required" });
      return redirect(res, "/login");
    }

    if (path === "/" ) return redirect(res, "/content");
    if (path === "/api/content" && method === "GET") return json(res, 200, store.list());
    if (path === "/api/search" && method === "GET") {
      try {
        const hits = search(store.list(), url.searchParams.get("q") ?? "", faults);
        return json(res, 200, hits.map((h) => ({ id: h.item.id, title: h.item.title, score: h.score })));
      } catch (e) {
        if (e instanceof EmptyQueryError) return json(res, 400, { error: e.message });
        throw e;
      }
    }
    const apiItem = path.match(/^\/api\/content\/([\w-]+)$/);
    if (apiItem && method === "GET") return json(res, 200, store.get(apiItem[1]));

    if (path === "/content" && method === "GET") return page(res, 200, "Content", user, listPage(store.list()));
    if (path === "/search" && method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      try {
        return page(res, 200, "Search", user, searchPage(q, search(store.list(), q, faults)));
      } catch (e) {
        if (e instanceof EmptyQueryError) return page(res, 400, "Search", user, searchPage(q, [], e.message));
        throw e;
      }
    }
    const edit = path.match(/^\/content\/([\w-]+)\/edit$/);
    if (edit && method === "GET") {
      if (user.role !== "editor") return page(res, 403, "Forbidden", user, errorPage(403, "Editors only"));
      return page(res, 200, "Edit", user, editPage(store.get(edit[1])));
    }
    const item = path.match(/^\/content\/([\w-]+)$/);
    if (item && method === "GET") {
      const saved = url.searchParams.get("saved") === "1";
      return page(res, 200, "Content", user, contentPage(store.get(item[1]), user.role === "editor", saved ? "Saved" : undefined, faults.has("save-title-unescaped")));
    }
    if (item && method === "POST") {
      if (user.role !== "editor") return page(res, 403, "Forbidden", user, errorPage(403, "Editors only"));
      const form = await readForm(req);
      const id = item[1];
      try {
        store.update(id, { title: form.get("title") ?? "", body: form.get("body") ?? "" });
      } catch (e) {
        if (e instanceof ValidationError) {
          const current = store.get(id);
          return page(res, 422, "Edit", user, editPage({ ...current, title: form.get("title") ?? "", body: form.get("body") ?? "" }, e.message));
        }
        throw e;
      }
      return redirect(res, `/content/${encodeURIComponent(id)}?saved=1`);
    }
    if (path.startsWith("/api/")) return json(res, 404, { error: "not found" });
    return page(res, 404, "Not found", user, errorPage(404, "Page not found"));
  }

  return createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      if (res.headersSent) return res.end();
      if (err instanceof NotFoundError) {
        if ((req.url ?? "").startsWith("/api/")) return json(res, 404, { error: err.message });
        return page(res, 404, "Not found", null, errorPage(404, err.message));
      }
      if (err instanceof ValidationError) return json(res, 413, { error: err.message });
      console.error(`[${env}] 500 ${req.method} ${req.url}:`, err);
      send(res, 500, layout("Error", { env, version, user: null }, errorPage(500, "Internal server error")));
    });
  });
}

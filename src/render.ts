import type { ContentItem } from "./store.js";
import type { SearchHit } from "./search.js";
import type { User } from "./auth.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface PageMeta {
  env: string;
  version: string;
  user: User | null;
}

export function layout(title: string, meta: PageMeta, body: string): string {
  const nav = meta.user
    ? `<nav><a href="/content">Content</a>
<form method="get" action="/search" role="search"><input name="q" aria-label="Search" placeholder="Search content"><button>Search</button></form>
<span data-testid="current-user">${escapeHtml(meta.user.displayName)}</span>
<form method="post" action="/logout"><button data-testid="logout">Log out</button></form></nav>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · LernWerk</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;color:#1d2433}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ccd;margin-bottom:16px}
nav{display:flex;gap:12px;align-items:center;flex-wrap:wrap}nav form{display:inline}
.badge{font-size:12px;padding:2px 8px;border-radius:8px;background:#e6eefc}
.error{color:#a00}.ok{color:#060}textarea{width:100%;min-height:160px}input[name=title]{width:100%}</style></head>
<body><header><h1><a href="/content">LernWerk</a></h1><span class="badge" data-testid="env-badge">${escapeHtml(meta.env)} · v${escapeHtml(meta.version)}</span></header>
${nav}
<main>${body}</main></body></html>`;
}

export function loginPage(error?: string): string {
  return `<h2>Sign in</h2>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
<form method="post" action="/login">
<label>Username <input name="username" autocomplete="username"></label>
<label>Password <input name="password" type="password" autocomplete="current-password"></label>
<button type="submit">Sign in</button></form>`;
}

export function listPage(items: ContentItem[]): string {
  const rows = items
    .map((i) => `<li><a href="/content/${encodeURIComponent(i.id)}">${escapeHtml(i.title)}</a> <small>${escapeHtml(i.subject)}</small></li>`)
    .join("\n");
  return `<h2>Learning content</h2><ul data-testid="content-list">${rows}</ul>`;
}

export function contentPage(item: ContentItem, canEdit: boolean, message?: string, rawTitle = false): string {
  const title = rawTitle ? item.title : escapeHtml(item.title);
  return `${message ? `<p class="ok" role="status">${escapeHtml(message)}</p>` : ""}
<article><h2 data-testid="content-title">${title}</h2>
<p><small>${escapeHtml(item.subject)} · revision <span data-testid="revision">${item.revision}</span></small></p>
<div data-testid="content-body">${escapeHtml(item.body).replace(/\n/g, "<br>")}</div></article>
${canEdit ? `<p><a href="/content/${encodeURIComponent(item.id)}/edit">Edit</a></p>` : ""}`;
}

export function editPage(item: ContentItem, error?: string): string {
  return `<h2>Edit: ${escapeHtml(item.title)}</h2>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
<form method="post" action="/content/${encodeURIComponent(item.id)}">
<label>Title <input name="title" value="${escapeHtml(item.title)}"></label>
<label>Body <textarea name="body">${escapeHtml(item.body)}</textarea></label>
<button type="submit">Save</button></form>`;
}

export function searchPage(query: string, hits: SearchHit[], error?: string): string {
  const list = hits
    .map((h) => `<li><a href="/content/${encodeURIComponent(h.item.id)}">${escapeHtml(h.item.title)}</a></li>`)
    .join("\n");
  return `<h2>Search</h2>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
<p data-testid="result-count">${hits.length} result${hits.length === 1 ? "" : "s"} for “${escapeHtml(query)}”</p>
<ul data-testid="search-results">${list}</ul>`;
}

export function errorPage(status: number, message: string): string {
  return `<h2 data-testid="error-status">${status}</h2><p>${escapeHtml(message)}</p>`;
}

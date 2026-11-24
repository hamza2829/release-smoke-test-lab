export interface ChecklistItem {
  id: string;
  smokeId: string;
  text: string;
  section: string;
}

export type Status = "pass" | "fail" | "skipped" | "missing";

export interface SmokeResult {
  status: Status;
  durationMs: number;
}

export interface RunMeta {
  env: string;
  version: string;
  build: string;
  tester: string;
  date: string;
}

const ITEM = /^- \[[ x]\] (CHK-\d{2}) \| (SMK-\d{2}) \| (.+)$/;

export function parseChecklist(markdown: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  let section = "General";
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("## ")) section = line.slice(3).trim();
    const m = line.match(ITEM);
    if (m) items.push({ id: m[1], smokeId: m[2], text: m[3].trim(), section });
  }
  const ids = new Set<string>();
  for (const i of items) {
    if (ids.has(i.id)) throw new Error(`Duplicate checklist id ${i.id}`);
    ids.add(i.id);
  }
  return items;
}

interface PwSpec { title: string; tests: Array<{ status: string; results: Array<{ duration: number; status: string }> }> }
interface PwSuite { specs?: PwSpec[]; suites?: PwSuite[] }

/** Extract SMK-xx results from a Playwright JSON report. */
export function smokeResults(report: { suites?: PwSuite[] }): Map<string, SmokeResult> {
  const out = new Map<string, SmokeResult>();
  const walk = (suite: PwSuite) => {
    for (const spec of suite.specs ?? []) {
      const id = spec.title.match(/^(SMK-\d{2})/)?.[1];
      if (!id) continue;
      const t = spec.tests[0];
      const duration = t?.results.reduce((s, r) => s + r.duration, 0) ?? 0;
      const status: Status = !t ? "missing" : t.status === "expected" ? "pass" : t.status === "skipped" ? "skipped" : "fail";
      out.set(id, { status, durationMs: duration });
    }
    for (const s of suite.suites ?? []) walk(s);
  };
  for (const s of report.suites ?? []) walk(s);
  return out;
}

export interface RenderedChecklist {
  markdown: string;
  html: string;
  summary: { passed: number; failed: number; skipped: number; total: number };
}

const ICON: Record<Status, string> = { pass: "PASS", fail: "FAIL", skipped: "SKIP", missing: "MISSING" };

export function renderChecklist(items: ChecklistItem[], results: Map<string, SmokeResult>, meta: RunMeta): RenderedChecklist {
  const rows = items.map((i) => ({ ...i, result: results.get(i.smokeId) ?? { status: "missing" as Status, durationMs: 0 } }));
  const passed = rows.filter((r) => r.result.status === "pass").length;
  const skipped = rows.filter((r) => r.result.status === "skipped").length;
  const failed = rows.length - passed - skipped;
  const verdict = failed === 0 && passed > 0 ? "RELEASE OK" : "RELEASE BLOCKED";
  const md = [
    `# Release checklist: ${meta.env} ${meta.version}`,
    "",
    `| Field | Value |`,
    `|---|---|`,
    `| Environment | ${meta.env} |`,
    `| Build | ${meta.build} |`,
    `| Tester | ${meta.tester} |`,
    `| Date | ${meta.date} |`,
    `| Result | **${verdict}**: ${passed} passed, ${failed} failed, ${skipped} skipped of ${rows.length} |`,
    "",
    `| ID | Section | Check | Smoke test | Result | Duration |`,
    `|---|---|---|---|---|---|`,
    ...rows.map((r) => `| ${r.id} | ${r.section} | ${r.text} | ${r.smokeId} | ${ICON[r.result.status]} | ${r.result.durationMs} ms |`),
    "",
  ].join("\n");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Checklist ${esc(meta.env)} ${esc(meta.version)}</title>
<style>body{font-family:system-ui,sans-serif;margin:24px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}.pass{color:#060}.fail,.missing{color:#a00}</style></head><body>
<h1>Release checklist: ${esc(meta.env)} ${esc(meta.version)}</h1>
<p>Build ${esc(meta.build)} · Tester ${esc(meta.tester)} · ${esc(meta.date)}</p>
<p><strong>${verdict}</strong>: ${passed} passed, ${failed} failed, ${skipped} skipped of ${rows.length}</p>
<table><tr><th>ID</th><th>Section</th><th>Check</th><th>Smoke test</th><th>Result</th><th>Duration</th></tr>
${rows.map((r) => `<tr><td>${r.id}</td><td>${esc(r.section)}</td><td>${esc(r.text)}</td><td>${r.smokeId}</td><td class="${r.result.status}">${ICON[r.result.status]}</td><td>${r.result.durationMs} ms</td></tr>`).join("\n")}
</table></body></html>`;
  return { markdown: md, html, summary: { passed, failed, skipped, total: rows.length } };
}

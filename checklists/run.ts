import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ENVIRONMENTS, health, REPORTS, ROOT } from "../envs/release.js";
import { parseChecklist, renderChecklist, smokeResults } from "./checklist.js";

const env = process.argv[2] ?? process.env.SMOKE_ENV ?? "staging";
const reportFile = join(REPORTS, `smoke-${env}.json`);
if (!existsSync(reportFile)) {
  console.error(`No smoke report ${reportFile}; run the smoke tests first`);
  process.exit(1);
}
const live = await health(ENVIRONMENTS[env].port);
const version = live?.version ?? "unknown";
let commit = "uncommitted";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch { /* not a git checkout */ }
const tester = process.env.TESTER ?? (process.env.GITHUB_ACTIONS ? `github-actions (${process.env.GITHUB_ACTOR ?? "ci"})` : process.env.USER ?? "local");

const items = parseChecklist(readFileSync(join(ROOT, "checklists", "release-checklist.md"), "utf8"));
const results = smokeResults(JSON.parse(readFileSync(reportFile, "utf8")));
const out = renderChecklist(items, results, { env, version, build: `${version}+${commit}`, tester, date: new Date().toISOString() });

mkdirSync(REPORTS, { recursive: true });
writeFileSync(join(REPORTS, `checklist-${env}.md`), out.markdown);
writeFileSync(join(REPORTS, `checklist-${env}.html`), out.html);
writeFileSync(join(REPORTS, `gate-${env}.json`), JSON.stringify({ env, version, ...out.summary }, null, 2));
console.log(`checklist ${env} ${version}: ${out.summary.passed}/${out.summary.total} passed, ${out.summary.failed} failed`);
process.exit(out.summary.failed > 0 ? 1 : 0);

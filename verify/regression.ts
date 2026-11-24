import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../envs/release.js";
import { TICKETS } from "../tickets/catalog.js";
import { REPRO_VERSION, runTicket, withBrowser } from "../tickets/harness.js";

/**
 * Regression verification: every ticket is re-tested twice.
 *  1. against the build WITH the seeded fault  -> the check must detect the bug
 *  2. against the fixed build (fault switched off) -> the check must pass
 * A ticket is "Verified" only if both hold, which proves the check is
 * meaningful and the fix works.
 */
const outFile = process.env.VERIFY_OUT ?? join(ROOT, "reports", "verification-log.md");
mkdirSync(join(outFile, ".."), { recursive: true });

const rows: string[] = [];
let verified = 0;
const t0 = Date.now();
await withBrowser(async (browser) => {
  for (const t of TICKETS) {
    const broken = await runTicket(browser, t, true);
    const fixed = await runTicket(browser, t, false);
    const ok = broken.failed && !fixed.failed;
    if (ok) verified++;
    rows.push(`| ${t.id} | ${t.title} | \`${t.fault}\` | ${broken.failed ? "detected" : "NOT detected"} | ${fixed.failed ? "still failing" : "passes"} | ${fixed.actual.replace(/\|/g, "/")} | ${ok ? "Verified" : "REOPENED"} |`);
    console.log(`${t.id} ${ok ? "Verified" : "REOPENED"} (fault: ${broken.actual} | fixed: ${fixed.actual})`);
  }
});
const totalMs = Date.now() - t0;
writeFileSync(outFile, [
  "# Verification log",
  "",
  `Date: ${new Date().toISOString()} · Build: LernWerk ${REPRO_VERSION} · Runner: ${process.env.GITHUB_ACTIONS ? "GitHub Actions" : "local"} · Duration: ${totalMs} ms`,
  "",
  `Result: ${verified}/${TICKETS.length} tickets verified`,
  "",
  "| Ticket | Title | Fault | With fault | Fixed build | Observed on fixed build | Status |",
  "|---|---|---|---|---|---|---|",
  ...rows,
  "",
].join("\n"));
console.log(`${verified}/${TICKETS.length} tickets verified in ${totalMs} ms -> ${outFile}`);
process.exit(verified === TICKETS.length ? 0 : 1);

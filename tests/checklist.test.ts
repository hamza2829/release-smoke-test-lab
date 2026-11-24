import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseChecklist, renderChecklist, smokeResults } from "../checklists/checklist.js";

const template = readFileSync("checklists/release-checklist.md", "utf8");
const meta = { env: "staging", version: "1.0.0", build: "1.0.0+abc123", tester: "unit", date: "2026-01-01T00:00:00Z" };

const report = (status: string) => ({
  suites: [{ specs: [], suites: [{ specs: [
    { title: "SMK-01 health", tests: [{ status: "expected", results: [{ duration: 12, status: "passed" }] }] },
    { title: "SMK-02 redirect", tests: [{ status, results: [{ duration: 30, status: "x" }] }] },
  ] }] }],
});

describe("release checklist", () => {
  it("parses 14 items with sections, all mapped to smoke tests", () => {
    const items = parseChecklist(template);
    expect(items).toHaveLength(14);
    expect(items[0]).toMatchObject({ id: "CHK-01", smokeId: "SMK-01", section: "Deployment" });
    expect(new Set(items.map((i) => i.smokeId)).size).toBe(14);
  });

  it("extracts results from nested Playwright JSON suites", () => {
    const r = smokeResults(report("unexpected"));
    expect(r.get("SMK-01")).toEqual({ status: "pass", durationMs: 12 });
    expect(r.get("SMK-02")?.status).toBe("fail");
  });

  it("renders a blocked release when a check fails or is missing", () => {
    const out = renderChecklist(parseChecklist(template), smokeResults(report("unexpected")), meta);
    expect(out.summary).toEqual({ passed: 1, failed: 13, skipped: 0, total: 14 });
    expect(out.markdown).toContain("RELEASE BLOCKED");
    expect(out.markdown).toContain("| Tester | unit |");
    expect(out.html).toContain("<table>");
  });

  it("rejects duplicate checklist ids", () => {
    expect(() => parseChecklist("- [ ] CHK-01 | SMK-01 | a\n- [ ] CHK-01 | SMK-02 | b")).toThrow("Duplicate");
  });
});

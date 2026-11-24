import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAULT_IDS } from "../src/faults.js";
import { TICKETS } from "../tickets/catalog.js";

describe("ticket catalogue", () => {
  it("has 12 tickets, one per seeded fault, with sequential ids", () => {
    expect(TICKETS).toHaveLength(12);
    expect(new Set(TICKETS.map((t) => t.fault))).toEqual(new Set(FAULT_IDS));
    TICKETS.forEach((t, i) => expect(t.id).toBe(`BUG-${String(i + 1).padStart(3, "0")}`));
  });

  it("every ticket has steps and an expected result", () => {
    for (const t of TICKETS) {
      expect(t.steps.length, t.id).toBeGreaterThan(0);
      expect(t.expected.length, t.id).toBeGreaterThan(0);
    }
  });

  it("the bug report template has all required sections", () => {
    const tpl = readFileSync("tickets/TEMPLATE.md", "utf8");
    for (const s of ["## Steps to reproduce", "## Expected result", "## Actual result", "## Screenshot", "Environment"]) expect(tpl).toContain(s);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coverage, smokeIdsFromSource, validateCases } from "../testcases/validator.js";

const yamlText = readFileSync("testcases/cases.yaml", "utf8");
const smoke = smokeIdsFromSource(readFileSync("smoke/smoke.spec.ts", "utf8"));

describe("test case catalogue", () => {
  it("contains 40 valid cases that reference existing smoke tests", () => {
    const { cases, errors } = validateCases(yamlText, smoke);
    expect(errors).toEqual([]);
    expect(cases).toHaveLength(40);
  });

  it("every smoke test is referenced by at least one test case", () => {
    const { cases } = validateCases(yamlText, smoke);
    const referenced = new Set(cases.map((c) => c.automation));
    for (const id of smoke) expect(referenced.has(id), id).toBe(true);
    expect(coverage(cases).smoke).toBeGreaterThan(0);
  });

  it("reports missing fields, bad ids, duplicates and unknown references", () => {
    const bad = `
- id: TC-001
  title: ok
  area: search
  priority: P1
  preconditions: none
  steps: [a]
  expected: b
  automation: SMK-99
- id: TC-001
  title: dup
  area: space
  priority: P9
  preconditions: none
  steps: []
  expected: b
  automation: robot
- id: X
  title: missing
`;
    const { errors } = validateCases(bad, smoke);
    expect(errors.join("\n")).toMatch(/unknown smoke test SMK-99/);
    expect(errors.join("\n")).toMatch(/duplicate id TC-001/);
    expect(errors.join("\n")).toMatch(/unknown area space/);
    expect(errors.join("\n")).toMatch(/steps must be a non-empty list/);
    expect(errors.join("\n")).toMatch(/missing expected/);
  });
});

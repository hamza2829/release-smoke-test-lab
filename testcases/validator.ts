import { parse } from "yaml";

export const AREAS = ["deployment", "login", "content", "search", "editor", "maintenance"] as const;
export const PRIORITIES = ["P1", "P2", "P3"] as const;
const REQUIRED = ["id", "title", "area", "priority", "preconditions", "steps", "expected", "automation"] as const;

export interface TestCase {
  id: string;
  title: string;
  area: (typeof AREAS)[number];
  priority: (typeof PRIORITIES)[number];
  preconditions: string;
  steps: string[];
  expected: string;
  automation: string;
}

export interface ValidationResult {
  cases: TestCase[];
  errors: string[];
}

/**
 * Validate the test case catalogue. knownSmokeIds lets the validator check that
 * every "SMK-xx" reference points at a smoke test that actually exists.
 */
export function validateCases(yamlText: string, knownSmokeIds: Set<string> = new Set()): ValidationResult {
  const errors: string[] = [];
  const data = parse(yamlText) as unknown;
  if (!Array.isArray(data)) return { cases: [], errors: ["root must be a list"] };
  const seen = new Set<string>();
  data.forEach((raw, idx) => {
    const where = `case #${idx + 1}`;
    if (typeof raw !== "object" || raw === null) {
      errors.push(`${where}: not a mapping`);
      return;
    }
    const c = raw as Record<string, unknown>;
    for (const key of REQUIRED) if (c[key] === undefined || c[key] === null || c[key] === "") errors.push(`${where}: missing ${key}`);
    const id = String(c.id ?? "");
    if (!/^TC-\d{3}$/.test(id)) errors.push(`${where}: id "${id}" must look like TC-001`);
    else if (id !== `TC-${String(idx + 1).padStart(3, "0")}`) errors.push(`${where}: id ${id} out of sequence`);
    if (seen.has(id)) errors.push(`${where}: duplicate id ${id}`);
    seen.add(id);
    if (c.area && !(AREAS as readonly string[]).includes(String(c.area))) errors.push(`${id}: unknown area ${c.area}`);
    if (c.priority && !(PRIORITIES as readonly string[]).includes(String(c.priority))) errors.push(`${id}: unknown priority ${c.priority}`);
    if (!Array.isArray(c.steps) || c.steps.length === 0 || c.steps.some((s) => typeof s !== "string" || !s.trim())) errors.push(`${id}: steps must be a non-empty list of strings`);
    const auto = String(c.automation ?? "");
    if (!/^(SMK-\d{2}|unit|manual)$/.test(auto)) errors.push(`${id}: automation must be SMK-xx, unit or manual`);
    else if (auto.startsWith("SMK-") && knownSmokeIds.size > 0 && !knownSmokeIds.has(auto)) errors.push(`${id}: references unknown smoke test ${auto}`);
  });
  return { cases: errors.length ? (data as TestCase[]) : (data as TestCase[]), errors };
}

export function smokeIdsFromSource(source: string): Set<string> {
  return new Set([...source.matchAll(/test\("(SMK-\d{2})/g)].map((m) => m[1]));
}

export function coverage(cases: TestCase[]): Record<string, number> {
  const out: Record<string, number> = { smoke: 0, unit: 0, manual: 0 };
  for (const c of cases) out[c.automation.startsWith("SMK-") ? "smoke" : c.automation]++;
  return out;
}

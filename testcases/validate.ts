import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../envs/release.js";
import { coverage, smokeIdsFromSource, validateCases } from "./validator.js";

const smoke = smokeIdsFromSource(readFileSync(join(ROOT, "smoke", "smoke.spec.ts"), "utf8"));
const { cases, errors } = validateCases(readFileSync(join(ROOT, "testcases", "cases.yaml"), "utf8"), smoke);
if (errors.length) {
  for (const e of errors) console.error(`  ${e}`);
  console.error(`${errors.length} problem(s) in testcases/cases.yaml`);
  process.exit(1);
}
const cov = coverage(cases);
console.log(`${cases.length} test cases valid (smoke ${cov.smoke}, unit ${cov.unit}, manual ${cov.manual}); ${smoke.size} smoke tests referenced`);

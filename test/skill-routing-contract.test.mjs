import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateSkillRouting } from "../scripts/evaluate-skill-routing.mjs";

const repository = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const contract = JSON.parse(
  fs.readFileSync(path.join(repository, "fixtures/skill-routing/cases.json"), "utf8"),
);
const skill = fs.readFileSync(path.join(repository, "skills/rivet/SKILL.md"), "utf8");
const description = skill.match(/^description:\s*(.+)$/m)[1];

const valid = evaluateSkillRouting(contract, description);
assert.strictEqual(valid.decision, "pass");
assert.strictEqual(valid.cases, 13);
assert.strictEqual(valid.passed, 13);

const invalid = JSON.parse(JSON.stringify(contract));
invalid.cases[0].expected_activation = false;
invalid.cases[6].adjacent_owner = "";
invalid.description_requirements.push("unrepresented-domain");
const report = evaluateSkillRouting(invalid, description);
assert.strictEqual(report.decision, "fail");
assert.ok(report.faults.some((fault) => /api-authorization expected/.test(fault)));
assert.ok(report.faults.some((fault) => /frontend-only requires adjacent_owner/.test(fault)));
assert.ok(report.faults.some((fault) => /unrepresented-domain/.test(fault)));

process.stdout.write("skill routing contract tests passed\n");

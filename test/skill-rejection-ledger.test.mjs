import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validateSkillRejections,
} from "../scripts/validate-skill-rejections.mjs";

const repository = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ledger = JSON.parse(
  fs.readFileSync(path.join(repository, "docs/SKILL-CHANGE-REJECTIONS.json"), "utf8"),
);

const valid = validateSkillRejections(ledger);
assert.strictEqual(valid.decision, "valid");
assert.strictEqual(valid.faults.length, 0);
assert.strictEqual(valid.records, 3);

const invalid = JSON.parse(JSON.stringify(ledger));
invalid.records[1].id = invalid.records[0].id;
invalid.records[1].affected_revision = "short";
invalid.records[1].comparison.after = "";
invalid.records[1].retry_conditions = [];
const report = validateSkillRejections(invalid);
assert.strictEqual(report.decision, "invalid");
assert.ok(report.faults.some((fault) => /duplicated/.test(fault)));
assert.ok(report.faults.some((fault) => /full Git revision/.test(fault)));
assert.ok(report.faults.some((fault) => /before and after/.test(fault)));
assert.ok(report.faults.some((fault) => /retry_conditions/.test(fault)));

process.stdout.write("skill rejection ledger tests passed\n");

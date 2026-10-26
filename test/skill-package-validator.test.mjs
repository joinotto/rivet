import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateSkillPackage } from "../scripts/validate-skill-package.mjs";

const repository = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const valid = validateSkillPackage(path.join(repository, "skills/rivet"));
assert.strictEqual(valid.decision, "valid");
assert.strictEqual(valid.faults.length, 0);
assert.strictEqual(valid.reference_documents, 5);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-skill-validator-"));
try {
  const skill = path.join(temporary, "example-skill");
  fs.mkdirSync(path.join(skill, "references"), { recursive: true });
  fs.mkdirSync(path.join(skill, "empty"));
  fs.writeFileSync(
    path.join(skill, "SKILL.md"),
    [
      "---",
      "name: wrong-name",
      "description: Does work without an application condition.",
      "vendor: host",
      "---",
      "",
      "# Example",
      "",
      "[Missing](references/missing.md)",
      "[Escape](../../outside.md)",
      "[Bad anchor](references/guide.md#absent)",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(skill, "references", "guide.md"),
    "# Present\n",
  );
  fs.writeFileSync(
    path.join(skill, "references", "orphan.md"),
    "# Orphan\n",
  );
  const invalid = validateSkillPackage(skill);
  assert.strictEqual(invalid.decision, "invalid");
  assert.ok(invalid.faults.some((fault) => /name must match/.test(fault)));
  assert.ok(invalid.faults.some((fault) => /when the skill applies/.test(fault)));
  assert.ok(invalid.faults.some((fault) => /Unsupported.*vendor/.test(fault)));
  assert.ok(invalid.faults.some((fault) => /Empty directory/.test(fault)));
  assert.ok(invalid.faults.some((fault) => /missing link target/.test(fault)));
  assert.ok(invalid.faults.some((fault) => /outside the skill/.test(fault)));
  assert.ok(invalid.faults.some((fault) => /missing anchor/.test(fault)));
  assert.ok(invalid.faults.some((fault) => /Orphan reference/.test(fault)));
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

process.stdout.write("skill-package validator tests passed\n");

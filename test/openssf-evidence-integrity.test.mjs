import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isLocalEvidenceReference,
  validateLocalEvidence
} from "../scripts/validate-openssf-baseline.mjs";

assert.strictEqual(isLocalEvidenceReference("SECURITY.md"), true);
assert.strictEqual(isLocalEvidenceReference(".github/workflows"), true);
assert.strictEqual(
  isLocalEvidenceReference("GitHub repository API: visibility=public"),
  false
);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-openssf-evidence-"));
try {
  fs.writeFileSync(path.join(temporary, "present.md"), "evidence\n");
  assert.deepStrictEqual(
    validateLocalEvidence(
      ["present.md", "GitHub settings: enabled"],
      temporary
    ),
    []
  );

  const invalid = validateLocalEvidence(
    ["missing.md", "../escape.md", "present.md", "present.md"],
    temporary
  );
  assert.ok(invalid.includes("local evidence does not exist: missing.md"));
  assert.ok(invalid.includes("local evidence escapes the repository: ../escape.md"));
  assert.ok(invalid.includes("duplicate evidence reference: present.md"));

  fs.symlinkSync(path.join(temporary, "present.md"), path.join(temporary, "link.md"));
  assert.deepStrictEqual(validateLocalEvidence(["link.md"], temporary), [
    "local evidence must not be a symbolic link: link.md"
  ]);

  console.log("OpenSSF evidence integrity tests passed");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

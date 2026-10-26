import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  requiredFoundationFiles,
  validateOpenSourceFoundation
} from "../scripts/validate-open-source-foundation.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const valid = validateOpenSourceFoundation(repository);
assert.strictEqual(valid.decision, "valid", JSON.stringify(valid.faults));
assert.strictEqual(valid.required_files, 14);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-foundation-"));
try {
  for (const relative of [
    ...requiredFoundationFiles,
    "REUSE.toml",
    "LICENSES/Apache-2.0.txt",
    "package.json"
  ]) {
    const target = path.join(temporary, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repository, relative), target);
  }

  fs.rmSync(path.join(temporary, "SECURITY.md"));
  const missing = validateOpenSourceFoundation(temporary);
  assert.strictEqual(missing.decision, "invalid");
  assert.ok(missing.faults.includes("Required file is missing: SECURITY.md"));

  fs.symlinkSync(
    path.join(repository, "SECURITY.md"),
    path.join(temporary, "SECURITY.md")
  );
  const linked = validateOpenSourceFoundation(temporary);
  assert.strictEqual(linked.decision, "invalid");
  assert.ok(
    linked.faults.includes("Required file cannot be opened safely: SECURITY.md")
  );
  fs.rmSync(path.join(temporary, "SECURITY.md"));

  fs.copyFileSync(
    path.join(repository, "SECURITY.md"),
    path.join(temporary, "SECURITY.md")
  );
  const packageFile = path.join(temporary, "package.json");
  const packageDocument = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  packageDocument.license = "UNLICENSED";
  fs.writeFileSync(packageFile, `${JSON.stringify(packageDocument, null, 2)}\n`);
  const license = validateOpenSourceFoundation(temporary);
  assert.strictEqual(license.decision, "invalid");
  assert.ok(license.faults.includes("package.json license must be Apache-2.0."));

  console.log("open-source foundation tests passed");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

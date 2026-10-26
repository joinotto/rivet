import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = fs.readFileSync(
  path.join(repository, ".github/workflows/release-candidate.yml"),
  "utf8"
);

assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /permissions:\n  contents: read/);
assert.match(workflow, /persist-credentials: false/);
assert.match(workflow, /git merge-base --is-ancestor/);
assert.match(workflow, /npm run package:release-candidate/);
assert.match(workflow, /npm run verify:release-candidate/);
assert.match(
  workflow,
  /actions\/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9/
);
assert.match(workflow, /retention-days: 14/);
assert.doesNotMatch(workflow, /contents: write/);
assert.doesNotMatch(workflow, /packages: write/);
assert.doesNotMatch(workflow, /\bgh release\b/);
assert.doesNotMatch(workflow, /\bgit tag\b/);

console.log("release candidate workflow tests passed");

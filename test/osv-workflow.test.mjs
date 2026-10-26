import assert from "assert";
import fs from "fs";

const workflow = fs.readFileSync(
  ".github/workflows/osv-scanner.yml",
  "utf8",
);

assert.match(workflow, /pull_request:/);
assert.match(workflow, /merge_group:/);
assert.match(workflow, /push:\n    branches:\n      - main/);
assert.match(
  workflow,
  /scan-pr:[\s\S]*if: github\.event_name == 'pull_request' \|\| github\.event_name == 'merge_group'/,
);
assert.match(
  workflow,
  /scan-full:[\s\S]*if: github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'/,
);
assert.match(
  workflow,
  /osv-scanner-reusable-pr\.yml@b1d267aea5211fa648d9d442fa64b90dbdcbdd36/,
);
assert.match(
  workflow,
  /osv-scanner-reusable\.yml@b1d267aea5211fa648d9d442fa64b90dbdcbdd36/,
);
assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
assert.strictEqual(
  (workflow.match(/security-events: write/g) || []).length,
  2,
);
assert.doesNotMatch(workflow, /pull_request_target/);
assert.doesNotMatch(workflow, /uses:\s+[^@\n]+@(main|master|v\d+)\s*$/m);

console.log("OSV workflow tests passed.");

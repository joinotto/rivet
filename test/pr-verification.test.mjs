import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const sourceRoot = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-pr-verification-"));

function run(executable, args, options = {}) {
  return spawnSync(executable, args, {
    cwd: options.cwd || fixture,
    encoding: "utf8",
    env: options.env || process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function git(...args) {
  const result = run("git", args);
  assert.strictEqual(result.status, 0, result.stderr);
  return result.stdout.trim();
}

fs.cpSync(
  path.join(sourceRoot, "skills"),
  path.join(fixture, "skills"),
  { recursive: true },
);
fs.writeFileSync(
  path.join(fixture, "package.json"),
  `${JSON.stringify({
    name: "rivet-pr-fixture",
    private: true,
    type: "module",
    scripts: {
      test: "node -e \"process.exit(0)\"",
    },
  }, null, 2)}\n`,
);

git("init", "--initial-branch=main");
git("config", "user.name", "Rivet Test");
git("config", "user.email", "rivet-test@example.invalid");
git("add", ".");
git("commit", "-m", "base");
const base = git("rev-parse", "HEAD");

const unusual = path.join(fixture, "src/api", "orders,\nreport.js");
fs.mkdirSync(path.dirname(unusual), { recursive: true });
fs.writeFileSync(unusual, "export const route = '/orders';\n");
git("add", ".");
git("commit", "-m", "change");
const head = git("rev-parse", "HEAD");

const result = run(
  process.execPath,
  ["skills/rivet/scripts/rivet-pr-verify.mjs"],
  {
  env: {
    ...process.env,
    RIVET_BASE_SHA: base,
    RIVET_HEAD_SHA: head,
    RIVET_REPORT_DIR: ".rivet/ci",
  },
  },
);
assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);

const report = JSON.parse(
  fs.readFileSync(path.join(fixture, ".rivet/ci/report.json"), "utf8"),
);
assert.strictEqual(report.workflow, "pull-request-verification");
assert.strictEqual(report.base_revision, base);
assert.strictEqual(report.merge_base_revision, base);
assert.strictEqual(report.head_revision, head);
assert.strictEqual(report.impact.risk_mode, "service");
assert.deepStrictEqual(report.impact.files, ["src/api/orders,\nreport.js"]);
assert.strictEqual(report.verification.decision, "pass");
assert.deepStrictEqual(report.verification.available_evidence, []);
assert.strictEqual(report.decision, "pass-with-limitations");
assert.match(
  fs.readFileSync(path.join(fixture, ".rivet/ci/summary.md"), "utf8"),
  /Risk mode: \*\*service\*\*/,
);
assert.match(
  fs.readFileSync(path.join(fixture, ".rivet/ci/summary.md"), "utf8"),
  /orders, report\.js/,
);

const workflow = fs.readFileSync(
  path.join(sourceRoot, ".github/workflows/pr-verification.yml"),
  "utf8",
);
assert.match(workflow, /^permissions:\n  contents: read$/m);
assert.match(workflow, /persist-credentials: false/);
assert.match(workflow, /fetch-depth: 0/);
assert.match(workflow, /RIVET_BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
assert.match(workflow, /RIVET_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
assert.doesNotMatch(workflow, /pull_request_target/);
assert.doesNotMatch(workflow, /contents: write|pull-requests: write/);

fs.rmSync(fixture, { recursive: true, force: true });
console.log("PR verification workflow tests passed.");

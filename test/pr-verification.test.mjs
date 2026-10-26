import assert from "assert";
import crypto from "crypto";
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
assert.strictEqual(report.secret_scan.decision, "pass");
assert.strictEqual(report.secret_scan.findings.length, 0);
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
const manifest = JSON.parse(
  fs.readFileSync(path.join(fixture, ".rivet/ci/manifest.json"), "utf8"),
);
assert.strictEqual(manifest.kind, "rivet-pr-report-manifest");
assert.strictEqual(manifest.base_revision, base);
assert.strictEqual(manifest.merge_base_revision, base);
assert.strictEqual(manifest.head_revision, head);
assert.deepStrictEqual(
  manifest.files.map((item) => item.path),
  [
    "changed-files.nul",
    "secret-scan.json",
    "verification-receipt.json",
    "verification.md",
    "report.json",
    "summary.md",
  ],
);
for (const item of manifest.files) {
  const body = fs.readFileSync(path.join(fixture, ".rivet/ci", item.path));
  assert.strictEqual(item.size, body.length);
  assert.strictEqual(
    item.sha256,
    crypto.createHash("sha256").update(body).digest("hex"),
  );
}
const offlineVerification = run(
  process.execPath,
  [
    "skills/rivet/scripts/rivet-pr-verify.mjs",
    "verify-report",
    ".rivet/ci",
  ],
);
assert.strictEqual(
  offlineVerification.status,
  0,
  offlineVerification.stderr,
);
assert.strictEqual(
  JSON.parse(offlineVerification.stdout).decision,
  "pass",
);
const originalSummary = fs.readFileSync(
  path.join(fixture, ".rivet/ci/summary.md"),
);
fs.appendFileSync(path.join(fixture, ".rivet/ci/summary.md"), "altered");
const alteredVerification = run(
  process.execPath,
  [
    "skills/rivet/scripts/rivet-pr-verify.mjs",
    "verify-report",
    ".rivet/ci",
  ],
);
assert.strictEqual(alteredVerification.status, 1);
assert.match(alteredVerification.stderr, /verification failed: summary\.md/);
fs.writeFileSync(path.join(fixture, ".rivet/ci/summary.md"), originalSummary);
fs.writeFileSync(path.join(fixture, ".rivet/ci/unexpected.txt"), "unexpected");
const extraFileVerification = run(
  process.execPath,
  [
    "skills/rivet/scripts/rivet-pr-verify.mjs",
    "verify-report",
    ".rivet/ci",
  ],
);
assert.strictEqual(extraFileVerification.status, 1);
assert.match(extraFileVerification.stderr, /inventory does not match/);
fs.rmSync(path.join(fixture, ".rivet/ci/unexpected.txt"));
fs.symlinkSync(
  path.join(fixture, ".rivet/ci/summary.md"),
  path.join(fixture, ".rivet/ci/unexpected-link"),
);
const symbolicLinkVerification = run(
  process.execPath,
  [
    "skills/rivet/scripts/rivet-pr-verify.mjs",
    "verify-report",
    ".rivet/ci",
  ],
);
assert.strictEqual(symbolicLinkVerification.status, 1);
assert.match(symbolicLinkVerification.stderr, /regular files only/);
fs.rmSync(path.join(fixture, ".rivet/ci"), { recursive: true, force: true });
const exposedValue = "this-is-a-secret-value";
fs.writeFileSync(
  path.join(fixture, "src/config.js"),
  `export const apiKey = "${exposedValue}";\n`,
);
git("add", ".");
git("commit", "-m", "add exposed secret");
const secretHead = git("rev-parse", "HEAD");
const secretResult = run(
  process.execPath,
  ["skills/rivet/scripts/rivet-pr-verify.mjs"],
  {
    env: {
      ...process.env,
      RIVET_BASE_SHA: head,
      RIVET_HEAD_SHA: secretHead,
      RIVET_REPORT_DIR: ".rivet/ci",
    },
  },
);
assert.strictEqual(secretResult.status, 2, secretResult.stderr);
assert.doesNotMatch(secretResult.stdout, new RegExp(exposedValue));
assert.doesNotMatch(secretResult.stderr, new RegExp(exposedValue));
const secretReportBody = fs.readFileSync(
  path.join(fixture, ".rivet/ci/report.json"),
  "utf8",
);
assert.doesNotMatch(secretReportBody, new RegExp(exposedValue));
const secretReport = JSON.parse(secretReportBody);
assert.strictEqual(secretReport.secret_scan.decision, "fail");
assert.strictEqual(secretReport.secret_scan.findings.length, 1);
assert.strictEqual(secretReport.secret_scan.findings[0].value, "[REDACTED]");
assert.strictEqual(secretReport.decision, "fail");
const secretOfflineVerification = run(
  process.execPath,
  [
    "skills/rivet/scripts/rivet-pr-verify.mjs",
    "verify-report",
    ".rivet/ci",
  ],
);
assert.strictEqual(
  secretOfflineVerification.status,
  0,
  secretOfflineVerification.stderr,
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

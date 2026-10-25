import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(
  here,
  "../skills/rivet/scripts/rivet-evidence.mjs",
);
const steScript = path.resolve(
  here,
  "../skills/rivet/scripts/rivet-ste.mjs",
);

function invoke(cwd, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function invokeSte(cwd, args) {
  return spawnSync(process.execPath, [steScript, ...args], {
    cwd,
    encoding: "utf8",
  });
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-evidence-"));

fs.writeFileSync(
  path.join(fixture, "package.json"),
  JSON.stringify({
    scripts: {
      test: "node -e \"process.exit(0)\"",
      lint: "node -e \"process.exit(2)\""
    }
  }),
);

const inspect = invoke(fixture, ["inspect", "--json"]);
assert.strictEqual(inspect.status, 0, inspect.stderr);
const inspection = JSON.parse(inspect.stdout);
assert.deepStrictEqual(
  inspection.project.checks.map((check) => check.id),
  ["test", "lint"],
);

const dryRun = invoke(fixture, [
  "verify",
  "--dry-run",
  "--checks",
  "test,typecheck",
]);
assert.strictEqual(dryRun.status, 0, dryRun.stderr);
assert.match(dryRun.stdout, /test: npm run test/);
assert.match(dryRun.stdout, /Unavailable: typecheck/);

const pass = invoke(fixture, ["verify", "--checks", "test", "--json"]);
assert.strictEqual(pass.status, 0, pass.stderr);
assert.strictEqual(JSON.parse(pass.stdout).decision, "pass");

const fail = invoke(fixture, ["verify", "--checks", "lint", "--json"]);
assert.strictEqual(fail.status, 2, fail.stderr);
assert.strictEqual(JSON.parse(fail.stdout).decision, "fail");

const incomplete = invoke(fixture, [
  "verify",
  "--checks",
  "typecheck",
  "--json",
]);
assert.strictEqual(incomplete.status, 1, incomplete.stderr);
assert.strictEqual(JSON.parse(incomplete.stdout).decision, "incomplete");

const serviceRisk = invoke(fixture, [
  "change",
  "--files",
  "src/api/orders.js,src/domain/money.js",
  "--json",
]);
assert.strictEqual(serviceRisk.status, 0, serviceRisk.stderr);
assert.strictEqual(JSON.parse(serviceRisk.stdout).risk_mode, "service");

const criticalRisk = invoke(fixture, [
  "change",
  "--files",
  "src/auth/policy.js,src/worker/email.js",
  "--json",
]);
assert.strictEqual(criticalRisk.status, 0, criticalRisk.stderr);
assert.strictEqual(JSON.parse(criticalRisk.stdout).risk_mode, "critical");

const recordPath = path.join(fixture, "change.md");
const record = invoke(fixture, [
  "record",
  "--title",
  "Order authorization",
  "--files",
  "src/auth/policy.js",
  "--output",
  recordPath,
]);
assert.strictEqual(record.status, 0, record.stderr);
assert.match(fs.readFileSync(recordPath, "utf8"), /Risk mode: critical/);

const cleanDoc = path.join(fixture, "clean.md");
fs.writeFileSync(cleanDoc, "# Procedure\n\nRun the test.\n");
const cleanSte = invokeSte(fixture, [cleanDoc, "--json"]);
assert.strictEqual(cleanSte.status, 0, cleanSte.stderr);
assert.strictEqual(JSON.parse(cleanSte.stdout).faults, 0);

const faultyDoc = path.join(fixture, "faulty.md");
fs.writeFileSync(faultyDoc, "# Procedure\n\nRun the test; deploy the code.\n");
const faultySte = invokeSte(fixture, [faultyDoc, "--json"]);
assert.strictEqual(faultySte.status, 2, faultySte.stderr);
assert.strictEqual(JSON.parse(faultySte.stdout).faults, 1);

console.log("rivet-evidence tests passed");

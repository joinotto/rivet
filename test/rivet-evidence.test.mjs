import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, "..");
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

const multi = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-multi-"));
fs.writeFileSync(
  path.join(multi, "package.json"),
  JSON.stringify({ scripts: { test: "node -e \"process.exit(0)\"" } }),
);
fs.writeFileSync(path.join(multi, "Cargo.toml"), "[package]\nname='fixture'\n");
fs.writeFileSync(path.join(multi, "go.mod"), "module example.test/fixture\n");
fs.writeFileSync(path.join(multi, "pyproject.toml"), "[project]\nname='fixture'\n");
const multiInspect = invoke(multi, ["inspect", "--json"]);
assert.strictEqual(multiInspect.status, 0, multiInspect.stderr);
const ecosystems = new Set(
  JSON.parse(multiInspect.stdout).project.checks.map((item) => item.ecosystem),
);
assert.deepStrictEqual(
  [...ecosystems].sort(),
  ["go", "node", "python", "rust"],
);

const secretFile = path.join(fixture, "secrets.txt");
fs.writeFileSync(
  secretFile,
  "api_key='this-is-a-secret-value-that-must-not-print'\n",
);
const secretScan = invoke(fixture, [
  "secrets",
  "--files",
  "secrets.txt",
  "--json",
]);
assert.strictEqual(secretScan.status, 2, secretScan.stderr);
assert.strictEqual(JSON.parse(secretScan.stdout).findings.length, 1);
assert.doesNotMatch(secretScan.stdout, /this-is-a-secret-value/);

const defaultSecretScan = invoke(fixture, ["secrets", "--json"]);
assert.strictEqual(defaultSecretScan.status, 2, defaultSecretScan.stderr);
assert.ok(JSON.parse(defaultSecretScan.stdout).files_checked > 1);

const escapedRecord = invoke(fixture, [
  "record",
  "--output",
  "../escaped-record.md",
]);
assert.strictEqual(escapedRecord.status, 1);
assert.match(escapedRecord.stderr, /inside the project/);

const init = invoke(fixture, ["init"]);
assert.strictEqual(init.status, 0, init.stderr);
assert.ok(fs.existsSync(path.join(fixture, "SYSTEM.md")));
assert.ok(fs.existsSync(path.join(fixture, ".rivet/config.json")));
const systemBefore = fs.readFileSync(path.join(fixture, "SYSTEM.md"), "utf8");
const secondInit = invoke(fixture, ["init"]);
assert.strictEqual(secondInit.status, 0, secondInit.stderr);
assert.strictEqual(
  fs.readFileSync(path.join(fixture, "SYSTEM.md"), "utf8"),
  systemBefore,
);

fs.writeFileSync(path.join(fixture, "package-lock.json"), "{}");
const dependencyDryRun = invoke(fixture, ["dependencies", "--dry-run"]);
assert.strictEqual(dependencyDryRun.status, 0, dependencyDryRun.stderr);
assert.match(dependencyDryRun.stdout, /npm-audit/);

const packages = path.join(os.tmpdir(), `rivet-hosts-${process.pid}`);
const packageResult = spawnSync(
  process.execPath,
  [path.join(repository, "scripts/package-hosts.mjs"), "--output", packages],
  { encoding: "utf8" },
);
assert.strictEqual(packageResult.status, 0, packageResult.stderr);
for (const host of ["portable", "codex", "claude-code", "cursor"]) {
  const hostSkill = path.join(packages, host, "rivet", "SKILL.md");
  assert.ok(fs.existsSync(hostSkill), `${host} package has no SKILL.md`);
  assert.strictEqual(
    fs.readFileSync(hostSkill, "utf8"),
    fs.readFileSync(path.join(repository, "skills/rivet/SKILL.md"), "utf8"),
  );
}
assert.ok(fs.existsSync(path.join(packages, "codex/rivet/agents/openai.yaml")));
assert.ok(
  !fs.existsSync(path.join(packages, "claude-code/rivet/agents/openai.yaml")),
);
fs.rmSync(packages, { recursive: true });

const unsafePackageResult = spawnSync(
  process.execPath,
  [
    path.join(repository, "scripts/package-hosts.mjs"),
    "--output",
    path.parse(repository).root,
    "--force",
  ],
  { encoding: "utf8" },
);
assert.strictEqual(unsafePackageResult.status, 1);
assert.match(unsafePackageResult.stderr, /inside the Rivet repository/);

console.log("rivet-evidence tests passed");

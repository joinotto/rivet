#!/usr/bin/env node

import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-conformance-"));
const packages = path.join(temporary, "packages");
const fixture = path.join(temporary, "fixture");
const hosts = ["portable", "codex", "claude-code", "cursor"];

function run(executable, args, cwd = repository) {
  return spawnSync(executable, args, { cwd, encoding: "utf8" });
}

try {
  const packaged = run(process.execPath, [
    path.join(repository, "scripts/package-hosts.mjs"),
    "--output",
    packages,
  ]);
  assert.strictEqual(packaged.status, 0, packaged.stderr);

  fs.mkdirSync(fixture);
  fs.writeFileSync(
    path.join(fixture, "package.json"),
    JSON.stringify({
      scripts: { test: "node -e \"process.exit(0)\"" },
    }),
  );
  fs.writeFileSync(
    path.join(fixture, "seed.txt"),
    "api_key='host-conformance-secret-value'\n",
  );

  for (const host of hosts) {
    const root = path.join(packages, host);
    const skill = path.join(root, "rivet");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "rivet-host.json"), "utf8"),
    );
    assert.strictEqual(manifest.host, host);
    assert.strictEqual(manifest.capabilities.model_provider_independent, true);
    assert.ok(fs.existsSync(path.join(skill, "SKILL.md")));

    const runner = path.join(skill, "scripts/rivet-evidence.mjs");
    const inspection = run(process.execPath, [runner, "inspect", "--json"], fixture);
    assert.strictEqual(inspection.status, 0, `${host}: ${inspection.stderr}`);
    assert.strictEqual(
      JSON.parse(inspection.stdout).project.checks[0].id,
      "test",
    );

    const verification = run(
      process.execPath,
      [runner, "verify", "--checks", "test", "--json"],
      fixture,
    );
    assert.strictEqual(verification.status, 0, `${host}: ${verification.stderr}`);
    assert.strictEqual(JSON.parse(verification.stdout).decision, "pass");

    const secretScan = run(
      process.execPath,
      [runner, "secrets", "--files", "seed.txt", "--json"],
      fixture,
    );
    assert.strictEqual(secretScan.status, 2, `${host}: ${secretScan.stderr}`);
    assert.doesNotMatch(secretScan.stdout, /host-conformance-secret-value/);
  }

  console.log(`Rivet package conformance passed for: ${hosts.join(", ")}`);
  console.log("Native host runtime behavior was not tested.");
} finally {
  fs.rmSync(temporary, { recursive: true });
}

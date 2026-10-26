#!/usr/bin/env node

import assert from "assert";
import crypto from "crypto";
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
const source = path.join(repository, "skills", "rivet");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-conformance-"));
const packages = path.join(temporary, "packages");
const fixture = path.join(temporary, "fixture");
const hosts = {
  codex: {
    install_path: ".agents/skills/rivet or the configured Codex skills directory",
    includes_agent_metadata: true,
  },
  "claude-code": {
    install_path: ".claude/skills/rivet",
    includes_agent_metadata: false,
  },
};

function run(executable, args, cwd = repository) {
  return spawnSync(executable, args, { cwd, encoding: "utf8" });
}

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function files(root, directory = root, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files(root, absolute, output);
    } else if (entry.isFile()) {
      output.push(path.relative(root, absolute));
    }
  }
  return output.sort();
}

try {
  const packaged = run(process.execPath, [
    path.join(repository, "scripts/package-hosts.mjs"),
    "--output",
    packages,
  ]);
  assert.strictEqual(packaged.status, 0, packaged.stderr);
  assert.deepStrictEqual(fs.readdirSync(packages).sort(), Object.keys(hosts).sort());

  fs.mkdirSync(fixture);
  fs.writeFileSync(
    path.join(fixture, "package.json"),
    JSON.stringify({
      scripts: { test: "node -e \"process.exit(0)\"" },
    }),
  );
  fs.writeFileSync(
    path.join(fixture, "seed.txt"),
    "api" + "_key='host-conformance-secret-value'\n",
  );

  for (const [host, expected] of Object.entries(hosts)) {
    const root = path.join(packages, host);
    const skill = path.join(root, "rivet");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "rivet-host.json"), "utf8"),
    );
    assert.strictEqual(manifest.schema, 1);
    assert.strictEqual(manifest.host, host);
    assert.strictEqual(manifest.canonical_source, "skills/rivet");
    assert.strictEqual(manifest.install_path, expected.install_path);
    assert.deepStrictEqual(Object.keys(manifest.capabilities).sort(), [
      "approval_mapping",
      "evidence_receipts",
      "local_scripts",
      "model_provider_independent",
      "sandbox_mapping",
    ]);
    assert.strictEqual(manifest.capabilities.model_provider_independent, true);
    const sourceFiles = files(source).filter(
      (file) => expected.includes_agent_metadata || !file.startsWith(`agents${path.sep}`),
    );
    const packagedFiles = files(skill);
    assert.deepStrictEqual(
      packagedFiles,
      sourceFiles,
      `${host}: packaged artifact inventory differs from the canonical source`,
    );
    for (const file of sourceFiles) {
      assert.strictEqual(
        digest(path.join(skill, file)),
        digest(path.join(source, file)),
        `${host}: packaged ${file} differs from the canonical source`,
      );
    }

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

  console.log(
    `Rivet package conformance passed for: ${Object.keys(hosts).join(", ")}`,
  );
  console.log("Native host runtime behavior was not tested.");
} finally {
  fs.rmSync(temporary, { recursive: true });
}

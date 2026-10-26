import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyReleaseCandidate } from "../scripts/verify-release-candidate.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-release-verify-"));

function command(cwd, executable, args) {
  const result = spawnSync(executable, args, { cwd, encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function copyCandidate(source, name) {
  const target = path.join(temporary, name);
  fs.cpSync(source, target, { recursive: true });
  return target;
}

try {
  const source = path.join(temporary, "source");
  fs.cpSync(repository, source, {
    recursive: true,
    filter: (entry) => !entry.split(path.sep).includes(".git")
  });
  command(source, "git", ["init", "-q"]);
  command(source, "git", ["add", "."]);
  command(source, "git", [
    "-c",
    "user.name=Rivet Test",
    "-c",
    "user.email=rivet@example.invalid",
    "commit",
    "-q",
    "-m",
    "fixture"
  ]);
  const revision = command(source, "git", ["rev-parse", "HEAD"]);
  const candidate = path.join(temporary, "candidate");
  command(source, process.execPath, [
    "scripts/build-release-candidate.mjs",
    "--version",
    "0.1.0",
    "--revision",
    revision,
    "--output",
    candidate
  ]);

  const valid = verifyReleaseCandidate(candidate, {
    version: "0.1.0",
    revision
  });
  assert.strictEqual(valid.decision, "pass", JSON.stringify(valid.faults));
  assert.strictEqual(valid.archives, 4);
  assert.strictEqual(valid.signature, "not-checked");

  const changedArchive = copyCandidate(candidate, "changed-archive");
  fs.appendFileSync(
    path.join(changedArchive, "rivet-0.1.0-codex.tar"),
    "tampered"
  );
  const archiveResult = verifyReleaseCandidate(changedArchive);
  assert.strictEqual(archiveResult.decision, "fail");
  assert.ok(archiveResult.faults.some((fault) => /manifest digest/.test(fault)));

  const extraFile = copyCandidate(candidate, "extra-file");
  fs.writeFileSync(path.join(extraFile, "unrecorded.txt"), "unexpected\n");
  const inventoryResult = verifyReleaseCandidate(extraFile);
  assert.strictEqual(inventoryResult.decision, "fail");
  assert.ok(inventoryResult.faults.some((fault) => /inventory/.test(fault)));

  const changedBinding = copyCandidate(candidate, "changed-binding");
  const provenanceFile = path.join(changedBinding, "provenance.json");
  const provenance = JSON.parse(fs.readFileSync(provenanceFile, "utf8"));
  provenance.source.revision = "0".repeat(40);
  fs.writeFileSync(provenanceFile, `${JSON.stringify(provenance, null, 2)}\n`);
  const bindingResult = verifyReleaseCandidate(changedBinding);
  assert.strictEqual(bindingResult.decision, "fail");
  assert.ok(bindingResult.faults.some((fault) => /Provenance is not bound/.test(fault)));

  console.log("release candidate verification tests passed");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

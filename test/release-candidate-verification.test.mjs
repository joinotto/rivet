import assert from "node:assert/strict";
import crypto from "node:crypto";
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
  const candidate = path.join(source, ".rivet", "tmp", "candidate");
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

  const linkedFile = copyCandidate(candidate, "linked-file");
  const outside = path.join(temporary, "outside.txt");
  fs.writeFileSync(outside, "outside\n");
  fs.rmSync(path.join(linkedFile, "SHA256SUMS"));
  fs.symlinkSync(outside, path.join(linkedFile, "SHA256SUMS"));
  const linkedResult = verifyReleaseCandidate(linkedFile);
  assert.strictEqual(linkedResult.decision, "fail");
  assert.ok(
    linkedResult.faults.some(
      (fault) =>
        /non-file entry/.test(fault) ||
        /SHA256SUMS cannot be read safely/.test(fault)
    )
  );

  const linkedRoot = path.join(temporary, "linked-root");
  fs.symlinkSync(candidate, linkedRoot);
  const linkedRootResult = verifyReleaseCandidate(linkedRoot);
  assert.strictEqual(linkedRootResult.decision, "fail");
  assert.deepStrictEqual(linkedRootResult.faults, ["Input is not a directory."]);

  const changedBinding = copyCandidate(candidate, "changed-binding");
  const provenanceFile = path.join(changedBinding, "provenance.json");
  const provenance = JSON.parse(fs.readFileSync(provenanceFile, "utf8"));
  provenance.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit =
    "0".repeat(40);
  fs.writeFileSync(provenanceFile, `${JSON.stringify(provenance, null, 2)}\n`);
  const changedProvenance = fs.readFileSync(provenanceFile);
  const manifestFile = path.join(changedBinding, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const provenanceRecord = manifest.files.find(
    (entry) => entry.file === "provenance.json"
  );
  provenanceRecord.bytes = changedProvenance.length;
  provenanceRecord.sha256 = crypto
    .createHash("sha256")
    .update(changedProvenance)
    .digest("hex");
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const bindingResult = verifyReleaseCandidate(changedBinding);
  assert.strictEqual(bindingResult.decision, "fail");
  assert.ok(bindingResult.faults.some((fault) => /Provenance is not bound/.test(fault)));

  console.log("release candidate verification tests passed");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

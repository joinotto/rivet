import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyReleaseCandidate } from "../scripts/verify-release-candidate.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(fs.readFileSync(path.join(repository, "package.json"), "utf8")).version;
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

function rewriteProvenance(candidate, mutate) {
  const provenanceFile = path.join(candidate, "provenance.json");
  const provenance = JSON.parse(fs.readFileSync(provenanceFile, "utf8"));
  mutate(provenance);
  fs.writeFileSync(provenanceFile, `${JSON.stringify(provenance, null, 2)}\n`);
  const changedProvenance = fs.readFileSync(provenanceFile);
  const manifestFile = path.join(candidate, "manifest.json");
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
}

function rewriteArchive(candidate, mutate) {
  const name = `rivet-${version}-codex.tar`;
  const file = path.join(candidate, name);
  const content = mutate(fs.readFileSync(file));
  fs.writeFileSync(file, content);
  const manifestFile = path.join(candidate, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const record = manifest.files.find((entry) => entry.file === name);
  record.bytes = content.length;
  record.sha256 = crypto.createHash("sha256").update(content).digest("hex");
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
}

try {
  const source = path.join(temporary, "source");
  fs.cpSync(repository, source, {
    recursive: true,
    filter: (entry) => !entry.split(path.sep).some(
      (part) => [".git", ".rivet", "dist", "node_modules", "coverage"].includes(part)
    )
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
    version,
    "--revision",
    revision,
    "--output",
    candidate
  ]);

  const valid = verifyReleaseCandidate(candidate, {
    version,
    revision
  });
  assert.strictEqual(valid.decision, "pass", JSON.stringify(valid.faults));
  assert.strictEqual(valid.archives, 2);
  assert.deepStrictEqual(valid.hosts, ["claude-code", "codex"]);
  assert.strictEqual(valid.signature, "not-checked");
  for (const [index, size] of ["-0000001000", "+0000000001", "0000000001x", "77777777777"].entries()) {
    const malformed = copyCandidate(candidate, `invalid-size-${index}`);
    rewriteArchive(malformed, (content) => {
      content.fill(0, 124, 136);
      content.write(size, 124, "ascii");
      content.fill(0x20, 148, 156);
      const checksum = content.subarray(0, 512).reduce((sum, byte) => sum + byte, 0);
      content.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");
      return content;
    });
    const boundedResult = spawnSync(process.execPath, [
      "--max-old-space-size=64", path.join(repository, "scripts/verify-release-candidate.mjs"),
      "--input", malformed,
    ], { encoding: "utf8", timeout: 3000 });
    assert.strictEqual(boundedResult.status, 1, `${boundedResult.error || ""}\n${boundedResult.stderr}`);
    assert.ok(JSON.parse(boundedResult.stdout).faults.some((fault) => /invalid or truncated entry size/.test(fault)));
  }
  const duplicated = copyCandidate(candidate, "duplicate-entry");
  rewriteArchive(duplicated, (content) => {
    const size = Number.parseInt(content.subarray(124, 136).toString("ascii"), 8);
    const record = content.subarray(0, 512 + Math.ceil(size / 512) * 512);
    return Buffer.concat([record, content]);
  });
  assert.ok(verifyReleaseCandidate(duplicated).faults.some((fault) => /duplicate entry/.test(fault)));
  const trailing = copyCandidate(candidate, "trailing-data");
  rewriteArchive(trailing, (content) => Buffer.concat([content, Buffer.alloc(512, 1)]));
  assert.ok(verifyReleaseCandidate(trailing).faults.some((fault) => /no trailing data/.test(fault)));

  const retiredHost = copyCandidate(candidate, "retired-host");
  const retiredManifestFile = path.join(retiredHost, "manifest.json");
  const retiredManifest = JSON.parse(fs.readFileSync(retiredManifestFile, "utf8"));
  fs.renameSync(
    path.join(retiredHost, `rivet-${version}-claude-code.tar`),
    path.join(retiredHost, `rivet-${version}-cursor.tar`),
  );
  retiredManifest.files.find(
    (record) => record.file === `rivet-${version}-claude-code.tar`,
  ).file = `rivet-${version}-cursor.tar`;
  retiredManifest.hosts = ["codex", "cursor"];
  fs.writeFileSync(retiredManifestFile, JSON.stringify(retiredManifest));
  const retiredResult = verifyReleaseCandidate(retiredHost);
  assert.strictEqual(retiredResult.decision, "fail");
  assert.ok(retiredResult.faults.some((fault) => /exactly/.test(fault)));

  const changedArchive = copyCandidate(candidate, "changed-archive");
  fs.appendFileSync(
    path.join(changedArchive, `rivet-${version}-codex.tar`),
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
  rewriteProvenance(
    changedBinding,
    (provenance) =>
      (provenance.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit =
        "0".repeat(40))
  );
  const bindingResult = verifyReleaseCandidate(changedBinding);
  assert.strictEqual(bindingResult.decision, "fail");
  assert.ok(bindingResult.faults.some((fault) => /Provenance is not bound/.test(fault)));

  const changedByproduct = copyCandidate(candidate, "changed-byproduct");
  rewriteProvenance(
    changedByproduct,
    (provenance) =>
      (provenance.predicate.runDetails.byproducts[0].digest.sha256 =
        "0".repeat(64))
  );
  const byproductResult = verifyReleaseCandidate(changedByproduct);
  assert.strictEqual(byproductResult.decision, "fail");
  assert.ok(
    byproductResult.faults.some((fault) =>
      /does not verify byproduct SHA256SUMS/.test(fault)
    )
  );

  const extraSubject = copyCandidate(candidate, "extra-subject");
  rewriteProvenance(extraSubject, (provenance) =>
    provenance.subject.push({
      name: "unexpected.tar",
      digest: { sha256: "0".repeat(64) }
    })
  );
  const subjectResult = verifyReleaseCandidate(extraSubject);
  assert.strictEqual(subjectResult.decision, "fail");
  assert.ok(
    subjectResult.faults.some((fault) => /subject inventory/.test(fault))
  );

  console.log("release candidate verification tests passed");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

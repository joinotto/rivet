import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const temporary = path.join(
  repository,
  ".rivet",
  "tmp",
  `release-candidate-${process.pid}`
);
fs.mkdirSync(temporary, { recursive: true });
const sourceIsDirty =
  spawnSync("git", ["status", "--porcelain"], {
    cwd: repository,
    encoding: "utf8"
  }).stdout.trim().length > 0;

function run(output, extra = []) {
  const revision = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repository,
    encoding: "utf8"
  }).stdout.trim();
  return spawnSync(
    process.execPath,
    [
      "scripts/build-release-candidate.mjs",
      "--version",
      "0.1.0",
      "--revision",
      revision,
      "--output",
      output,
      "--allow-dirty",
      ...extra
    ],
    { cwd: repository, encoding: "utf8" }
  );
}

function inventory(root) {
  return fs
    .readdirSync(root)
    .sort()
    .map((file) => {
      const content = fs.readFileSync(path.join(root, file));
      return {
        file,
        bytes: content.length,
        sha256: crypto.createHash("sha256").update(content).digest("hex")
      };
    });
}

try {
  const first = path.join(temporary, "first");
  const second = path.join(temporary, "second");
  const firstRun = run(first);
  const secondRun = run(second);
  assert.strictEqual(firstRun.status, 0, firstRun.stderr);
  assert.strictEqual(secondRun.status, 0, secondRun.stderr);
  assert.deepStrictEqual(inventory(first), inventory(second));
  const originalInventory = inventory(first);
  const replacement = run(first, ["--force"]);
  assert.notStrictEqual(replacement.status, 0);
  assert.match(replacement.stderr, /Use a new candidate directory/);
  assert.deepStrictEqual(inventory(first), originalInventory);
  const unrelated = path.join(temporary, "user-files");
  fs.mkdirSync(unrelated);
  fs.writeFileSync(path.join(unrelated, "keep.txt"), "keep\n");
  const unrelatedReplacement = run(unrelated, ["--force"]);
  assert.notStrictEqual(unrelatedReplacement.status, 0);
  assert.strictEqual(fs.readFileSync(path.join(unrelated, "keep.txt"), "utf8"), "keep\n");

  const outside = fs.mkdtempSync(
    path.join(os.tmpdir(), "rivet-release-outside-")
  );
  const marker = path.join(outside, "keep.txt");
  fs.writeFileSync(marker, "keep\n");
  const outsideRun = spawnSync(
    process.execPath,
    [
      "scripts/build-release-candidate.mjs",
      "--version",
      "0.1.0",
      "--revision",
      spawnSync("git", ["rev-parse", "HEAD"], {
        cwd: repository,
        encoding: "utf8"
      }).stdout.trim(),
      "--output",
      outside,
      "--force",
      "--allow-dirty"
    ],
    { cwd: repository, encoding: "utf8" }
  );
  assert.notStrictEqual(outsideRun.status, 0);
  assert.match(outsideRun.stderr, /--output must resolve to a directory inside/);
  assert.strictEqual(fs.readFileSync(marker, "utf8"), "keep\n");

  const linkedParent = path.join(temporary, "outside-link");
  fs.symlinkSync(outside, linkedParent);
  const linkedRun = run(path.join(linkedParent, "candidate"));
  assert.notStrictEqual(linkedRun.status, 0);
  assert.match(linkedRun.stderr, /--output must resolve to a directory inside/);
  assert.strictEqual(fs.readFileSync(marker, "utf8"), "keep\n");
  fs.unlinkSync(linkedParent);
  fs.rmSync(outside, { recursive: true, force: true });

  const manifest = JSON.parse(
    fs.readFileSync(path.join(first, "manifest.json"), "utf8")
  );
  assert.strictEqual(manifest.kind, "rivet-release-candidate");
  assert.strictEqual(
    manifest.decision,
    sourceIsDirty ? "test-candidate" : "unsigned-candidate"
  );
  assert.strictEqual(
    manifest.source_state,
    sourceIsDirty ? "dirty-allowed" : "clean"
  );
  assert.strictEqual(manifest.files.length, 5);
  assert.deepStrictEqual(manifest.hosts, ["claude-code", "codex"]);

  const sbom = JSON.parse(
    fs.readFileSync(path.join(first, "bom.cdx.json"), "utf8")
  );
  assert.strictEqual(sbom.bomFormat, "CycloneDX");
  assert.strictEqual(sbom.components.length, 2);

  const provenance = JSON.parse(
    fs.readFileSync(path.join(first, "provenance.json"), "utf8")
  );
  assert.strictEqual(provenance._type, "https://in-toto.io/Statement/v1");
  assert.strictEqual(
    provenance.predicateType,
    "https://slsa.dev/provenance/v1"
  );
  assert.strictEqual(provenance.subject.length, 2);
  assert.strictEqual(
    provenance.predicate.buildDefinition.externalParameters.revision,
    manifest.revision
  );
  assert.strictEqual(provenance.predicate.rivetMetadata.unsigned, true);

  for (const host of ["codex", "claude-code"]) {
    const archive = path.join(first, `rivet-0.1.0-${host}.tar`);
    assert.ok(fs.statSync(archive).size > 1024);
    const listed = spawnSync("tar", ["-tf", archive], { encoding: "utf8" });
    assert.strictEqual(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /^rivet-host[.]json$/m);
    assert.match(listed.stdout, /^install[.]mjs$/m);
    assert.match(listed.stdout, /^LICENSE$/m);
    assert.match(listed.stdout, /^NOTICE$/m);
    assert.match(listed.stdout, /^rivet\/SKILL[.]md$/m);
  }

  const sums = fs
    .readFileSync(path.join(first, "SHA256SUMS"), "utf8")
    .trim()
    .split("\n");
  assert.strictEqual(sums.length, 2);
  for (const line of sums) {
    const [expected, file] = line.split(/  /);
    const content = fs.readFileSync(path.join(first, file));
    assert.strictEqual(
      crypto.createHash("sha256").update(content).digest("hex"),
      expected
    );
  }

  console.log("release candidate reproducibility tests passed");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

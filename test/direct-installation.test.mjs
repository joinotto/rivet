import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-direct-"));
const metadata = JSON.parse(fs.readFileSync(path.join(repository, "package.json"), "utf8"));
const env = { ...process.env, npm_config_cache: path.join(temporary, "cache"), npm_config_update_notifier: "false" };
function run(executable, args, cwd = temporary) {
  return spawnSync(executable, args, { cwd, env, encoding: "utf8", timeout: 60000 });
}
function good(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}
try {
  const packingOutput = JSON.parse(good(run("npm", [
    "pack", "--json", "--ignore-scripts", "--pack-destination", temporary,
  ], repository)).stdout);
  // npm 12 keys pack results by package name; older clients return an array.
  assert.equal(Object.keys(packingOutput).length, 1, "Packing must report exactly one package.");
  const packed = Array.isArray(packingOutput) ? packingOutput[0] : packingOutput[metadata.name];
  assert.ok(packed && Array.isArray(packed.files), "Packing must report the selected package files.");
  // Older npm clients can report the unsanitized scoped name in JSON even
  // though the physical archive uses a normalized filename.
  const archives = fs.readdirSync(temporary).filter((name) => name.endsWith(".tgz"));
  assert.equal(archives.length, 1, "Packing must create exactly one archive.");
  const archive = path.join(temporary, archives[0]);
  for (const file of packed.files) {
    assert.ok(["package.json", "README.md", "LICENSE", "NOTICE"].includes(file.path) ||
      file.path === "scripts/install-skill.mjs" || file.path.startsWith("skills/rivet/"),
    `Unexpected distribution file: ${file.path}`);
    assert.ok(!file.path.split("/").some((part) =>
      [".git", ".rivet", "node_modules", "dist", "test", "fixtures"].includes(part)));
  }
  assert.equal(metadata.name, "@ottoai/rivet", "Only publish under the selected scope.");
  assert.equal(metadata.private, false);
  assert.deepEqual(metadata.publishConfig, {
    access: "public", registry: "https://registry.npmjs.org/",
    tag: metadata.version === "0.1.3" ? "latest" : "next", provenance: true,
  });
  assert.deepEqual(metadata.bin, { rivet: "scripts/install-skill.mjs" });
  assert.ok(!metadata.dependencies && !metadata.devDependencies);
  for (const hook of ["preinstall", "install", "postinstall", "prepare", "prepack", "postpack"]) {
    assert.ok(!metadata.scripts[hook], `Unexpected lifecycle hook: ${hook}`);
  }
  // Downloaded archives must not borrow source identity from a parent worktree.
  const parent = path.join(temporary, "outer-repository");
  fs.mkdirSync(parent);
  good(run("git", ["init", "-q"], parent));
  fs.writeFileSync(path.join(parent, "marker.txt"), "outer repository\n");
  good(run("git", ["add", "marker.txt"], parent));
  good(run("git", ["-c", "user.name=Rivet Test", "-c", "user.email=rivet@example.invalid",
    "commit", "-qm", "outer fixture"], parent));
  good(run("tar", ["-xf", archive, "-C", parent]));
  const source = path.join(parent, "package");
  const installer = path.join(source, "scripts/install-skill.mjs");
  for (const [host, discovery] of [
    ["codex", ".agents/skills/rivet"], ["claude-code", ".claude/skills/rivet"],
  ]) {
    const project = path.join(temporary, `project-${host}`);
    fs.mkdirSync(project);
    const original = '{"name":"unchanged-backend","private":true}\n';
    fs.writeFileSync(path.join(project, "package.json"), original);
    fs.writeFileSync(path.join(project, "AGENTS.md"), "User instructions.\n");
    fs.writeFileSync(path.join(project, "CLAUDE.md"), "User instructions.\n");
    const invoke = (action, extra = []) => run("npx", [
      "--offline", "--yes", "--ignore-scripts", `file:${archive}`,
      action, "--host", host, "--project", ".", ...extra,
    ], project);
    const target = path.join(project, discovery);
    assert.equal(JSON.parse(good(invoke("install", ["--dry-run"])).stdout).decision, "planned");
    assert.equal(fs.existsSync(path.join(project, discovery.split("/")[0])), false);
    assert.equal(JSON.parse(good(invoke("install")).stdout).decision, "installed");
    const receipt = JSON.parse(fs.readFileSync(path.join(target, ".rivet-installation.json"), "utf8"));
    assert.equal(receipt.version, metadata.version);
    assert.equal(receipt.source_revision, null);
    assert.equal(receipt.source_state, "unknown");
    assert.equal(fs.existsSync(path.join(target, "agents/openai.yaml")), host === "codex");
    for (const name of ["LICENSE", "NOTICE"]) {
      assert.equal(fs.readFileSync(path.join(target, name), "utf8"),
        fs.readFileSync(path.join(repository, name), "utf8"));
    }
    assert.equal(JSON.parse(good(invoke("status")).stdout).decision, "installed");
    const upgrade = JSON.parse(good(invoke("upgrade")).stdout);
    assert.equal(upgrade.decision, "upgraded");
    assert.ok(fs.existsSync(path.join(upgrade.backup, "SKILL.md")));
    const removal = JSON.parse(good(invoke("remove")).stdout);
    assert.equal(removal.decision, "removed");
    fs.renameSync(removal.backup, target);
    assert.equal(JSON.parse(good(invoke("status")).stdout).decision, "installed");
    const nestedResult = JSON.parse(good(run(process.execPath, [
      installer, "upgrade", "--host", host, "--project", project,
    ])).stdout);
    assert.equal(nestedResult.source_revision, null, "Parent Git identity is not Rivet provenance.");
    assert.equal(nestedResult.source_state, "unknown");
    fs.appendFileSync(path.join(target, "SKILL.md"), "\nUser edit.\n");
    const edited = fs.readFileSync(path.join(target, "SKILL.md"), "utf8");
    for (const action of ["install", "upgrade", "remove"]) {
      assert.equal(invoke(action).status, 2);
      assert.equal(fs.readFileSync(path.join(target, "SKILL.md"), "utf8"), edited);
    }
    assert.equal(fs.readFileSync(path.join(project, "package.json"), "utf8"), original);
    assert.equal(fs.existsSync(path.join(project, "package-lock.json")), false);
    assert.equal(fs.existsSync(path.join(project, "node_modules")), false);
    for (const name of ["AGENTS.md", "CLAUDE.md"]) {
      assert.equal(fs.readFileSync(path.join(project, name), "utf8"), "User instructions.\n");
    }
  }
  console.log("Direct distribution: offline npm execution, both hosts, lifecycle, preservation, and source identity passed.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

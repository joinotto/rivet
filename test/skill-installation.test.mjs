import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hostPaths, manageSkill } from "../scripts/install-skill.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-installation-"));
function project(name) {
  const root = path.join(temporary, name);
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    scripts: { test: "node check.mjs" },
  }));
  fs.writeFileSync(path.join(root, "check.mjs"), "import fs from 'node:fs'; fs.writeFileSync('check-ran.txt', 'observed'); process.stdout.write('check passed\\n');\n");
  fs.writeFileSync(path.join(root, "AGENTS.md"), "Preserve this project guidance.\n");
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "Preserve this Claude guidance.\n");
  fs.mkdirSync(path.join(root, ".codex"));
  fs.writeFileSync(path.join(root, ".codex/config.toml"), 'model_provider = "bedrock"\n');
  fs.mkdirSync(path.join(root, ".claude"));
  fs.writeFileSync(path.join(root, ".claude/settings.json"), '{"permissions":{"defaultMode":"plan"}}\n');
  return root;
}
function run(file, args, cwd = repository) {
  return spawnSync(process.execPath, [file, ...args], { cwd, encoding: "utf8", timeout: 60000 });
}
function cli(action, host, root, extra = [], file = path.join(repository, "scripts/install-skill.mjs")) {
  return run(file, [action, "--host", host, "--project", root, ...extra]);
}
function inventory(root) {
  const result = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isDirectory()) { result.push([relative, "directory"]); walk(absolute); }
      else if (entry.isFile()) result.push([relative, crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex")]);
      else result.push([relative, "link"]);
    }
  }
  walk(root);
  return result;
}

try {
  for (const host of Object.keys(hostPaths)) {
    const root = project(host);
    const original = inventory(root);
    const planned = cli("install", host, root, ["--dry-run"]);
    assert.equal(planned.status, 0, planned.stderr);
    assert.equal(JSON.parse(planned.stdout).decision, "planned");
    assert.deepEqual(inventory(root), original, "Dry-run must not create files.");
    const installed = cli("install", host, root);
    assert.equal(installed.status, 0, installed.stderr);
    assert.equal(JSON.parse(installed.stdout).decision, "installed");
    const target = path.join(root, hostPaths[host]);
    assert.equal(fs.existsSync(path.join(target, "agents/openai.yaml")), host === "codex");
    const receipt = JSON.parse(fs.readFileSync(path.join(target, ".rivet-installation.json"), "utf8"));
    assert.equal(receipt.host, host);
    assert.equal(receipt.inventory.files.some((file) => file.path === "SKILL.md"), true);
    for (const document of ["LICENSE", "NOTICE"]) {
      assert.equal(fs.readFileSync(path.join(target, document), "utf8"), fs.readFileSync(path.join(repository, document), "utf8"));
      assert.equal(receipt.inventory.files.some((file) => file.path === document), true);
    }
    assert.equal(JSON.parse(cli("status", host, root).stdout).decision, "installed");
    const beforeRepeated = inventory(root);
    assert.equal(JSON.parse(cli("install", host, root).stdout).decision, "unchanged");
    assert.deepEqual(inventory(root), beforeRepeated);
    const runner = path.join(target, "scripts/rivet-evidence.mjs");
    for (const args of [["inspect", "--json"], ["verify", "--dry-run", "--json"], ["verify", "--checks", "test", "--json"]]) {
      const result = run(runner, args, root);
      assert.equal(result.status, 0, result.stderr);
      if (args.includes("--dry-run")) {
        assert.match(result.stdout, /Checks that would run:/);
        assert.equal(fs.existsSync(path.join(root, "check-ran.txt")), false);
      } else {
        const evidence = JSON.parse(result.stdout);
        if (args.includes("--checks")) assert.equal(evidence.decision, "pass");
      }
    }
    const beforeRemovalPlan = inventory(root);
    assert.equal(cli("remove", host, root, ["--dry-run"]).status, 0);
    assert.deepEqual(inventory(root), beforeRemovalPlan);
    const removed = cli("remove", host, root);
    assert.equal(removed.status, 0, removed.stderr);
    const backup = JSON.parse(removed.stdout).backup;
    assert.equal(fs.existsSync(target), false);
    assert.equal(fs.readFileSync(path.join(backup, "SKILL.md"), "utf8"), fs.readFileSync("skills/rivet/SKILL.md", "utf8"));
    assert.equal(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), "Preserve this project guidance.\n");
    assert.equal(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), "Preserve this Claude guidance.\n");
    assert.equal(fs.readFileSync(path.join(root, ".codex/config.toml"), "utf8"), 'model_provider = "bedrock"\n');
    assert.equal(fs.readFileSync(path.join(root, ".claude/settings.json"), "utf8"), '{"permissions":{"defaultMode":"plan"}}\n');
    assert.equal(JSON.parse(cli("remove", host, root).stdout).decision, "unchanged");
    fs.renameSync(backup, target);
    assert.equal(JSON.parse(cli("status", host, root).stdout).decision, "installed", "Backup must be recoverable.");
    fs.appendFileSync(path.join(target, "SKILL.md"), "\nUser edits.\n");
    const edited = inventory(root);
    assert.equal(JSON.parse(cli("status", host, root).stdout).decision, "modified");
    for (const action of ["install", "upgrade", "remove"]) {
      const refused = cli(action, host, root);
      assert.equal(refused.status, 2);
      assert.match(refused.stderr, /modified installation/);
      assert.deepEqual(inventory(root), edited, `${action} must preserve edits.`);
    }
  }

  const source = path.join(temporary, "source");
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, "SKILL.md"), "---\nname: rivet\ndescription: Use for testing.\n---\n# Old\n");
  const root = project("upgrade");
  const options = { host: "codex", project: root,
    source: { root: source, version: "0.1.0", revision: "a".repeat(40), state: "clean" } };
  manageSkill({ ...options, action: "install" });
  fs.writeFileSync(path.join(source, "SKILL.md"), "---\nname: rivet\ndescription: Use for testing.\n---\n# New\n");
  const oldInventory = inventory(root);
  assert.throws(() => manageSkill({ ...options, action: "install" }), /Use upgrade/);
  assert.deepEqual(inventory(root), oldInventory);
  const upgraded = manageSkill({ ...options, action: "upgrade" });
  assert.match(fs.readFileSync(path.join(root, hostPaths.codex, "SKILL.md"), "utf8"), /# New/);
  assert.match(fs.readFileSync(path.join(upgraded.backup, "SKILL.md"), "utf8"), /# Old/);
  assert.equal(manageSkill({ ...options, action: "status" }).decision, "installed");

  fs.writeFileSync(path.join(source, "SKILL.md"), "# Another\n");
  const rename = fs.renameSync;
  try {
    fs.renameSync = (from, to) => {
      if (path.basename(from).startsWith(".rivet-stage-")) throw new Error("Simulated commit failure.");
      return rename(from, to);
    };
    assert.throws(() => manageSkill({ ...options, action: "upgrade" }), /Simulated commit failure/);
  } finally {
    fs.renameSync = rename;
  }
  assert.equal(manageSkill({ ...options, action: "status" }).decision, "installed");
  assert.match(fs.readFileSync(path.join(root, hostPaths.codex, "SKILL.md"), "utf8"), /# New/);
  assert.equal(fs.readdirSync(path.join(root, ".agents/skills")).some((name) => name.startsWith(".rivet-stage-") || name.endsWith(".lock")), false);

  const addedDirectory = path.join(root, hostPaths.codex, "user-folder");
  fs.mkdirSync(addedDirectory);
  assert.equal(manageSkill({ ...options, action: "status" }).decision, "modified");
  assert.throws(() => manageSkill({ ...options, action: "remove" }), /modified installation/);
  fs.rmdirSync(addedDirectory);
  const receiptFile = path.join(root, hostPaths.codex, ".rivet-installation.json");
  const savedReceipt = fs.readFileSync(receiptFile);
  fs.writeFileSync(receiptFile, '{"schema":1}');
  assert.equal(manageSkill({ ...options, action: "status" }).decision, "unmanaged");
  assert.throws(() => manageSkill({ ...options, action: "remove" }), /unmanaged installation/);
  fs.writeFileSync(receiptFile, savedReceipt);
  const lock = path.join(root, ".agents/skills/.rivet-install.lock");
  fs.writeFileSync(lock, "Another installer owns this lock.");
  assert.throws(() => manageSkill({ ...options, action: "upgrade" }), /Installation lock exists/);
  assert.equal(fs.readFileSync(lock, "utf8"), "Another installer owns this lock.");
  fs.unlinkSync(lock);

  const unmanaged = project("unmanaged");
  fs.mkdirSync(path.join(unmanaged, hostPaths.codex), { recursive: true });
  fs.writeFileSync(path.join(unmanaged, hostPaths.codex, "SKILL.md"), "User-managed skill.\n");
  for (const action of ["install", "upgrade", "remove"]) assert.equal(cli(action, "codex", unmanaged).status, 2);
  assert.equal(fs.readFileSync(path.join(unmanaged, hostPaths.codex, "SKILL.md"), "utf8"), "User-managed skill.\n");
  const linked = project("linked");
  const outside = project("outside");
  fs.symlinkSync(outside, path.join(linked, ".agents"));
  const outsideBefore = inventory(outside);
  assert.equal(cli("install", "codex", linked).status, 2);
  assert.deepEqual(inventory(outside), outsideBefore);
  const broken = project("broken-link");
  fs.mkdirSync(path.join(broken, ".agents/skills"), { recursive: true });
  fs.symlinkSync(path.join(temporary, "absent"), path.join(broken, hostPaths.codex));
  assert.equal(cli("install", "codex", broken).status, 2);
  const unsafeSource = path.join(source, "link");
  fs.symlinkSync(path.join(outside, "AGENTS.md"), unsafeSource);
  assert.throws(() => manageSkill({ ...options, action: "upgrade" }), /links or special files/);
  fs.unlinkSync(unsafeSource);
  fs.writeFileSync(path.join(source, "oversized"), Buffer.alloc(1024 * 1024 + 1));
  const beforeOversized = inventory(root);
  assert.throws(() => manageSkill({ ...options, action: "upgrade" }), /bounded regular file/);
  assert.deepEqual(inventory(root), beforeOversized);
  fs.unlinkSync(path.join(source, "oversized"));
  for (const filename of [".env.local", "private.pem", "private.key", "debug.log"]) {
    fs.writeFileSync(path.join(source, filename), "Synthetic local data.\n");
    const before = inventory(root);
    assert.throws(() => manageSkill({ ...options, action: "upgrade" }), /Local or credential-bearing paths/);
    assert.deepEqual(inventory(root), before);
    fs.unlinkSync(path.join(source, filename));
  }
  const conflictingNotices = [{ path: "LICENSE", content: Buffer.from("notice") }];
  fs.mkdirSync(path.join(source, "LICENSE"));
  assert.throws(() => manageSkill({ ...options, action: "upgrade",
    source: { ...options.source, notices: conflictingNotices },
  }), /conflicting LICENSE/);
  fs.rmdirSync(path.join(source, "LICENSE"));
  const backupLinked = project("backup-link");
  assert.equal(cli("install", "codex", backupLinked).status, 0);
  fs.mkdirSync(path.join(backupLinked, ".rivet"));
  fs.symlinkSync(outside, path.join(backupLinked, ".rivet/installation-backups"));
  for (const action of ["upgrade", "remove"]) assert.equal(cli(action, "codex", backupLinked).status, 2);
  assert.deepEqual(inventory(outside), outsideBefore);
  for (const host of ["cursor", "portable", "../codex", "__proto__"]) assert.equal(cli("install", host, project(`bad-${host.replaceAll("/", "_")}`)).status, 2);
  assert.equal(run("scripts/install-skill.mjs", ["install", "--host", "codex"]).status, 2);
  assert.equal(cli("install", "codex", root, ["--force"]).status, 2);

  const packages = path.join(temporary, "packages");
  assert.equal(run("scripts/package-hosts.mjs", ["--output", packages]).status, 0);
  for (const host of Object.keys(hostPaths)) {
    const packagedProject = project(`packaged-${host}`);
    const installer = path.join(packages, host, "install.mjs");
    const result = cli("install", host, packagedProject, [], installer);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).decision, "installed");
    for (const document of ["LICENSE", "NOTICE"]) {
      assert.equal(fs.readFileSync(path.join(packagedProject, hostPaths[host], document), "utf8"), fs.readFileSync(path.join(repository, document), "utf8"));
    }
    const wrongHost = host === "codex" ? "claude-code" : "codex";
    assert.equal(cli("install", wrongHost, packagedProject, [], installer).status, 2);
  }

  const packagerSource = path.join(temporary, "packager-source");
  fs.mkdirSync(path.join(packagerSource, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(packagerSource, "skills/rivet"), { recursive: true });
  for (const name of ["install-skill.mjs", "package-hosts.mjs"]) {
    fs.copyFileSync(path.join(repository, "scripts", name), path.join(packagerSource, "scripts", name));
  }
  for (const document of ["LICENSE", "NOTICE"]) {
    fs.copyFileSync(path.join(repository, document), path.join(packagerSource, document));
  }
  fs.writeFileSync(path.join(packagerSource, "package.json"), '{"version":"0.1.0","type":"module"}\n');
  fs.writeFileSync(path.join(packagerSource, "skills/rivet/SKILL.md"), "# Fixture skill\n");
  fs.writeFileSync(path.join(packagerSource, ".gitignore"), ".env*\n");
  for (const args of [
    ["init", "-q"], ["add", "."],
    ["-c", "user.name=Rivet Test", "-c", "user.email=rivet@example.invalid",
      "-c", "commit.gpgsign=false", "commit", "-q", "-m", "fixture"],
  ]) {
    const result = spawnSync("git", args, { cwd: packagerSource, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  function packageFixture(args) {
    return run(path.join(packagerSource, "scripts/package-hosts.mjs"), args, packagerSource);
  }
  const unrelated = path.join(packagerSource, "unrelated");
  fs.mkdirSync(unrelated);
  fs.writeFileSync(path.join(unrelated, "keep.txt"), "Keep this user file.\n");
  assert.notEqual(packageFixture(["--output", unrelated, "--force"]).status, 0);
  assert.equal(fs.readFileSync(path.join(unrelated, "keep.txt"), "utf8"), "Keep this user file.\n");
  assert.notEqual(packageFixture(["--output", path.join(packagerSource, "scripts"), "--force"]).status, 0);
  assert.equal(fs.existsSync(path.join(packagerSource, "scripts/install-skill.mjs")), true);
  assert.notEqual(packageFixture(["--output", path.join(packagerSource, "skills/rivet"), "--force"]).status, 0);
  assert.equal(fs.existsSync(path.join(packagerSource, "skills/rivet/SKILL.md")), true);
  for (const args of [["--unknown"], ["--output"], ["--force", "--force"]]) {
    assert.notEqual(packageFixture(args).status, 0);
  }
  const generated = path.join(packagerSource, "generated");
  assert.equal(packageFixture(["--output", generated]).status, 0);
  assert.equal(packageFixture(["--output", generated, "--force"]).status, 0);
  const metadataPath = path.join(generated, "codex/rivet-host.json");
  const metadataContent = fs.readFileSync(metadataPath);
  const externalMetadata = path.join(unrelated, "external-metadata.json");
  fs.writeFileSync(externalMetadata, metadataContent);
  fs.unlinkSync(metadataPath);
  fs.symlinkSync(externalMetadata, metadataPath);
  assert.notEqual(packageFixture(["--output", generated, "--force"]).status, 0);
  assert.equal(fs.readlinkSync(metadataPath), externalMetadata);
  assert.deepEqual(fs.readFileSync(externalMetadata), metadataContent);
  fs.unlinkSync(metadataPath);
  fs.writeFileSync(metadataPath, metadataContent);
  const beforeIgnored = inventory(generated);
  fs.writeFileSync(path.join(packagerSource, "skills/rivet/.env.local"), "Synthetic local data.\n");
  const ignored = packageFixture(["--output", generated, "--force"]);
  assert.notEqual(ignored.status, 0);
  assert.match(ignored.stderr, /canonical skill contains ignored files/);
  assert.deepEqual(inventory(generated), beforeIgnored);
  fs.unlinkSync(path.join(packagerSource, "skills/rivet/.env.local"));
  fs.symlinkSync(path.join(packagerSource, "LICENSE"), path.join(packagerSource, "skills/rivet/link"));
  assert.notEqual(packageFixture(["--output", generated, "--force"]).status, 0);
  assert.deepEqual(inventory(generated), beforeIgnored);
  fs.unlinkSync(path.join(packagerSource, "skills/rivet/link"));
  fs.writeFileSync(path.join(generated, "codex/user-notes.txt"), "Preserve unrelated content.");
  assert.notEqual(packageFixture(["--output", generated, "--force"]).status, 0);
  assert.equal(fs.readFileSync(path.join(generated, "codex/user-notes.txt"), "utf8"), "Preserve unrelated content.");
  console.log("Skill installation, upgrade, removal, recovery, and fresh-project workflow tests passed.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

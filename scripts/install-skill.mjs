#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const container = path.dirname(fileURLToPath(import.meta.url));
const receiptName = ".rivet-installation.json";
const limits = { files: 4096, fileBytes: 1024 * 1024, totalBytes: 16 * 1024 * 1024 };
export const hostPaths = Object.freeze({
  codex: ".agents/skills/rivet",
  "claude-code": ".claude/skills/rivet",
});

function digest(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function stat(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function directory(file) {
  const info = stat(file);
  if (!info?.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`Expected a non-symbolic directory: ${file}`);
  }
}

function read(file, maximum = limits.fileBytes) {
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(descriptor);
    if (!before.isFile() || before.size > maximum) {
      throw new Error(`Expected a bounded regular file: ${file}`);
    }
    const content = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < content.length) {
      const count = fs.readSync(descriptor, content, offset, content.length - offset, offset);
      if (!count) throw new Error(`File changed while reading: ${file}`);
      offset += count;
    }
    const after = fs.fstatSync(descriptor);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw new Error(`File changed while reading: ${file}`);
    }
    return content;
  } finally {
    fs.closeSync(descriptor);
  }
}

function safeRelative(relative) {
  return typeof relative === "string" && relative.length > 0 &&
    Buffer.byteLength(relative) <= 1024 && !/[\\\x00-\x1f\x7f]/.test(relative) &&
    relative.split("/").every((part) => part && part !== "." && part !== "..");
}

function snapshot(root, { host, ignoreReceipt = false } = {}) {
  directory(root);
  const files = [];
  const directories = [];
  let bytes = 0;
  function walk(current, prefix = "") {
    directory(current);
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!prefix && host === "claude-code" && entry.name === "agents") continue;
      if (!prefix && entry.name === receiptName && ignoreReceipt) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!safeRelative(relative) || relative === receiptName) {
        throw new Error(`Unsupported source path: ${relative}`);
      }
      if (files.length + directories.length >= limits.files) {
        throw new Error("The skill inventory exceeds its entry limit.");
      }
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        directories.push(relative);
        walk(absolute, relative);
      } else if (entry.isFile() && !entry.isSymbolicLink()) {
        const content = read(absolute);
        bytes += content.length;
        if (bytes > limits.totalBytes) throw new Error("The skill exceeds its total byte limit.");
        files.push({ path: relative, bytes: content.length, sha256: digest(content), content });
      } else {
        throw new Error(`The skill cannot contain links or special files: ${relative}`);
      }
    }
  }
  walk(root);
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  directories.sort();
  const records = files.map(({ content, ...record }) => record);
  return { files, inventory: { directories, files: records } };
}

export function sourceForHost(host) {
  if (!Object.hasOwnProperty.call(hostPaths, host)) throw new Error("Host must be codex or claude-code.");
  const packaged = path.join(container, "rivet-host.json");
  if (stat(packaged)) {
    const metadata = JSON.parse(read(packaged, 65536));
    if (metadata.schema !== 1 || metadata.host !== host ||
        !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(metadata.version || "") ||
        !/^[a-f0-9]{40}$/.test(metadata.source_revision || "") ||
        !["clean", "dirty", "unknown"].includes(metadata.source_state)) {
      throw new Error("Package metadata does not match the requested host or source.");
    }
    return {
      root: path.join(container, "rivet"), version: metadata.version,
      revision: metadata.source_revision, state: metadata.source_state,
    };
  }
  const repository = path.resolve(container, "..");
  const version = JSON.parse(read(path.join(repository, "package.json"), 65536)).version;
  const head = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repository, encoding: "utf8", timeout: 30000,
  });
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: repository, encoding: "utf8", timeout: 30000,
  });
  return {
    root: path.join(repository, "skills/rivet"), version,
    revision: head.status === 0 ? head.stdout.trim() : null,
    state: head.status !== 0 || status.status !== 0 ? "unknown" : status.stdout.trim() ? "dirty" : "clean",
  };
}

function chain(project, parts, create = false) {
  let current = project;
  directory(current);
  for (const part of parts) {
    current = path.join(current, part);
    const existing = stat(current);
    if (!existing) {
      if (create) fs.mkdirSync(current, { mode: 0o700 });
      else continue;
    }
    if (stat(current)) directory(current);
  }
  return current;
}

function installedState(target, host) {
  if (!stat(target)) return { decision: "missing" };
  directory(target);
  if (!stat(path.join(target, receiptName))) return { decision: "unmanaged" };
  let receipt;
  try {
    receipt = JSON.parse(read(path.join(target, receiptName), 2 * 1024 * 1024));
    const inventory = receipt.inventory;
    if (receipt.schema !== 1 || receipt.kind !== "rivet-skill-installation" ||
        receipt.host !== host || receipt.install_path !== hostPaths[host] ||
        !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(receipt.version || "") ||
        !(receipt.source_revision === null || /^[a-f0-9]{40}$/.test(receipt.source_revision || "")) ||
        !["clean", "dirty", "unknown"].includes(receipt.source_state) ||
        !inventory || !Array.isArray(inventory.files) || !Array.isArray(inventory.directories) ||
        inventory.files.length + inventory.directories.length > limits.files ||
        inventory.files.some((file) => !safeRelative(file.path) || file.path === receiptName ||
          !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > limits.fileBytes ||
          !/^[a-f0-9]{64}$/.test(file.sha256 || "")) ||
        inventory.directories.some((name) => !safeRelative(name)) ||
        receipt.inventory_sha256 !== digest(JSON.stringify(inventory))) {
      throw new Error("Invalid installation receipt.");
    }
    const actual = snapshot(target, { ignoreReceipt: true }).inventory;
    if (JSON.stringify(actual) !== JSON.stringify(inventory)) {
      return { decision: "modified", receipt };
    }
    return { decision: "installed", receipt };
  } catch (error) {
    return { decision: "unmanaged", fault: error.message };
  }
}

function lock(parent, operation) {
  const file = path.join(parent, ".rivet-install.lock");
  let descriptor;
  try {
    descriptor = fs.openSync(file, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`Installation lock exists: ${file}`);
    throw error;
  }
  const identity = fs.fstatSync(descriptor);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, host: os.hostname() })}\n`);
    return operation();
  } finally {
    fs.closeSync(descriptor);
    const current = stat(file);
    if (current && current.ino === identity.ino && current.dev === identity.dev) fs.unlinkSync(file);
  }
}

export function manageSkill({ action, host, project, dryRun = false, source }) {
  if (!["install", "status", "upgrade", "remove"].includes(action)) {
    throw new Error("Action must be install, status, upgrade, or remove.");
  }
  if (!Object.hasOwnProperty.call(hostPaths, host)) throw new Error("Host must be codex or claude-code.");
  if (!project) throw new Error("An explicit --project directory is required.");
  const suppliedProject = path.resolve(project);
  directory(suppliedProject);
  const root = fs.realpathSync(suppliedProject);
  if (root === path.parse(root).root || root === fs.realpathSync(os.homedir())) {
    throw new Error("Use a project directory, not the filesystem root or home directory.");
  }
  const parts = hostPaths[host].split("/");
  const parentParts = parts.slice(0, -1);
  const target = chain(root, parts);
  let state = installedState(target, host);
  const base = {
    schema: 1, kind: "rivet-skill-installation-result", action, host,
    project: root, install_path: hostPaths[host], dry_run: dryRun,
  };
  if (action === "status") {
    return { ...base, ...state, limitations: ["An installation receipt is not a publisher signature."] };
  }
  let selected;
  let sourceSnapshot;
  if (action === "install" || action === "upgrade") {
    selected = source || sourceForHost(host);
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(selected.version || "")) {
      throw new Error("The source version is invalid.");
    }
    if (!(selected.revision === null || /^[a-f0-9]{40}$/.test(selected.revision || "")) ||
        !["clean", "dirty", "unknown"].includes(selected.state)) {
      throw new Error("The source identity is invalid.");
    }
    sourceSnapshot = snapshot(selected.root, { host });
    if (!sourceSnapshot.files.some((file) => file.path === "SKILL.md")) {
      throw new Error("The source has no SKILL.md.");
    }
    if (target === fs.realpathSync(selected.root)) throw new Error("Source and target must differ.");
  }
  function check(current) {
    if (["modified", "unmanaged"].includes(current.decision)) {
      throw new Error(`Refusing to ${action} a ${current.decision} installation. Preserve or move it manually.`);
    }
    if (action === "upgrade" && current.decision === "missing") {
      throw new Error("No managed installation exists. Use install first.");
    }
    if (action === "install" && current.decision === "installed" &&
        JSON.stringify(current.receipt.inventory) !== JSON.stringify(sourceSnapshot.inventory)) {
      throw new Error("A different managed installation exists. Use upgrade.");
    }
  }
  check(state);
  if ((action === "remove" && state.decision === "missing") ||
      (action === "install" && state.decision === "installed")) {
    return { ...base, decision: "unchanged" };
  }
  if (action === "upgrade" || action === "remove") {
    chain(root, [".rivet", "installation-backups", host]);
  }
  if (dryRun) {
    return { ...base, decision: "planned", current: state.decision,
      source: selected && { version: selected.version, revision: selected.revision, state: selected.state },
      recovery: action === "install" ? "No existing installation is replaced." : "The prior installation will be retained in a project-local backup." };
  }
  const parent = chain(root, parentParts, true);
  return lock(parent, () => {
    chain(root, parts);
    state = installedState(target, host);
    check(state);
    if (action === "install" && state.decision === "installed") return { ...base, decision: "unchanged" };
    if (action === "remove" && state.decision === "missing") return { ...base, decision: "unchanged" };
    let backup;
    if (action === "upgrade" || action === "remove") {
      const backupParent = chain(root, [".rivet", "installation-backups", host], true);
      backup = path.join(backupParent, `rivet-${crypto.randomUUID()}`);
    }
    if (action === "remove") {
      fs.renameSync(target, backup);
      return { ...base, decision: "removed", backup };
    }
    const stage = fs.mkdtempSync(path.join(parent, ".rivet-stage-"));
    let moved = false;
    try {
      for (const relative of sourceSnapshot.inventory.directories) {
        fs.mkdirSync(path.join(stage, relative), { recursive: true, mode: 0o700 });
      }
      for (const file of sourceSnapshot.files) {
        fs.writeFileSync(path.join(stage, file.path), file.content, { flag: "wx", mode: 0o644 });
      }
      const receipt = {
        schema: 1, kind: "rivet-skill-installation", host, install_path: hostPaths[host],
        version: selected.version, source_revision: selected.revision, source_state: selected.state,
        inventory: sourceSnapshot.inventory,
        inventory_sha256: digest(JSON.stringify(sourceSnapshot.inventory)),
      };
      fs.writeFileSync(path.join(stage, receiptName), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      if (backup) {
        fs.renameSync(target, backup);
        moved = true;
      }
      if (stat(target)) throw new Error("The target appeared during installation.");
      fs.renameSync(stage, target);
      return { ...base, decision: action === "upgrade" ? "upgraded" : "installed",
        version: selected.version, source_revision: selected.revision,
        source_state: selected.state, inventory_sha256: receipt.inventory_sha256, backup };
    } catch (error) {
      if (moved && !stat(target)) {
        try {
          fs.renameSync(backup, target);
        } catch (restoreError) {
          throw new Error(`${error.message} Previous installation remains at ${backup}. Recovery failed: ${restoreError.message}`);
        }
      } else if (moved) {
        throw new Error(`${error.message} Previous installation remains at ${backup}.`);
      }
      throw error;
    } finally {
      if (stat(stage)) fs.rmSync(stage, { recursive: true });
    }
  });
}

if (process.argv[1] && stat(path.resolve(process.argv[1])) &&
    fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
      console.log("node install.mjs install|status|upgrade|remove --host codex|claude-code --project DIRECTORY [--dry-run]");
    } else {
      const action = args.shift();
      const options = { action };
      for (let index = 0; index < args.length; index += 1) {
        const flag = args[index];
        if (flag === "--dry-run" && options.dryRun === undefined) options.dryRun = true;
        else if (["--host", "--project"].includes(flag) && !options[flag.slice(2)] &&
            args[index + 1] && !args[index + 1].startsWith("--")) options[flag.slice(2)] = args[++index];
        else throw new Error(`Unknown, repeated, or incomplete option: ${flag}`);
      }
      const result = manageSkill(options);
      console.log(JSON.stringify(result, null, 2));
      if (["modified", "unmanaged"].includes(result.decision)) process.exitCode = 2;
    }
  } catch (error) {
    console.error(JSON.stringify({ decision: "refused", error: error.message }));
    process.exitCode = 2;
  }
}

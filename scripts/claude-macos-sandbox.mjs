#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

function quoteProfile(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

if (process.platform !== "darwin") {
  console.error("The Claude macOS sandbox profile requires macOS.");
  process.exit(78);
}
if (!fs.existsSync("/usr/bin/sandbox-exec")) {
  console.error("The deprecated macOS sandbox-exec compatibility tool is unavailable.");
  process.exit(78);
}

const requested = process.env.RIVET_CLAUDE_EXECUTABLE || "claude";
let executable = requested;
if (!path.isAbsolute(executable)) {
  const resolved = spawnSync("/usr/bin/which", [executable], {
    encoding: "utf8"
  });
  if (resolved.status !== 0 || !resolved.stdout.trim()) {
    console.error(`Claude executable is unavailable: ${requested}`);
    process.exit(127);
  }
  executable = resolved.stdout.trim();
}

const workspace = fs.realpathSync(process.cwd());
const profile = [
  "(version 1)",
  "(allow default)",
  `(deny file-write* (require-not (subpath "${quoteProfile(workspace)}")))`
].join("");
const result = spawnSync(
  "/usr/bin/sandbox-exec",
  ["-p", profile, executable, ...process.argv.slice(2)],
  {
    cwd: workspace,
    env: process.env,
    encoding: "utf8",
    input: process.stdin.isTTY ? undefined : fs.readFileSync(0),
    maxBuffer: 8 * 1024 * 1024
  }
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launcher = path.join(repository, "scripts/claude-macos-sandbox.mjs");

if (process.platform !== "darwin") {
  const source = fs.readFileSync(launcher, "utf8");
  assert.match(source, /process[.]platform !== "darwin"/);
  assert.match(source, /deny file-write/);
  console.log("Claude macOS sandbox test skipped on non-macOS");
} else {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-seatbelt-"));
  const outside = path.join(os.homedir(), `.rivet-seatbelt-${process.pid}.txt`);
  try {
    const probe = [
      "const fs=require('fs');",
      "fs.writeFileSync('inside.txt','inside');",
      `try{fs.writeFileSync(${JSON.stringify(outside)},'outside')}catch(e){process.stdout.write(e.code)}`
    ].join("");
    const result = spawnSync(process.execPath, [launcher, "-e", probe], {
      cwd: temporary,
      env: {
        ...process.env,
        RIVET_CLAUDE_EXECUTABLE: process.execPath
      },
      encoding: "utf8"
    });
    if (
      result.status === 71 &&
      result.stderr.includes("sandbox_apply: Operation not permitted")
    ) {
      console.log(
        "Claude macOS sandbox runtime test skipped inside an existing sandbox"
      );
      process.exit(0);
    }
    assert.strictEqual(result.status, 0, result.stderr);
    assert.strictEqual(result.stdout, "EPERM");
    assert.strictEqual(fs.readFileSync(path.join(temporary, "inside.txt"), "utf8"), "inside");
    assert.strictEqual(fs.existsSync(outside), false);
    console.log("Claude macOS sandbox tests passed");
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(outside, { force: true });
  }
}

import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const root = process.cwd();
const temporary = path.join(
  root,
  ".rivet",
  "tmp",
  `fuzz-workflow-${process.pid}`,
);
fs.mkdirSync(temporary, { recursive: true });
const output = path.join(temporary, "parser-fuzz.json");
const relativeOutput = path.relative(root, output);

const result = spawnSync(
  process.execPath,
  [
    "scripts/run-parser-fuzz.mjs",
    "--executions",
    "1",
    "--executions",
    "50",
    "--seed",
    "20261026",
    "--output",
    relativeOutput,
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
assert.strictEqual(result.status, 0, result.stderr);
const stdoutReport = JSON.parse(result.stdout);
const retainedReport = JSON.parse(fs.readFileSync(output, "utf8"));
assert.deepStrictEqual(retainedReport, stdoutReport);
assert.match(retainedReport.report.revision, /^[a-f0-9]{40,64}$/);
assert.strictEqual(retainedReport.report.executions, 50);
assert.strictEqual(retainedReport.evidence.decision, "no-crash-observed");

const outside = spawnSync(
  process.execPath,
  [
    "scripts/run-parser-fuzz.mjs",
    "--executions",
    "1",
    "--output",
    path.join(os.tmpdir(), "rivet-fuzz-outside.json"),
  ],
  { cwd: root, encoding: "utf8" },
);
assert.notStrictEqual(outside.status, 0);
assert.match(outside.stderr, /--output must be inside the project/);

const missingOutput = spawnSync(
  process.execPath,
  ["scripts/run-parser-fuzz.mjs", "--executions", "1", "--output"],
  { cwd: root, encoding: "utf8" },
);
assert.notStrictEqual(missingOutput.status, 0);
assert.match(missingOutput.stderr, /--output requires/);

const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
assert.match(
  workflow,
  /npm run test:fuzz -- --output "\.rivet\/ci\/parser-fuzz-node-\$\{\{ matrix\.node \}\}\.json"/,
);
assert.match(workflow, /name: rivet-parser-fuzz-node-\$\{\{ matrix\.node \}\}/);
assert.match(workflow, /if-no-files-found: error/);
assert.match(workflow, /retention-days: 14/);
assert.match(
  workflow,
  /actions\/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9/,
);
assert.doesNotMatch(workflow, /pull_request_target/);

fs.rmSync(temporary, { recursive: true, force: true });
console.log("Fuzz workflow tests passed.");

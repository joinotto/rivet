import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const fixture = path.dirname(fileURLToPath(import.meta.url));
const output = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(fixture, "evidence");
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) {
  throw new Error("The test-quality evidence fixture requires Node.js 20 or later.");
}

function run(args, cwd = fixture) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
  });
}

function lineCoverage(body) {
  const row = body.split(/\r?\n/).find((line) =>
    /source[.]mjs\s*\|/.test(line),
  );
  if (!row) throw new Error("Node coverage output has no source.mjs row.");
  const columns = row.split("|").map((item) => item.trim());
  const percent = Number(columns[1]);
  if (!Number.isFinite(percent)) {
    throw new Error("Node coverage output has no line percentage.");
  }
  return percent;
}

function mutationRun(testFile) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-mutant-"));
  try {
    const source = fs.readFileSync(path.join(fixture, "source.mjs"), "utf8");
    const mutant = source.replace("age >= 18", "age > 18");
    if (mutant === source) throw new Error("The mutation target was not found.");
    fs.writeFileSync(path.join(temporary, "source.mjs"), mutant);
    fs.copyFileSync(
      path.join(fixture, testFile),
      path.join(temporary, testFile),
    );
    return run(["--test", testFile], temporary);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

const coverage = run([
  "--test",
  "--experimental-test-coverage",
  "weak.test.mjs",
]);
if (coverage.status !== 0) {
  throw new Error(`Weak coverage run failed: ${coverage.stderr || coverage.stdout}`);
}
const weakLineCoverage = lineCoverage(coverage.stdout);
const weakMutation = mutationRun("weak.test.mjs");
const strongMutation = mutationRun("strong.test.mjs");
if (weakMutation.status !== 0) {
  throw new Error("The weak suite unexpectedly killed the boundary mutant.");
}
if (strongMutation.status === 0) {
  throw new Error("The strong suite did not kill the boundary mutant.");
}

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(
  path.join(output, "coverage-summary.json"),
  `${JSON.stringify({
    total: {
      lines: {
        total: 2,
        covered: weakLineCoverage === 100 ? 2 : 0,
        skipped: 0,
        pct: weakLineCoverage,
      },
    },
    source: {
      tool: "node-test-coverage",
      command: "node --test --experimental-test-coverage weak.test.mjs",
    },
  }, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(output, "weak-mutation.json"),
  `${JSON.stringify({
    schemaVersion: "1",
    thresholds: { high: 80, low: 60, break: null },
    files: {
      "source.mjs": {
        language: "javascript",
        mutants: [{
          id: "boundary-1",
          mutatorName: "EqualityOperator",
          replacement: "age > 18",
          status: "Survived",
          location: {
            start: { line: 2, column: 10 },
            end: { line: 2, column: 19 },
          },
        }],
      },
    },
  }, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(output, "strong-mutation.json"),
  `${JSON.stringify({
    schemaVersion: "1",
    thresholds: { high: 80, low: 60, break: null },
    files: {
      "source.mjs": {
        language: "javascript",
        mutants: [{
          id: "boundary-1",
          mutatorName: "EqualityOperator",
          replacement: "age > 18",
          status: "Killed",
          location: {
            start: { line: 2, column: 10 },
            end: { line: 2, column: 19 },
          },
        }],
      },
    },
  }, null, 2)}\n`,
);
console.log(`Weak line coverage: ${weakLineCoverage}%`);
console.log("Weak mutation result: survived");
console.log("Strong mutation result: killed");

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizeFuzzCampaign } from "../skills/rivet/scripts/lib/fuzz.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

function option(name, fallback) {
  const index = argv.lastIndexOf(name);
  return index === -1 ? fallback : argv[index + 1];
}

function digest(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function directoryDigest(directory) {
  const records = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      if (entry.isFile()) {
        records.push([
          path.relative(directory, absolute).split(path.sep).join("/"),
          digest(fs.readFileSync(absolute)),
        ]);
      }
    }
  }
  visit(directory);
  return digest(JSON.stringify(records.sort(([left], [right]) =>
    left.localeCompare(right)
  )));
}

function projectPath(value, label) {
  const target = path.resolve(root, value);
  let existing = target;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error(`${label} cannot be resolved.`);
    existing = parent;
  }
  const rootReal = fs.realpathSync(root);
  const targetReal = path.resolve(
    fs.realpathSync(existing),
    path.relative(existing, target),
  );
  if (
    targetReal === rootReal ||
    !targetReal.startsWith(`${rootReal}${path.sep}`)
  ) {
    throw new Error(`${label} must resolve inside the project.`);
  }
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
    throw new Error(`${label} cannot be a symbolic link.`);
  }
  return target;
}

function revision() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0 || !/^[a-f0-9]{40,64}$/.test(result.stdout.trim())) {
    throw new Error("Cannot determine the source revision.");
  }
  return result.stdout.trim();
}

const executions = Number(option("--executions", "10000"));
const seed = Number(option("--seed", "20261026"));
if (!Number.isInteger(executions) || executions < 1 || executions > 1000000) {
  throw new Error("--executions must be an integer from 1 through 1000000.");
}
if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
  throw new Error("--seed must be a 32-bit unsigned integer.");
}

const workspace = projectPath(
  option("--workspace", ".rivet/coverage-guided"),
  "--workspace",
);
const output = projectPath(
  option("--output", ".rivet/coverage-guided/report.json"),
  "--output",
);
const packageRoot = path.join(root, "fuzz/coverage-guided");
const seedCorpus = path.join(packageRoot, "corpus");
const corpus = path.join(workspace, "corpus");
const crashesRoot = path.join(workspace, "crashes");
const executable = path.join(
  packageRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "jazzer.cmd" : "jazzer",
);
if (!fs.existsSync(executable)) {
  throw new Error("Install the isolated fuzz workspace with npm ci first.");
}

fs.rmSync(workspace, { recursive: true, force: true });
fs.mkdirSync(crashesRoot, { recursive: true, mode: 0o700 });
fs.cpSync(seedCorpus, corpus, { recursive: true });

const target = path.join(packageRoot, "target.mjs");
const dictionary = path.join(packageRoot, "dictionary.txt");
const args = [
  target,
  corpus,
  "-i",
  path.join(root, "skills/rivet/scripts/lib/"),
  "--sync",
  "--",
  `-runs=${executions}`,
  `-seed=${seed}`,
  "-max_len=65536",
  `-dict=${dictionary}`,
  `-artifact_prefix=${crashesRoot}${path.sep}`,
  "-print_final_stats=1",
];
const started = new Date();
const fuzz = spawnSync(executable, args, {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
const finished = new Date();
const combinedLog = `${fuzz.stdout || ""}\n${fuzz.stderr || ""}`;
const timeoutCount = /\btimeout\b/i.test(combinedLog) ? 1 : 0;
const outOfMemoryCount = /\bout[- ]of[- ]memory\b|\bheap limit\b/i.test(
  combinedLog,
)
  ? 1
  : 0;
const executedMatch =
  [...combinedLog.matchAll(/#(\d+)\s+(?:DONE|pulse)/g)].at(-1) ||
  combinedLog.match(/Done (\d+) runs/);
const observedExecutions = executedMatch
  ? Number(executedMatch[1])
  : executions;
const crashFiles = fs
  .readdirSync(crashesRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();
const crashes = crashFiles.map((file) => {
  const absolute = path.join(crashesRoot, file);
  return {
    id: file,
    class: "jazzer-crash-input",
    input_digest: digest(fs.readFileSync(absolute)),
    artifact: path.relative(root, absolute),
    stack_digest: digest(combinedLog),
    reproducible: false,
  };
});
const version = JSON.parse(
  fs.readFileSync(path.join(packageRoot, "node_modules/@jazzer.js/core/package.json"))
).version;
const report = {
  schema: 1,
  kind: "fuzz-campaign",
  engine: "Jazzer.js/libFuzzer",
  engine_version: version,
  target: "Rivet SARIF, Trivy, CycloneDX, and SPDX normalizers",
  revision: revision(),
  command_digest: digest([executable, ...args].join("\0")),
  started_at: started.toISOString(),
  finished_at: finished.toISOString(),
  duration_seconds: (finished.getTime() - started.getTime()) / 1000,
  executions: observedExecutions,
  seed_corpus_digest: directoryDigest(seedCorpus),
  final_corpus_digest: directoryDigest(corpus),
  dictionary_digest: digest(fs.readFileSync(dictionary)),
  sanitizer:
    "Jazzer.js/libFuzzer coverage, JavaScript exceptions, determinism, output-size checks, and built-in bug detectors",
  crashes,
  timeouts: timeoutCount,
  out_of_memory: outOfMemoryCount,
  observations: {
    configured_executions: executions,
    seed,
    exit_code: fuzz.status,
    signal: fuzz.signal,
    tool_error: fuzz.error?.message || null,
    corpus_files: fs.readdirSync(corpus).length,
    log_digest: digest(combinedLog),
  },
};
const evidence = normalizeFuzzCampaign(report);
const workflowDecision =
  fuzz.status === 0
    ? "pass"
    : crashes.length
      ? "crash-observed"
      : "tool-failure";
const result = { report, evidence, workflow_decision: workflowDecision };
fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, {
  mode: 0o600,
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (workflowDecision !== "pass" || evidence.decision !== "no-crash-observed") {
  process.exitCode = 1;
}

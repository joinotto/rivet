import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  normalizeSarif,
  normalizeSbom,
  normalizeTrivy
} from "../skills/rivet/scripts/lib/security-evidence.mjs";
import { normalizeFuzzCampaign } from "../skills/rivet/scripts/lib/fuzz.mjs";

function option(name, fallback) {
  const index = process.argv.lastIndexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function revision() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown-revision";
}

function generator(initialSeed) {
  let state = initialSeed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function integer(random, maximum) {
  return Math.floor(random() * maximum);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function primitive(random) {
  const values = [
    null,
    true,
    false,
    0,
    -1,
    Number.MAX_SAFE_INTEGER,
    "",
    "A".repeat(integer(random, 512)),
    "\u0000\n\r\t",
    "../".repeat(integer(random, 20)),
    [],
    {},
    [null, {}, "value"]
  ];
  return clone(values[integer(random, values.length)]);
}

function paths(value, current = [], result = []) {
  result.push(current);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      paths(value[key], [...current, key], result);
    }
  }
  return result;
}

function parentAt(root, selected) {
  let parent = root;
  for (const key of selected.slice(0, -1)) {
    if (!parent || typeof parent !== "object") return null;
    parent = parent[key];
  }
  return parent;
}

function mutate(input, random) {
  let output = clone(input);
  const mutationCount = 1 + integer(random, 4);
  for (let count = 0; count < mutationCount; count += 1) {
    const available = paths(output);
    const selected = available[integer(random, available.length)];
    if (selected.length === 0) {
      output = primitive(random);
      continue;
    }
    const parent = parentAt(output, selected);
    if (!parent || typeof parent !== "object") continue;
    const key = selected[selected.length - 1];
    const operation = integer(random, 4);
    if (operation === 0) {
      delete parent[key];
    } else if (operation === 1) {
      parent[key] = primitive(random);
    } else if (operation === 2 && Array.isArray(parent[key])) {
      parent[key].push(primitive(random));
    } else {
      parent[`fuzz_${integer(random, 100)}`] = primitive(random);
    }
  }
  return output;
}

const seedCorpus = [
  {
    target: "sarif",
    value: {
      version: "2.1.0",
      runs: [
        {
          tool: { driver: { name: "fixture", version: "1", rules: [] } },
          results: []
        }
      ]
    }
  },
  {
    target: "trivy",
    value: {
      Results: [
        {
          Target: "fixture",
          Vulnerabilities: [],
          Misconfigurations: []
        }
      ]
    }
  },
  {
    target: "cyclonedx",
    value: {
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      components: [{ type: "library", name: "fixture", version: "1" }]
    }
  },
  {
    target: "spdx",
    value: {
      spdxVersion: "SPDX-2.3",
      packages: [{ name: "fixture", versionInfo: "1" }]
    }
  }
];

const targetFunctions = {
  sarif: (file) => normalizeSarif(file),
  trivy: (file) => normalizeTrivy(file),
  cyclonedx: (file) => normalizeSbom(file, "fuzz-revision"),
  spdx: (file) => normalizeSbom(file, "fuzz-revision")
};
const allowedErrors = new Set([
  "The artifact is not SARIF 2.1.0.",
  "The artifact is not a supported Trivy JSON report.",
  "The artifact is not supported CycloneDX or SPDX JSON."
]);

const executions = Number(option("--executions", "3000"));
const seed = Number(option("--seed", "20261026"));
const outputOption = option("--output", "");
if (!Number.isInteger(executions) || executions < 1 || executions > 100000) {
  throw new Error("--executions must be an integer from 1 through 100000");
}
if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
  throw new Error("--seed must be a 32-bit unsigned integer");
}
if (process.argv.includes("--output") && !outputOption) {
  throw new Error("--output requires a project-relative file path");
}
let outputFile = "";
if (outputOption) {
  outputFile = path.resolve(process.cwd(), outputOption);
  if (!outputFile.startsWith(`${process.cwd()}${path.sep}`)) {
    throw new Error("--output must be inside the project.");
  }
}

const random = generator(seed);
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-parser-fuzz-"));
const inputFile = path.join(workspace, "input.json");
const crashes = [];
let rejected = 0;
let accepted = 0;
let malformed = 0;
const started = new Date();

try {
  for (let execution = 0; execution < executions; execution += 1) {
    const corpusEntry = seedCorpus[integer(random, seedCorpus.length)];
    const mutated = mutate(corpusEntry.value, random);
    const malformedInput = integer(random, 20) === 0;
    const body = malformedInput
      ? `${JSON.stringify(mutated).slice(0, -1)}!`
      : JSON.stringify(mutated);
    fs.writeFileSync(inputFile, body);
    if (malformedInput) malformed += 1;

    const normalize = targetFunctions[corpusEntry.target];
    try {
      const first = JSON.stringify(normalize(inputFile));
      const second = JSON.stringify(normalize(inputFile));
      if (first !== second) {
        throw new Error("The normalizer returned a non-deterministic result.");
      }
      if (Buffer.byteLength(first) > 1024 * 1024) {
        throw new Error("The normalizer returned more than 1 MiB.");
      }
      accepted += 1;
    } catch (error) {
      const expectedSyntax = malformedInput && error instanceof SyntaxError;
      if (expectedSyntax || allowedErrors.has(error?.message)) {
        rejected += 1;
        continue;
      }
      const inputDigest = digest(body);
      crashes.push({
        id: `parser-${execution}-${inputDigest.slice(0, 12)}`,
        class: error?.name || "NonErrorThrow",
        input_digest: inputDigest,
        artifact: `generated:${corpusEntry.target}:${execution}`,
        stack_digest: digest(String(error?.stack || error)),
        reproducible: true,
        message: String(error?.message || error)
      });
      if (crashes.length >= 20) break;
    }
  }
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}

const finished = new Date();
const report = {
  schema: 1,
  kind: "fuzz-campaign",
  engine: "rivet-deterministic-structure-mutator",
  engine_version: "1",
  target: "SARIF, Trivy, CycloneDX, and SPDX JSON normalization",
  revision: revision(),
  command_digest: digest(process.argv.join("\0")),
  started_at: started.toISOString(),
  finished_at: finished.toISOString(),
  duration_seconds: (finished.getTime() - started.getTime()) / 1000,
  executions: accepted + rejected + crashes.length,
  seed_corpus_digest: digest(JSON.stringify(seedCorpus)),
  dictionary_digest: digest(JSON.stringify(["version", "runs", "Results", "bomFormat", "spdxVersion"])),
  sanitizer: "JavaScript exception, determinism, serialization, and output-size checks",
  crashes,
  timeouts: 0,
  out_of_memory: 0,
  observations: {
    seed,
    accepted,
    rejected,
    malformed
  }
};
const evidence = normalizeFuzzCampaign(report);
const result = `${JSON.stringify({ report, evidence }, null, 2)}\n`;
if (outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true, mode: 0o700 });
  const temporary = `${outputFile}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, result, { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, outputFile);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
process.stdout.write(result);
if (crashes.length > 0 || evidence.decision !== "no-crash-observed") {
  process.exitCode = 1;
}

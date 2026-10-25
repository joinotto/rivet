#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";

const argv = process.argv.slice(2);
const command = argv[0] || "inspect";
const cwd = process.cwd();

function has(flag) {
  return argv.includes(flag);
}

function value(flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function run(executable, args, options = {}) {
  return spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    timeout: options.timeout || 120000,
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
  });
}

function combinedOutput(result) {
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function exists(file) {
  return fs.existsSync(path.join(cwd, file));
}

function gitInfo() {
  const revision = run("git", ["rev-parse", "HEAD"]);
  const root = run("git", ["rev-parse", "--show-toplevel"]);
  const status = run("git", ["status", "--short"]);

  return {
    available: revision.status === 0,
    root: root.status === 0 ? root.stdout.trim() : null,
    revision: revision.status === 0 ? revision.stdout.trim() : null,
    changes:
      status.status === 0
        ? status.stdout
            .split("\n")
            .map((line) => line.trimEnd())
            .filter(Boolean)
        : [],
  };
}

function addCheck(checks, candidate) {
  const duplicate = checks.some(
    (check) =>
      check.id === candidate.id &&
      check.ecosystem === candidate.ecosystem,
  );
  if (!duplicate) checks.push(candidate);
}

function detectProject() {
  const packageJson = readJson(path.join(cwd, "package.json"));
  const checks = [];

  if (packageJson) {
    const scripts = packageJson.scripts || {};
    for (const name of ["test", "lint", "typecheck", "build"]) {
      if (scripts[name]) {
        addCheck(checks, {
          id: name,
          ecosystem: "node",
          executable: "npm",
          args: ["run", name],
          source: `package.json#scripts.${name}`,
        });
      }
    }
  }

  if (exists("Cargo.toml")) {
    addCheck(checks, {
      id: "test",
      ecosystem: "rust",
      executable: "cargo",
      args: ["test"],
      source: "Cargo.toml",
    });
    addCheck(checks, {
      id: "check",
      ecosystem: "rust",
      executable: "cargo",
      args: ["check"],
      source: "Cargo.toml",
    });
  }

  if (exists("go.mod")) {
    addCheck(checks, {
      id: "test",
      ecosystem: "go",
      executable: "go",
      args: ["test", "./..."],
      source: "go.mod",
    });
  }

  const python =
    exists("pyproject.toml") ||
    exists("requirements.txt") ||
    exists("setup.py");
  if (python) {
    addCheck(checks, {
      id: "test",
      ecosystem: "python",
      executable: "python3",
      args: ["-m", "pytest"],
      source: "Python project files",
    });
  }

  return {
    manifests: [
      "package.json",
      "Cargo.toml",
      "go.mod",
      "pyproject.toml",
      "requirements.txt",
      "Dockerfile",
      "docker-compose.yml",
      "compose.yml",
    ].filter(exists),
    context: [
      "PRODUCT.md",
      "SYSTEM.md",
      "ARCHITECTURE.md",
      "SECURITY.md",
      "THREAT-MODEL.md",
      "RELIABILITY.md",
      "TESTING.md",
      "DATA.md",
      "OPERATIONS.md",
    ].filter(exists),
    checks,
  };
}

function digest(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function inspect() {
  const report = {
    schema: 1,
    evidence_class: "observed",
    directory: cwd,
    git: gitInfo(),
    project: detectProject(),
  };

  if (has("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log("Rivet evidence inspection");
  console.log(`Directory: ${report.directory}`);
  console.log(`Revision: ${report.git.revision || "unavailable"}`);
  console.log(`Changed files: ${report.git.changes.length || "none observed"}`);
  console.log(
    `Manifests: ${report.project.manifests.join(", ") || "none detected"}`,
  );
  console.log(
    `Context: ${report.project.context.join(", ") || "none detected"}`,
  );
  console.log("Detected checks:");

  if (!report.project.checks.length) console.log("- none");

  for (const check of report.project.checks) {
    console.log(
      `- ${check.id} [${check.ecosystem}]: ${check.executable} ${check.args.join(" ")} (${check.source})`,
    );
  }
}

function verify() {
  const project = detectProject();
  const requested = (value("--checks") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const selected = requested.length
    ? project.checks.filter((check) => requested.includes(check.id))
    : project.checks;

  const unavailable = requested.filter(
    (id) => !project.checks.some((check) => check.id === id),
  );

  if (has("--dry-run")) {
    console.log("Checks that would run:");
    if (!selected.length) console.log("- none");
    for (const check of selected) {
      console.log(`- ${check.id}: ${check.executable} ${check.args.join(" ")}`);
    }
    if (unavailable.length) {
      console.log(`Unavailable: ${unavailable.join(", ")}`);
    }
    return;
  }

  const startedAt = new Date().toISOString();
  const results = [];

  for (const check of selected) {
    const started = Date.now();
    const result = run(check.executable, check.args);
    results.push({
      id: check.id,
      ecosystem: check.ecosystem,
      command: [check.executable, ...check.args],
      command_digest: digest(
        JSON.stringify([check.executable, ...check.args]),
      ),
      source: check.source,
      result:
        result.error && result.error.code === "ENOENT"
          ? "unavailable"
          : result.status === 0
            ? "pass"
            : "fail",
      exit_code: Number.isInteger(result.status) ? result.status : null,
      duration_ms: Date.now() - started,
      output: combinedOutput(result).slice(-12000),
      error: result.error ? String(result.error.message || result.error) : null,
    });
  }

  for (const id of unavailable) {
    results.push({
      id,
      result: "unavailable",
      reason: "No detected repository check has this identifier.",
    });
  }

  const receipt = {
    schema: 1,
    workflow: "verify",
    evidence_class: "observed",
    target: cwd,
    revision: gitInfo().revision,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    results,
    limitations: [
      "Only detected repository checks were run.",
      "A passing generic check does not prove security, migration safety, authorization, or production behavior.",
    ],
    decision:
      results.length === 0
        ? "insufficient-evidence"
        : results.some((item) => item.result === "fail")
          ? "fail"
          : results.some((item) => item.result === "unavailable")
            ? "incomplete"
            : "pass",
  };

  const receiptPath = value("--receipt");
  if (receiptPath) {
    const absolute = path.resolve(cwd, receiptPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `${JSON.stringify(receipt, null, 2)}\n`, {
      mode: 0o600,
    });
  }

  if (has("--json")) {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } else {
    console.log(`Verification decision: ${receipt.decision}`);
    for (const result of results) {
      const duration =
        result.duration_ms === undefined ? "" : ` (${result.duration_ms} ms)`;
      console.log(`- ${result.id}: ${result.result}${duration}`);
    }
    if (receiptPath) console.log(`Receipt: ${receiptPath}`);
    console.log("Limitations:");
    for (const limitation of receipt.limitations) console.log(`- ${limitation}`);
  }

  if (receipt.decision === "fail") process.exitCode = 2;
  if (
    receipt.decision === "incomplete" ||
    receipt.decision === "insufficient-evidence"
  ) {
    process.exitCode = 1;
  }
}

if (command === "inspect") {
  inspect();
} else if (command === "verify") {
  verify();
} else {
  console.error(`Unknown command: ${command}`);
  console.error(
    "Use: inspect [--json] | verify [--dry-run] [--checks list] [--receipt path] [--json]",
  );
  process.exitCode = 1;
}


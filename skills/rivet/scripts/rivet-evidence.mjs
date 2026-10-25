#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import {
  discoverCheckAdapters,
  discoverDependencyAdapters,
} from "./lib/adapters.mjs";
import { fingerprint, redact } from "./lib/redact.mjs";
import { discoverTopology, topologyImpact } from "./lib/topology.mjs";
import { normalizeDependencyResult } from "./lib/dependencies.mjs";

const argv = process.argv.slice(2);
const command = argv[0] || "inspect";
const cwd = process.cwd();
const canonicalCwd = fs.realpathSync(cwd);

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

function detectProject() {
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
    checks: discoverCheckAdapters(cwd),
    dependency_checks: discoverDependencyAdapters(cwd),
  };
}

function digest(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function outputPath(relative) {
  const absolute = path.resolve(cwd, relative);
  const parent = path.dirname(absolute);
  const canonical = fs.existsSync(parent)
    ? path.join(fs.realpathSync(parent), path.basename(absolute))
    : absolute;
  if (
    canonical !== canonicalCwd &&
    !canonical.startsWith(`${canonicalCwd}${path.sep}`)
  ) {
    throw new Error(`Output must be inside the project: ${relative}`);
  }
  return absolute;
}

function writeNewFile(relative, body) {
  const absolute = outputPath(relative);
  if (fs.existsSync(absolute) && !has("--force")) {
    return { file: relative, result: "preserved" };
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, body, { mode: 0o600 });
  return { file: relative, result: "written" };
}

function initProject() {
  const project = detectProject();
  const config = {
    schema: 1,
    riskPaths: [
      {
        path: "auth",
        mode: "critical",
        reason: "Authentication and authorization are critical.",
      },
      {
        path: "migration",
        mode: "critical",
        reason: "Database migrations can cause irreversible data changes.",
      },
    ],
  };
  const system = `# System

## Purpose

- Add the system purpose.

## Runtime

Detected manifests:
${project.manifests.length ? project.manifests.map((item) => `- \`${item}\``).join("\n") : "- No manifest was detected."}

## Boundaries

- Add services, modules, jobs, clients, and external systems.

## Data

- Add stores, owners, classifications, and integrity rules.

## Critical paths

- Add paths that need service, distributed, or critical review.

## Operations

- Add deployment, rollback, backup, recovery, and ownership.

## Unknowns

- Confirm all generated observations and add missing system facts.
`;

  const results = [
    writeNewFile(".rivet/config.json", `${JSON.stringify(config, null, 2)}\n`),
    writeNewFile("SYSTEM.md", system),
  ];

  console.log("Rivet initialization:");
  for (const result of results) {
    console.log(`- ${result.file}: ${result.result}`);
  }
  console.log("Review generated files. Rivet did not infer unknown architecture.");
}

function mapProject() {
  const project = detectProject();
  const topology = discoverTopology(cwd);
  const map = {
    schema: 1,
    evidence_class: "observed",
    directory: cwd,
    manifests: project.manifests,
    context: project.context,
    checks: project.checks.map((item) => ({
      id: item.id,
      ecosystem: item.ecosystem,
      source: item.source,
    })),
    dependency_checks: project.dependency_checks.map((item) => ({
      id: item.id,
      ecosystem: item.ecosystem,
      source: item.source,
    })),
    topology,
    unknowns: [
      "Runtime topology was not observed.",
      "Data ownership and trust boundaries require project context.",
      "Production deployment and recovery behavior were not observed.",
    ],
  };
  if (has("--json")) {
    process.stdout.write(`${JSON.stringify(map, null, 2)}\n`);
    return;
  }
  console.log("Rivet system map");
  console.log(`Manifests: ${map.manifests.join(", ") || "none"}`);
  console.log(`Context: ${map.context.join(", ") || "none"}`);
  console.log(
    `Checks: ${map.checks.map((item) => `${item.ecosystem}:${item.id}`).join(", ") || "none"}`,
  );
  console.log(
    `Dependency checks: ${map.dependency_checks.map((item) => item.id).join(", ") || "none"}`,
  );
  console.log(
    `Components: ${map.topology.components.map((item) => item.id).join(", ") || "none"}`,
  );
  console.log(
    `Internal edges: ${map.topology.edges.map((item) => `${item.from} -> ${item.to}`).join(", ") || "none"}`,
  );
  console.log(
    `Data-store evidence: ${map.topology.data_stores.map((item) => item.id).join(", ") || "none"}`,
  );
  console.log(
    `Messaging evidence: ${map.topology.messaging.map((item) => `${item.component}:${item.technology}`).join(", ") || "none"}`,
  );
  console.log("Unknowns:");
  for (const item of map.unknowns) console.log(`- ${item}`);
}

function walkFiles(root, output = []) {
  if (!fs.existsSync(root)) return output;
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    output.push(root);
    return output;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (
      [".git", "node_modules", "vendor", "target", "dist", "build"].includes(
        entry.name,
      )
    ) {
      continue;
    }
    walkFiles(path.join(root, entry.name), output);
  }
  return output;
}

function secretScan() {
  const explicit = (value("--files") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => path.resolve(cwd, item));
  const files = explicit.length ? explicit : walkFiles(cwd);
  const patterns = [
    {
      id: "private-key",
      pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    },
    {
      id: "aws-access-key",
      pattern: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g,
    },
    {
      id: "assigned-secret",
      pattern:
        /\b(api[_-]?key|token|password|secret)\s*[:=]\s*["']([^"'\s]{12,})["']/gi,
    },
  ];
  const findings = [];

  for (const file of files) {
    if (!file.startsWith(`${cwd}${path.sep}`) || !fs.existsSync(file)) continue;
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 1024 * 1024) continue;
    let body;
    try {
      body = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = body.split("\n");
    lines.forEach((line, index) => {
      for (const rule of patterns) {
        rule.pattern.lastIndex = 0;
        const match = rule.pattern.exec(line);
        if (!match) continue;
        findings.push({
          id: rule.id,
          file: path.relative(cwd, file),
          line: index + 1,
          fingerprint: fingerprint(match[0]),
          value: "[REDACTED]",
        });
      }
    });
  }

  const report = {
    schema: 1,
    evidence_class: "observed",
    files_checked: files.length,
    findings,
    decision: findings.length ? "fail" : "pass",
    limitations: [
      "Pattern scanning cannot identify all secret formats.",
      "A finding requires confirmation and credential rotation when exposed.",
    ],
  };
  if (has("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`Secret scan: ${report.decision}`);
    for (const item of findings) {
      console.log(
        `- ${item.file}:${item.line} ${item.id} ${item.fingerprint} ${item.value}`,
      );
    }
    for (const item of report.limitations) console.log(`- ${item}`);
  }
  if (findings.length) process.exitCode = 2;
}

function runAdapters(adapters, workflow) {
  if (has("--dry-run")) {
    console.log(`${workflow} adapters:`);
    if (!adapters.length) console.log("- none");
    for (const adapter of adapters) {
      console.log(
        `- ${adapter.id}: ${adapter.executable} ${adapter.args.join(" ")}${adapter.network ? " [network]" : ""}`,
      );
    }
    return;
  }

  const results = [];
  for (const adapter of adapters) {
    const started = Date.now();
    const result = run(adapter.executable, adapter.args);
    const normalized =
      workflow === "dependencies"
        ? normalizeDependencyResult(adapter, result)
        : {
            result:
              result.error && result.error.code === "ENOENT"
                ? "unavailable"
                : result.status === 0
                  ? "pass"
                  : "tool-failure",
            findings: [],
            finding_count: null,
            reason: null,
          };
    results.push({
      adapter_schema: adapter.schema,
      id: adapter.id,
      ecosystem: adapter.ecosystem,
      source: adapter.source,
      result: normalized.result,
      finding_count: normalized.finding_count,
      findings: normalized.findings,
      reason: normalized.reason,
      exit_code: Number.isInteger(result.status) ? result.status : null,
      duration_ms: Date.now() - started,
      output: redact(combinedOutput(result)).slice(-12000),
      error: result.error ? redact(result.error.message) : null,
    });
  }

  const report = {
    schema: 1,
    workflow,
    evidence_class: "observed",
    results,
    decision:
      !results.length
        ? "insufficient-evidence"
        : results.some(
              (item) =>
                item.result === "unavailable" ||
                item.result === "tool-failure",
            )
          ? "incomplete"
          : results.some((item) => item.result === "findings")
            ? "review-findings"
            : "pass",
    limitations: [
      "Dependency tools report known data from their configured sources.",
      "A clean result does not identify a new malicious package or prove runtime reachability.",
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.decision === "incomplete" || report.decision === "insufficient-evidence") {
    process.exitCode = 1;
  } else if (report.decision === "review-findings") {
    process.exitCode = 2;
  }
}

function dependencyAudit() {
  runAdapters(discoverDependencyAdapters(cwd), "dependencies");
}

function changedFiles() {
  const explicit = (value("--files") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (explicit.length) return explicit;

  const result = run("git", ["status", "--short"]);
  if (result.status !== 0) return [];

  return result.stdout
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map((file) => file.includes(" -> ") ? file.split(" -> ").pop() : file);
}

function configRiskSignals(files) {
  const config =
    readJson(path.join(cwd, ".rivet", "config.json")) || {};
  const configured = Array.isArray(config.riskPaths) ? config.riskPaths : [];
  const signals = [];

  for (const rule of configured) {
    if (!rule || !rule.path || !rule.mode) continue;
    for (const file of files) {
      if (file.includes(rule.path)) {
        signals.push({
          file,
          mode: rule.mode,
          source: "project-config",
          reason: rule.reason || `The path matches configured risk path '${rule.path}'.`,
        });
      }
    }
  }
  return signals;
}

function contentRiskSignals(files) {
  const patterns = [
    {
      mode: "critical",
      pattern:
        /\b(authori[sz]e|permission|password|secret|encrypt|decrypt|payment|delete\s+from|drop\s+table|alter\s+table)\b/i,
      reason: "Changed content can affect authorization, secrets, payments, encryption, or destructive data operations.",
    },
    {
      mode: "distributed",
      pattern:
        /\b(retry|backoff|jitter|idempoten|message\s+queue|event\s+bus|kafka|outbox|saga)\b/i,
      reason: "Changed content can affect distributed delivery, retry, or duplicate-work behavior.",
    },
    {
      mode: "service",
      pattern:
        /\b(route|endpoint|openapi|graphql|transaction|foreign\s+key|create\s+index|select\s+.+\s+from)\b/i,
      reason: "Changed content can affect a service contract or persistent data.",
    },
  ];
  const signals = [];

  for (const file of files) {
    const absolute = path.resolve(cwd, file);
    if (!absolute.startsWith(`${cwd}${path.sep}`) || !fs.existsSync(absolute)) {
      continue;
    }
    const stat = fs.statSync(absolute);
    if (!stat.isFile() || stat.size > 1024 * 1024) continue;
    const body = fs.readFileSync(absolute, "utf8");
    for (const rule of patterns) {
      if (rule.pattern.test(body)) {
        signals.push({
          file,
          mode: rule.mode,
          source: "content-heuristic",
          reason: rule.reason,
        });
      }
    }
  }
  return signals;
}

function classifyRisk(files) {
  const rules = [
    {
      mode: "critical",
      pattern:
        /(^|\/)(auth|security|crypto|payment|permission|policy|secrets?|migrations?)(\/|[._-])/i,
      reason: "The path can affect privileged, destructive, payment, cryptographic, or security behavior.",
    },
    {
      mode: "distributed",
      pattern:
        /(^|\/)(queue|worker|event|kafka|retry|outbox|saga|terraform|k8s|deploy|infra)(\/|[._-])/i,
      reason: "The path can affect distributed execution or deployment behavior.",
    },
    {
      mode: "service",
      pattern:
        /(^|\/)(api|route|controller|schema|database|sql|service|repository)(\/|[._-])/i,
      reason: "The path can affect a service contract, persistent data, or integration boundary.",
    },
  ];

  const rank = { local: 0, service: 1, distributed: 2, critical: 3 };
  let mode = "local";
  const signals = [];

  for (const file of files) {
    for (const rule of rules) {
      if (rule.pattern.test(file)) {
        signals.push({
          file,
          mode: rule.mode,
          source: "path-heuristic",
          reason: rule.reason,
        });
        if (rank[rule.mode] > rank[mode]) mode = rule.mode;
      }
    }
  }

  signals.push(...configRiskSignals(files), ...contentRiskSignals(files));
  for (const signal of signals) {
    if (rank[signal.mode] > rank[mode]) mode = signal.mode;
  }

  return { mode, signals };
}

function changeAnalysis() {
  const files = changedFiles();
  const risk = classifyRisk(files);
  const impact = topologyImpact(discoverTopology(cwd), files);
  const report = {
    schema: 1,
    evidence_class: "derived",
    files,
    risk_mode: risk.mode,
    signals: risk.signals,
    topology_impact: impact,
    required_review:
      risk.mode === "critical"
        ? [
            "Define explicit invariants.",
            "Perform a threat and failure review.",
            "Use independent human review.",
            "Define staged rollout and recovery evidence.",
          ]
        : risk.mode === "distributed"
          ? [
              "Test duplicate, delayed, partial, and recovery behavior.",
              "Review compatibility, timeouts, and retries.",
            ]
          : risk.mode === "service"
            ? [
                "Review contracts, data integrity, integration tests, and observability.",
              ]
            : ["Run focused tests and static checks."],
    limitations: [
      "Risk classification uses paths, changed content, configuration, and declared component dependencies.",
      "Declared dependencies do not prove runtime behavior or business impact.",
      "A user or reviewer must increase the risk mode when project context requires it.",
    ],
  };

  if (has("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  console.log(`Risk mode: ${report.risk_mode}`);
  console.log(`Changed files: ${files.length}`);
  for (const signal of report.signals) {
    console.log(`- ${signal.file}: ${signal.mode} — ${signal.reason}`);
  }
  console.log("Required review:");
  for (const item of report.required_review) console.log(`- ${item}`);
  console.log(
    `Affected components: ${report.topology_impact.affected_components.join(", ") || "none observed"}`,
  );
  console.log("Limitations:");
  for (const item of report.limitations) console.log(`- ${item}`);
}

function changeRecord() {
  const files = changedFiles();
  const risk = classifyRisk(files);
  const title = value("--title") || "Backend change";
  const body = `# ${title}

> This record uses an ASD-STE100-aligned writing style. It is not a certified ASD-STE100 document.

## Target

Current behavior:

Required behavior:

Success measure:

Out of scope:

## Facts

- Add observed facts.

## Assumptions

- Add assumptions that need confirmation.

## Unknowns

- Add unknowns that can change the design or risk.

## Invariants

- Add conditions that must remain true.

## Change impact

Risk mode: ${risk.mode}

Changed files:
${files.length ? files.map((file) => `- \`${file}\``).join("\n") : "- No changed files were detected."}

## Threats and failure cases

- Add applicable threats and failure cases.

## Alternatives

- Add material alternatives and the selection reason.

## Verification

- Add each check and its expected result.

## Rollout and recovery

- Add rollout, stop, rollback, and recovery steps.

## Evidence

- Add observed evidence.

## Open risks

- Add unresolved risks and owners.
`;

  const output = value("--output");
  if (!output) {
    process.stdout.write(body);
    return;
  }

  let absolute;
  try {
    absolute = outputPath(output);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  if (fs.existsSync(absolute) && !has("--force")) {
    console.error(`Refusing to overwrite existing file: ${output}`);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(absolute, body, { mode: 0o600 });
  console.log(`Change record: ${output}`);
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
      adapter_schema: check.schema,
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
      output: redact(combinedOutput(result)).slice(-12000),
      error: result.error
        ? redact(String(result.error.message || result.error))
        : null,
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

if (command === "init") {
  initProject();
} else if (command === "map") {
  mapProject();
} else if (command === "inspect") {
  inspect();
} else if (command === "change") {
  changeAnalysis();
} else if (command === "record") {
  changeRecord();
} else if (command === "secrets") {
  secretScan();
} else if (command === "dependencies") {
  dependencyAudit();
} else if (command === "verify") {
  verify();
} else {
  console.error(`Unknown command: ${command}`);
  console.error(
    "Use: init [--force] | map [--json] | inspect [--json] | change [--files list] [--json] | record [--title value] [--files list] [--output path] [--force] | secrets [--files list] [--json] | dependencies [--dry-run] | verify [--dry-run] [--checks list] [--receipt path] [--json]",
  );
  process.exitCode = 1;
}


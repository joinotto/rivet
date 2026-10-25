#!/usr/bin/env node

import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { spawnSync } from "child_process";
import {
  discoverCheckAdapters,
  discoverDependencyAdapters,
  discoverSecurityAdapters,
} from "./lib/adapters.mjs";
import { fingerprint, redact } from "./lib/redact.mjs";
import { discoverTopology, topologyImpact } from "./lib/topology.mjs";
import { normalizeDependencyResult } from "./lib/dependencies.mjs";
import {
  inspectPostgresMigration,
  inspectPostgresPlan,
} from "./lib/postgres.mjs";
import { extractChangeRecord, testFamilies } from "./lib/test-plan.mjs";
import {
  detectFlakes,
  normalizeCoverage,
  normalizeJunit,
  normalizeMutation,
} from "./lib/test-evidence.mjs";
import {
  reviewFindingsSchema,
  reviewMarkdown,
  reviewPacket,
  reviewPrompt,
  validateReviewFindings,
} from "./lib/review.mjs";
import {
  applyReachability,
  enrichVulnerabilities,
  normalizeSarif,
  normalizeSbom,
  normalizeTrivy,
} from "./lib/security-evidence.mjs";
import { validateWaiver, waiverTemplate } from "./lib/waiver.mjs";
import { cosignPlan, cosignResult } from "./lib/attest.mjs";
import { analyzeResilience } from "./lib/resilience.mjs";
import { analyzeRuntimeRetries } from "./lib/runtime-retry.mjs";
import {
  validateMigrationDryRun,
  validateMigrationPlan,
} from "./lib/migration.mjs";
import { analyzeTelemetry } from "./lib/observe.mjs";
import {
  comparePerformance,
  comparePerformanceSamples,
} from "./lib/performance.mjs";
import { evaluateRelease } from "./lib/release.mjs";
import {
  appendIncidentEvent,
  incidentReport,
  incidentTemplate,
} from "./lib/incident.mjs";
import {
  buildPostmortem,
  postmortemMarkdown,
} from "./lib/postmortem.mjs";
import { actionTemplate, validateAction } from "./lib/action.mjs";
import {
  githubIssuePlan,
  parseGithubIssue,
} from "./lib/ticket-sync.mjs";
import { evaluateFindings } from "./lib/evaluate.mjs";
import {
  threatModelTemplate,
  validateThreatModel,
} from "./lib/threat-model.mjs";
import {
  statefulTemplate,
  validateStatefulModel,
} from "./lib/stateful.mjs";
import { normalizeFuzzCampaign } from "./lib/fuzz.mjs";
import {
  chaosTemplate,
  normalizeChaosResult,
  validateChaosExperiment,
} from "./lib/chaos.mjs";
import {
  formalModelTemplate,
  normalizeModelCheckResult,
  validateFormalModel,
} from "./lib/formalize.mjs";

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
    cwd: options.cwd || cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    encoding: "utf8",
    timeout: options.timeout || 120000,
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
    input: options.input,
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
    security_checks: discoverSecurityAdapters(cwd),
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

function configurationDigest(source) {
  const file = String(source || "").split("#")[0];
  const absolute = path.resolve(cwd, file);
  if (
    !absolute.startsWith(`${canonicalCwd}${path.sep}`) &&
    absolute !== canonicalCwd
  ) {
    return null;
  }
  try {
    return digest(fs.readFileSync(absolute));
  } catch {
    return null;
  }
}

function toolVersion(executable) {
  const result = run(executable, ["--version"], { timeout: 10000 });
  if (result.status !== 0) return null;
  return redact(combinedOutput(result)).split("\n")[0].slice(0, 300) || null;
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
    security_checks: project.security_checks.map((item) => ({
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
    `Security checks: ${map.security_checks.map((item) => item.id).join(", ") || "none"}`,
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

function runAdapters(adapters, workflow, options = {}) {
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
    const result = run(adapter.executable, adapter.args, {
      cwd: path.resolve(cwd, adapter.working_directory || "."),
      env: options.env,
    });
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
      working_directory: adapter.working_directory || ".",
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
    ...(options.target ? { authorized_target: options.target } : {}),
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
    limitations:
      workflow === "dependencies"
        ? [
            "Dependency tools report known data from their configured sources.",
            "A clean result does not identify a new malicious package or prove runtime reachability.",
          ]
        : [
            "A zero exit status means only that the declared repository command completed successfully.",
            "Use the command's machine-readable artifact to evaluate security findings.",
            "A clean command result does not prove that the system is secure.",
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

function contractEvidence() {
  try {
    const reportPath = value("--report");
    if (reportPath) {
      const artifact = evidenceArtifact("--report");
      const report = normalizeJunit(artifact, "contract");
      report.artifact = path.relative(cwd, artifact);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.decision === "fail") process.exitCode = 2;
      if (report.decision === "insufficient-evidence") process.exitCode = 1;
      return;
    }

    const adapters = discoverCheckAdapters(cwd).filter(
      (adapter) => adapter.kind === "contract-check",
    );
    if (has("--dry-run")) {
      runAdapters(adapters, "contract");
      return;
    }
    const target = value("--target");
    if (!target) {
      throw new Error("Contract execution requires --target <http-or-https-url>.");
    }
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      throw new Error("The contract target must be a valid HTTP or HTTPS URL.");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("The contract target must use HTTP or HTTPS.");
    }
    if (parsed.username || parsed.password) {
      throw new Error("Do not put credentials in the contract target URL.");
    }
    if (!has("--allow-network")) {
      throw new Error("Contract execution requires explicit --allow-network.");
    }
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (!localHosts.has(parsed.hostname) && !has("--allow-nonlocal-target")) {
      throw new Error(
        "A non-local contract target requires explicit --allow-nonlocal-target.",
      );
    }
    runAdapters(adapters, "contract", {
      target: parsed.toString(),
      env: { RIVET_AUTHORIZED_TARGET: parsed.toString() },
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function threatModelWorkflow() {
  const action = argv[1];
  try {
    if (action === "init") {
      const output = value("--output");
      if (!output) {
        throw new Error("Threat-model initialization requires --output <file>.");
      }
      const absolute = outputPath(output);
      if (fs.existsSync(absolute) && !has("--force")) {
        throw new Error(`Refusing to overwrite existing file: ${output}`);
      }
      const model = threatModelTemplate(
        value("--system"),
        value("--revision") || gitInfo().revision,
        value("--created-at") || new Date().toISOString().slice(0, 10),
      );
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, `${JSON.stringify(model, null, 2)}\n`, {
        mode: 0o600,
      });
      console.log(`Threat-model template: ${output}`);
      console.log("Status: incomplete");
      return;
    }
    if (action === "validate") {
      const artifact = evidenceArtifact("--file");
      if (!artifact) {
        throw new Error("Threat-model validation requires --file <file>.");
      }
      const model = readJson(artifact);
      if (!model) throw new Error("The threat-model file must contain valid JSON.");
      const report = validateThreatModel(model);
      report.artifact = path.relative(cwd, artifact);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.decision === "incomplete") process.exitCode = 1;
      return;
    }
    throw new Error("Use threat-model init or threat-model validate.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function statefulWorkflow() {
  const action = argv[1];
  try {
    if (action === "init") {
      const output = value("--output");
      if (!output) {
        throw new Error("Stateful initialization requires --output <file>.");
      }
      const absolute = outputPath(output);
      if (fs.existsSync(absolute) && !has("--force")) {
        throw new Error(`Refusing to overwrite existing file: ${output}`);
      }
      const model = statefulTemplate(
        value("--system"),
        value("--revision") || gitInfo().revision,
        value("--created-at") || new Date().toISOString().slice(0, 10),
      );
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, `${JSON.stringify(model, null, 2)}\n`, {
        mode: 0o600,
      });
      console.log(`Stateful model template: ${output}`);
      console.log("Status: incomplete");
      return;
    }
    if (action === "validate") {
      const artifact = evidenceArtifact("--file");
      if (!artifact) {
        throw new Error("Stateful validation requires --file <file>.");
      }
      const model = readJson(artifact);
      if (!model) throw new Error("The stateful model must contain valid JSON.");
      const report = validateStatefulModel(model);
      report.artifact = path.relative(cwd, artifact);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.decision === "incomplete") process.exitCode = 1;
      return;
    }
    throw new Error("Use stateful init or stateful validate.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function fuzzEvidence() {
  try {
    const artifact = evidenceArtifact("--report");
    if (!artifact) throw new Error("Fuzz evidence requires --report <file>.");
    const report = readJson(artifact);
    if (!report) throw new Error("The fuzz report must contain valid JSON.");
    const evidence = normalizeFuzzCampaign(report);
    evidence.artifact = path.relative(cwd, artifact);
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    if (evidence.decision === "invalid-evidence") process.exitCode = 1;
    if (evidence.decision === "crash-observed") process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function chaosWorkflow() {
  const action = argv[1];
  try {
    if (action === "init") {
      const output = value("--output");
      if (!output) throw new Error("Chaos initialization requires --output <file>.");
      const absolute = outputPath(output);
      if (fs.existsSync(absolute) && !has("--force")) {
        throw new Error(`Refusing to overwrite existing file: ${output}`);
      }
      const experiment = chaosTemplate(
        value("--system"),
        value("--revision") || gitInfo().revision,
        value("--created-at") || new Date().toISOString().slice(0, 10),
      );
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, `${JSON.stringify(experiment, null, 2)}\n`, {
        mode: 0o600,
      });
      console.log(`Chaos experiment template: ${output}`);
      console.log("Status: incomplete");
      return;
    }
    const artifact = evidenceArtifact("--file");
    if (!artifact) throw new Error(`Chaos ${action} requires --file <file>.`);
    const document = readJson(artifact);
    if (!document) throw new Error("The chaos file must contain valid JSON.");
    const report = action === "validate"
      ? validateChaosExperiment(document)
      : action === "result"
        ? normalizeChaosResult(document)
        : null;
    if (!report) throw new Error("Use chaos init, chaos validate, or chaos result.");
    report.artifact = path.relative(cwd, artifact);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (["incomplete", "invalid-evidence"].includes(report.decision)) {
      process.exitCode = 1;
    }
    if (report.decision === "weakness-observed") process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function formalizeWorkflow() {
  const action = argv[1];
  try {
    if (action === "init") {
      const output = value("--output");
      if (!output) {
        throw new Error("Formal-model initialization requires --output <file>.");
      }
      const absolute = outputPath(output);
      if (fs.existsSync(absolute) && !has("--force")) {
        throw new Error(`Refusing to overwrite existing file: ${output}`);
      }
      const model = formalModelTemplate(
        value("--system"),
        value("--revision") || gitInfo().revision,
        value("--created-at") || new Date().toISOString().slice(0, 10),
      );
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, `${JSON.stringify(model, null, 2)}\n`, {
        mode: 0o600,
      });
      console.log(`Formal-model template: ${output}`);
      console.log("Status: incomplete");
      return;
    }
    const artifact = evidenceArtifact("--file");
    if (!artifact) throw new Error(`Formalize ${action} requires --file <file>.`);
    const document = readJson(artifact);
    if (!document) throw new Error("The formalize file must contain valid JSON.");
    const report = action === "validate"
      ? validateFormalModel(document)
      : action === "result"
        ? normalizeModelCheckResult(document)
        : null;
    if (!report) {
      throw new Error("Use formalize init, formalize validate, or formalize result.");
    }
    report.artifact = path.relative(cwd, artifact);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (["incomplete", "invalid-evidence"].includes(report.decision)) {
      process.exitCode = 1;
    }
    if (report.decision === "property-violation") process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function findExecutable(executable) {
  if (executable.includes(path.sep)) {
    return fs.existsSync(executable) ? executable : null;
  }
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, executable);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Continue to the next PATH entry.
    }
  }
  return null;
}

function doctor() {
  const project = detectProject();
  const adapters = [
    ...project.checks,
    ...project.dependency_checks,
    ...project.security_checks,
  ];
  const tools = adapters.map((adapter) => ({
    id: adapter.id,
    ecosystem: adapter.ecosystem,
    kind: adapter.kind,
    executable: adapter.executable,
    available: Boolean(findExecutable(adapter.executable)),
    network: Boolean(adapter.network),
    evidence_class: "observed",
  }));
  const configFile = path.join(cwd, ".rivet", "config.json");
  const configExists = fs.existsSync(configFile);
  const config = configExists ? readJson(configFile) : null;
  const issues = [];
  if (!gitInfo().available) {
    issues.push({
      severity: "warning",
      id: "git-unavailable",
      statement: "Git revision evidence is unavailable.",
    });
  }
  if (!project.context.length) {
    issues.push({
      severity: "warning",
      id: "context-missing",
      statement: "No recognized project context file was detected.",
    });
  }
  if (configExists && !config) {
    issues.push({
      severity: "error",
      id: "invalid-config",
      statement: ".rivet/config.json is not valid JSON.",
    });
  }
  for (const tool of tools.filter((item) => !item.available)) {
    issues.push({
      severity: "warning",
      id: "tool-unavailable",
      tool: tool.id,
      statement: `The declared executable '${tool.executable}' is unavailable.`,
    });
  }
  const report = {
    schema: 1,
    workflow: "doctor",
    evidence_class: "observed",
    target: cwd,
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    context_files: project.context,
    config: configExists ? (config ? "valid" : "invalid") : "absent",
    tools,
    issues,
    decision: issues.some((item) => item.severity === "error")
      ? "not-ready"
      : issues.length
        ? "ready-with-limitations"
        : "ready",
    limitations: [
      "Executable discovery does not prove that a tool is correctly configured.",
      "Network, credentials, database access, and host approval behavior were not tested.",
    ],
  };
  if (has("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`Rivet doctor: ${report.decision}`);
    console.log(`Config: ${report.config}`);
    for (const tool of tools) {
      console.log(`- ${tool.id}: ${tool.available ? "available" : "unavailable"}`);
    }
    for (const issue of issues) console.log(`- ${issue.severity}: ${issue.statement}`);
    for (const limitation of report.limitations) console.log(`- ${limitation}`);
  }
  if (report.decision === "not-ready") process.exitCode = 2;
}

function databaseEvidence() {
  const migration = value("--migration");
  const plan = value("--plan");
  if (Boolean(migration) === Boolean(plan)) {
    console.error("Use exactly one of --migration <file> or --plan <file>.");
    process.exitCode = 1;
    return;
  }
  try {
    const artifact = path.resolve(cwd, migration || plan);
    if (!artifact.startsWith(`${cwd}${path.sep}`) || !fs.existsSync(artifact)) {
      throw new Error("The database artifact must be an existing file inside the project.");
    }
    const report = migration
      ? inspectPostgresMigration(artifact)
      : inspectPostgresPlan(artifact, value("--query") || "unspecified");
    report.artifact = path.relative(cwd, artifact);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.decision !== "pass") process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
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
    workflow: "impact",
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

function testSelection() {
  const flakeReports = value("--flake-reports");
  if (flakeReports) {
    const files = flakeReports
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => path.resolve(cwd, item));
    if (
      files.some(
        (file) =>
          !file.startsWith(`${cwd}${path.sep}`) || !fs.existsSync(file),
      )
    ) {
      console.error("Each flake report must be an existing file inside the project.");
      process.exitCode = 1;
      return;
    }
    try {
      const report = detectFlakes(files);
      report.artifacts = files.map((file) => path.relative(cwd, file));
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.decision === "flakes-observed") process.exitCode = 2;
      if (report.decision === "insufficient-evidence") process.exitCode = 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
    return;
  }
  const artifactOptions = [
    ["--coverage-report", "coverage"],
    ["--mutation-report", "mutation"],
    ["--property-report", "property"],
    ["--contract-report", "contract"],
  ].filter(([flag]) => value(flag));
  if (artifactOptions.length) {
    if (artifactOptions.length !== 1) {
      console.error("Use one test evidence report at a time.");
      process.exitCode = 1;
      return;
    }
    const [flag, kind] = artifactOptions[0];
    const absolute = path.resolve(cwd, value(flag));
    if (!absolute.startsWith(`${cwd}${path.sep}`) || !fs.existsSync(absolute)) {
      console.error("The test evidence artifact must be an existing file inside the project.");
      process.exitCode = 1;
      return;
    }
    try {
      const report =
        kind === "coverage"
          ? normalizeCoverage(absolute)
          : kind === "mutation"
            ? normalizeMutation(absolute)
            : normalizeJunit(absolute, kind);
      report.artifact = path.relative(cwd, absolute);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (["fail", "test-gaps"].includes(report.decision)) process.exitCode = 2;
      if (report.decision === "insufficient-evidence") process.exitCode = 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
    return;
  }
  const files = changedFiles();
  const project = detectProject();
  const impact = topologyImpact(discoverTopology(cwd), files);
  const componentPaths = new Set(
    discoverTopology(cwd).components
      .filter((item) => impact.affected_components.includes(item.id))
      .map((item) => item.path),
  );
  const selected = project.checks.filter((check) => {
    if ((check.working_directory || ".") === ".") return true;
    return componentPaths.has(check.working_directory);
  });
  const recordPath = value("--record");
  let record = null;
  if (recordPath) {
    const absolute = path.resolve(cwd, recordPath);
    if (!absolute.startsWith(`${cwd}${path.sep}`) || !fs.existsSync(absolute)) {
      console.error("The change record must be an existing file inside the project.");
      process.exitCode = 1;
      return;
    }
    record = extractChangeRecord(absolute);
    record.source = path.relative(cwd, absolute);
  }
  const risk = classifyRisk(files);
  const report = {
    schema: 1,
    workflow: "test-selection",
    evidence_class: "derived",
    files,
    affected_components: impact.affected_components,
    selected_checks: selected.map((check) => ({
      id: check.id,
      ecosystem: check.ecosystem,
      working_directory: check.working_directory || ".",
      source: check.source,
    })),
    risks: risk,
    record,
    test_families: testFamilies(risk.mode, record),
    missing_inputs: record
      ? [
          !record.target.length ? "Required behavior is missing from the change record." : null,
          !record.invariants.length ? "No invariant was recorded." : null,
          !record.failure_cases.length ? "No threat or failure case was recorded." : null,
        ].filter(Boolean)
      : ["No change record was supplied. Rivet did not infer product behavior."],
    limitations: [
      "Selection uses declared package dependencies and changed paths.",
      "Runtime calls, dynamic imports, generated code, and external consumers can require additional tests.",
      "A selected check is not evidence until it runs.",
    ],
  };
  if (has("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  console.log("Rivet test selection");
  console.log(`Affected components: ${report.affected_components.join(", ") || "none observed"}`);
  for (const check of report.selected_checks) {
    console.log(`- ${check.id} (${check.working_directory})`);
  }
  console.log("Test families:");
  for (const family of report.test_families) {
    console.log(`- ${family.id}: ${family.purpose}`);
  }
  for (const missing of report.missing_inputs) console.log(`- missing: ${missing}`);
  for (const limitation of report.limitations) console.log(`- ${limitation}`);
}

function prepareReview() {
  const action = argv[1];
  if (action === "run" || action === "ingest") {
    reviewResultWorkflow(action);
    return;
  }
  const recordPath = value("--record");
  if (!recordPath) {
    console.error("Independent review requires --record <file>.");
    process.exitCode = 1;
    return;
  }
  const absoluteRecord = path.resolve(cwd, recordPath);
  if (
    !absoluteRecord.startsWith(`${cwd}${path.sep}`) ||
    !fs.existsSync(absoluteRecord)
  ) {
    console.error("The change record must be an existing file inside the project.");
    process.exitCode = 1;
    return;
  }
  const files = changedFiles();
  const topology = discoverTopology(cwd);
  const impact = topologyImpact(topology, files);
  const risk = classifyRisk(files);
  const diffResult = files.length
    ? run("git", ["diff", "--no-ext-diff", "--unified=3", "--", ...files])
    : { status: 0, stdout: "", stderr: "" };
  const packet = reviewPacket({
    record: extractChangeRecord(absoluteRecord),
    files,
    affectedComponents: impact.affected_components,
    risk,
    diff: redact(diffResult.stdout || "").slice(0, 200000),
    revision: gitInfo().revision,
  });
  const output = value("--output");
  if (output) {
    const absolute = outputPath(output);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    const body = output.endsWith(".json")
      ? `${JSON.stringify(packet, null, 2)}\n`
      : reviewMarkdown(packet);
    fs.writeFileSync(absolute, body, { mode: 0o600 });
    console.log(`Independent review packet: ${output}`);
    console.log("Status: prepared-not-reviewed");
    return;
  }
  if (has("--json")) {
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
  } else {
    process.stdout.write(reviewMarkdown(packet));
  }
}

function reviewPacketArtifact() {
  const artifact = evidenceArtifact("--packet");
  if (!artifact) throw new Error("Review requires --packet <json-file>.");
  const packet = readJson(artifact);
  if (
    !packet ||
    packet.schema !== 1 ||
    packet.workflow !== "independent-review" ||
    packet.status !== "prepared-not-reviewed"
  ) {
    throw new Error("The review packet must be a prepared Rivet JSON packet.");
  }
  return { artifact, packet };
}

function parseClaudeReviewOutput(output) {
  const envelope = JSON.parse(output);
  if (envelope.structured_output) return envelope.structured_output;
  if (typeof envelope.result === "string") return JSON.parse(envelope.result);
  if (envelope.verdict) return envelope;
  throw new Error("Claude Code returned no structured review findings.");
}

function reviewResultWorkflow(action) {
  try {
    const { artifact: packetArtifact, packet } = reviewPacketArtifact();
    if (action === "ingest") {
      const findingsArtifact = evidenceArtifact("--findings");
      if (!findingsArtifact) {
        throw new Error("Review ingestion requires --findings <json-file>.");
      }
      const findings = readJson(findingsArtifact);
      if (!findings) throw new Error("The review findings must contain valid JSON.");
      const report = validateReviewFindings(packet, findings);
      report.sources = {
        packet: path.relative(cwd, packetArtifact),
        findings: path.relative(cwd, findingsArtifact),
      };
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.decision === "invalid-findings") process.exitCode = 1;
      if (report.decision === "review-findings") process.exitCode = 2;
      return;
    }

    const provider = value("--provider");
    if (!["codex", "claude"].includes(provider)) {
      throw new Error("Native review requires --provider codex or --provider claude.");
    }
    if (!has("--allow-network")) {
      throw new Error("Native review requires explicit --allow-network.");
    }
    const output = value("--output");
    if (!output) throw new Error("Native review requires --output <json-file>.");
    const outputArtifact = outputPath(output);
    if (fs.existsSync(outputArtifact) && !has("--force")) {
      throw new Error(`Refusing to overwrite existing file: ${output}`);
    }

    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-review-"));
    let result;
    let findings;
    let command;
    try {
      const prompt = reviewPrompt(packet);
      if (provider === "codex") {
        const schemaFile = path.join(temporary, "review-schema.json");
        const responseFile = path.join(temporary, "review-findings.json");
        fs.writeFileSync(schemaFile, JSON.stringify(reviewFindingsSchema), {
          mode: 0o600,
        });
        command = [
          "codex",
          "exec",
          "--sandbox",
          "read-only",
          "--ephemeral",
          "--skip-git-repo-check",
          "--color",
          "never",
          "--output-schema",
          schemaFile,
          "--output-last-message",
          responseFile,
          "-",
        ];
        result = run(command[0], command.slice(1), {
          cwd: temporary,
          input: prompt,
          timeout: 600000,
        });
        if (result.status === 0) findings = readJson(responseFile);
      } else {
        command = [
          "claude",
          "--print",
          "--bare",
          "--no-session-persistence",
          "--tools",
          "",
          "--permission-mode",
          "plan",
          "--output-format",
          "json",
          "--json-schema",
          JSON.stringify(reviewFindingsSchema),
        ];
        result = run(command[0], command.slice(1), {
          cwd: temporary,
          input: prompt,
          timeout: 600000,
        });
        if (result.status === 0) {
          findings = parseClaudeReviewOutput(result.stdout);
        }
      }
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
    if (result.error?.code === "ENOENT") {
      throw new Error(`The ${provider} CLI is unavailable.`);
    }
    if (result.status !== 0) {
      throw new Error(
        `${provider} review failed with exit ${result.status}: ${redact(combinedOutput(result)).slice(-2000)}`,
      );
    }
    if (!findings) throw new Error(`${provider} returned no valid JSON findings.`);
    const report = validateReviewFindings(packet, findings);
    report.evidence_class = "observed";
    report.reviewer = {
      provider,
      command_digest: digest(JSON.stringify(command)),
      isolation: provider === "codex"
        ? "temporary-directory, ephemeral, read-only"
        : "temporary-directory, bare, no-session, no-tools",
    };
    report.sources = { packet: path.relative(cwd, packetArtifact) };
    fs.mkdirSync(path.dirname(outputArtifact), { recursive: true });
    fs.writeFileSync(outputArtifact, `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.decision === "invalid-findings") process.exitCode = 1;
    if (report.decision === "review-findings") process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function evidenceArtifact(flag) {
  const relative = value(flag);
  if (!relative) return null;
  const absolute = path.resolve(cwd, relative);
  if (!absolute.startsWith(`${cwd}${path.sep}`) || !fs.existsSync(absolute)) {
    throw new Error("The evidence artifact must be an existing file inside the project.");
  }
  return absolute;
}

function securityEvidence() {
  try {
    if (has("--run")) {
      const adapters = discoverSecurityAdapters(cwd);
      if (has("--dry-run")) {
        runAdapters(adapters, "security");
        return;
      }
      if (!has("--allow-network")) {
        throw new Error(
          "Security command execution requires explicit --allow-network.",
        );
      }
      runAdapters(adapters, "security");
      return;
    }
    const reachability = value("--reachability");
    if (reachability) {
      const findings = evidenceArtifact("--reachability");
      const evidence = evidenceArtifact("--evidence");
      if (!evidence) {
        throw new Error("Reachability requires --reachability and --evidence.");
      }
      const report = applyReachability(findings, evidence);
      report.sources.findings = path.relative(cwd, findings);
      report.sources.reachability = path.relative(cwd, evidence);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.decision === "invalid-evidence") process.exitCode = 2;
      if (report.decision === "incomplete") process.exitCode = 1;
      return;
    }
    const enrichment = value("--enrich");
    if (enrichment) {
      const findings = evidenceArtifact("--enrich");
      const kev = evidenceArtifact("--kev");
      const epss = evidenceArtifact("--epss");
      const retrievedAt = value("--retrieved-at");
      if (!kev || !epss || !retrievedAt) {
        throw new Error(
          "Enrichment requires --enrich, --kev, --epss, and --retrieved-at.",
        );
      }
      const report = enrichVulnerabilities(
        findings,
        kev,
        epss,
        retrievedAt,
      );
      report.sources.findings = path.relative(cwd, findings);
      report.sources.kev.artifact = path.relative(cwd, kev);
      report.sources.epss.artifact = path.relative(cwd, epss);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.decision === "insufficient-evidence") process.exitCode = 1;
      return;
    }
    const sarif = evidenceArtifact("--sarif");
    const trivy = evidenceArtifact("--trivy");
    if (Boolean(sarif) === Boolean(trivy)) {
      throw new Error("Use exactly one of --sarif <file> or --trivy <file>.");
    }
    const report = sarif ? normalizeSarif(sarif) : normalizeTrivy(trivy);
    report.artifact = path.relative(cwd, sarif || trivy);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.decision === "review-findings") process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function sbomEvidence() {
  try {
    const artifact = evidenceArtifact("--file");
    const revision = value("--revision");
    if (!artifact || !revision) {
      throw new Error("SBOM verification requires --file <file> and --revision <value>.");
    }
    const report = normalizeSbom(artifact, revision);
    report.artifact = path.relative(cwd, artifact);
    if (has("--validate-schema")) {
      let validator;
      let args;
      if (report.format === "CycloneDX") {
        validator = findExecutable("cyclonedx") || findExecutable("cyclonedx-cli");
        const version = String(report.format_version || "").replace(".", "_");
        args = [
          "validate",
          "--input-file",
          artifact,
          "--input-version",
          `v${version}`,
          "--fail-on-errors",
        ];
      } else if (["SPDX-2.2", "SPDX-2.3"].includes(report.format_version)) {
        validator = findExecutable("pyspdxtools");
        args = ["-i", artifact];
      } else {
        report.schema_validation = {
          result: "unsupported",
          tool: null,
          output: "",
          reason: `No configured full validator supports ${report.format_version || "this version"}.`,
        };
      }
      if (args) {
        if (!validator) {
          report.schema_validation = {
            result: "unavailable",
            tool: report.format === "CycloneDX" ? "cyclonedx" : "pyspdxtools",
            output: "",
            reason: "The required official validator is not installed.",
          };
        } else {
          const result = run(validator, args);
          report.schema_validation = {
            result: result.status === 0 ? "valid" : "invalid",
            tool: path.basename(validator),
            tool_version: toolVersion(validator),
            command_digest: digest(JSON.stringify([validator, ...args])),
            exit_code: Number.isInteger(result.status) ? result.status : null,
            output: redact(combinedOutput(result)).slice(-12000),
            reason: result.status === 0 ? null : "The official validator rejected the SBOM.",
          };
        }
      }
    }
    const signatureMode = value("--signature");
    if (signatureMode) {
      let executable;
      let args;
      if (signatureMode === "embedded") {
        if (report.format !== "CycloneDX") {
          throw new Error("Embedded signature verification is supported only for CycloneDX.");
        }
        const key = evidenceArtifact("--key-file");
        if (!key) {
          throw new Error("Embedded signature verification requires --key-file <file>.");
        }
        executable = findExecutable("cyclonedx") || findExecutable("cyclonedx-cli");
        args = ["verify", "all", artifact, "--key-file", key];
      } else if (signatureMode === "sigstore") {
        const bundle = evidenceArtifact("--bundle");
        const identity = value("--identity");
        const issuer = value("--issuer");
        if (!bundle || !identity || !issuer) {
          throw new Error(
            "Sigstore SBOM verification requires --bundle, --identity, and --issuer.",
          );
        }
        executable = findExecutable("cosign");
        args = [
          "verify-blob",
          "--bundle",
          bundle,
          "--certificate-identity",
          identity,
          "--certificate-oidc-issuer",
          issuer,
          artifact,
        ];
      } else if (signatureMode === "cosign-key") {
        const bundle = evidenceArtifact("--bundle");
        const key = evidenceArtifact("--key-file");
        if (!bundle || !key) {
          throw new Error(
            "Cosign key verification requires --bundle and --key-file.",
          );
        }
        executable = findExecutable("cosign");
        args = [
          "verify-blob",
          "--key",
          key,
          "--bundle",
          bundle,
          "--insecure-ignore-tlog",
          artifact,
        ];
      } else {
        throw new Error(
          "Use --signature embedded, --signature sigstore, or --signature cosign-key.",
        );
      }
      if (!executable) {
        report.signature_validation = {
          result: "unavailable",
          tool: signatureMode === "embedded" ? "cyclonedx" : "cosign",
          mode: signatureMode,
          output: "",
          reason: "The required signature verifier is not installed.",
        };
      } else {
        const result = run(executable, args);
        report.signature_validation = {
          result: result.status === 0 ? "valid" : "invalid",
          tool: path.basename(executable),
          tool_version: toolVersion(executable),
          mode: signatureMode,
          command_digest: digest(JSON.stringify([executable, ...args])),
          exit_code: Number.isInteger(result.status) ? result.status : null,
          output: redact(combinedOutput(result)).slice(-12000),
          reason: result.status === 0 ? null : "The signature verifier rejected the SBOM.",
        };
      }
    }
    const requestedChecks = [
      has("--validate-schema") ? report.schema_validation : null,
      signatureMode ? report.signature_validation : null,
    ].filter(Boolean);
    if (requestedChecks.some((item) => ["invalid"].includes(item.result))) {
      report.decision = "fail";
    } else if (
      requestedChecks.some((item) =>
        ["unavailable", "unsupported"].includes(item.result),
      )
    ) {
      report.decision = "insufficient-evidence";
    } else if (
      requestedChecks.length &&
      requestedChecks.every((item) => item.result === "valid")
    ) {
      report.decision = "verified";
    }
    report.limitations.push(
      "Structural parsing is not full schema validation unless schema_validation.result is valid.",
      "A valid signature proves artifact integrity and signer identity under the verifier policy. It does not prove SBOM completeness.",
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.decision === "insufficient-evidence") process.exitCode = 1;
    if (report.decision === "fail") process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function waiverWorkflow() {
  const action = argv[1];
  try {
    if (action === "init") {
      const output = value("--output");
      if (!output) throw new Error("Waiver initialization requires --output <file>.");
      const createdAt = value("--created-at") || new Date().toISOString().slice(0, 10);
      const absolute = outputPath(output);
      if (fs.existsSync(absolute) && !has("--force")) {
        throw new Error(`Refusing to overwrite existing file: ${output}`);
      }
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(
        absolute,
        `${JSON.stringify(waiverTemplate(value("--finding"), createdAt), null, 2)}\n`,
        { mode: 0o600 },
      );
      console.log(`Waiver template: ${output}`);
      console.log("Status: incomplete");
      return;
    }
    if (action === "validate") {
      const artifact = evidenceArtifact("--file");
      if (!artifact) throw new Error("Waiver validation requires --file <file>.");
      const asOf = value("--as-of") || new Date().toISOString().slice(0, 10);
      const report = validateWaiver(artifact, asOf);
      report.artifact = path.relative(cwd, artifact);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.decision !== "valid") process.exitCode = 2;
      return;
    }
    throw new Error("Use waiver init or waiver validate.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function attestWorkflow() {
  const action = argv[1] || "plan";
  try {
    const artifact = evidenceArtifact("--artifact");
    const bundleValue = value("--bundle");
    if (!artifact || !bundleValue) {
      throw new Error("Attestation requires --artifact <file> and --bundle <file>.");
    }
    const bundle = path.resolve(cwd, bundleValue);
    if (!bundle.startsWith(`${cwd}${path.sep}`)) {
      throw new Error("The attestation bundle must be inside the project.");
    }
    const plan = cosignPlan({
      artifact: path.relative(cwd, artifact),
      bundle: path.relative(cwd, bundle),
      identity: value("--identity"),
      issuer: value("--issuer"),
    });
    plan.cosign_available = Boolean(findExecutable("cosign"));
    if (action === "plan") {
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
      return;
    }
    if (action === "sign" && !has("--allow-network")) {
      throw new Error("Keyless signing requires explicit --allow-network.");
    }
    if (action === "verify" && (!value("--identity") || !value("--issuer"))) {
      throw new Error("Verification requires --identity and --issuer.");
    }
    if (!["sign", "verify"].includes(action)) {
      throw new Error("Use attest plan, attest sign, or attest verify.");
    }
    const adapter = action === "sign" ? plan.sign : plan.verify;
    const args = adapter.args.map((item) => {
      if (item === plan.artifact) return artifact;
      if (item === plan.bundle) return bundle;
      return item;
    });
    const result = run(adapter.executable, args);
    const normalized = cosignResult(action, result);
    const report = {
      schema: 1,
      workflow: `attest-${action}`,
      evidence_class: "observed",
      artifact: plan.artifact,
      bundle: plan.bundle,
      identity: value("--identity") || null,
      issuer: value("--issuer") || null,
      command_digest: digest(JSON.stringify([adapter.executable, ...args])),
      ...normalized,
      output: redact(combinedOutput(result)).slice(-12000),
      limitations: plan.limitations,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!["signed", "verified"].includes(report.result)) {
      process.exitCode = report.result === "fail" ? 2 : 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function resilienceEvidence() {
  try {
    const trace = evidenceArtifact("--trace");
    if (trace) {
      const report = analyzeRuntimeRetries(trace);
      report.artifact = path.relative(cwd, trace);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.decision === "review-findings") process.exitCode = 2;
      if (report.decision === "insufficient-evidence") process.exitCode = 1;
      return;
    }
    const artifact = evidenceArtifact("--file");
    if (!artifact) throw new Error("Resilience analysis requires --file <file>.");
    const report = analyzeResilience(artifact);
    report.artifact = path.relative(cwd, artifact);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.decision === "review-findings") process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function migrationEvidence() {
  try {
    const plan = evidenceArtifact("--plan");
    const dryRun = evidenceArtifact("--dry-run");
    if (Boolean(plan) === Boolean(dryRun)) {
      throw new Error("Use exactly one of --plan <file> or --dry-run <file>.");
    }
    const report = plan
      ? validateMigrationPlan(plan)
      : validateMigrationDryRun(dryRun);
    report.artifact = path.relative(cwd, plan || dryRun);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!["valid", "observed"].includes(report.decision)) process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function observationEvidence() {
  try {
    const artifact = evidenceArtifact("--file");
    if (!artifact) throw new Error("Telemetry review requires --file <file>.");
    const report = analyzeTelemetry(artifact);
    report.artifact = path.relative(cwd, artifact);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.decision === "review-findings") process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function performanceEvidence() {
  try {
    const sampleMode = value("--sample-baseline") || value("--sample-candidate");
    const baseline = evidenceArtifact(
      sampleMode ? "--sample-baseline" : "--baseline",
    );
    const candidate = evidenceArtifact(
      sampleMode ? "--sample-candidate" : "--candidate",
    );
    if (!baseline || !candidate) {
      throw new Error(
        "Performance comparison requires --baseline <file> and --candidate <file>.",
      );
    }
    const report = sampleMode
      ? comparePerformanceSamples(baseline, candidate)
      : comparePerformance(baseline, candidate);
    report.baseline_artifact = path.relative(cwd, baseline);
    report.candidate_artifact = path.relative(cwd, candidate);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.decision === "invalid-comparison") process.exitCode = 2;
    if (report.decision === "insufficient-evidence") process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function releaseEvidence() {
  try {
    const plan = evidenceArtifact("--plan");
    if (!plan) throw new Error("Release evaluation requires --plan <file>.");
    const performance = value("--performance")
      ? evidenceArtifact("--performance")
      : null;
    const report = evaluateRelease(plan, performance);
    report.plan_artifact = path.relative(cwd, plan);
    report.performance_artifact = performance
      ? path.relative(cwd, performance)
      : null;
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (["invalid-plan", "hold"].includes(report.decision)) {
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function incidentWorkflow() {
  const action = argv[1];
  try {
    if (action === "init") {
      const output = value("--output");
      const id = value("--id");
      const declaredAt = value("--at");
      if (!output || !id || !declaredAt) {
        throw new Error("Incident initialization requires --id, --at, and --output.");
      }
      const absolute = outputPath(output);
      if (fs.existsSync(absolute) && !has("--force")) {
        throw new Error(`Refusing to overwrite existing file: ${output}`);
      }
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(
        absolute,
        `${JSON.stringify(incidentTemplate(id, declaredAt), null, 2)}\n`,
        { mode: 0o600 },
      );
      console.log(`Incident timeline: ${output}`);
      return;
    }
    const artifact = evidenceArtifact("--file");
    if (!artifact) throw new Error("Incident action requires --file <file>.");
    if (action === "validate") {
      const report = incidentReport(artifact);
      report.artifact = path.relative(cwd, artifact);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.decision !== "valid") process.exitCode = 2;
      return;
    }
    if (action === "add") {
      for (const flag of ["--at", "--actor", "--type", "--statement"]) {
        if (!value(flag)) throw new Error(`Incident add requires ${flag}.`);
      }
      const document = JSON.parse(fs.readFileSync(artifact, "utf8"));
      const updated = appendIncidentEvent(document, {
        at: value("--at"),
        actor: value("--actor"),
        type: value("--type"),
        statement: value("--statement"),
        mode: value("--mode") || "read",
        target: value("--target"),
        approval: value("--approval"),
        evidence: (value("--evidence") || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      fs.writeFileSync(artifact, `${JSON.stringify(updated, null, 2)}\n`, {
        mode: 0o600,
      });
      console.log(`Incident event: ${updated.events.length}`);
      console.log(`Mode: ${updated.events.at(-1).mode}`);
      return;
    }
    throw new Error("Use incident init, incident add, or incident validate.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function postmortemEvidence() {
  try {
    const incident = evidenceArtifact("--incident");
    if (!incident) throw new Error("Postmortem generation requires --incident <file>.");
    const report = buildPostmortem(incident);
    report.incident_artifact = path.relative(cwd, incident);
    const output = value("--output");
    if (output) {
      const absolute = outputPath(output);
      if (fs.existsSync(absolute) && !has("--force")) {
        throw new Error(`Refusing to overwrite existing file: ${output}`);
      }
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(
        absolute,
        output.endsWith(".json")
          ? `${JSON.stringify(report, null, 2)}\n`
          : postmortemMarkdown(report),
        { mode: 0o600 },
      );
      console.log(`Postmortem draft: ${output}`);
      return;
    }
    if (has("--json")) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(postmortemMarkdown(report));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function actionWorkflow() {
  const action = argv[1];
  try {
    if (action === "init") {
      const output = value("--output");
      if (!output || !value("--id") || !value("--incident")) {
        throw new Error(
          "Action initialization requires --id, --incident, and --output.",
        );
      }
      const absolute = outputPath(output);
      if (fs.existsSync(absolute) && !has("--force")) {
        throw new Error(`Refusing to overwrite existing file: ${output}`);
      }
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(
        absolute,
        `${JSON.stringify(
          actionTemplate(
            value("--id"),
            value("--incident"),
            value("--created-at") || new Date().toISOString().slice(0, 10),
          ),
          null,
          2,
        )}\n`,
        { mode: 0o600 },
      );
      console.log(`Preventive action: ${output}`);
      return;
    }
    if (action === "validate") {
      const artifact = evidenceArtifact("--file");
      if (!artifact) throw new Error("Action validation requires --file <file>.");
      const report = validateAction(
        artifact,
        value("--as-of") || new Date().toISOString().slice(0, 10),
      );
      report.artifact = path.relative(cwd, artifact);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (report.decision === "invalid") process.exitCode = 2;
      if (report.decision === "overdue") process.exitCode = 1;
      return;
    }
    if (action === "sync") {
      const artifact = evidenceArtifact("--file");
      if (!artifact) throw new Error("Action synchronization requires --file <file>.");
      const provider = value("--provider");
      if (provider !== "github") {
        throw new Error("Action synchronization currently supports --provider github.");
      }
      const repository = value("--repo");
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || "")) {
        throw new Error("GitHub synchronization requires --repo owner/name.");
      }
      const actionRecord = readJson(artifact);
      if (!actionRecord) throw new Error("The preventive action must contain valid JSON.");
      const validation = validateAction(
        artifact,
        value("--as-of") || new Date().toISOString().slice(0, 10),
      );
      if (validation.decision === "invalid") {
        throw new Error("The preventive action must be valid before ticket synchronization.");
      }
      if (actionRecord.ticket?.number || actionRecord.ticket?.url) {
        throw new Error("The preventive action already has a synchronized ticket.");
      }
      const labels = (value("--labels") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const plan = githubIssuePlan(actionRecord, repository, labels);
      if (has("--dry-run")) {
        process.stdout.write(
          `${JSON.stringify({
            schema: 1,
            workflow: "ticket-sync",
            evidence_class: "planned",
            action: actionRecord.id,
            provider,
            repository,
            title: plan.title,
            labels,
            decision: "planned-not-executed",
            limitations: [
              "The plan does not create or update a ticket.",
              "Rivet does not infer a GitHub assignee from the preventive-action owner.",
            ],
          }, null, 2)}\n`,
        );
        return;
      }
      if (!has("--allow-network") || !has("--allow-write") || !value("--approval")) {
        throw new Error(
          "Ticket synchronization requires --allow-network, --allow-write, and --approval.",
        );
      }
      const result = run(plan.executable, plan.args, {
        input: plan.body,
        timeout: 120000,
      });
      if (result.error?.code === "ENOENT") throw new Error("The GitHub CLI is unavailable.");
      if (result.status !== 0) {
        throw new Error(
          `GitHub issue creation failed with exit ${result.status}: ${redact(combinedOutput(result)).slice(-2000)}`,
        );
      }
      const ticket = parseGithubIssue(combinedOutput(result));
      actionRecord.ticket = {
        provider,
        repository,
        number: ticket.number,
        url: ticket.url,
        synced_at: value("--synced-at") || new Date().toISOString(),
        approval: value("--approval"),
      };
      fs.writeFileSync(artifact, `${JSON.stringify(actionRecord, null, 2)}\n`, {
        mode: 0o600,
      });
      process.stdout.write(
        `${JSON.stringify({
          schema: 1,
          workflow: "ticket-sync",
          evidence_class: "observed",
          action: actionRecord.id,
          provider,
          repository,
          ticket,
          approval: value("--approval"),
          decision: "created",
          limitations: [
            "Rivet created the issue but did not verify project, milestone, or assignee policy.",
            "Future issue status changes require separate synchronization evidence.",
          ],
        }, null, 2)}\n`,
      );
      return;
    }
    throw new Error("Use action init, action validate, or action sync.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function evaluationEvidence() {
  try {
    const fixtures = value("--fixtures");
    const findings = evidenceArtifact("--findings");
    if (!fixtures || !findings) {
      throw new Error("Evaluation requires --fixtures <directory> and --findings <file>.");
    }
    const fixturesRoot = path.resolve(cwd, fixtures);
    if (
      !fixturesRoot.startsWith(`${cwd}${path.sep}`) ||
      !fs.existsSync(fixturesRoot) ||
      !fs.statSync(fixturesRoot).isDirectory()
    ) {
      throw new Error("The fixtures directory must exist inside the project.");
    }
    const report = evaluateFindings(fixturesRoot, findings);
    report.fixtures = path.relative(cwd, fixturesRoot);
    report.findings = path.relative(cwd, findings);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.decision === "gaps-observed") process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function markdownSummary(receipt) {
  const lines = [
    "# Rivet verification",
    "",
    `Decision: **${receipt.decision}**`,
    "",
    `Revision: \`${receipt.revision || "unavailable"}\``,
    "",
    "## Checks",
    "",
    "| Check | Ecosystem | Result | Exit | Duration |",
    "|---|---|---|---:|---:|",
  ];
  if (!receipt.results.length) {
    lines.push("| None | — | insufficient evidence | — | — |");
  }
  for (const result of receipt.results) {
    lines.push(
      `| ${result.id} | ${result.ecosystem || "—"} | ${result.result} | ${result.exit_code ?? "—"} | ${result.duration_ms ?? "—"} ms |`,
    );
  }
  lines.push("", "## Limitations", "");
  for (const limitation of receipt.limitations) lines.push(`- ${limitation}`);
  return `${lines.join("\n")}\n`;
}

function githubEscape(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

function githubOutput(receipt) {
  for (const result of receipt.results) {
    if (result.result === "pass") {
      console.log(
        `::notice title=Rivet ${githubEscape(result.id)}::Check passed`,
      );
    } else if (result.result === "unavailable") {
      console.log(
        `::warning title=Rivet ${githubEscape(result.id)}::Check unavailable`,
      );
    } else {
      console.log(
        `::error title=Rivet ${githubEscape(result.id)}::Check ${githubEscape(result.result)}`,
      );
    }
  }
  console.log(
    `::${receipt.decision === "pass" ? "notice" : receipt.decision === "fail" ? "error" : "warning"} title=Rivet verification::Decision ${githubEscape(receipt.decision)}`,
  );
}

function verify() {
  const project = detectProject();
  const requested = (value("--checks") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const selected = requested.length
    ? project.checks.filter(
        (check) =>
          requested.includes(check.id) ||
          requested.includes(check.base_id),
      )
    : project.checks;

  const unavailable = requested.filter(
    (id) =>
      !project.checks.some(
        (check) => check.id === id || check.base_id === id,
      ),
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
    const workingDirectory = path.resolve(cwd, check.working_directory || ".");
    const result = run(check.executable, check.args, { cwd: workingDirectory });
    results.push({
      adapter_schema: check.schema,
      id: check.id,
      ecosystem: check.ecosystem,
      working_directory: check.working_directory || ".",
      command: [check.executable, ...check.args],
      tool_version: toolVersion(check.executable),
      command_digest: digest(
        JSON.stringify([check.executable, ...check.args]),
      ),
      configuration_digest: configurationDigest(check.source),
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
      tool_version: null,
      command_digest: null,
      configuration_digest: null,
      reason: "No detected repository check has this identifier.",
    });
  }

  const receipt = {
    schema: 1,
    workflow: "verify",
    evidence_class: "observed",
    target: cwd,
    revision: gitInfo().revision,
    environment: {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
    },
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
    const absolute = outputPath(receiptPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `${JSON.stringify(receipt, null, 2)}\n`, {
      mode: 0o600,
    });
  }

  const summaryPath = value("--summary");
  if (summaryPath) {
    const absolute = outputPath(summaryPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, markdownSummary(receipt), { mode: 0o600 });
  }

  const format = value("--format");
  if (format === "github") {
    githubOutput(receipt);
  } else if (has("--json") || format === "json") {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } else {
    console.log(`Verification decision: ${receipt.decision}`);
    for (const result of results) {
      const duration =
        result.duration_ms === undefined ? "" : ` (${result.duration_ms} ms)`;
      console.log(`- ${result.id}: ${result.result}${duration}`);
    }
    if (receiptPath) console.log(`Receipt: ${receiptPath}`);
    if (summaryPath) console.log(`Summary: ${summaryPath}`);
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
} else if (command === "impact" || command === "change") {
  changeAnalysis();
} else if (command === "shape" || command === "record") {
  changeRecord();
} else if (command === "secrets") {
  secretScan();
} else if (command === "dependencies") {
  dependencyAudit();
} else if (command === "database") {
  databaseEvidence();
} else if (command === "doctor") {
  doctor();
} else if (command === "verify") {
  verify();
} else if (command === "test") {
  testSelection();
} else if (command === "contract") {
  contractEvidence();
} else if (command === "threat-model") {
  threatModelWorkflow();
} else if (command === "stateful") {
  statefulWorkflow();
} else if (command === "fuzz") {
  fuzzEvidence();
} else if (command === "chaos") {
  chaosWorkflow();
} else if (command === "formalize") {
  formalizeWorkflow();
} else if (command === "review") {
  prepareReview();
} else if (command === "security") {
  securityEvidence();
} else if (command === "sbom") {
  sbomEvidence();
} else if (command === "waiver") {
  waiverWorkflow();
} else if (command === "attest") {
  attestWorkflow();
} else if (command === "resilience") {
  resilienceEvidence();
} else if (command === "migrate") {
  migrationEvidence();
} else if (command === "observe") {
  observationEvidence();
} else if (command === "performance") {
  performanceEvidence();
} else if (command === "release") {
  releaseEvidence();
} else if (command === "incident") {
  incidentWorkflow();
} else if (command === "postmortem") {
  postmortemEvidence();
} else if (command === "action") {
  actionWorkflow();
} else if (command === "evaluate") {
  evaluationEvidence();
} else {
  console.error(`Unknown command: ${command}`);
  console.error(
    "Use: init [--force] | map [--json] | inspect [--json] | impact [--files list] [--json] | shape [--title value] [--files list] [--output path] [--force] | secrets [--files list] [--json] | dependencies [--dry-run] | database (--migration file | --plan file [--query id]) | test [--files list] [--record file] [--coverage-report file | --mutation-report file | --property-report file | --contract-report file | --flake-reports file1,file2] [--json] | stateful (init | validate) | fuzz --report file | chaos (init | validate | result) | formalize (init | validate | result) | contract (--dry-run | --report file | --target url --allow-network [--allow-nonlocal-target]) | review [--record file | run --packet file --provider codex|claude --output file --allow-network | ingest --packet file --findings file] | threat-model (init | validate) | security (--run [--dry-run] [--allow-network] | --sarif file | --trivy file | --enrich findings --kev snapshot --epss snapshot --retrieved-at date | --reachability findings --evidence record) | sbom --file file --revision value [--validate-schema] [--signature embedded|sigstore|cosign-key] | waiver (init | validate) | attest (plan | sign | verify) | resilience (--file model.json | --trace spans.json) | migrate (--plan file | --dry-run file) | observe --file telemetry.json | performance (--baseline file --candidate file | --sample-baseline file --sample-candidate file) | release --plan file [--performance comparison.json] | incident (init | add | validate) | postmortem --incident file [--output file] | action (init | validate | sync) | evaluate --fixtures dir --findings file | verify [--dry-run] [--checks list] [--receipt path] [--summary path] [--format text|json|github] | doctor [--json]. Compatibility aliases: change=impact, record=shape.",
  );
  process.exitCode = 1;
}


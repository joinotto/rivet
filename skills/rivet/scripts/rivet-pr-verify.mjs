#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const cwd = process.cwd();
const base = process.env.RIVET_BASE_SHA || "";
const head = process.env.RIVET_HEAD_SHA || "";
const outputRoot = path.resolve(cwd, process.env.RIVET_REPORT_DIR || ".rivet/ci");
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(scriptRoot, "rivet-evidence.mjs");
const reportVerificationRoot =
  process.argv[2] === "verify-report" ? process.argv[3] : null;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function validRevision(value) {
  return /^[a-f0-9]{40,64}$/.test(value);
}

function run(executable, args, options = {}) {
  return spawnSync(executable, args, {
    cwd,
    encoding: options.binary ? undefined : "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: options.stdio || "pipe",
  });
}

function markdownCell(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "\\|")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ");
}

function inlineCode(value) {
  return `\`${markdownCell(value).replaceAll("`", "&#96;")}\``;
}

function fileEvidence(file) {
  const body = fs.readFileSync(file);
  return {
    path: path.basename(file),
    size: body.length,
    sha256: crypto.createHash("sha256").update(body).digest("hex"),
  };
}

function readRegularFile(file) {
  let descriptor;
  try {
    descriptor = fs.openSync(
      file,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
    );
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024) {
      throw new Error(`Evidence is not a bounded regular file: ${path.basename(file)}`);
    }
    return fs.readFileSync(descriptor);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function verifyReport(directory) {
  if (!directory) throw new Error("Use verify-report <report-directory>.");
  const root = fs.realpathSync(path.resolve(cwd, directory));
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    throw new Error("The report path must be a readable directory.");
  }
  if (entries.some((entry) => !entry.isFile())) {
    throw new Error("The report directory must contain regular files only.");
  }
  const manifestFile = path.join(root, "manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(readRegularFile(manifestFile).toString("utf8"));
  } catch {
    throw new Error("The report manifest must contain valid JSON.");
  }
  if (manifest?.schema !== 1 || manifest?.kind !== "rivet-pr-report-manifest") {
    throw new Error("The report manifest schema or kind is unsupported.");
  }
  for (const revision of [
    manifest.base_revision,
    manifest.merge_base_revision,
    manifest.head_revision,
  ]) {
    if (!validRevision(revision)) {
      throw new Error("The report manifest contains an invalid revision.");
    }
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("The report manifest requires evidence files.");
  }
  const names = manifest.files.map((item) => item?.path);
  if (
    names.some(
      (name) =>
        typeof name !== "string" ||
        name !== path.basename(name) ||
        name === "manifest.json",
    ) ||
    new Set(names).size !== names.length
  ) {
    throw new Error("The report manifest contains an invalid or duplicate path.");
  }
  const expected = new Set(["manifest.json", ...names]);
  const observed = new Set(entries.map((entry) => entry.name));
  if (
    expected.size !== observed.size ||
    [...expected].some((name) => !observed.has(name))
  ) {
    throw new Error("The report directory inventory does not match the manifest.");
  }
  for (const item of manifest.files) {
    if (
      !Number.isSafeInteger(item.size) ||
      item.size < 0 ||
      !/^[a-f0-9]{64}$/.test(item.sha256 || "")
    ) {
      throw new Error(`The manifest evidence record is invalid: ${item.path}`);
    }
    const body = readRegularFile(path.join(root, item.path));
    const observedDigest = crypto
      .createHash("sha256")
      .update(body)
      .digest("hex");
    if (body.length !== item.size || observedDigest !== item.sha256) {
      throw new Error(`Report evidence verification failed: ${item.path}`);
    }
  }
  return {
    schema: 1,
    workflow: "pull-request-report-verification",
    evidence_class: "observed",
    base_revision: manifest.base_revision,
    merge_base_revision: manifest.merge_base_revision,
    head_revision: manifest.head_revision,
    files: manifest.files.length,
    decision: "pass",
  };
}

if (process.argv[2] === "verify-report") {
  try {
    process.stdout.write(`${JSON.stringify(verifyReport(reportVerificationRoot), null, 2)}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else {
if (!validRevision(base) || !validRevision(head)) {
  fail("RIVET_BASE_SHA and RIVET_HEAD_SHA must be full lowercase commit identifiers.");
}
if (
  outputRoot !== cwd &&
  !outputRoot.startsWith(`${cwd}${path.sep}`)
) {
  fail("RIVET_REPORT_DIR must be inside the project.");
}
if (!fs.existsSync(cli)) fail("The Rivet evidence CLI is unavailable.");

for (const revision of [base, head]) {
  const check = run("git", ["cat-file", "-e", `${revision}^{commit}`]);
  if (check.status !== 0) fail(`Git revision is unavailable: ${revision}`);
}

const checkedOut = run("git", ["rev-parse", "HEAD"]);
if (checkedOut.status !== 0 || checkedOut.stdout.trim() !== head) {
  fail("The checked-out revision does not match RIVET_HEAD_SHA.");
}

const mergeBaseResult = run("git", ["merge-base", base, head]);
if (mergeBaseResult.status !== 0 || !validRevision(mergeBaseResult.stdout.trim())) {
  fail("Git could not determine the pull-request merge base.");
}
const mergeBase = mergeBaseResult.stdout.trim();

const diff = run(
  "git",
  ["diff", "--name-only", "--diff-filter=ACMRDTUXB", "-z", mergeBase, head, "--"],
  { binary: true },
);
if (diff.status !== 0) fail("Git could not determine the pull-request file set.");

fs.mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
const filesPath = path.join(outputRoot, "changed-files.nul");
fs.writeFileSync(filesPath, diff.stdout, { mode: 0o600 });

const relativeFilesPath = path.relative(cwd, filesPath);
const impact = run(process.execPath, [
  cli,
  "impact",
  "--files-from",
  relativeFilesPath,
  "--base-revision",
  mergeBase,
  "--head-revision",
  head,
  "--json",
]);
if (impact.status !== 0) {
  process.stderr.write(impact.stderr || "");
  fail("Rivet could not analyze pull-request impact.");
}

let impactReport;
try {
  impactReport = JSON.parse(impact.stdout);
} catch {
  fail("Rivet produced an invalid impact report.");
}

const secretScanPath = path.join(outputRoot, "secret-scan.json");
const secretScan = run(process.execPath, [
  cli,
  "secrets",
  "--files-from",
  relativeFilesPath,
  "--json",
]);
if (![0, 2].includes(secretScan.status)) {
  process.stderr.write(secretScan.stderr || "");
  fail("Rivet could not scan pull-request files for secrets.");
}
let secretScanReport;
try {
  secretScanReport = JSON.parse(secretScan.stdout);
} catch {
  fail("Rivet produced an invalid secret scan report.");
}
if (
  !["pass", "fail"].includes(secretScanReport.decision) ||
  !Array.isArray(secretScanReport.findings)
) {
  fail("Rivet produced an unsupported secret scan report.");
}
fs.writeFileSync(
  secretScanPath,
  `${JSON.stringify(secretScanReport, null, 2)}\n`,
  { mode: 0o600 },
);
if (secretScanReport.decision === "fail") {
  console.error(
    `::error title=Changed-file secret scan failed::Rivet found ${secretScanReport.findings.length} potential secret(s). Review the report and rotate any exposed credential.`,
  );
}

const receiptPath = path.join(outputRoot, "verification-receipt.json");
const verificationSummaryPath = path.join(outputRoot, "verification.md");
const verifyArgs = [
  cli,
  "verify",
  "--receipt",
  path.relative(cwd, receiptPath),
  "--summary",
  path.relative(cwd, verificationSummaryPath),
  "--format",
  "github",
];
if (process.env.RIVET_VERIFY_CHECKS) {
  verifyArgs.push("--checks", process.env.RIVET_VERIFY_CHECKS);
}
const verification = run(process.execPath, verifyArgs);
process.stdout.write(verification.stdout || "");
process.stderr.write(verification.stderr || "");

if (!fs.existsSync(receiptPath)) {
  fail("Rivet did not produce a verification receipt.");
}
let receipt;
try {
  receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
} catch {
  fail("Rivet produced an invalid verification receipt.");
}
const report = {
  schema: 1,
  workflow: "pull-request-verification",
  evidence_class: "observed-and-derived",
  base_revision: base,
  merge_base_revision: mergeBase,
  head_revision: head,
  impact: impactReport,
  secret_scan: secretScanReport,
  verification: receipt,
  decision:
    secretScanReport.decision === "fail"
      ? "fail"
      : receipt.decision === "pass"
      ? "pass-with-limitations"
      : receipt.decision,
  limitations: [
    ...impactReport.limitations,
    ...secretScanReport.limitations,
    ...receipt.limitations,
    "The report inspects the checked-out head revision. It does not inspect deployment state or production behavior.",
  ],
};

const reportPath = path.join(outputRoot, "report.json");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
  mode: 0o600,
});

const lines = [
  "# Rivet pull-request verification",
  "",
  `Decision: **${report.decision}**`,
  "",
  `Base revision: \`${base}\``,
  "",
  `Head revision: \`${head}\``,
  "",
  `Risk mode: **${impactReport.risk_mode}**`,
  "",
  `Changed files: ${impactReport.files.length}`,
  "",
  "## Risk signals",
  "",
];
if (!impactReport.signals.length) lines.push("- No heuristic risk signal was observed.");
for (const signal of impactReport.signals) {
  lines.push(
    `- ${inlineCode(signal.file)}: ${markdownCell(signal.mode)} — ${markdownCell(signal.reason)}`,
  );
}
lines.push(
  "",
  "## Secret scan",
  "",
  `Decision: **${secretScanReport.decision}**`,
  "",
  `Files checked: ${secretScanReport.files_checked}`,
  "",
  `Potential secrets: ${secretScanReport.findings.length}`,
  "",
  ...secretScanReport.limitations.map((item) => `- ${markdownCell(item)}`),
  "",
  "## Required review",
  "",
  ...impactReport.required_review.map((item) => `- ${markdownCell(item)}`),
  "",
  "## Verification",
  "",
  "| Check | Result | Exit |",
  "|---|---|---:|",
);
for (const result of receipt.results) {
  lines.push(
    `| ${markdownCell(result.id)} | ${markdownCell(result.result)} | ${result.exit_code ?? "—"} |`,
  );
}
if (!receipt.results.length) {
  lines.push("| None | insufficient evidence | — |");
}
lines.push(
  "",
  "## Specialized evidence not run",
  "",
);
if (!receipt.available_evidence.length) {
  lines.push("- No specialized security or dependency adapter was detected.");
}
for (const item of receipt.available_evidence) {
  lines.push(
    `- ${markdownCell(item.id)} (${markdownCell(item.kind)}): ${markdownCell(item.reason)}`,
  );
}
lines.push(
  "",
  "## Limitations",
  "",
  ...report.limitations.map((item) => `- ${markdownCell(item)}`),
  "",
);
const summaryPath = path.join(outputRoot, "summary.md");
fs.writeFileSync(summaryPath, lines.join("\n"), { mode: 0o600 });

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"));
}

const evidenceFiles = [
  filesPath,
  secretScanPath,
  receiptPath,
  verificationSummaryPath,
  reportPath,
  summaryPath,
];
const manifestPath = path.join(outputRoot, "manifest.json");
fs.writeFileSync(
  manifestPath,
  `${JSON.stringify({
    schema: 1,
    kind: "rivet-pr-report-manifest",
    base_revision: base,
    merge_base_revision: mergeBase,
    head_revision: head,
    files: evidenceFiles.map(fileEvidence),
  }, null, 2)}\n`,
  { mode: 0o600 },
);

console.log(`Rivet PR report: ${path.relative(cwd, summaryPath)}`);
if (verification.status !== 0) process.exit(verification.status || 1);
if (secretScanReport.decision === "fail") process.exit(2);
}

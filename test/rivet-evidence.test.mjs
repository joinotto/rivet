import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { normalizeDependencyResult } from "../skills/rivet/scripts/lib/dependencies.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, "..");
const script = path.resolve(
  here,
  "../skills/rivet/scripts/rivet-evidence.mjs",
);
const steScript = path.resolve(
  here,
  "../skills/rivet/scripts/rivet-ste.mjs",
);

function invoke(cwd, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function invokeSte(cwd, args) {
  return spawnSync(process.execPath, [steScript, ...args], {
    cwd,
    encoding: "utf8",
  });
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-evidence-"));

fs.writeFileSync(
  path.join(fixture, "package.json"),
  JSON.stringify({
    scripts: {
      test: "node -e \"process.exit(0)\"",
      lint: "node -e \"process.exit(2)\""
    }
  }),
);

const inspect = invoke(fixture, ["inspect", "--json"]);
assert.strictEqual(inspect.status, 0, inspect.stderr);
const inspection = JSON.parse(inspect.stdout);
assert.deepStrictEqual(
  inspection.project.checks.map((check) => check.id),
  ["test", "lint"],
);

const doctor = invoke(fixture, ["doctor", "--json"]);
assert.strictEqual(doctor.status, 0, doctor.stderr);
const diagnosis = JSON.parse(doctor.stdout);
assert.match(diagnosis.decision, /^ready/);
assert.strictEqual(
  diagnosis.tools.find((item) => item.id === "test").available,
  true,
);
assert.ok(diagnosis.limitations.some((item) => /credentials/.test(item)));

fs.mkdirSync(path.join(fixture, ".rivet"), { recursive: true });
fs.writeFileSync(path.join(fixture, ".rivet/config.json"), "{invalid");
const invalidDoctor = invoke(fixture, ["doctor", "--json"]);
assert.strictEqual(invalidDoctor.status, 2, invalidDoctor.stderr);
assert.strictEqual(JSON.parse(invalidDoctor.stdout).decision, "not-ready");
fs.rmSync(path.join(fixture, ".rivet"), { recursive: true });

const dryRun = invoke(fixture, [
  "verify",
  "--dry-run",
  "--checks",
  "test,typecheck",
]);
assert.strictEqual(dryRun.status, 0, dryRun.stderr);
assert.match(dryRun.stdout, /test: npm run test/);
assert.match(dryRun.stdout, /Unavailable: typecheck/);

const pass = invoke(fixture, ["verify", "--checks", "test", "--json"]);
assert.strictEqual(pass.status, 0, pass.stderr);
const passReceipt = JSON.parse(pass.stdout);
assert.strictEqual(passReceipt.decision, "pass");
assert.ok(passReceipt.results[0].tool_version);
assert.match(passReceipt.results[0].command_digest, /^[a-f0-9]{64}$/);
assert.match(passReceipt.results[0].configuration_digest, /^[a-f0-9]{64}$/);
assert.strictEqual(passReceipt.environment.node, process.version);

const fail = invoke(fixture, ["verify", "--checks", "lint", "--json"]);
assert.strictEqual(fail.status, 2, fail.stderr);
assert.strictEqual(JSON.parse(fail.stdout).decision, "fail");

const summaryFile = path.join(fixture, ".rivet/summary.md");
const githubVerification = invoke(fixture, [
  "verify",
  "--checks",
  "lint",
  "--format",
  "github",
  "--summary",
  ".rivet/summary.md",
]);
assert.strictEqual(githubVerification.status, 2, githubVerification.stderr);
assert.match(githubVerification.stdout, /::error title=Rivet lint/);
assert.match(githubVerification.stdout, /Decision fail/);
assert.match(fs.readFileSync(summaryFile, "utf8"), /# Rivet verification/);
assert.match(fs.readFileSync(summaryFile, "utf8"), /\| lint \| node \| fail \|/);

const incomplete = invoke(fixture, [
  "verify",
  "--checks",
  "typecheck",
  "--json",
]);
assert.strictEqual(incomplete.status, 1, incomplete.stderr);
assert.strictEqual(JSON.parse(incomplete.stdout).decision, "incomplete");

const serviceRisk = invoke(fixture, [
  "change",
  "--files",
  "src/api/orders.js,src/domain/money.js",
  "--json",
]);
assert.strictEqual(serviceRisk.status, 0, serviceRisk.stderr);
assert.strictEqual(JSON.parse(serviceRisk.stdout).risk_mode, "service");

const criticalRisk = invoke(fixture, [
  "change",
  "--files",
  "src/auth/policy.js,src/worker/email.js",
  "--json",
]);
assert.strictEqual(criticalRisk.status, 0, criticalRisk.stderr);
assert.strictEqual(JSON.parse(criticalRisk.stdout).risk_mode, "critical");

const topology = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-topology-"));
fs.mkdirSync(path.join(topology, "packages/core"), { recursive: true });
fs.mkdirSync(path.join(topology, "apps/api"), { recursive: true });
fs.writeFileSync(
  path.join(topology, "packages/core/package.json"),
  JSON.stringify({
    name: "@fixture/core",
    scripts: { test: "node -e \"process.exit(0)\"" },
  }),
);
fs.writeFileSync(
  path.join(topology, "apps/api/package.json"),
  JSON.stringify({
    name: "@fixture/api",
    dependencies: {
      "@fixture/core": "workspace:*",
      "@aws-sdk/client-sqs": "1.0.0",
    },
    scripts: { test: "node -e \"process.exit(0)\"" },
  }),
);
fs.mkdirSync(path.join(topology, "prisma"), { recursive: true });
fs.writeFileSync(path.join(topology, "prisma/schema.prisma"), "model User {}\n");
const systemMap = invoke(topology, ["map", "--json"]);
assert.strictEqual(systemMap.status, 0, systemMap.stderr);
const mapped = JSON.parse(systemMap.stdout);
assert.strictEqual(mapped.topology.components.length, 2);
assert.deepStrictEqual(mapped.topology.edges[0], {
  from: "@fixture/api",
  to: "@fixture/core",
  relation: "declared-dependency",
  source: "apps/api/package.json",
  evidence_class: "observed",
});
assert.strictEqual(mapped.topology.data_stores.length, 1);
assert.strictEqual(mapped.topology.messaging[0].technology, "sqs");
const topologyChange = invoke(topology, [
  "change",
  "--files",
  "packages/core/src/value.js",
  "--json",
]);
assert.strictEqual(topologyChange.status, 0, topologyChange.stderr);
assert.deepStrictEqual(
  JSON.parse(topologyChange.stdout).topology_impact.affected_components,
  ["@fixture/api", "@fixture/core"],
);
const selectedTests = invoke(topology, [
  "test",
  "--files",
  "packages/core/src/value.js",
  "--json",
]);
assert.strictEqual(selectedTests.status, 0, selectedTests.stderr);
assert.deepStrictEqual(
  JSON.parse(selectedTests.stdout).selected_checks.map((item) => item.id),
  ["test:apps/api", "test:packages/core"],
);
assert.match(
  JSON.parse(selectedTests.stdout).missing_inputs[0],
  /No change record/,
);
fs.mkdirSync(path.join(topology, ".rivet/changes"), { recursive: true });
fs.writeFileSync(
  path.join(topology, ".rivet/changes/core.md"),
  `# Core change

## Target

- Required behavior: Preserve one charge for a repeated request.

## Invariants

- One payment attempt creates at most one provider charge.

## Threats and failure cases

- The provider completes the charge and the response is lost.

## Verification

- Retry the same stable request identifier.

## Open risks

- Provider behavior is simulated.
`,
);
const plannedTests = invoke(topology, [
  "test",
  "--files",
  "packages/core/src/payment.js",
  "--record",
  ".rivet/changes/core.md",
  "--json",
]);
assert.strictEqual(plannedTests.status, 0, plannedTests.stderr);
const testPlan = JSON.parse(plannedTests.stdout);
assert.strictEqual(testPlan.record.invariants.length, 1);
assert.ok(testPlan.test_families.some((item) => item.id === "recorded-failures"));
assert.deepStrictEqual(testPlan.missing_inputs, []);

const intelligence = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-test-intelligence-"));
fs.writeFileSync(
  path.join(intelligence, "package.json"),
  JSON.stringify({
    scripts: {
      "test:coverage": "jest --coverage",
      "test:mutation": "stryker run",
      "test:property": "vitest run property",
      "test:contract": "schemathesis run",
    },
  }),
);
const intelligenceInspection = invoke(intelligence, ["inspect", "--json"]);
assert.strictEqual(intelligenceInspection.status, 0, intelligenceInspection.stderr);
assert.deepStrictEqual(
  JSON.parse(intelligenceInspection.stdout).project.checks.map((item) => item.kind),
  ["coverage-check", "mutation-check", "property-check", "contract-check"],
);

fs.writeFileSync(
  path.join(intelligence, "coverage-summary.json"),
  JSON.stringify({
    total: {
      lines: { total: 10, covered: 8, skipped: 0, pct: 80 },
      branches: { total: 4, covered: 2, skipped: 0, pct: 50 },
    },
  }),
);
const coverageEvidence = invoke(intelligence, [
  "test",
  "--coverage-report",
  "coverage-summary.json",
]);
assert.strictEqual(coverageEvidence.status, 0, coverageEvidence.stderr);
const coverageReport = JSON.parse(coverageEvidence.stdout);
assert.strictEqual(coverageReport.metrics.lines.percent, 80);
assert.match(coverageReport.limitations[0], /does not prove/);

fs.writeFileSync(
  path.join(intelligence, "mutation.json"),
  JSON.stringify({
    files: {
      "src/value.js": {
        mutants: [
          { id: "1", status: "Killed", mutatorName: "ArithmeticOperator" },
          { id: "2", status: "Survived", mutatorName: "ConditionalExpression" },
        ],
      },
    },
  }),
);
const mutationEvidence = invoke(intelligence, [
  "test",
  "--mutation-report",
  "mutation.json",
]);
assert.strictEqual(mutationEvidence.status, 2, mutationEvidence.stderr);
const mutationReport = JSON.parse(mutationEvidence.stdout);
assert.strictEqual(mutationReport.mutation_score, 50);
assert.strictEqual(mutationReport.surviving_mutants.length, 1);

fs.writeFileSync(
  path.join(intelligence, "contract.xml"),
  '<testsuite tests="3" failures="1" errors="0" skipped="0"></testsuite>',
);
const contractEvidence = invoke(intelligence, [
  "test",
  "--contract-report",
  "contract.xml",
]);
assert.strictEqual(contractEvidence.status, 2, contractEvidence.stderr);
assert.strictEqual(JSON.parse(contractEvidence.stdout).decision, "fail");

fs.writeFileSync(
  path.join(intelligence, "run-1.xml"),
  '<testsuite tests="2"><testcase classname="orders" name="creates one order"></testcase><testcase classname="orders" name="lists orders"></testcase></testsuite>',
);
fs.writeFileSync(
  path.join(intelligence, "run-2.xml"),
  '<testsuite tests="2" failures="1"><testcase classname="orders" name="creates one order"><failure/></testcase><testcase classname="orders" name="lists orders"></testcase></testsuite>',
);
fs.writeFileSync(
  path.join(intelligence, "run-3.xml"),
  '<testsuite tests="1"><testcase classname="orders" name="creates one order"></testcase></testsuite>',
);
const flakeEvidence = invoke(intelligence, [
  "test",
  "--flake-reports",
  "run-1.xml,run-2.xml,run-3.xml",
]);
assert.strictEqual(flakeEvidence.status, 2, flakeEvidence.stderr);
const flakeReport = JSON.parse(flakeEvidence.stdout);
assert.strictEqual(flakeReport.flaky[0].id, "orders::creates one order");
assert.strictEqual(
  flakeReport.inconsistent_presence[0].id,
  "orders::lists orders",
);

fs.writeFileSync(
  path.join(intelligence, "sast.sarif"),
  JSON.stringify({
    version: "2.1.0",
    runs: [{
      tool: {
        driver: {
          name: "fixture-sast",
          version: "1.0.0",
          rules: [{
            id: "auth-object",
            properties: { tags: ["security", "CWE-639"] },
          }],
        },
      },
      results: [{
        ruleId: "auth-object",
        level: "error",
        message: { text: "Object ownership is not checked." },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: "src/invoice.js" },
            region: { startLine: 12 },
          },
        }],
      }],
    }],
  }),
);
const sarifEvidence = invoke(intelligence, [
  "security",
  "--sarif",
  "sast.sarif",
]);
assert.strictEqual(sarifEvidence.status, 2, sarifEvidence.stderr);
const sarifReport = JSON.parse(sarifEvidence.stdout);
assert.strictEqual(sarifReport.findings[0].rule_id, "auth-object");
assert.deepStrictEqual(sarifReport.findings[0].cwe, ["CWE-639"]);

fs.writeFileSync(
  path.join(intelligence, "trivy.json"),
  JSON.stringify({
    Results: [{
      Target: "Dockerfile",
      Vulnerabilities: [{
        VulnerabilityID: "CVE-TEST",
        PkgName: "fixture",
        InstalledVersion: "1",
        FixedVersion: "2",
        Severity: "HIGH",
      }],
      Misconfigurations: [{
        ID: "CFG-TEST",
        Title: "Container runs as root",
        Severity: "HIGH",
      }],
    }],
  }),
);
const trivyEvidence = invoke(intelligence, [
  "security",
  "--trivy",
  "trivy.json",
]);
assert.strictEqual(trivyEvidence.status, 2, trivyEvidence.stderr);
assert.strictEqual(JSON.parse(trivyEvidence.stdout).findings.length, 2);

fs.writeFileSync(
  path.join(intelligence, "bom.json"),
  JSON.stringify({
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    components: [{ type: "library", name: "fixture", version: "1.0.0" }],
  }),
);
const sbomEvidence = invoke(intelligence, [
  "sbom",
  "--file",
  "bom.json",
  "--revision",
  "fixture-revision",
]);
assert.strictEqual(sbomEvidence.status, 0, sbomEvidence.stderr);
const sbomReport = JSON.parse(sbomEvidence.stdout);
assert.strictEqual(sbomReport.format, "CycloneDX");
assert.strictEqual(sbomReport.component_count, 1);
assert.strictEqual(sbomReport.subject_revision, "fixture-revision");

fs.writeFileSync(
  path.join(intelligence, "findings.json"),
  JSON.stringify({
    findings: [
      { id: "CVE-2021-44228" },
      { id: "CVE-2099-0001" },
    ],
  }),
);
fs.writeFileSync(
  path.join(intelligence, "kev.json"),
  JSON.stringify({
    catalogVersion: "fixture-1",
    dateReleased: "2026-10-25",
    vulnerabilities: [{
      cveID: "CVE-2021-44228",
      dateAdded: "2021-12-10",
      dueDate: "2021-12-24",
      knownRansomwareCampaignUse: "Known",
      cwes: ["CWE-502"],
    }],
  }),
);
fs.writeFileSync(
  path.join(intelligence, "epss.json"),
  JSON.stringify({
    status: "OK",
    data: [{
      cve: "CVE-2021-44228",
      epss: "0.975",
      percentile: "0.999",
      date: "2026-10-25",
    }],
  }),
);
const enrichedEvidence = invoke(intelligence, [
  "security",
  "--enrich",
  "findings.json",
  "--kev",
  "kev.json",
  "--epss",
  "epss.json",
  "--retrieved-at",
  "2026-10-25",
]);
assert.strictEqual(enrichedEvidence.status, 0, enrichedEvidence.stderr);
const enrichedReport = JSON.parse(enrichedEvidence.stdout);
assert.strictEqual(enrichedReport.vulnerabilities[0].known_exploited, true);
assert.strictEqual(enrichedReport.vulnerabilities[0].epss.probability, 0.975);
assert.strictEqual(
  enrichedReport.vulnerabilities[0].priority_factors.runtime_reachability,
  "unknown",
);
assert.strictEqual(enrichedReport.vulnerabilities[1].epss, null);
assert.match(enrichedReport.limitations[1], /not severity/);

const waiverInit = invoke(intelligence, [
  "waiver",
  "init",
  "--finding",
  "CVE-2021-44228",
  "--created-at",
  "2026-10-25",
  "--output",
  "waiver.json",
]);
assert.strictEqual(waiverInit.status, 0, waiverInit.stderr);
const waiverFile = path.join(intelligence, "waiver.json");
const waiver = JSON.parse(fs.readFileSync(waiverFile, "utf8"));
Object.assign(waiver, {
  technical_reason: "The supported upgrade requires a compatibility release.",
  business_reason: "The service must complete an active migration window.",
  compensating_control: "Disable the affected feature and block untrusted input.",
  owner: "security-owner",
  approval: "SEC-123",
  expires_at: "2026-11-15",
  review_trigger: "Upgrade release or new exploitation evidence.",
  evidence: ["control-test-1"],
});
fs.writeFileSync(waiverFile, JSON.stringify(waiver));
const validWaiver = invoke(intelligence, [
  "waiver",
  "validate",
  "--file",
  "waiver.json",
  "--as-of",
  "2026-10-25",
]);
assert.strictEqual(validWaiver.status, 0, validWaiver.stderr);
assert.strictEqual(JSON.parse(validWaiver.stdout).decision, "valid");
const expiredWaiver = invoke(intelligence, [
  "waiver",
  "validate",
  "--file",
  "waiver.json",
  "--as-of",
  "2026-12-01",
]);
assert.strictEqual(expiredWaiver.status, 2, expiredWaiver.stderr);
assert.ok(
  JSON.parse(expiredWaiver.stdout).faults.includes("the waiver is expired"),
);

fs.writeFileSync(
  path.join(intelligence, "reachability.json"),
  JSON.stringify({
    revision: "fixture-revision",
    observed_at: "2026-10-25T10:00:00Z",
    entries: [{
      id: "CVE-2021-44228",
      status: "not-reachable",
      method: "static call graph plus runtime class-load trace",
      evidence: ["reports/call-graph.json", "reports/class-load.json"],
    }],
  }),
);
const incompleteReachability = invoke(intelligence, [
  "security",
  "--reachability",
  "findings.json",
  "--evidence",
  "reachability.json",
]);
assert.strictEqual(
  incompleteReachability.status,
  1,
  incompleteReachability.stderr,
);
const reachabilityReport = JSON.parse(incompleteReachability.stdout);
assert.strictEqual(
  reachabilityReport.vulnerabilities[0].reachability,
  "not-reachable",
);
assert.strictEqual(
  reachabilityReport.vulnerabilities[1].reachability,
  "unknown",
);
assert.match(reachabilityReport.limitations[2], /must not suppress/);

fs.writeFileSync(
  path.join(intelligence, "invalid-reachability.json"),
  JSON.stringify({
    revision: "fixture-revision",
    observed_at: "2026-10-25T10:00:00Z",
    entries: [{
      id: "CVE-2021-44228",
      status: "not-reachable",
      method: "",
      evidence: [],
    }],
  }),
);
const invalidReachability = invoke(intelligence, [
  "security",
  "--reachability",
  "findings.json",
  "--evidence",
  "invalid-reachability.json",
]);
assert.strictEqual(invalidReachability.status, 2, invalidReachability.stderr);
assert.strictEqual(
  JSON.parse(invalidReachability.stdout).vulnerabilities[0].reachability,
  "unknown",
);

const attestPlan = invoke(intelligence, [
  "attest",
  "plan",
  "--artifact",
  "findings.json",
  "--bundle",
  "findings.sigstore.json",
  "--identity",
  "release@example.com",
  "--issuer",
  "https://issuer.example.test",
]);
assert.strictEqual(attestPlan.status, 0, attestPlan.stderr);
const signingPlan = JSON.parse(attestPlan.stdout);
assert.strictEqual(signingPlan.sign.executable, "cosign");
assert.deepStrictEqual(signingPlan.sign.args.slice(0, 3), [
  "sign-blob",
  "--yes",
  "--bundle",
]);
assert.ok(signingPlan.verify.args.includes("release@example.com"));
assert.match(signingPlan.limitations[0], /not a signature/);

const unauthorizedSign = invoke(intelligence, [
  "attest",
  "sign",
  "--artifact",
  "findings.json",
  "--bundle",
  "findings.sigstore.json",
]);
assert.strictEqual(unauthorizedSign.status, 1);
assert.match(unauthorizedSign.stderr, /explicit --allow-network/);

const unconstrainedVerify = invoke(intelligence, [
  "attest",
  "verify",
  "--artifact",
  "findings.json",
  "--bundle",
  "findings.sigstore.json",
]);
assert.strictEqual(unconstrainedVerify.status, 1);
assert.match(unconstrainedVerify.stderr, /requires --identity and --issuer/);
const nestedVerification = invoke(topology, [
  "verify",
  "--checks",
  "test:packages/core",
  "--json",
]);
assert.strictEqual(nestedVerification.status, 0, nestedVerification.stderr);
assert.strictEqual(
  JSON.parse(nestedVerification.stdout).results[0].working_directory,
  "packages/core",
);

const recordPath = path.join(fixture, "change.md");
const record = invoke(fixture, [
  "record",
  "--title",
  "Order authorization",
  "--files",
  "src/auth/policy.js",
  "--output",
  recordPath,
]);
assert.strictEqual(record.status, 0, record.stderr);
assert.match(fs.readFileSync(recordPath, "utf8"), /Risk mode: critical/);

const reviewPacketPath = path.join(fixture, ".rivet/review.md");
const preparedReview = invoke(fixture, [
  "review",
  "--record",
  "change.md",
  "--files",
  "src/auth/policy.js",
  "--output",
  ".rivet/review.md",
]);
assert.strictEqual(preparedReview.status, 0, preparedReview.stderr);
assert.match(preparedReview.stdout, /prepared-not-reviewed/);
const reviewBody = fs.readFileSync(reviewPacketPath, "utf8");
assert.match(reviewBody, /# Independent review packet/);
assert.match(reviewBody, /Do not accept the implementation explanation as evidence/);
assert.match(reviewBody, /## Invariants\n\n- None recorded/);
assert.doesNotMatch(reviewBody, /## Alternatives/);

const cleanDoc = path.join(fixture, "clean.md");
fs.writeFileSync(cleanDoc, "# Procedure\n\nRun the test.\n");
const cleanSte = invokeSte(fixture, [cleanDoc, "--json"]);
assert.strictEqual(cleanSte.status, 0, cleanSte.stderr);
assert.strictEqual(JSON.parse(cleanSte.stdout).faults, 0);

const faultyDoc = path.join(fixture, "faulty.md");
fs.writeFileSync(faultyDoc, "# Procedure\n\nRun the test; deploy the code.\n");
const faultySte = invokeSte(fixture, [faultyDoc, "--json"]);
assert.strictEqual(faultySte.status, 2, faultySte.stderr);
assert.strictEqual(JSON.parse(faultySte.stdout).faults, 1);

const multi = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-multi-"));
fs.writeFileSync(
  path.join(multi, "package.json"),
  JSON.stringify({ scripts: { test: "node -e \"process.exit(0)\"" } }),
);
fs.writeFileSync(path.join(multi, "Cargo.toml"), "[package]\nname='fixture'\n");
fs.writeFileSync(path.join(multi, "go.mod"), "module example.test/fixture\n");
fs.writeFileSync(path.join(multi, "pyproject.toml"), "[project]\nname='fixture'\n");
const multiInspect = invoke(multi, ["inspect", "--json"]);
assert.strictEqual(multiInspect.status, 0, multiInspect.stderr);
const ecosystems = new Set(
  JSON.parse(multiInspect.stdout).project.checks.map((item) => item.ecosystem),
);
assert.deepStrictEqual(
  [...ecosystems].sort(),
  ["go", "node", "python", "rust"],
);

const secretFile = path.join(fixture, "secrets.txt");
fs.writeFileSync(
  secretFile,
  "api_key='this-is-a-secret-value-that-must-not-print'\n",
);
const secretScan = invoke(fixture, [
  "secrets",
  "--files",
  "secrets.txt",
  "--json",
]);
assert.strictEqual(secretScan.status, 2, secretScan.stderr);
assert.strictEqual(JSON.parse(secretScan.stdout).findings.length, 1);
assert.doesNotMatch(secretScan.stdout, /this-is-a-secret-value/);

const defaultSecretScan = invoke(fixture, ["secrets", "--json"]);
assert.strictEqual(defaultSecretScan.status, 2, defaultSecretScan.stderr);
assert.ok(JSON.parse(defaultSecretScan.stdout).files_checked > 1);

const escapedRecord = invoke(fixture, [
  "record",
  "--output",
  "../escaped-record.md",
]);
assert.strictEqual(escapedRecord.status, 1);
assert.match(escapedRecord.stderr, /inside the project/);

const init = invoke(fixture, ["init"]);
assert.strictEqual(init.status, 0, init.stderr);
assert.ok(fs.existsSync(path.join(fixture, "SYSTEM.md")));
assert.ok(fs.existsSync(path.join(fixture, ".rivet/config.json")));
const systemBefore = fs.readFileSync(path.join(fixture, "SYSTEM.md"), "utf8");
const secondInit = invoke(fixture, ["init"]);
assert.strictEqual(secondInit.status, 0, secondInit.stderr);
assert.strictEqual(
  fs.readFileSync(path.join(fixture, "SYSTEM.md"), "utf8"),
  systemBefore,
);

fs.writeFileSync(path.join(fixture, "package-lock.json"), "{}");
const dependencyDryRun = invoke(fixture, ["dependencies", "--dry-run"]);
assert.strictEqual(dependencyDryRun.status, 0, dependencyDryRun.stderr);
assert.match(dependencyDryRun.stdout, /npm-audit/);

const npmFindings = normalizeDependencyResult(
  { id: "npm-audit" },
  {
    status: 1,
    stdout: JSON.stringify({
      vulnerabilities: {
        vulnerable: { severity: "high", isDirect: true, via: ["ADV-1"] },
      },
    }),
  },
);
assert.strictEqual(npmFindings.result, "findings");
assert.strictEqual(npmFindings.finding_count, 1);

const npmClean = normalizeDependencyResult(
  { id: "npm-audit" },
  { status: 0, stdout: JSON.stringify({ vulnerabilities: {} }) },
);
assert.strictEqual(npmClean.result, "pass");

const invalidAudit = normalizeDependencyResult(
  { id: "npm-audit" },
  { status: 1, stdout: "registry unavailable" },
);
assert.strictEqual(invalidAudit.result, "tool-failure");

const cargoFindings = normalizeDependencyResult(
  { id: "cargo-audit" },
  {
    status: 1,
    stdout: JSON.stringify({
      vulnerabilities: {
        list: [{
          package: { name: "fixture" },
          advisory: { id: "RUSTSEC-TEST" },
        }],
      },
    }),
  },
);
assert.strictEqual(cargoFindings.result, "findings");

const pipFindings = normalizeDependencyResult(
  { id: "pip-audit" },
  {
    status: 1,
    stdout: JSON.stringify([{
      name: "fixture",
      vulns: [{ id: "PYSEC-TEST", fix_versions: ["2.0.0"] }],
    }]),
  },
);
assert.strictEqual(pipFindings.result, "findings");

const goFindings = normalizeDependencyResult(
  { id: "govulncheck" },
  {
    status: 3,
    stdout: `${JSON.stringify({ finding: { osv: "GO-TEST", trace: [{}] } })}\n`,
  },
);
assert.strictEqual(goFindings.result, "findings");

const migrationFile = path.join(fixture, "migration.sql");
fs.writeFileSync(
  migrationFile,
  "BEGIN;\nCREATE INDEX CONCURRENTLY users_email_idx ON users(email);\nCOMMIT;\n",
);
const migrationInspection = invoke(fixture, [
  "database",
  "--migration",
  "migration.sql",
]);
assert.strictEqual(migrationInspection.status, 2, migrationInspection.stderr);
assert.ok(
  JSON.parse(migrationInspection.stdout).findings.some(
    (item) => item.id === "concurrent-index-in-transaction",
  ),
);

const planFile = path.join(fixture, "plan.json");
fs.writeFileSync(
  planFile,
  JSON.stringify([{
    Plan: {
      "Node Type": "Seq Scan",
      "Relation Name": "orders",
      "Plan Rows": 10000,
      "Total Cost": 250,
    },
  }]),
);
const planInspection = invoke(fixture, [
  "database",
  "--plan",
  "plan.json",
  "--query",
  "orders-by-customer",
]);
assert.strictEqual(planInspection.status, 2, planInspection.stderr);
const planReport = JSON.parse(planInspection.stdout);
assert.strictEqual(planReport.query_id, "orders-by-customer");
assert.strictEqual(planReport.observations[0].relation, "orders");
assert.match(planReport.limitations[0], /not sufficient evidence/);

const packages = path.join(os.tmpdir(), `rivet-hosts-${process.pid}`);
const packageResult = spawnSync(
  process.execPath,
  [path.join(repository, "scripts/package-hosts.mjs"), "--output", packages],
  { encoding: "utf8" },
);
assert.strictEqual(packageResult.status, 0, packageResult.stderr);
for (const host of ["portable", "codex", "claude-code", "cursor"]) {
  const hostSkill = path.join(packages, host, "rivet", "SKILL.md");
  assert.ok(fs.existsSync(hostSkill), `${host} package has no SKILL.md`);
  assert.strictEqual(
    fs.readFileSync(hostSkill, "utf8"),
    fs.readFileSync(path.join(repository, "skills/rivet/SKILL.md"), "utf8"),
  );
}
assert.ok(fs.existsSync(path.join(packages, "codex/rivet/agents/openai.yaml")));
assert.ok(
  !fs.existsSync(path.join(packages, "claude-code/rivet/agents/openai.yaml")),
);
fs.rmSync(packages, { recursive: true });

const unsafePackageResult = spawnSync(
  process.execPath,
  [
    path.join(repository, "scripts/package-hosts.mjs"),
    "--output",
    path.parse(repository).root,
    "--force",
  ],
  { encoding: "utf8" },
);
assert.strictEqual(unsafePackageResult.status, 1);
assert.match(unsafePackageResult.stderr, /inside the Rivet repository/);

console.log("rivet-evidence tests passed");

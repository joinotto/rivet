import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { normalizeDependencyResult } from "../skills/rivet/scripts/lib/dependencies.mjs";
import { validateStatefulModel } from "../skills/rivet/scripts/lib/stateful.mjs";
import { normalizeFuzzCampaign } from "../skills/rivet/scripts/lib/fuzz.mjs";
import {
  normalizeChaosResult,
  validateChaosExperiment,
} from "../skills/rivet/scripts/lib/chaos.mjs";
import {
  normalizeModelCheckResult,
  validateFormalModel,
} from "../skills/rivet/scripts/lib/formalize.mjs";
import { validatePrivacyAnalysis } from "../skills/rivet/scripts/lib/privacy.mjs";
import { evaluateCapacityPlan } from "../skills/rivet/scripts/lib/capacity.mjs";

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

const nativeSastFixture = fs.readFileSync(
  path.join(repository, "fixtures/native-sast/command-injection.js"),
  "utf8",
);
assert.match(nativeSastFixture, /\bexec\(command,/);
const nativeSastWorkflow = fs.readFileSync(
  path.join(repository, ".github/workflows/native-sast.yml"),
  "utf8",
);
assert.match(
  nativeSastWorkflow,
  /github\/codeql-action\/analyze@9b3254085494b55a0f7c4c2b3d2d52cc712ce370/,
);
assert.match(nativeSastWorkflow, /js\/command-line-injection/);
assert.doesNotMatch(
  nativeSastWorkflow,
  /uses:\s+[^@\n]+@(main|master|v\d+)\s*$/m,
);
const nativeSignatureWorkflow = fs.readFileSync(
  path.join(repository, ".github/workflows/native-signature.yml"),
  "utf8",
);
assert.match(
  nativeSignatureWorkflow,
  /sigstore\/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6/,
);
assert.match(nativeSignatureWorkflow, /cosign-release: v3[.]1[.]4/);
assert.match(nativeSignatureWorkflow, /--signature cosign-key/);
assert.doesNotMatch(
  nativeSignatureWorkflow,
  /uses:\s+[^@\n]+@(main|master|v\d+)\s*$/m,
);

function invoke(cwd, args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
}

function invokeSte(cwd, args) {
  return spawnSync(process.execPath, [steScript, ...args], {
    cwd,
    encoding: "utf8",
  });
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-evidence-"));

const statefulModel = {
  schema: 1,
  kind: "stateful-test-model",
  system: "ledger",
  revision: "fixture-revision",
  created_at: "2026-10-25",
  model: {
    initial_state: "empty",
    states: [
      { id: "empty", description: "The ledger has no entries." },
      { id: "funded", description: "The ledger has a positive balance." },
    ],
    commands: [{
      id: "credit",
      description: "Add funds.",
      generator: "Generate a positive integer amount.",
      precondition: "The amount is within the account limit.",
      action: "Credit the generated amount.",
      postcondition: "The observed balance equals the model balance.",
      from: ["empty", "funded"],
      to: ["funded"],
    }],
    invariants: [{
      id: "balance-agrees",
      description: "The implementation and model balances agree.",
      oracle: "Read both balances after each command.",
    }],
  },
  execution: {
    runner: "fast-check",
    runs: 100,
    max_commands: 50,
    records_seed: true,
    shrinking: true,
    reset: "Create an isolated ledger.",
    isolation: "Use a new transaction for each run.",
  },
  review: {
    owner: "test-team",
    evidence: [],
  },
};
const statefulValidation = validateStatefulModel(statefulModel);
assert.strictEqual(statefulValidation.decision, "ready-for-execution");
assert.deepStrictEqual(statefulValidation.unreachable_states, []);
const incompleteStateful = validateStatefulModel({
  ...statefulModel,
  execution: { ...statefulModel.execution, records_seed: false },
});
assert.strictEqual(incompleteStateful.decision, "incomplete");
const fuzzCampaign = {
  schema: 1,
  kind: "fuzz-campaign",
  engine: "libFuzzer",
  engine_version: "fixture",
  target: "parse_message",
  revision: "fixture-revision",
  command_digest: "sha256:fixture",
  started_at: "2026-10-25T10:00:00Z",
  finished_at: "2026-10-25T10:05:00Z",
  duration_seconds: 300,
  executions: 50000,
  seed_corpus_digest: "sha256:corpus",
  dictionary_digest: "sha256:dictionary",
  sanitizer: "address,undefined",
  crashes: [],
  timeouts: 0,
  out_of_memory: 0,
};
assert.strictEqual(
  normalizeFuzzCampaign(fuzzCampaign).decision,
  "no-crash-observed",
);
assert.strictEqual(
  normalizeFuzzCampaign({
    ...fuzzCampaign,
    crashes: [{
      id: "crash-1",
      class: "heap-buffer-overflow",
      input_digest: "sha256:input",
      artifact: "artifacts/crash-1",
      stack_digest: "sha256:stack",
      reproducible: true,
    }],
  }).decision,
  "crash-observed",
);
const chaosExperiment = {
  schema: 1,
  kind: "chaos-experiment",
  system: "checkout",
  revision: "fixture-revision",
  created_at: "2026-10-25",
  environment: "staging",
  target: {
    selector: "service=payments,instance=canary",
    expected_count: 1,
    excluded: ["production", "database-primary"],
  },
  steady_state: {
    hypothesis: "Checkout success remains above the project threshold.",
    probes: [{
      id: "checkout-success",
      measure: "successful checkouts divided by checkout attempts",
      tolerance: "greater than or equal to 99 percent",
      source: "staging checkout telemetry",
    }],
  },
  method: {
    fault: "Add 200 milliseconds of latency to the payment canary.",
    duration_seconds: 60,
    blast_radius: "One staging payment instance.",
  },
  stop_conditions: [{
    id: "user-harm",
    signal: "checkout success",
    threshold: "less than 95 percent for one minute",
    action: "Stop fault injection and start rollback.",
  }],
  rollback: {
    actions: ["Remove the latency rule."],
    verification: ["Confirm the canary latency returns to baseline."],
  },
  observation: {
    metrics: ["checkout success", "payment latency"],
    user_harm_signal: "checkout failure rate",
  },
  approval: {
    required: true,
    owner: "reliability-team",
    reference: "change-123",
  },
};
assert.strictEqual(
  validateChaosExperiment(chaosExperiment).decision,
  "ready-for-approval",
);
assert.strictEqual(
  normalizeChaosResult({
    schema: 1,
    kind: "chaos-experiment-result",
    experiment_digest: "sha256:experiment",
    revision: "fixture-revision",
    environment: "staging",
    started_at: "2026-10-25T10:00:00Z",
    finished_at: "2026-10-25T10:01:00Z",
    tool: "fixture",
    tool_version: "1",
    hypothesis: "held",
    execution: "completed",
    rollback: { attempted: true, result: "verified" },
    observations: [{ probe_id: "checkout-success", result: "within-tolerance" }],
  }).decision,
  "hypothesis-held",
);
const formalModel = {
  schema: 1,
  kind: "formal-model",
  system: "payment-worker",
  revision: "fixture-revision",
  created_at: "2026-10-25",
  language: "TLA+",
  module: "PaymentWorker.tla",
  config: "PaymentWorker.cfg",
  abstraction: {
    scope: ["one queue and two workers"],
    assumptions: ["message identifiers are unique"],
    omitted_behavior: ["network partitions longer than the visibility timeout"],
    implementation_mapping: ["Process maps to src/worker.js processMessage"],
  },
  checks: {
    invariants: ["AtMostOnceEffect"],
    temporal_properties: ["EventuallyCompleted"],
    deadlock: true,
  },
  bounds: {
    constants: { Workers: 2, Messages: 3 },
    constraints: ["Queue length is at most three."],
  },
  review: {
    owner: "reliability-team",
    reviewed_at: "2026-10-25",
    evidence: ["review-123"],
  },
};
assert.strictEqual(
  validateFormalModel(formalModel).decision,
  "ready-for-model-checking",
);
assert.strictEqual(
  normalizeModelCheckResult({
    schema: 1,
    kind: "model-check-result",
    language: "TLA+",
    checker: "TLC",
    checker_version: "fixture",
    model_digest: "sha256:model",
    config_digest: "sha256:config",
    revision: "fixture-revision",
    started_at: "2026-10-25T10:00:00Z",
    finished_at: "2026-10-25T10:01:00Z",
    command_digest: "sha256:command",
    outcome: "completed",
    states_generated: 100,
    distinct_states: 60,
    violations: [],
  }).decision,
  "no-violation-observed",
);
const privacyAnalysis = {
  schema: 1,
  kind: "privacy-analysis",
  system: "customer-profile",
  revision: "fixture-revision",
  created_at: "2026-10-25",
  scope: {
    included: ["profile API and database"],
    excluded: ["payment processor"],
    jurisdictions: ["review-required"],
  },
  data_categories: [{
    id: "email",
    description: "Customer email address.",
    subjects: "Customers.",
    classification: "Personal data.",
    source: "Customer input.",
    retention: "Until account deletion plus the documented recovery period.",
    deletion: "Delete from the primary store and expire backups.",
    necessary: true,
  }],
  processing_activities: [{
    id: "account-notices",
    purpose: "Send account and security notices.",
    necessity: "The service needs a delivery address for account notices.",
    legal_basis_review: "Qualified reviewer must confirm.",
    owner: "identity-team",
    automated_decision_effect: "None.",
    data_category_ids: ["email"],
  }],
  data_flows: [{
    id: "profile-write",
    from: "profile API",
    to: "profile database",
    transport: "encrypted service connection",
    protection: "service identity and field-level access control",
    data_category_ids: ["email"],
  }],
  third_parties: [],
  risks: [{
    id: "email-disclosure",
    harm: "Unwanted disclosure of a customer email address.",
    affected_subjects: "Customers.",
    likelihood_basis: "API and storage exposure paths.",
    control: "Object authorization and encrypted transport.",
    verification: "Authorization tests and configuration evidence.",
    owner: "identity-team",
    residual_risk: "Privileged operator access.",
  }],
  rights_and_requests: {
    access: "Export the current profile.",
    correction: "Allow verified profile updates.",
    deletion: "Run the documented deletion workflow.",
    export: "Produce a machine-readable profile export.",
    objection_or_restriction: "Route the request to the privacy owner.",
  },
  review: {
    owner: "privacy-reviewer",
    reviewed_at: "2026-10-25",
    evidence: ["review-123"],
  },
};
assert.strictEqual(
  validatePrivacyAnalysis(privacyAnalysis).decision,
  "ready-for-qualified-review",
);
const capacityPlan = {
  schema: 1,
  kind: "capacity-plan",
  system: "checkout",
  revision: "fixture-revision",
  created_at: "2026-10-25",
  workload: {
    name: "checkout requests",
    demand_unit: "requests",
    observation_window: "rolling seven days",
    demand_period_seconds: 1,
    baseline_demand: 100,
    peak_demand: 300,
    growth_assumption: "Twenty percent growth over twelve months.",
    service_objective: "Project latency and availability objectives.",
  },
  resources: [{
    id: "api",
    description: "Checkout API instances.",
    capacity_unit: "requests per second",
    measurement_source: "staging load test report.",
    capacity_per_instance: 200,
    instances: 3,
    observed_peak_demand: 300,
    max_utilization: 0.7,
    cost_per_instance_hour: 0.2,
  }],
  cost: {
    currency: "USD",
    price_snapshot_at: "2026-10-25",
    price_source: "Saved provider price record.",
    hours_per_month: 730,
    other_monthly_cost: 50,
  },
  scenarios: [{
    id: "forecast-peak",
    description: "Expected peak after forecast growth.",
    assumption: "Traffic shape stays comparable to the measured peak.",
    demand: 360,
    allocations: [{ resource_id: "api", instances: 3 }],
  }],
  review: {
    owner: "platform-team",
    evidence: ["load-test-123"],
  },
};
const capacityEvaluation = evaluateCapacityPlan(capacityPlan);
assert.strictEqual(capacityEvaluation.decision, "within-declared-limits");
assert.strictEqual(capacityEvaluation.cost.monthly, 488);
assert.strictEqual(
  evaluateCapacityPlan({
    ...capacityPlan,
    scenarios: [{
      ...capacityPlan.scenarios[0],
      demand: 500,
    }],
  }).decision,
  "capacity-gap",
);

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
  "impact",
  "--files",
  "src/api/orders.js,src/domain/money.js",
  "--json",
]);
assert.strictEqual(serviceRisk.status, 0, serviceRisk.stderr);
assert.strictEqual(JSON.parse(serviceRisk.stdout).risk_mode, "service");
assert.strictEqual(JSON.parse(serviceRisk.stdout).workflow, "impact");

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
      "test:contract":
        "node -e \"process.exit(process.env.RIVET_AUTHORIZED_TARGET === 'http://127.0.0.1:3000/' ? 0 : 1)\"",
      "security:scan": "node -e \"process.exit(0)\"",
    },
  }),
);
const intelligenceInspection = invoke(intelligence, ["inspect", "--json"]);
assert.strictEqual(intelligenceInspection.status, 0, intelligenceInspection.stderr);
assert.deepStrictEqual(
  JSON.parse(intelligenceInspection.stdout).project.checks.map((item) => item.kind),
  ["coverage-check", "mutation-check", "property-check", "contract-check"],
);
assert.strictEqual(
  JSON.parse(intelligenceInspection.stdout).project.security_checks[0].kind,
  "sast-check",
);

const contractDryRun = invoke(intelligence, ["contract", "--dry-run"]);
assert.strictEqual(contractDryRun.status, 0, contractDryRun.stderr);
assert.match(contractDryRun.stdout, /test:contract/);
const contractWithoutAuthorization = invoke(intelligence, [
  "contract",
  "--target",
  "http://127.0.0.1:3000",
]);
assert.strictEqual(contractWithoutAuthorization.status, 1);
assert.match(contractWithoutAuthorization.stderr, /explicit --allow-network/);
const nonlocalContract = invoke(intelligence, [
  "contract",
  "--target",
  "https://api.example.test",
  "--allow-network",
]);
assert.strictEqual(nonlocalContract.status, 1);
assert.match(nonlocalContract.stderr, /explicit --allow-nonlocal-target/);
const contractRun = invoke(intelligence, [
  "contract",
  "--target",
  "http://127.0.0.1:3000",
  "--allow-network",
]);
assert.strictEqual(contractRun.status, 0, contractRun.stderr);
const contractRunReport = JSON.parse(contractRun.stdout);
assert.strictEqual(contractRunReport.decision, "pass");
assert.strictEqual(
  contractRunReport.authorized_target,
  "http://127.0.0.1:3000/",
);

const threatModelPath = path.join(intelligence, "threat-model.json");
const initializedThreatModel = invoke(intelligence, [
  "threat-model",
  "init",
  "--system",
  "Order API",
  "--revision",
  "fixture-revision",
  "--created-at",
  "2026-10-25",
  "--output",
  "threat-model.json",
]);
assert.strictEqual(initializedThreatModel.status, 0, initializedThreatModel.stderr);
const incompleteThreatModel = invoke(intelligence, [
  "threat-model",
  "validate",
  "--file",
  "threat-model.json",
]);
assert.strictEqual(incompleteThreatModel.status, 1);
assert.strictEqual(
  JSON.parse(incompleteThreatModel.stdout).decision,
  "incomplete",
);
const threatModel = JSON.parse(fs.readFileSync(threatModelPath, "utf8"));
threatModel.assets = [{ id: "orders", description: "Customer orders." }];
threatModel.actors = [{ id: "customer", description: "Authenticated customer." }];
threatModel.entry_points = [{ id: "order-api", description: "Order HTTP API." }];
threatModel.trust_boundaries = [
  { id: "internet-api", description: "Internet to API boundary." },
];
threatModel.data_flows = [
  { id: "read-order", description: "Customer requests an order." },
];
threatModel.abuse_cases = [
  { id: "cross-account", description: "Read another customer's order." },
];
threatModel.threats = [
  {
    id: "broken-object-authorization",
    description: "A customer reads another customer's order.",
    asset_ids: ["orders"],
    actor_ids: ["customer"],
    entry_point_ids: ["order-api"],
    trust_boundary_ids: ["internet-api"],
    data_flow_ids: ["read-order"],
    abuse_case_ids: ["cross-account"],
    impact: "Confidential order data is disclosed.",
    likelihood_basis: "The object identifier is controlled by the caller.",
    control: "Authorize the order against the authenticated customer.",
    verification: "Run positive, negative, and cross-customer authorization tests.",
    verification_evidence: ["reports/authorization.xml"],
    standard_mappings: ["CWE-639"],
    owner: "orders-team",
    status: "mitigated",
  },
];
threatModel.residual_risks = [
  {
    description: "Application defects can bypass the policy.",
    owner: "orders-team",
  },
];
threatModel.review = {
  owner: "security-reviewer",
  reviewed_at: "2026-10-25",
  evidence: ["reviews/threat-model.md"],
};
fs.writeFileSync(threatModelPath, JSON.stringify(threatModel));
const validThreatModel = invoke(intelligence, [
  "threat-model",
  "validate",
  "--file",
  "threat-model.json",
]);
assert.strictEqual(validThreatModel.status, 0, validThreatModel.stderr);
const validThreatModelReport = JSON.parse(validThreatModel.stdout);
assert.strictEqual(validThreatModelReport.decision, "ready-for-review");
assert.deepStrictEqual(validThreatModelReport.faults, []);

const securityDryRun = invoke(intelligence, [
  "security",
  "--run",
  "--dry-run",
]);
assert.strictEqual(securityDryRun.status, 0, securityDryRun.stderr);
assert.match(securityDryRun.stdout, /security:scan/);
const securityWithoutNetworkApproval = invoke(intelligence, [
  "security",
  "--run",
]);
assert.strictEqual(securityWithoutNetworkApproval.status, 1);
assert.match(
  securityWithoutNetworkApproval.stderr,
  /explicit --allow-network/,
);
const securityRun = invoke(intelligence, [
  "security",
  "--run",
  "--allow-network",
]);
assert.strictEqual(securityRun.status, 0, securityRun.stderr);
assert.strictEqual(JSON.parse(securityRun.stdout).decision, "pass");

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
assert.strictEqual(coverageReport.format, "istanbul-summary-json");
assert.match(coverageReport.limitations[0], /does not prove/);

fs.writeFileSync(
  path.join(intelligence, "coverage.xml"),
  '<coverage lines-valid="20" lines-covered="15" branches-valid="8" branches-covered="6"></coverage>',
);
const coberturaEvidence = invoke(intelligence, [
  "test",
  "--coverage-report",
  "coverage.xml",
]);
assert.strictEqual(coberturaEvidence.status, 0, coberturaEvidence.stderr);
const coberturaReport = JSON.parse(coberturaEvidence.stdout);
assert.strictEqual(coberturaReport.format, "cobertura-xml");
assert.strictEqual(coberturaReport.metrics.branches.percent, 75);

fs.writeFileSync(
  path.join(intelligence, "jacoco.xml"),
  '<report name="fixture"><package name="orders"><counter type="LINE" missed="4" covered="6"/></package><counter type="INSTRUCTION" missed="8" covered="12"/><counter type="BRANCH" missed="2" covered="2"/><counter type="LINE" missed="4" covered="6"/><counter type="METHOD" missed="1" covered="3"/></report>',
);
const jacocoEvidence = invoke(intelligence, [
  "test",
  "--coverage-report",
  "jacoco.xml",
]);
assert.strictEqual(jacocoEvidence.status, 0, jacocoEvidence.stderr);
const jacocoReport = JSON.parse(jacocoEvidence.stdout);
assert.strictEqual(jacocoReport.format, "jacoco-xml");
assert.strictEqual(jacocoReport.metrics.functions.percent, 75);

fs.writeFileSync(
  path.join(intelligence, "coverage.lcov"),
  "TN:\nSF:src/order.c\nFNF:2\nFNH:1\nBRF:4\nBRH:3\nLF:10\nLH:8\nend_of_record\n",
);
const lcovEvidence = invoke(intelligence, [
  "test",
  "--coverage-report",
  "coverage.lcov",
]);
assert.strictEqual(lcovEvidence.status, 0, lcovEvidence.stderr);
const lcovReport = JSON.parse(lcovEvidence.stdout);
assert.strictEqual(lcovReport.format, "lcov");
assert.strictEqual(lcovReport.metrics.lines.percent, 80);

fs.writeFileSync(
  path.join(intelligence, "cover.out"),
  "mode: atomic\nexample/order.go:10.1,12.2 2 1\nexample/order.go:14.1,15.2 1 0\n",
);
const goCoverageEvidence = invoke(intelligence, [
  "test",
  "--coverage-report",
  "cover.out",
]);
assert.strictEqual(goCoverageEvidence.status, 0, goCoverageEvidence.stderr);
const goCoverageReport = JSON.parse(goCoverageEvidence.stdout);
assert.strictEqual(goCoverageReport.format, "go-coverprofile");
assert.strictEqual(goCoverageReport.metrics.statements.percent, 66.67);

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
assert.strictEqual(mutationReport.format, "stryker-json");
assert.strictEqual(mutationReport.mutation_score, 50);
assert.strictEqual(mutationReport.surviving_mutants.length, 1);

fs.writeFileSync(
  path.join(intelligence, "mutations.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<mutations>
  <mutation detected="true" status="KILLED">
    <sourceFile>Order.java</sourceFile>
    <mutatedClass>example.Order</mutatedClass>
    <mutatedMethod>total</mutatedMethod>
    <lineNumber>12</lineNumber>
    <mutator>MathMutator</mutator>
  </mutation>
  <mutation detected="false" status="NO_COVERAGE">
    <sourceFile>Order.java</sourceFile>
    <mutatedClass>example.Order</mutatedClass>
    <mutatedMethod>discount</mutatedMethod>
    <lineNumber>18</lineNumber>
    <mutator>ReturnValsMutator</mutator>
  </mutation>
</mutations>`,
);
const pitEvidence = invoke(intelligence, [
  "test",
  "--mutation-report",
  "mutations.xml",
]);
assert.strictEqual(pitEvidence.status, 2, pitEvidence.stderr);
const pitReport = JSON.parse(pitEvidence.stdout);
assert.strictEqual(pitReport.format, "pitest-xml");
assert.strictEqual(pitReport.mutation_score, 50);
assert.strictEqual(pitReport.surviving_mutants[0].status, "NO_COVERAGE");

fs.writeFileSync(
  path.join(intelligence, "outcomes.json"),
  JSON.stringify({
    cargo_mutants_version: "25.3.1",
    total_mutants: 2,
    missed: 1,
    caught: 1,
    timeout: 0,
    unviable: 0,
    outcomes: [
      {
        scenario: {
          Mutant: {
            name: "src/order.rs:12: replace + with -",
            file: "src/order.rs",
            genre: "BinaryOperator",
            span: { start: { line: 12, column: 9 } },
          },
        },
        summary: "CaughtMutant",
      },
      {
        scenario: {
          Mutant: {
            name: "src/order.rs:20: replace true with false",
            file: "src/order.rs",
            genre: "BoolValue",
            span: { start: { line: 20, column: 5 } },
          },
        },
        summary: "MissedMutant",
      },
    ],
  }),
);
const cargoMutationEvidence = invoke(intelligence, [
  "test",
  "--mutation-report",
  "outcomes.json",
]);
assert.strictEqual(cargoMutationEvidence.status, 2, cargoMutationEvidence.stderr);
const cargoMutationReport = JSON.parse(cargoMutationEvidence.stdout);
assert.strictEqual(cargoMutationReport.format, "cargo-mutants-json");
assert.strictEqual(cargoMutationReport.mutation_score, 50);
assert.strictEqual(
  cargoMutationReport.surviving_mutants[0].location.file,
  "src/order.rs",
);

fs.writeFileSync(
  path.join(intelligence, "contract.xml"),
  '<testsuite tests="3" failures="1" errors="0" skipped="0"></testsuite>',
);
const contractEvidence = invoke(intelligence, [
  "contract",
  "--report",
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

const unavailableSbomValidator = invoke(intelligence, [
  "sbom",
  "--file",
  "bom.json",
  "--revision",
  "fixture-revision",
  "--validate-schema",
]);
assert.strictEqual(unavailableSbomValidator.status, 1);
assert.strictEqual(
  JSON.parse(unavailableSbomValidator.stdout).schema_validation.result,
  "unavailable",
);

const mockSbomBin = path.join(intelligence, "mock-sbom-bin");
fs.mkdirSync(mockSbomBin);
fs.writeFileSync(
  path.join(mockSbomBin, "cyclonedx"),
  `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  process.stdout.write("0.33.1\\n");
} else {
  process.stdout.write("Valid BOM or signature\\n");
}
`,
  { mode: 0o755 },
);
fs.writeFileSync(
  path.join(mockSbomBin, "pyspdxtools"),
  `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  process.stdout.write("0.8.3\\n");
} else {
  process.stdout.write("This SPDX document is valid.\\n");
}
`,
  { mode: 0o755 },
);
fs.writeFileSync(
  path.join(mockSbomBin, "cosign"),
  `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  process.stdout.write("cosign version v3.1.4\\n");
} else if (
  process.argv.includes("--key") &&
  !process.argv.includes("--insecure-ignore-tlog")
) {
  process.stderr.write("offline key verification must ignore the transparency log\\n");
  process.exit(1);
} else {
  process.stdout.write("Verified OK\\n");
}
`,
  { mode: 0o755 },
);
fs.writeFileSync(path.join(intelligence, "public.pem"), "fixture public key");
const verifiedCycloneDx = invoke(
  intelligence,
  [
    "sbom",
    "--file",
    "bom.json",
    "--revision",
    "fixture-revision",
    "--validate-schema",
    "--signature",
    "embedded",
    "--key-file",
    "public.pem",
  ],
  { env: { PATH: `${mockSbomBin}${path.delimiter}${process.env.PATH}` } },
);
assert.strictEqual(verifiedCycloneDx.status, 0, verifiedCycloneDx.stderr);
const verifiedCycloneDxReport = JSON.parse(verifiedCycloneDx.stdout);
assert.strictEqual(verifiedCycloneDxReport.decision, "verified");
assert.strictEqual(verifiedCycloneDxReport.schema_validation.result, "valid");
assert.strictEqual(verifiedCycloneDxReport.signature_validation.result, "valid");

fs.writeFileSync(
  path.join(intelligence, "bom.spdx.json"),
  JSON.stringify({
    spdxVersion: "SPDX-2.3",
    SPDXID: "SPDXRef-DOCUMENT",
    name: "fixture",
    dataLicense: "CC0-1.0",
    packages: [{ SPDXID: "SPDXRef-Package", name: "fixture" }],
  }),
);
const validatedSpdx = invoke(
  intelligence,
  [
    "sbom",
    "--file",
    "bom.spdx.json",
    "--revision",
    "fixture-revision",
    "--validate-schema",
  ],
  { env: { PATH: `${mockSbomBin}${path.delimiter}${process.env.PATH}` } },
);
assert.strictEqual(validatedSpdx.status, 0, validatedSpdx.stderr);
assert.strictEqual(
  JSON.parse(validatedSpdx.stdout).schema_validation.tool,
  "pyspdxtools",
);

fs.writeFileSync(path.join(intelligence, "bom.bundle.json"), "{}");
const verifiedCosignKey = invoke(
  intelligence,
  [
    "sbom",
    "--file",
    "bom.json",
    "--revision",
    "fixture-revision",
    "--signature",
    "cosign-key",
    "--bundle",
    "bom.bundle.json",
    "--key-file",
    "public.pem",
  ],
  { env: { PATH: `${mockSbomBin}${path.delimiter}${process.env.PATH}` } },
);
assert.strictEqual(verifiedCosignKey.status, 0, verifiedCosignKey.stderr);
const verifiedCosignKeyReport = JSON.parse(verifiedCosignKey.stdout);
assert.strictEqual(verifiedCosignKeyReport.decision, "verified");
assert.strictEqual(
  verifiedCosignKeyReport.signature_validation.mode,
  "cosign-key",
);
assert.match(
  verifiedCosignKeyReport.signature_validation.output,
  /Verified OK/,
);

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

fs.writeFileSync(
  path.join(intelligence, "resilience.json"),
  JSON.stringify({
    calls: [
      {
        id: "api-to-service",
        from: "api",
        to: "service",
        timeout_ms: 1000,
        retries: 2,
        jitter: true,
        idempotent: true,
      },
      {
        id: "service-to-provider",
        from: "service",
        to: "provider",
        timeout_ms: 1500,
        retries: 2,
        jitter: false,
        idempotent: false,
      },
    ],
  }),
);
const resilienceEvidence = invoke(intelligence, [
  "resilience",
  "--file",
  "resilience.json",
]);
assert.strictEqual(resilienceEvidence.status, 2, resilienceEvidence.stderr);
const resilienceReport = JSON.parse(resilienceEvidence.stdout);
assert.ok(
  resilienceReport.findings.some(
    (item) => item.id === "retry-amplification" && item.worst_case_attempts === 9,
  ),
);
assert.ok(
  resilienceReport.findings.some(
    (item) => item.id === "timeout-budget-inversion",
  ),
);
assert.ok(
  resilienceReport.findings.some((item) => item.id === "unsafe-retry"),
);

fs.writeFileSync(
  path.join(intelligence, "runtime-trace.json"),
  JSON.stringify({
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              {
                traceId: "trace-1",
                spanId: "root",
                name: "POST /checkout",
                kind: "SPAN_KIND_SERVER",
              },
              {
                traceId: "trace-1",
                spanId: "payment-1",
                parentSpanId: "root",
                name: "Charge",
                kind: "SPAN_KIND_CLIENT",
                attributes: [
                  { key: "rpc.system.name", value: { stringValue: "grpc" } },
                  { key: "rpc.method", value: { stringValue: "Charge" } },
                  { key: "error.type", value: { stringValue: "UNAVAILABLE" } },
                ],
              },
              {
                traceId: "trace-1",
                spanId: "payment-2",
                parentSpanId: "root",
                name: "Charge",
                kind: "SPAN_KIND_CLIENT",
                attributes: [
                  { key: "rpc.system.name", value: { stringValue: "grpc" } },
                  { key: "rpc.method", value: { stringValue: "Charge" } },
                ],
              },
              {
                traceId: "trace-1",
                spanId: "ledger-1",
                parentSpanId: "payment-1",
                name: "POST",
                kind: 3,
                attributes: [
                  { key: "http.request.method", value: { stringValue: "POST" } },
                  { key: "server.address", value: { stringValue: "ledger" } },
                  { key: "http.request.resend_count", value: { intValue: "1" } },
                ],
              },
              {
                traceId: "trace-1",
                spanId: "ledger-2",
                parentSpanId: "payment-1",
                name: "POST",
                kind: 3,
                attributes: [
                  { key: "http.request.method", value: { stringValue: "POST" } },
                  { key: "server.address", value: { stringValue: "ledger" } },
                ],
              },
            ],
          },
        ],
      },
    ],
  }),
);
const runtimeRetryEvidence = invoke(intelligence, [
  "resilience",
  "--trace",
  "runtime-trace.json",
]);
assert.strictEqual(runtimeRetryEvidence.status, 2, runtimeRetryEvidence.stderr);
const runtimeRetryReport = JSON.parse(runtimeRetryEvidence.stdout);
assert.strictEqual(runtimeRetryReport.trace_format, "otlp-json");
assert.strictEqual(runtimeRetryReport.explicit_http_resends[0].request_attempts, 2);
assert.strictEqual(runtimeRetryReport.repeated_client_groups.length, 2);
assert.strictEqual(runtimeRetryReport.nested_repetition.length, 1);
assert.ok(
  runtimeRetryReport.findings.some(
    (item) => item.id === "runtime-retry-amplification",
  ),
);

fs.writeFileSync(
  path.join(intelligence, "migration-plan.json"),
  JSON.stringify({
    engine: "postgresql",
    compatibility_window: "Keep both columns through release 2026-11.",
    recovery_method: "Restore the old read path and retain the original column.",
    abort_rule: "Stop when error rate exceeds 0.5% or reconciliation differs.",
    owner: "data-platform",
    batch: {
      max_items: 1000,
      resume_cursor: "last_account_id",
    },
    phases: [
      {
        name: "expand",
        actions: ["Add the nullable replacement column."],
        completion_evidence: ["Old and new application versions start."],
      },
      {
        name: "migrate",
        actions: ["Backfill in bounded batches."],
        completion_evidence: ["Every batch records its cursor and count."],
      },
      {
        name: "validate",
        actions: ["Reconcile source and destination values."],
        completion_evidence: ["Mismatch count is zero."],
      },
      {
        name: "contract",
        actions: ["Remove the old column after the compatibility window."],
        completion_evidence: ["No supported version reads the old column."],
      },
    ],
  }),
);
const migrationPlan = invoke(intelligence, [
  "migrate",
  "--plan",
  "migration-plan.json",
]);
assert.strictEqual(migrationPlan.status, 0, migrationPlan.stderr);
assert.strictEqual(JSON.parse(migrationPlan.stdout).decision, "valid");

fs.writeFileSync(
  path.join(intelligence, "migration-dry-run.json"),
  JSON.stringify({
    revision: "fixture-revision",
    environment: "isolated-copy",
    started_at: "2026-10-25T10:00:00Z",
    finished_at: "2026-10-25T10:05:00Z",
    source_count: 100,
    migrated_count: 99,
    validated_count: 99,
    interrupted: true,
    resumed: false,
    recovery_test: "Restored the old application read path.",
    batches: [{ cursor: "50", count: 50 }, { cursor: "99", count: 49 }],
    lock_observations: [],
  }),
);
const migrationDryRun = invoke(intelligence, [
  "migrate",
  "--dry-run",
  "migration-dry-run.json",
]);
assert.strictEqual(migrationDryRun.status, 2, migrationDryRun.stderr);
const dryRunReport = JSON.parse(migrationDryRun.stdout);
assert.ok(
  dryRunReport.faults.includes(
    "source_count and migrated_count do not reconcile",
  ),
);
assert.ok(
  dryRunReport.faults.includes(
    "an interrupted dry run must record successful resume or remain incomplete",
  ),
);

fs.writeFileSync(
  path.join(intelligence, "telemetry.json"),
  JSON.stringify({
    semantic_convention_version: "1.38.0",
    resource_attributes: {
      "deployment.environment": "production",
    },
    metrics: [{
      name: "http.server.requests",
      attributes: [
        { name: "http.request.method", bounded: true },
        {
          name: "user.id",
          cardinality: "unbounded",
          sensitive: true,
        },
      ],
    }],
    alerts: [{
      name: "Request failures",
      urgency: "page",
      owner: "service-team",
    }],
  }),
);
const telemetryEvidence = invoke(intelligence, [
  "observe",
  "--file",
  "telemetry.json",
]);
assert.strictEqual(telemetryEvidence.status, 2, telemetryEvidence.stderr);
const telemetryReport = JSON.parse(telemetryEvidence.stdout);
assert.ok(
  telemetryReport.findings.some(
    (item) => item.id === "missing-service-name",
  ),
);

const performanceWorkload = {
  id: "orders-read",
  duration_seconds: 60,
  concurrency: 20,
  data_set: "fixture-v1",
};
fs.writeFileSync(
  path.join(intelligence, "performance-baseline.json"),
  JSON.stringify({
    revision: "baseline",
    environment: { cpu: "4", memory_gb: 8 },
    workload: performanceWorkload,
    metrics: {
      latency_p95_ms: 100,
      throughput_rps: 200,
      error_rate: 0.001,
    },
  }),
);
fs.writeFileSync(
  path.join(intelligence, "performance-candidate.json"),
  JSON.stringify({
    revision: "candidate",
    environment: { cpu: "4", memory_gb: 8 },
    workload: performanceWorkload,
    metrics: {
      latency_p95_ms: 120,
      throughput_rps: 210,
      error_rate: 0.002,
    },
  }),
);
const performanceEvidence = invoke(intelligence, [
  "performance",
  "--baseline",
  "performance-baseline.json",
  "--candidate",
  "performance-candidate.json",
]);
assert.strictEqual(performanceEvidence.status, 0, performanceEvidence.stderr);
const performanceReport = JSON.parse(performanceEvidence.stdout);
assert.strictEqual(performanceReport.decision, "comparison-observed");
assert.strictEqual(
  performanceReport.metrics.find((item) => item.name === "latency_p95_ms")
    .delta_percent,
  20,
);
assert.match(performanceReport.limitations[0], /user-defined/);

const changedCandidate = JSON.parse(
  fs.readFileSync(path.join(intelligence, "performance-candidate.json"), "utf8"),
);
changedCandidate.workload.concurrency = 40;
fs.writeFileSync(
  path.join(intelligence, "performance-invalid.json"),
  JSON.stringify(changedCandidate),
);
const invalidPerformance = invoke(intelligence, [
  "performance",
  "--baseline",
  "performance-baseline.json",
  "--candidate",
  "performance-invalid.json",
]);
assert.strictEqual(invalidPerformance.status, 2, invalidPerformance.stderr);
assert.strictEqual(
  JSON.parse(invalidPerformance.stdout).decision,
  "invalid-comparison",
);

fs.writeFileSync(
  path.join(intelligence, "sample-baseline.json"),
  JSON.stringify({
    revision: "baseline",
    workload: performanceWorkload,
    samples: {
      latency_p95_ms: Array.from({ length: 30 }, (_, index) => 100 + index),
    },
  }),
);
fs.writeFileSync(
  path.join(intelligence, "sample-candidate.json"),
  JSON.stringify({
    revision: "candidate",
    workload: performanceWorkload,
    samples: {
      latency_p95_ms: Array.from({ length: 30 }, (_, index) => 110 + index),
    },
  }),
);
const samplePerformance = invoke(intelligence, [
  "performance",
  "--sample-baseline",
  "sample-baseline.json",
  "--sample-candidate",
  "sample-candidate.json",
]);
assert.strictEqual(samplePerformance.status, 0, samplePerformance.stderr);
const sampleReport = JSON.parse(samplePerformance.stdout);
assert.strictEqual(sampleReport.decision, "comparison-observed");
assert.strictEqual(
  sampleReport.metrics[0].directional_evidence,
  "increase",
);
assert.strictEqual(sampleReport.metrics[0].baseline.count, 30);
assert.ok(Array.isArray(sampleReport.metrics[0].mean_delta_ci_95_approx));

fs.writeFileSync(
  path.join(intelligence, "small-sample.json"),
  JSON.stringify({
    revision: "candidate-small",
    workload: performanceWorkload,
    samples: { latency_p95_ms: [110, 111, 112] },
  }),
);
const insufficientSamples = invoke(intelligence, [
  "performance",
  "--sample-baseline",
  "sample-baseline.json",
  "--sample-candidate",
  "small-sample.json",
]);
assert.strictEqual(insufficientSamples.status, 1, insufficientSamples.stderr);
assert.strictEqual(
  JSON.parse(insufficientSamples.stdout).metrics[0].directional_evidence,
  "insufficient-samples",
);

fs.writeFileSync(
  path.join(intelligence, "performance-comparison.json"),
  JSON.stringify(performanceReport),
);
const releasePlan = {
  revision: "candidate",
  owner: "release-owner",
  compatibility: {
    status: "compatible",
    evidence: "contract-suite-1",
  },
  monitoring_window: "30 minutes per stage",
  rollout_stages: [
    { percent: 5, success_evidence: "Error and latency objectives hold." },
    { percent: 25, success_evidence: "No new failure class appears." },
    { percent: 100, success_evidence: "All release objectives hold." },
  ],
  abort_conditions: [
    "Abort when error rate exceeds the release objective.",
  ],
  rollback_steps: [
    "Route traffic to the previous compatible revision.",
  ],
  evidence: [
    { id: "tests", status: "pass" },
    { id: "security", status: "pass" },
  ],
  performance_thresholds: [{
    metric: "latency_p95_ms",
    max_increase_percent: 10,
  }],
  open_risks: [],
};
fs.writeFileSync(
  path.join(intelligence, "release-plan.json"),
  JSON.stringify(releasePlan),
);
const heldRelease = invoke(intelligence, [
  "release",
  "--plan",
  "release-plan.json",
  "--performance",
  "performance-comparison.json",
]);
assert.strictEqual(heldRelease.status, 2, heldRelease.stderr);
const heldReport = JSON.parse(heldRelease.stdout);
assert.strictEqual(heldReport.decision, "hold");
assert.strictEqual(heldReport.performance_thresholds[0].result, "breach");

releasePlan.performance_thresholds[0].max_increase_percent = 25;
fs.writeFileSync(
  path.join(intelligence, "release-plan.json"),
  JSON.stringify(releasePlan),
);
const readyRelease = invoke(intelligence, [
  "release",
  "--plan",
  "release-plan.json",
  "--performance",
  "performance-comparison.json",
]);
assert.strictEqual(readyRelease.status, 0, readyRelease.stderr);
assert.strictEqual(
  JSON.parse(readyRelease.stdout).decision,
  "ready-for-human-approval",
);

const incidentInit = invoke(intelligence, [
  "incident",
  "init",
  "--id",
  "INC-2026-001",
  "--at",
  "2026-10-25T10:00:00Z",
  "--output",
  "incident.json",
]);
assert.strictEqual(incidentInit.status, 0, incidentInit.stderr);
const incidentRead = invoke(intelligence, [
  "incident",
  "add",
  "--file",
  "incident.json",
  "--at",
  "2026-10-25T10:01:00Z",
  "--actor",
  "incident-commander",
  "--type",
  "observation",
  "--statement",
  "The error rate increased.",
  "--evidence",
  "dashboard-snapshot-1",
]);
assert.strictEqual(incidentRead.status, 0, incidentRead.stderr);
assert.match(incidentRead.stdout, /Mode: read/);
const rejectedIncidentWrite = invoke(intelligence, [
  "incident",
  "add",
  "--file",
  "incident.json",
  "--at",
  "2026-10-25T10:02:00Z",
  "--actor",
  "operator",
  "--type",
  "change",
  "--mode",
  "write",
  "--statement",
  "Rollback production.",
]);
assert.strictEqual(rejectedIncidentWrite.status, 1);
assert.match(rejectedIncidentWrite.stderr, /requires --approval/);
const approvedIncidentWrite = invoke(intelligence, [
  "incident",
  "add",
  "--file",
  "incident.json",
  "--at",
  "2026-10-25T10:02:00Z",
  "--actor",
  "operator",
  "--type",
  "change",
  "--mode",
  "write",
  "--statement",
  "Rollback production.",
  "--approval",
  "APPROVAL-123",
]);
assert.strictEqual(approvedIncidentWrite.status, 0, approvedIncidentWrite.stderr);
const incidentValidation = invoke(intelligence, [
  "incident",
  "validate",
  "--file",
  "incident.json",
]);
assert.strictEqual(incidentValidation.status, 0, incidentValidation.stderr);
assert.strictEqual(
  JSON.parse(incidentValidation.stdout).event_count,
  2,
);
const postmortem = invoke(intelligence, [
  "postmortem",
  "--incident",
  "incident.json",
  "--output",
  "postmortem.md",
]);
assert.strictEqual(postmortem.status, 0, postmortem.stderr);
const postmortemBody = fs.readFileSync(
  path.join(intelligence, "postmortem.md"),
  "utf8",
);
assert.match(postmortemBody, /# Postmortem: INC-2026-001/);
assert.match(postmortemBody, /The error rate increased/);
assert.match(postmortemBody, /does not infer root cause/);
assert.match(postmortemBody, /Add owner, priority, due date, and verification/);
const tamperedIncident = JSON.parse(
  fs.readFileSync(path.join(intelligence, "incident.json"), "utf8"),
);
tamperedIncident.events[0].statement = "Changed after recording.";
fs.writeFileSync(
  path.join(intelligence, "incident.json"),
  JSON.stringify(tamperedIncident),
);
const invalidIncident = invoke(intelligence, [
  "incident",
  "validate",
  "--file",
  "incident.json",
]);
assert.strictEqual(invalidIncident.status, 2, invalidIncident.stderr);
assert.ok(
  JSON.parse(invalidIncident.stdout).faults.some((item) =>
    item.includes("invalid digest"),
  ),
);
const rejectedPostmortem = invoke(intelligence, [
  "postmortem",
  "--incident",
  "incident.json",
  "--json",
]);
assert.strictEqual(rejectedPostmortem.status, 1);
assert.match(rejectedPostmortem.stderr, /timeline is invalid/);

const actionInit = invoke(intelligence, [
  "action",
  "init",
  "--id",
  "ACT-001",
  "--incident",
  "INC-2026-001",
  "--created-at",
  "2026-10-25",
  "--output",
  "action.json",
]);
assert.strictEqual(actionInit.status, 0, actionInit.stderr);
const actionFile = path.join(intelligence, "action.json");
const preventiveAction = JSON.parse(fs.readFileSync(actionFile, "utf8"));
Object.assign(preventiveAction, {
  contributing_condition: "The release gate did not verify rollback readiness.",
  change: "Add an automated rollback exercise to release evidence.",
  owner: "release-platform",
  priority: "high",
  due_at: "2026-11-15",
  status: "completed",
});
fs.writeFileSync(actionFile, JSON.stringify(preventiveAction));
const invalidCompletedAction = invoke(intelligence, [
  "action",
  "validate",
  "--file",
  "action.json",
  "--as-of",
  "2026-10-25",
]);
assert.strictEqual(invalidCompletedAction.status, 2, invalidCompletedAction.stderr);
assert.ok(
  JSON.parse(invalidCompletedAction.stdout).faults.some((item) =>
    item.includes("verification.evidence"),
  ),
);

preventiveAction.verification = {
  method: "Run rollback exercise against the release fixture.",
  evidence: ["rollback-exercise-2026-10-25.json"],
  result: "pass",
  verified_at: "2026-10-25T11:00:00Z",
};
fs.writeFileSync(actionFile, JSON.stringify(preventiveAction));
const completedAction = invoke(intelligence, [
  "action",
  "validate",
  "--file",
  "action.json",
  "--as-of",
  "2026-10-25",
]);
assert.strictEqual(completedAction.status, 0, completedAction.stderr);
assert.strictEqual(
  JSON.parse(completedAction.stdout).decision,
  "verified-complete",
);

preventiveAction.status = "open";
fs.writeFileSync(actionFile, JSON.stringify(preventiveAction));
const overdueAction = invoke(intelligence, [
  "action",
  "validate",
  "--file",
  "action.json",
  "--as-of",
  "2026-12-01",
]);
assert.strictEqual(overdueAction.status, 1, overdueAction.stderr);
assert.strictEqual(JSON.parse(overdueAction.stdout).decision, "overdue");

const ticketPlan = invoke(intelligence, [
  "action",
  "sync",
  "--file",
  "action.json",
  "--provider",
  "github",
  "--repo",
  "example/rivet",
  "--labels",
  "reliability,preventive-action",
  "--dry-run",
]);
assert.strictEqual(ticketPlan.status, 0, ticketPlan.stderr);
const ticketPlanReport = JSON.parse(ticketPlan.stdout);
assert.strictEqual(ticketPlanReport.decision, "planned-not-executed");
assert.deepStrictEqual(ticketPlanReport.labels, [
  "reliability",
  "preventive-action",
]);

const ticketWithoutApproval = invoke(intelligence, [
  "action",
  "sync",
  "--file",
  "action.json",
  "--provider",
  "github",
  "--repo",
  "example/rivet",
  "--allow-network",
  "--allow-write",
]);
assert.strictEqual(ticketWithoutApproval.status, 1);
assert.match(ticketWithoutApproval.stderr, /requires .*--approval/);

const mockTicketBin = path.join(intelligence, "mock-ticket-bin");
fs.mkdirSync(mockTicketBin);
fs.writeFileSync(
  path.join(mockTicketBin, "gh"),
  `#!/usr/bin/env node
process.stdin.resume();
process.stdin.on("end", () => {
  process.stdout.write("https://github.com/example/rivet/issues/42\\n");
});
`,
  { mode: 0o755 },
);
const ticketSync = invoke(
  intelligence,
  [
    "action",
    "sync",
    "--file",
    "action.json",
    "--provider",
    "github",
    "--repo",
    "example/rivet",
    "--allow-network",
    "--allow-write",
    "--approval",
    "CHANGE-2026-104",
    "--synced-at",
    "2026-10-25T12:00:00Z",
  ],
  { env: { PATH: `${mockTicketBin}${path.delimiter}${process.env.PATH}` } },
);
assert.strictEqual(ticketSync.status, 0, ticketSync.stderr);
const ticketSyncReport = JSON.parse(ticketSync.stdout);
assert.strictEqual(ticketSyncReport.decision, "created");
assert.strictEqual(ticketSyncReport.ticket.number, 42);
const synchronizedAction = JSON.parse(fs.readFileSync(actionFile, "utf8"));
assert.strictEqual(synchronizedAction.ticket.number, 42);
assert.strictEqual(synchronizedAction.ticket.approval, "CHANGE-2026-104");
const duplicateTicketSync = invoke(
  intelligence,
  [
    "action",
    "sync",
    "--file",
    "action.json",
    "--provider",
    "github",
    "--repo",
    "example/rivet",
    "--allow-network",
    "--allow-write",
    "--approval",
    "CHANGE-2026-105",
  ],
  { env: { PATH: `${mockTicketBin}${path.delimiter}${process.env.PATH}` } },
);
assert.strictEqual(duplicateTicketSync.status, 1);
assert.match(duplicateTicketSync.stderr, /already has a synchronized ticket/);

assert.ok(
  telemetryReport.findings.some(
    (item) => item.id === "unbounded-metric-dimension",
  ),
);
assert.ok(
  telemetryReport.findings.some(
    (item) =>
      item.id === "incomplete-alert" &&
      item.missing.includes("harm") &&
      item.missing.includes("first_action"),
  ),
);
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
  "shape",
  "--title",
  "Order authorization",
  "--files",
  "src/auth/policy.js",
  "--output",
  recordPath,
]);
assert.strictEqual(record.status, 0, record.stderr);
assert.match(fs.readFileSync(recordPath, "utf8"), /Risk mode: critical/);

const legacyRecord = invoke(fixture, [
  "record",
  "--title",
  "Legacy alias",
  "--files",
  "src/domain/money.js",
]);
assert.strictEqual(legacyRecord.status, 0, legacyRecord.stderr);
assert.match(legacyRecord.stdout, /# Legacy alias/);

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

const reviewJsonPath = path.join(fixture, ".rivet/review.json");
const preparedJsonReview = invoke(fixture, [
  "review",
  "--record",
  "change.md",
  "--files",
  "src/auth/policy.js",
  "--output",
  ".rivet/review.json",
]);
assert.strictEqual(preparedJsonReview.status, 0, preparedJsonReview.stderr);
const reviewFindingsPath = path.join(fixture, ".rivet/findings.json");
fs.writeFileSync(
  reviewFindingsPath,
  JSON.stringify({
    verdict: "findings",
    findings: [
      {
        id: "REV-001",
        severity: "high",
        category: "authorization",
        summary: "The negative authorization path has no evidence.",
        evidence: "The change record lists no negative authorization check.",
        requirement: null,
        file: "src/auth/policy.js",
        line: 1,
        recommendation: "Add a cross-account denial test.",
        confidence: "high",
      },
    ],
    limitations: ["The packet has no runtime authorization trace."],
  }),
);
const ingestedReview = invoke(fixture, [
  "review",
  "ingest",
  "--packet",
  ".rivet/review.json",
  "--findings",
  ".rivet/findings.json",
]);
assert.strictEqual(ingestedReview.status, 2, ingestedReview.stderr);
assert.strictEqual(JSON.parse(ingestedReview.stdout).decision, "review-findings");

const mockBin = path.join(fixture, "mock-review-bin");
fs.mkdirSync(mockBin);
fs.writeFileSync(
  path.join(mockBin, "codex"),
  `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const output = args[args.indexOf("--output-last-message") + 1];
fs.writeFileSync(output, JSON.stringify({
  verdict: "pass",
  findings: [],
  limitations: ["Mocked native reviewer protocol."]
}));
`,
  { mode: 0o755 },
);
const nativeReviewWithoutAuthorization = invoke(
  fixture,
  [
    "review",
    "run",
    "--packet",
    ".rivet/review.json",
    "--provider",
    "codex",
    "--output",
    ".rivet/native-review.json",
  ],
  { env: { PATH: `${mockBin}${path.delimiter}${process.env.PATH}` } },
);
assert.strictEqual(nativeReviewWithoutAuthorization.status, 1);
assert.match(nativeReviewWithoutAuthorization.stderr, /explicit --allow-network/);
const nativeReview = invoke(
  fixture,
  [
    "review",
    "run",
    "--packet",
    ".rivet/review.json",
    "--provider",
    "codex",
    "--output",
    ".rivet/native-review.json",
    "--allow-network",
  ],
  { env: { PATH: `${mockBin}${path.delimiter}${process.env.PATH}` } },
);
assert.strictEqual(nativeReview.status, 0, nativeReview.stderr);
const nativeReviewReport = JSON.parse(nativeReview.stdout);
assert.strictEqual(nativeReviewReport.decision, "pass");
assert.strictEqual(nativeReviewReport.reviewer.provider, "codex");
assert.match(nativeReviewReport.reviewer.isolation, /ephemeral, read-only/);
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

const referenceEvaluation = invoke(repository, [
  "evaluate",
  "--fixtures",
  "fixtures/reference-systems",
  "--findings",
  "fixtures/reference-systems/expected-findings.json",
]);
assert.strictEqual(referenceEvaluation.status, 0, referenceEvaluation.stderr);
const evaluationReport = JSON.parse(referenceEvaluation.stdout);
assert.strictEqual(evaluationReport.seed_count, 8);
assert.strictEqual(evaluationReport.metrics.recall, 1);
assert.strictEqual(evaluationReport.metrics.precision, 1);

console.log("rivet-evidence tests passed");

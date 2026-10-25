import fs from "fs";

const REQUIRED_PHASES = ["expand", "migrate", "validate", "contract"];

export function validateMigrationPlan(file) {
  const plan = JSON.parse(fs.readFileSync(file, "utf8"));
  const faults = [];
  const phases = Array.isArray(plan.phases) ? plan.phases : [];
  const names = phases.map((phase) => phase.name);
  if (JSON.stringify(names) !== JSON.stringify(REQUIRED_PHASES)) {
    faults.push("phases must use expand, migrate, validate, contract in that order");
  }
  for (const phase of phases) {
    if (!Array.isArray(phase.actions) || phase.actions.length === 0) {
      faults.push(`${phase.name || "unknown"} phase requires actions`);
    }
    if (
      !Array.isArray(phase.completion_evidence) ||
      phase.completion_evidence.length === 0
    ) {
      faults.push(`${phase.name || "unknown"} phase requires completion_evidence`);
    }
  }
  for (const field of [
    "compatibility_window",
    "recovery_method",
    "abort_rule",
    "owner",
  ]) {
    if (!String(plan[field] || "").trim()) faults.push(`${field} is required`);
  }
  if (!plan.batch || !Number.isFinite(plan.batch.max_items) || plan.batch.max_items <= 0) {
    faults.push("batch.max_items must be a positive number");
  }
  if (!String(plan.batch?.resume_cursor || "").trim()) {
    faults.push("batch.resume_cursor is required");
  }
  return {
    schema: 1,
    kind: "migration-plan",
    evidence_class: "derived",
    artifact: file,
    engine: plan.engine || "unspecified",
    phases,
    compatibility_window: plan.compatibility_window || null,
    recovery_method: plan.recovery_method || null,
    abort_rule: plan.abort_rule || null,
    owner: plan.owner || null,
    batch: plan.batch || null,
    faults,
    decision: faults.length ? "invalid" : "valid",
    limitations: [
      "A valid plan does not prove that the migration, recovery, or compatibility behavior works.",
      "Execute a representative dry run and interruption test before production use.",
    ],
  };
}

export function validateMigrationDryRun(file) {
  const run = JSON.parse(fs.readFileSync(file, "utf8"));
  const faults = [];
  for (const field of [
    "revision",
    "environment",
    "started_at",
    "finished_at",
    "recovery_test",
  ]) {
    if (!String(run[field] || "").trim()) faults.push(`${field} is required`);
  }
  for (const field of ["source_count", "migrated_count", "validated_count"]) {
    if (!Number.isInteger(run[field]) || run[field] < 0) {
      faults.push(`${field} must be a non-negative integer`);
    }
  }
  if (
    Number.isInteger(run.source_count) &&
    Number.isInteger(run.migrated_count) &&
    run.source_count !== run.migrated_count
  ) {
    faults.push("source_count and migrated_count do not reconcile");
  }
  if (
    Number.isInteger(run.migrated_count) &&
    Number.isInteger(run.validated_count) &&
    run.migrated_count !== run.validated_count
  ) {
    faults.push("migrated_count and validated_count do not reconcile");
  }
  if (run.interrupted === true && run.resumed !== true) {
    faults.push("an interrupted dry run must record successful resume or remain incomplete");
  }
  if (!Array.isArray(run.batches) || run.batches.length === 0) {
    faults.push("batches must record at least one batch");
  }
  return {
    schema: 1,
    kind: "migration-dry-run",
    evidence_class: "observed",
    artifact: file,
    revision: run.revision || null,
    environment: run.environment || null,
    started_at: run.started_at || null,
    finished_at: run.finished_at || null,
    counts: {
      source: run.source_count ?? null,
      migrated: run.migrated_count ?? null,
      validated: run.validated_count ?? null,
    },
    interrupted: run.interrupted ?? null,
    resumed: run.resumed ?? null,
    recovery_test: run.recovery_test || null,
    lock_observations: run.lock_observations || [],
    batches: run.batches || [],
    faults,
    decision: faults.length ? "invalid-or-incomplete" : "observed",
    limitations: [
      "A dry run proves behavior only for the recorded revision, environment, data, and workload.",
      "Production volume, skew, locks, replicas, and concurrent traffic can differ.",
    ],
  };
}

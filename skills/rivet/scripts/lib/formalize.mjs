function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function formalModelTemplate(system, revision, createdAt) {
  return {
    schema: 1,
    kind: "formal-model",
    system: system || "",
    revision: revision || "",
    created_at: createdAt,
    language: "TLA+",
    module: "",
    config: "",
    abstraction: {
      scope: [],
      assumptions: [],
      omitted_behavior: [],
      implementation_mapping: [],
    },
    checks: {
      invariants: [],
      temporal_properties: [],
      deadlock: true,
    },
    bounds: {
      constants: {},
      constraints: [],
    },
    review: {
      owner: "",
      reviewed_at: "",
      evidence: [],
    },
  };
}

export function validateFormalModel(model) {
  const faults = [];
  const warnings = [];
  if (model?.schema !== 1 || model?.kind !== "formal-model") {
    faults.push("The file must use Rivet formal-model schema 1.");
  }
  for (const field of [
    "system",
    "revision",
    "created_at",
    "language",
    "module",
    "config",
  ]) {
    if (!text(model?.[field])) faults.push(`The formal model requires ${field}.`);
  }
  if (model?.language !== "TLA+") {
    warnings.push("The current formal-model workflow has native guidance only for TLA+.");
  }

  const abstraction = model?.abstraction || {};
  for (const field of [
    "scope",
    "assumptions",
    "omitted_behavior",
    "implementation_mapping",
  ]) {
    if (!list(abstraction[field]).length) {
      faults.push(`The abstraction requires ${field}.`);
    }
  }

  const checks = model?.checks || {};
  if (!list(checks.invariants).length) {
    faults.push("The model requires at least one invariant.");
  }
  if (!list(checks.temporal_properties).length) {
    warnings.push("The model declares no temporal property.");
  }
  if (checks.deadlock !== true && checks.deadlock !== false) {
    faults.push("The deadlock check must be a boolean.");
  }

  if (
    !model?.bounds ||
    typeof model.bounds.constants !== "object" ||
    Array.isArray(model.bounds.constants) ||
    !Object.keys(model.bounds.constants).length
  ) {
    faults.push("The model requires bounded constants.");
  }
  if (!list(model?.bounds?.constraints).length) {
    warnings.push("The model declares no additional state-space constraint.");
  }
  if (!text(model?.review?.owner) || !text(model?.review?.reviewed_at)) {
    warnings.push("The formal model has no completed human review record.");
  }
  if (!list(model?.review?.evidence).length) {
    warnings.push("The formal model has no human review evidence.");
  }

  return {
    schema: 1,
    kind: "formal-model-validation",
    evidence_class: "derived",
    faults,
    warnings,
    checks: {
      invariants: list(checks.invariants).length,
      temporal_properties: list(checks.temporal_properties).length,
      deadlock: checks.deadlock ?? null,
    },
    decision: faults.length ? "incomplete" : "ready-for-model-checking",
    limitations: [
      "Manifest validation does not parse or run the formal model.",
      "The abstraction can omit implementation behavior and environmental faults.",
      "A qualified reviewer must compare the model with the implementation.",
    ],
  };
}

export function normalizeModelCheckResult(result) {
  const faults = [];
  const warnings = [];
  if (result?.schema !== 1 || result?.kind !== "model-check-result") {
    faults.push("The file must use Rivet model-check-result schema 1.");
  }
  for (const field of [
    "language",
    "checker",
    "checker_version",
    "model_digest",
    "config_digest",
    "revision",
    "started_at",
    "finished_at",
    "command_digest",
  ]) {
    if (!text(result?.[field])) faults.push(`The result requires ${field}.`);
  }
  if (!["completed", "violation", "resource-limit", "tool-error"].includes(
    result?.outcome,
  )) {
    faults.push("The result requires a valid outcome.");
  }
  for (const field of ["states_generated", "distinct_states"]) {
    if (!Number.isInteger(result?.[field]) || result[field] < 0) {
      faults.push(`The result requires non-negative integer ${field}.`);
    }
  }
  if (result?.outcome === "violation" && !list(result?.violations).length) {
    faults.push("A violation outcome requires violation records.");
  }
  if (result?.outcome === "resource-limit" && !text(result?.limit)) {
    faults.push("A resource-limit outcome requires the reached limit.");
  }
  if (result?.outcome === "completed" && list(result?.violations).length) {
    faults.push("A completed result cannot contain violations.");
  }
  if (result?.outcome === "resource-limit") {
    warnings.push("The checker did not exhaust the declared state space.");
  }

  const decision = faults.length
    ? "invalid-evidence"
    : result.outcome === "violation"
      ? "property-violation"
      : result.outcome === "completed"
        ? "no-violation-observed"
        : "inconclusive";
  return {
    schema: 1,
    kind: "model-check-evidence",
    evidence_class: "observed",
    language: result?.language || null,
    checker: result?.checker || null,
    checker_version: result?.checker_version || null,
    revision: result?.revision || null,
    outcome: result?.outcome || null,
    states_generated: result?.states_generated ?? null,
    distinct_states: result?.distinct_states ?? null,
    violations: list(result?.violations),
    limit: result?.limit || null,
    faults,
    warnings,
    decision,
    limitations: [
      "No observed violation applies only to the checked model and declared bounds.",
      "Model checking does not prove that the implementation conforms to the model.",
      "Preserve counterexamples and exact tool inputs for review and reproduction.",
    ],
  };
}

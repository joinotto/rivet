function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function chaosTemplate(system, revision, createdAt) {
  return {
    schema: 1,
    kind: "chaos-experiment",
    system: system || "",
    revision: revision || "",
    created_at: createdAt,
    environment: "",
    target: {
      selector: "",
      expected_count: 0,
      excluded: [],
    },
    steady_state: {
      hypothesis: "",
      probes: [],
    },
    method: {
      fault: "",
      duration_seconds: 0,
      blast_radius: "",
    },
    stop_conditions: [],
    rollback: {
      actions: [],
      verification: [],
    },
    observation: {
      metrics: [],
      user_harm_signal: "",
    },
    approval: {
      required: true,
      owner: "",
      reference: "",
    },
  };
}

export function validateChaosExperiment(experiment) {
  const faults = [];
  const warnings = [];
  if (experiment?.schema !== 1 || experiment?.kind !== "chaos-experiment") {
    faults.push("The file must use Rivet chaos-experiment schema 1.");
  }
  for (const field of ["system", "revision", "created_at", "environment"]) {
    if (!text(experiment?.[field])) {
      faults.push(`The chaos experiment requires ${field}.`);
    }
  }

  const target = experiment?.target || {};
  if (!text(target.selector)) faults.push("The target requires selector.");
  if (!Number.isInteger(target.expected_count) || target.expected_count < 1) {
    faults.push("The target expected_count must be a positive integer.");
  }
  if (!list(target.excluded).length) {
    warnings.push("The target does not declare excluded resources.");
  }

  const steadyState = experiment?.steady_state || {};
  if (!text(steadyState.hypothesis)) {
    faults.push("The experiment requires a steady-state hypothesis.");
  }
  const probes = list(steadyState.probes);
  if (!probes.length) faults.push("The experiment requires steady-state probes.");
  for (const probe of probes) {
    const label = probe?.id || "record";
    for (const field of ["id", "measure", "tolerance", "source"]) {
      if (!text(probe?.[field])) faults.push(`Probe ${label} requires ${field}.`);
    }
  }

  const method = experiment?.method || {};
  for (const field of ["fault", "blast_radius"]) {
    if (!text(method[field])) faults.push(`The method requires ${field}.`);
  }
  if (!Number.isInteger(method.duration_seconds) || method.duration_seconds < 1) {
    faults.push("The method duration_seconds must be a positive integer.");
  }

  const stopConditions = list(experiment?.stop_conditions);
  if (!stopConditions.length) {
    faults.push("The experiment requires at least one stop condition.");
  }
  for (const condition of stopConditions) {
    const label = condition?.id || "record";
    for (const field of ["id", "signal", "threshold", "action"]) {
      if (!text(condition?.[field])) {
        faults.push(`Stop condition ${label} requires ${field}.`);
      }
    }
  }

  const rollback = experiment?.rollback || {};
  if (!list(rollback.actions).length) {
    faults.push("The experiment requires rollback actions.");
  }
  if (!list(rollback.verification).length) {
    faults.push("The experiment requires rollback verification.");
  }

  const observation = experiment?.observation || {};
  if (!list(observation.metrics).length) {
    faults.push("The experiment requires observation metrics.");
  }
  if (!text(observation.user_harm_signal)) {
    faults.push("The experiment requires a user-harm signal.");
  }

  const approval = experiment?.approval || {};
  if (approval.required !== true) {
    faults.push("The chaos experiment must require explicit approval.");
  }
  if (!text(approval.owner)) faults.push("The approval requires owner.");
  if (!text(approval.reference)) {
    warnings.push("The experiment has no approval reference.");
  }
  if (String(experiment?.environment).toLowerCase() === "production") {
    warnings.push("Production execution needs a stricter blast-radius review.");
  }

  return {
    schema: 1,
    kind: "chaos-experiment-validation",
    evidence_class: "derived",
    faults,
    warnings,
    counts: {
      probes: probes.length,
      stop_conditions: stopConditions.length,
      rollback_actions: list(rollback.actions).length,
      observation_metrics: list(observation.metrics).length,
    },
    decision: faults.length ? "incomplete" : "ready-for-approval",
    limitations: [
      "Validation does not execute the experiment or prove resilience.",
      "Run the experiment only in the declared environment and blast radius.",
      "Observe stop conditions independently from the fault-injection process.",
    ],
  };
}

export function normalizeChaosResult(result) {
  const faults = [];
  const warnings = [];
  if (result?.schema !== 1 || result?.kind !== "chaos-experiment-result") {
    faults.push("The file must use Rivet chaos-experiment-result schema 1.");
  }
  for (const field of [
    "experiment_digest",
    "revision",
    "environment",
    "started_at",
    "finished_at",
    "tool",
    "tool_version",
  ]) {
    if (!text(result?.[field])) faults.push(`The result requires ${field}.`);
  }
  if (!["held", "violated", "not-evaluated"].includes(result?.hypothesis)) {
    faults.push("The result requires a valid hypothesis outcome.");
  }
  if (!["completed", "stopped", "failed-to-start"].includes(result?.execution)) {
    faults.push("The result requires a valid execution outcome.");
  }
  if (result?.rollback?.attempted !== true) {
    faults.push("The result must record an attempted rollback.");
  }
  if (!["verified", "failed", "unknown"].includes(result?.rollback?.result)) {
    faults.push("The result requires a valid rollback outcome.");
  }
  if (!list(result?.observations).length) {
    faults.push("The result requires observations.");
  }
  if (result?.execution === "stopped" && !text(result?.stop_condition_id)) {
    faults.push("A stopped experiment requires stop_condition_id.");
  }
  if (result?.rollback?.result !== "verified") {
    warnings.push("Rollback was not verified.");
  }

  const decision = faults.length
    ? "invalid-evidence"
    : result.hypothesis === "violated" || result.rollback.result === "failed"
      ? "weakness-observed"
      : result.hypothesis === "held" && result.rollback.result === "verified"
        ? "hypothesis-held"
        : "inconclusive";
  return {
    schema: 1,
    kind: "chaos-experiment-evidence",
    evidence_class: "observed",
    experiment_digest: result?.experiment_digest || null,
    revision: result?.revision || null,
    environment: result?.environment || null,
    execution: result?.execution || null,
    hypothesis: result?.hypothesis || null,
    stop_condition_id: result?.stop_condition_id || null,
    rollback: result?.rollback || null,
    observations: list(result?.observations),
    faults,
    warnings,
    decision,
    limitations: [
      "One experiment result applies only to its target, revision, load, and environment.",
      "A held hypothesis does not prove behavior under other faults or larger blast radii.",
    ],
  };
}

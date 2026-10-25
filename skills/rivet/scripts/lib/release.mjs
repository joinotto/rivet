import fs from "fs";

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function evaluateRelease(planFile, performanceFile) {
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  const performance = performanceFile
    ? JSON.parse(fs.readFileSync(performanceFile, "utf8"))
    : null;
  const faults = [];
  const evidenceGaps = [];
  const thresholdResults = [];

  for (const field of ["revision", "owner", "monitoring_window"]) {
    if (!requiredString(plan[field])) faults.push(`${field} is required`);
  }
  if (!Array.isArray(plan.abort_conditions) || !plan.abort_conditions.length) {
    faults.push("abort_conditions are required");
  }
  if (!Array.isArray(plan.rollback_steps) || !plan.rollback_steps.length) {
    faults.push("rollback_steps are required");
  }
  const stages = Array.isArray(plan.rollout_stages) ? plan.rollout_stages : [];
  if (!stages.length) {
    faults.push("rollout_stages are required");
  } else {
    let previous = 0;
    for (const stage of stages) {
      if (
        !Number.isFinite(stage.percent) ||
        stage.percent <= previous ||
        stage.percent > 100
      ) {
        faults.push("rollout stage percentages must increase and end at or below 100");
        break;
      }
      if (!requiredString(stage.success_evidence)) {
        faults.push(`rollout stage ${stage.percent} requires success_evidence`);
      }
      previous = stage.percent;
    }
    if (stages.at(-1)?.percent !== 100) {
      faults.push("the final rollout stage must equal 100 percent");
    }
  }

  for (const evidence of plan.evidence || []) {
    if (evidence.status !== "pass") {
      evidenceGaps.push({
        id: evidence.id || "unnamed",
        status: evidence.status || "unknown",
        reason: evidence.reason || "No reason was supplied.",
      });
    }
  }
  if (!Array.isArray(plan.evidence) || !plan.evidence.length) {
    evidenceGaps.push({
      id: "release-evidence",
      status: "missing",
      reason: "The release plan has no evidence records.",
    });
  }

  const thresholds = plan.performance_thresholds || [];
  if (thresholds.length && !performance) {
    evidenceGaps.push({
      id: "performance",
      status: "missing",
      reason: "Performance thresholds exist, but no comparison artifact was supplied.",
    });
  }
  if (performance) {
    if (performance.decision !== "comparison-observed") {
      evidenceGaps.push({
        id: "performance",
        status: performance.decision || "invalid",
        reason: "The performance artifact is not a valid observed comparison.",
      });
    }
    for (const threshold of thresholds) {
      const metric = performance.metrics?.find(
        (item) => item.name === threshold.metric,
      );
      if (!metric || !Number.isFinite(metric.delta_percent)) {
        thresholdResults.push({
          metric: threshold.metric,
          result: "insufficient-evidence",
        });
        continue;
      }
      let pass = true;
      if (Number.isFinite(threshold.max_increase_percent)) {
        pass = pass && metric.delta_percent <= threshold.max_increase_percent;
      }
      if (Number.isFinite(threshold.min_increase_percent)) {
        pass = pass && metric.delta_percent >= threshold.min_increase_percent;
      }
      thresholdResults.push({
        metric: threshold.metric,
        delta_percent: metric.delta_percent,
        result: pass ? "pass" : "breach",
      });
    }
  }

  const openRisks = Array.isArray(plan.open_risks) ? plan.open_risks : [];
  const blockingRisks = openRisks.filter(
    (risk) => risk.disposition !== "accepted" && risk.severity === "critical",
  );
  const blocked =
    faults.length ||
    evidenceGaps.length ||
    blockingRisks.length ||
    thresholdResults.some((item) => item.result !== "pass");

  return {
    schema: 1,
    kind: "release-decision",
    evidence_class: "derived",
    revision: plan.revision || null,
    owner: plan.owner || null,
    compatibility: plan.compatibility || { status: "unknown" },
    rollout_stages: stages,
    monitoring_window: plan.monitoring_window || null,
    abort_conditions: plan.abort_conditions || [],
    rollback_steps: plan.rollback_steps || [],
    open_risks: openRisks,
    faults,
    evidence_gaps: evidenceGaps,
    performance_thresholds: thresholdResults,
    decision: faults.length
      ? "invalid-plan"
      : blocked
        ? "hold"
        : "ready-for-human-approval",
    limitations: [
      "Ready for human approval does not deploy or authorize the release.",
      "The result depends on the completeness and truth of supplied evidence and risks.",
      "Production conditions can differ from pre-release evidence.",
    ],
  };
}

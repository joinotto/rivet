import crypto from "crypto";
import fs from "fs";

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function comparePerformance(baselineFile, candidateFile) {
  const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
  const candidate = JSON.parse(fs.readFileSync(candidateFile, "utf8"));
  if (!baseline.workload || !candidate.workload) {
    throw new Error("Both performance artifacts require a workload.");
  }
  const baselineWorkload = digest(baseline.workload);
  const candidateWorkload = digest(candidate.workload);
  if (baselineWorkload !== candidateWorkload) {
    return {
      schema: 1,
      kind: "performance-comparison",
      evidence_class: "derived",
      decision: "invalid-comparison",
      reason: "Baseline and candidate workloads differ.",
      baseline_workload_digest: baselineWorkload,
      candidate_workload_digest: candidateWorkload,
      limitations: [
        "Performance results are comparable only when workload, environment, data, and measurement method are controlled.",
      ],
    };
  }
  const metrics = [];
  const names = new Set([
    ...Object.keys(baseline.metrics || {}),
    ...Object.keys(candidate.metrics || {}),
  ]);
  for (const name of [...names].sort()) {
    const before = Number(baseline.metrics?.[name]);
    const after = Number(candidate.metrics?.[name]);
    if (!Number.isFinite(before) || !Number.isFinite(after)) {
      metrics.push({ name, baseline: null, candidate: null, delta: null, delta_percent: null });
      continue;
    }
    metrics.push({
      name,
      baseline: before,
      candidate: after,
      delta: after - before,
      delta_percent:
        before === 0 ? null : Number((((after - before) / before) * 100).toFixed(2)),
    });
  }
  return {
    schema: 1,
    kind: "performance-comparison",
    evidence_class: "derived",
    workload: baseline.workload,
    workload_digest: baselineWorkload,
    baseline_revision: baseline.revision || null,
    candidate_revision: candidate.revision || null,
    environment: {
      baseline: baseline.environment || null,
      candidate: candidate.environment || null,
      equal: digest(baseline.environment) === digest(candidate.environment),
    },
    metrics,
    decision: "comparison-observed",
    limitations: [
      "Metric direction and acceptable change require user-defined objectives or thresholds.",
      "One sample does not establish statistical significance or production capacity.",
      "Environment or data differences can invalidate causal conclusions.",
    ],
  };
}

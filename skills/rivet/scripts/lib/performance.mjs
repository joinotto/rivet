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

function summary(values) {
  const samples = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!samples.length) return null;
  const mean = samples.reduce((total, value) => total + value, 0) / samples.length;
  const median =
    samples.length % 2
      ? samples[(samples.length - 1) / 2]
      : (samples[samples.length / 2 - 1] + samples[samples.length / 2]) / 2;
  const variance =
    samples.length > 1
      ? samples.reduce((total, value) => total + (value - mean) ** 2, 0) /
        (samples.length - 1)
      : 0;
  const standardDeviation = Math.sqrt(variance);
  const standardError = standardDeviation / Math.sqrt(samples.length);
  return {
    count: samples.length,
    mean,
    median,
    min: samples[0],
    max: samples.at(-1),
    standard_deviation: standardDeviation,
    standard_error: standardError,
    mean_ci_95_approx:
      samples.length >= 30
        ? [mean - 1.96 * standardError, mean + 1.96 * standardError]
        : null,
  };
}

export function comparePerformanceSamples(baselineFile, candidateFile) {
  const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
  const candidate = JSON.parse(fs.readFileSync(candidateFile, "utf8"));
  if (!baseline.workload || !candidate.workload) {
    throw new Error("Both sample artifacts require a workload.");
  }
  if (digest(baseline.workload) !== digest(candidate.workload)) {
    return {
      schema: 1,
      kind: "performance-sample-comparison",
      evidence_class: "derived",
      decision: "invalid-comparison",
      reason: "Baseline and candidate workloads differ.",
    };
  }
  const metrics = [];
  const names = new Set([
    ...Object.keys(baseline.samples || {}),
    ...Object.keys(candidate.samples || {}),
  ]);
  let insufficient = false;
  for (const name of [...names].sort()) {
    const before = summary(baseline.samples?.[name] || []);
    const after = summary(candidate.samples?.[name] || []);
    if (!before || !after) {
      insufficient = true;
      metrics.push({ name, baseline: before, candidate: after, result: "insufficient-evidence" });
      continue;
    }
    const effect = after.mean - before.mean;
    const effectPercent = before.mean === 0 ? null : (effect / before.mean) * 100;
    const adequate = before.count >= 30 && after.count >= 30;
    if (!adequate) insufficient = true;
    const effectError = Math.sqrt(
      before.standard_error ** 2 + after.standard_error ** 2,
    );
    const interval = adequate
      ? [effect - 1.96 * effectError, effect + 1.96 * effectError]
      : null;
    metrics.push({
      name,
      baseline: before,
      candidate: after,
      mean_delta: effect,
      mean_delta_percent: effectPercent,
      mean_delta_ci_95_approx: interval,
      directional_evidence: !interval
        ? "insufficient-samples"
        : interval[0] > 0
          ? "increase"
          : interval[1] < 0
            ? "decrease"
            : "inconclusive",
    });
  }
  return {
    schema: 1,
    kind: "performance-sample-comparison",
    evidence_class: "derived",
    workload: baseline.workload,
    workload_digest: digest(baseline.workload),
    baseline_revision: baseline.revision || null,
    candidate_revision: candidate.revision || null,
    metrics,
    method: "descriptive statistics and 95 percent normal-approximation intervals",
    decision: insufficient ? "insufficient-evidence" : "comparison-observed",
    limitations: [
      "Normal-approximation intervals are not suitable for every latency or heavy-tailed distribution.",
      "Independent samples, stable measurement conditions, and representative workloads are assumptions.",
      "Statistical direction does not determine business significance or release acceptance.",
    ],
  };
}

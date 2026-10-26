import fs from "fs";

export function inspectPostgresMigration(file) {
  const sql = fs.readFileSync(file, "utf8");
  const findings = [];
  const rules = [
    {
      id: "destructive-drop",
      severity: "critical",
      pattern: /\bdrop\s+(table|column|schema|database)\b/i,
      reason: "The migration contains a destructive DROP operation.",
    },
    {
      id: "truncate",
      severity: "critical",
      pattern: /\btruncate\b/i,
      reason: "The migration can remove all rows from a table.",
    },
    {
      id: "column-type-change",
      severity: "high",
      pattern: /\balter\s+(?:column\s+)?[^;]+\s+type\b/i,
      reason: "A column type change can require a table rewrite or compatibility plan.",
    },
    {
      id: "blocking-index-build",
      severity: "medium",
      pattern: /\bcreate\s+(?:unique\s+)?index\s+(?!concurrently\b)/i,
      reason: "A standard index build can block writes. Confirm the workload and deployment method.",
    },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(sql)) findings.push({
      id: rule.id,
      severity: rule.severity,
      reason: rule.reason,
      evidence_class: "observed",
    });
  }
  if (
    /\bbegin\b[\s\S]*\bcreate\s+(?:unique\s+)?index\s+concurrently\b/i.test(sql)
  ) {
    findings.push({
      id: "concurrent-index-in-transaction",
      severity: "high",
      reason: "PostgreSQL does not permit CREATE INDEX CONCURRENTLY in a transaction block.",
      evidence_class: "observed",
    });
  }
  return {
    schema: 1,
    engine: "postgresql",
    artifact: file,
    evidence_class: "observed",
    findings,
    decision: findings.length ? "review-findings" : "pass",
    required_evidence: [
      "State the forward compatibility window.",
      "State the rollback or recovery method.",
      "Run the migration in an isolated or shadow environment.",
      "Measure lock time and migration duration on representative data.",
    ],
    limitations: [
      "Static SQL inspection does not measure locks, rewrites, runtime, or data correctness.",
      "The absence of a finding does not prove that the migration is safe.",
    ],
  };
}

function collectPlanNodes(node, output = []) {
  if (!node || typeof node !== "object") return output;
  output.push({
    node_type: node["Node Type"] || "unknown",
    relation: node["Relation Name"] || null,
    plan_rows: node["Plan Rows"] ?? null,
    actual_rows: node["Actual Rows"] ?? null,
    total_cost: node["Total Cost"] ?? null,
    actual_total_time: node["Actual Total Time"] ?? null,
    loops: node["Actual Loops"] ?? null,
  });
  for (const child of node.Plans || []) collectPlanNodes(child, output);
  return output;
}

export function inspectPostgresPlan(file, queryId) {
  const document = JSON.parse(fs.readFileSync(file, "utf8"));
  const root = Array.isArray(document) ? document[0]?.Plan : document.Plan;
  if (!root) throw new Error("The file is not a PostgreSQL JSON plan.");
  const nodes = collectPlanNodes(root);
  const sequentialScans = nodes.filter((node) => node.node_type === "Seq Scan");
  return {
    schema: 1,
    engine: "postgresql",
    query_id: queryId,
    artifact: file,
    evidence_class: "observed",
    nodes,
    observations: sequentialScans.map((node) => ({
      id: "sequential-scan",
      relation: node.relation,
      plan_rows: node.plan_rows,
      actual_rows: node.actual_rows,
      statement: "The plan uses a sequential scan.",
    })),
    decision: "review-required",
    limitations: [
      "A sequential scan is not sufficient evidence for an index recommendation.",
      "Index decisions require the query, workload frequency, table size, write cost, and measured comparison.",
      "Planner estimates can differ from production runtime behavior.",
    ],
  };
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

export function evaluatePostgresIndexEvidence(document) {
  const faults = [];
  if (document?.schema !== 1 || document?.kind !== "postgres-index-evidence") {
    faults.push("The artifact must use postgres-index-evidence schema 1.");
  }
  for (const field of ["id", "purpose", "statement_digest"]) {
    if (!text(document?.query?.[field])) {
      faults.push(`The query requires ${field}.`);
    }
  }
  for (const field of ["source", "environment", "dataset", "observation_window"]) {
    if (!text(document?.workload?.[field])) {
      faults.push(`The workload requires ${field}.`);
    }
  }
  for (const name of ["baseline", "candidate"]) {
    const measurement = document?.[name];
    for (const field of ["plan_artifact", "measured_at"]) {
      if (!text(measurement?.[field])) {
        faults.push(`The ${name} requires ${field}.`);
      }
    }
    for (const field of ["sample_count", "latency_p95_ms"]) {
      if (!positive(measurement?.[field])) {
        faults.push(`The ${name} requires a positive ${field}.`);
      }
    }
  }
  if (!text(document?.candidate?.index_definition)) {
    faults.push("The candidate requires index_definition.");
  }
  if (!text(document?.candidate?.write_cost_evidence)) {
    faults.push("The candidate requires write_cost_evidence.");
  }

  const baseline = document?.baseline?.latency_p95_ms;
  const candidate = document?.candidate?.latency_p95_ms;
  const improvement =
    positive(baseline) && positive(candidate)
      ? {
          latency_p95_ms: baseline - candidate,
          latency_p95_percent: ((baseline - candidate) / baseline) * 100,
        }
      : null;
  const supported = !faults.length && candidate < baseline;
  return {
    schema: 1,
    kind: "postgres-index-recommendation",
    engine: "postgresql",
    query: {
      id: document?.query?.id || null,
      purpose: document?.query?.purpose || null,
      statement_digest: document?.query?.statement_digest || null,
    },
    workload: document?.workload || null,
    measured_baseline: document?.baseline || null,
    measured_candidate: document?.candidate || null,
    measured_improvement: improvement,
    recommendation: supported
      ? {
          index_definition: document.candidate.index_definition,
          statement: `Use the candidate index for query ${document.query.id} under the measured workload.`,
        }
      : null,
    faults,
    decision: faults.length
      ? "insufficient-evidence"
      : supported
        ? "recommendation-supported"
        : "recommendation-not-supported",
    limitations: [
      "The recommendation applies only to the named query, dataset, environment, and observation window.",
      "A lower measured latency does not prove lower production cost or stable planner selection.",
      "Review storage, write amplification, maintenance, locking, and redundant-index effects before deployment.",
    ],
  };
}

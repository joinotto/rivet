import fs from "fs";

export function analyzeResilience(file) {
  const document = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(document.calls)) {
    throw new Error("The resilience model requires a calls array.");
  }
  const findings = [];
  for (const call of document.calls) {
    const id = call.id || `${call.from || "unknown"}->${call.to || "unknown"}`;
    if (!Number.isFinite(call.timeout_ms) || call.timeout_ms <= 0) {
      findings.push({
        id: "missing-timeout",
        call: id,
        severity: "high",
        statement: "The call has no positive timeout.",
      });
    }
    if ((call.retries || 0) > 0 && call.idempotent !== true) {
      findings.push({
        id: "unsafe-retry",
        call: id,
        severity: "critical",
        statement: "The call retries an operation that is not proven idempotent.",
      });
    }
    if ((call.retries || 0) > 0 && !call.jitter) {
      findings.push({
        id: "retry-without-jitter",
        call: id,
        severity: "medium",
        statement: "The retry policy has no recorded jitter.",
      });
    }
  }

  for (const outer of document.calls) {
    for (const inner of document.calls) {
      if (outer.to !== inner.from) continue;
      if ((outer.retries || 0) > 0 && (inner.retries || 0) > 0) {
        findings.push({
          id: "retry-amplification",
          path: [outer.id, inner.id],
          severity: "high",
          worst_case_attempts:
            (Number(outer.retries) + 1) * (Number(inner.retries) + 1),
          statement: "Adjacent layers both retry the operation.",
        });
      }
      if (
        Number.isFinite(outer.timeout_ms) &&
        Number.isFinite(inner.timeout_ms) &&
        inner.timeout_ms >= outer.timeout_ms
      ) {
        findings.push({
          id: "timeout-budget-inversion",
          path: [outer.id, inner.id],
          severity: "high",
          statement: "The downstream timeout does not fit inside the caller timeout.",
        });
      }
    }
  }

  return {
    schema: 1,
    kind: "resilience-analysis",
    evidence_class: "derived",
    artifact: file,
    calls: document.calls,
    findings,
    decision: findings.length ? "review-findings" : "pass",
    limitations: [
      "The result depends on the completeness and accuracy of the supplied call model.",
      "Retry counts do not include hidden client, proxy, queue, or platform retries.",
      "Idempotent=true is an assertion until tests or runtime evidence verify it.",
    ],
  };
}

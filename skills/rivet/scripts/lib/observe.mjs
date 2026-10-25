import fs from "fs";

const HIGH_CARDINALITY_NAMES = [
  /^user[._]?id$/i,
  /^request[._]?id$/i,
  /^session[._]?id$/i,
  /^trace[._]?id$/i,
  /^email$/i,
  /^url[.]full$/i,
];

export function analyzeTelemetry(file) {
  const model = JSON.parse(fs.readFileSync(file, "utf8"));
  const findings = [];
  const resources = model.resource_attributes || {};
  if (!String(resources["service.name"] || "").trim()) {
    findings.push({
      id: "missing-service-name",
      severity: "high",
      statement: "The resource has no service.name.",
    });
  }
  if (Object.hasOwn(resources, "deployment.environment")) {
    findings.push({
      id: "deprecated-deployment-environment",
      severity: "medium",
      statement: "Use deployment.environment.name instead of deployment.environment.",
    });
  }
  for (const metric of model.metrics || []) {
    for (const attribute of metric.attributes || []) {
      const name = attribute.name || "";
      const riskyName = HIGH_CARDINALITY_NAMES.some((pattern) =>
        pattern.test(name),
      );
      if (
        attribute.cardinality === "unbounded" ||
        attribute.bounded === false ||
        riskyName
      ) {
        findings.push({
          id: "unbounded-metric-dimension",
          severity: "high",
          metric: metric.name || null,
          attribute: name || null,
          statement: "The metric can create an unbounded attribute dimension.",
        });
      }
      if (attribute.sensitive === true) {
        findings.push({
          id: "sensitive-metric-attribute",
          severity: "high",
          metric: metric.name || null,
          attribute: name || null,
          statement: "The metric includes an attribute marked as sensitive.",
        });
      }
    }
  }
  const alertFields = ["harm", "urgency", "owner", "first_action"];
  for (const alert of model.alerts || []) {
    const missing = alertFields.filter(
      (field) => !String(alert[field] || "").trim(),
    );
    if (missing.length) {
      findings.push({
        id: "incomplete-alert",
        severity: "high",
        alert: alert.name || null,
        missing,
        statement: "The alert does not identify harm, urgency, owner, and first action.",
      });
    }
  }
  return {
    schema: 1,
    kind: "telemetry-review",
    evidence_class: "derived",
    artifact: file,
    semantic_convention_version:
      model.semantic_convention_version || "unspecified",
    findings,
    decision: findings.length ? "review-findings" : "pass",
    limitations: [
      "The review uses the supplied telemetry model and does not inspect emitted runtime data.",
      "Attribute names alone cannot prove actual cardinality or sensitive-data exposure.",
      "A complete alert definition still requires an SLO or explicit user-harm threshold when applicable.",
    ],
  };
}

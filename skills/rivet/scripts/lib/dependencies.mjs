function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function npmFindings(document) {
  if (!document || typeof document !== "object") return null;
  if (document.vulnerabilities && typeof document.vulnerabilities === "object") {
    return Object.entries(document.vulnerabilities).map(([name, item]) => ({
      package: name,
      severity: item.severity || "unknown",
      direct: Boolean(item.isDirect),
      via: Array.isArray(item.via) ? item.via.length : null,
    }));
  }
  const total = document.metadata?.vulnerabilities?.total;
  return Number.isInteger(total)
    ? Array.from({ length: total }, () => ({ severity: "unknown" }))
    : null;
}

function cargoFindings(document) {
  const list = document?.vulnerabilities?.list;
  if (!Array.isArray(list)) return null;
  return list.map((item) => ({
    package: item.package?.name || "unknown",
    advisory: item.advisory?.id || "unknown",
    severity: item.advisory?.cvss ? "scored" : "unknown",
  }));
}

function pipFindings(document) {
  const dependencies = Array.isArray(document)
    ? document
    : document?.dependencies;
  if (!Array.isArray(dependencies)) return null;
  return dependencies.flatMap((dependency) =>
    (dependency.vulns || []).map((item) => ({
      package: dependency.name || "unknown",
      advisory: item.id || "unknown",
      fix_versions: item.fix_versions || [],
    })),
  );
}

function govulnFindings(output) {
  const lines = output.split("\n").filter(Boolean);
  if (!lines.length) return [];
  const documents = lines.map(parseJson);
  if (documents.some((item) => item === null)) return null;
  return documents
    .filter((item) => item.finding)
    .map((item) => ({
      advisory: item.finding.osv || "unknown",
      trace_count: Array.isArray(item.finding.trace)
        ? item.finding.trace.length
        : null,
    }));
}

export function normalizeDependencyResult(adapter, result) {
  if (result.error?.code === "ENOENT") {
    return {
      result: "unavailable",
      finding_count: null,
      findings: [],
      reason: "The declared dependency tool is not available.",
    };
  }
  if (result.error) {
    return {
      result: "tool-failure",
      finding_count: null,
      findings: [],
      reason: result.error.message || "The dependency tool failed to start.",
    };
  }

  const output = String(result.stdout || "").trim();
  let findings;
  if (adapter.id === "npm-audit") findings = npmFindings(parseJson(output));
  if (adapter.id === "cargo-audit") findings = cargoFindings(parseJson(output));
  if (adapter.id === "pip-audit") findings = pipFindings(parseJson(output));
  if (adapter.id === "govulncheck") findings = govulnFindings(output);

  if (findings === null || findings === undefined) {
    return {
      result: "tool-failure",
      finding_count: null,
      findings: [],
      reason: "The tool output did not match its declared machine-readable format.",
    };
  }

  return {
    result: findings.length ? "findings" : "pass",
    finding_count: findings.length,
    findings,
    reason: findings.length
      ? "The dependency tool reported known vulnerabilities."
      : null,
  };
}

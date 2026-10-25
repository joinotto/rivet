import fs from "fs";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function location(result) {
  const physical = result.locations?.[0]?.physicalLocation;
  return {
    file: physical?.artifactLocation?.uri || null,
    line: physical?.region?.startLine || null,
  };
}

export function normalizeSarif(file) {
  const document = readJson(file);
  if (document.version !== "2.1.0" || !Array.isArray(document.runs)) {
    throw new Error("The artifact is not SARIF 2.1.0.");
  }
  const findings = [];
  const tools = [];
  for (const run of document.runs) {
    const driver = run.tool?.driver;
    tools.push({
      name: driver?.name || "unknown",
      version: driver?.semanticVersion || driver?.version || null,
    });
    for (const result of run.results || []) {
      const rule = (driver?.rules || []).find((item) => item.id === result.ruleId);
      const tags = rule?.properties?.tags || [];
      findings.push({
        rule_id: result.ruleId || null,
        level: result.level || "warning",
        message: result.message?.text || null,
        location: location(result),
        cwe: tags.filter((tag) => /^CWE-\d+$/i.test(tag)),
        evidence_class: "observed",
      });
    }
  }
  return {
    schema: 1,
    kind: "sast",
    format: "sarif-2.1.0",
    evidence_class: "observed",
    artifact: file,
    tools,
    findings,
    decision: findings.length ? "review-findings" : "pass",
    limitations: [
      "A clean static-analysis result does not prove that the system has no vulnerabilities.",
      "CWE identifiers are preserved only when the source rule supplies them.",
      "Runtime configuration, authorization, data flow, and reachability can require separate evidence.",
    ],
  };
}

export function normalizeTrivy(file) {
  const document = readJson(file);
  if (!Array.isArray(document.Results)) {
    throw new Error("The artifact is not a supported Trivy JSON report.");
  }
  const findings = [];
  for (const result of document.Results) {
    for (const item of result.Vulnerabilities || []) {
      findings.push({
        class: "vulnerability",
        target: result.Target || null,
        id: item.VulnerabilityID || null,
        package: item.PkgName || null,
        installed_version: item.InstalledVersion || null,
        fixed_version: item.FixedVersion || null,
        severity: item.Severity || "UNKNOWN",
        evidence_class: "observed",
      });
    }
    for (const item of result.Misconfigurations || []) {
      findings.push({
        class: "misconfiguration",
        target: result.Target || null,
        id: item.ID || null,
        title: item.Title || null,
        severity: item.Severity || "UNKNOWN",
        evidence_class: "observed",
      });
    }
  }
  return {
    schema: 1,
    kind: "container-or-iac",
    format: "trivy-json",
    evidence_class: "observed",
    artifact: file,
    findings,
    decision: findings.length ? "review-findings" : "pass",
    limitations: [
      "The report covers only the targets, scanners, databases, and configuration used by Trivy.",
      "A package finding does not prove runtime reachability.",
    ],
  };
}

export function normalizeSbom(file, revision) {
  const document = readJson(file);
  let format;
  let version;
  let components;
  if (document.bomFormat === "CycloneDX") {
    format = "CycloneDX";
    version = document.specVersion;
    components = document.components || [];
  } else if (String(document.spdxVersion || "").startsWith("SPDX-")) {
    format = "SPDX";
    version = document.spdxVersion;
    components = document.packages || [];
  } else if (Array.isArray(document["@graph"]) || Array.isArray(document.element)) {
    format = "SPDX";
    version = "3";
    components = document["@graph"] || document.element;
  } else {
    throw new Error("The artifact is not supported CycloneDX or SPDX JSON.");
  }
  return {
    schema: 1,
    kind: "sbom",
    evidence_class: "observed",
    artifact: file,
    format,
    format_version: version || null,
    subject_revision: revision,
    component_count: components.length,
    decision: components.length ? "observed" : "insufficient-evidence",
    limitations: [
      "The supplied revision is an assertion by the SBOM producer or user.",
      "Component presence does not prove runtime reachability or deployment.",
      "This structural check does not perform full schema or signature validation.",
    ],
  };
}

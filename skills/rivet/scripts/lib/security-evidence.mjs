import fs from "fs";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function location(result) {
  const physical = result.locations?.[0]?.physicalLocation;
  return {
    file: physical?.artifactLocation?.uri || null,
    line: physical?.region?.startLine || null,
  };
}

export function normalizeSarifDocument(document, artifact = "<memory>") {
  if (
    !record(document) ||
    document.version !== "2.1.0" ||
    !Array.isArray(document.runs)
  ) {
    throw new Error("The artifact is not SARIF 2.1.0.");
  }
  const findings = [];
  const tools = [];
  for (const run of document.runs) {
    if (!record(run)) throw new Error("The artifact is not SARIF 2.1.0.");
    const driver = record(run.tool?.driver) ? run.tool.driver : null;
    const rules = Array.isArray(driver?.rules) ? driver.rules : [];
    const results =
      run.results === undefined
        ? []
        : Array.isArray(run.results)
          ? run.results
          : null;
    if (!results) throw new Error("The artifact is not SARIF 2.1.0.");
    tools.push({
      name: driver?.name || "unknown",
      version: driver?.semanticVersion || driver?.version || null,
    });
    for (const result of results) {
      if (!record(result)) throw new Error("The artifact is not SARIF 2.1.0.");
      const rule = rules.find(
        (item) => record(item) && item.id === result.ruleId,
      );
      const tags = Array.isArray(rule?.properties?.tags)
        ? rule.properties.tags.filter((tag) => typeof tag === "string")
        : [];
      const cwe = tags.filter((tag) => /^CWE-\d+$/i.test(tag));
      const asvs = tags.filter(
        (tag) => /^(?:OWASP[-: ])?ASVS[-: ][A-Za-z0-9.-]+$/i.test(tag),
      );
      findings.push({
        rule_id: result.ruleId || null,
        level: result.level || "warning",
        message: result.message?.text || null,
        location: location(result),
        cwe,
        asvs,
        standard_mappings: [...cwe, ...asvs],
        evidence_class: "observed",
      });
    }
  }
  return {
    schema: 1,
    kind: "sast",
    format: "sarif-2.1.0",
    evidence_class: "observed",
    artifact,
    tools,
    findings,
    decision: findings.length ? "review-findings" : "pass",
    limitations: [
      "A clean static-analysis result does not prove that the system has no vulnerabilities.",
      "CWE and ASVS identifiers are preserved only when the source rule supplies them.",
      "Runtime configuration, authorization, data flow, and reachability can require separate evidence.",
    ],
  };
}

export function normalizeSarif(file) {
  return normalizeSarifDocument(readJson(file), file);
}

export function normalizeTrivyDocument(document, artifact = "<memory>") {
  if (!record(document) || !Array.isArray(document.Results)) {
    throw new Error("The artifact is not a supported Trivy JSON report.");
  }
  const findings = [];
  for (const result of document.Results) {
    if (!record(result)) {
      throw new Error("The artifact is not a supported Trivy JSON report.");
    }
    const vulnerabilities =
      result.Vulnerabilities === undefined
        ? []
        : Array.isArray(result.Vulnerabilities)
          ? result.Vulnerabilities
          : null;
    const misconfigurations =
      result.Misconfigurations === undefined
        ? []
        : Array.isArray(result.Misconfigurations)
          ? result.Misconfigurations
          : null;
    if (!vulnerabilities || !misconfigurations) {
      throw new Error("The artifact is not a supported Trivy JSON report.");
    }
    for (const item of vulnerabilities) {
      if (!record(item)) {
        throw new Error("The artifact is not a supported Trivy JSON report.");
      }
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
    for (const item of misconfigurations) {
      if (!record(item)) {
        throw new Error("The artifact is not a supported Trivy JSON report.");
      }
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
    artifact,
    findings,
    decision: findings.length ? "review-findings" : "pass",
    limitations: [
      "The report covers only the targets, scanners, databases, and configuration used by Trivy.",
      "A package finding does not prove runtime reachability.",
    ],
  };
}

export function normalizeTrivy(file) {
  return normalizeTrivyDocument(readJson(file), file);
}

export function normalizeSbomDocument(
  document,
  revision,
  artifact = "<memory>",
) {
  if (!record(document)) {
    throw new Error("The artifact is not supported CycloneDX or SPDX JSON.");
  }
  let format;
  let version;
  let components;
  if (document.bomFormat === "CycloneDX") {
    format = "CycloneDX";
    version = document.specVersion;
    components = document.components === undefined ? [] : document.components;
  } else if (String(document.spdxVersion || "").startsWith("SPDX-")) {
    format = "SPDX";
    version = document.spdxVersion;
    components = document.packages === undefined ? [] : document.packages;
  } else if (Array.isArray(document["@graph"]) || Array.isArray(document.element)) {
    format = "SPDX";
    version = "3";
    components = document["@graph"] || document.element;
  } else {
    throw new Error("The artifact is not supported CycloneDX or SPDX JSON.");
  }
  if (!Array.isArray(components)) {
    throw new Error("The artifact is not supported CycloneDX or SPDX JSON.");
  }
  return {
    schema: 1,
    kind: "sbom",
    evidence_class: "observed",
    artifact,
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

export function normalizeSbom(file, revision) {
  return normalizeSbomDocument(readJson(file), revision, file);
}

function vulnerabilityIds(document) {
  if (Array.isArray(document.findings)) {
    return document.findings
      .map((item) => item.id || item.vulnerability_id)
      .filter((item) => /^CVE-\d{4}-\d+$/i.test(item || ""));
  }
  if (Array.isArray(document.Results)) {
    return document.Results.flatMap((result) =>
      (result.Vulnerabilities || []).map((item) => item.VulnerabilityID),
    ).filter((item) => /^CVE-\d{4}-\d+$/i.test(item || ""));
  }
  throw new Error("The findings artifact has no supported vulnerability list.");
}

export function enrichVulnerabilities(findingsFile, kevFile, epssFile, retrievedAt) {
  const findingsDocument = readJson(findingsFile);
  const kevDocument = readJson(kevFile);
  const epssDocument = readJson(epssFile);
  if (!Array.isArray(kevDocument.vulnerabilities)) {
    throw new Error("The KEV snapshot has no vulnerabilities array.");
  }
  if (!Array.isArray(epssDocument.data)) {
    throw new Error("The EPSS snapshot has no data array.");
  }
  const kev = new Map(
    kevDocument.vulnerabilities.map((item) => [item.cveID, item]),
  );
  const epss = new Map(epssDocument.data.map((item) => [item.cve, item]));
  const vulnerabilities = [...new Set(vulnerabilityIds(findingsDocument))]
    .sort()
    .map((id) => {
      const kevItem = kev.get(id);
      const epssItem = epss.get(id);
      return {
        id,
        known_exploited: Boolean(kevItem),
        kev: kevItem
          ? {
              date_added: kevItem.dateAdded || null,
              due_date: kevItem.dueDate || null,
              known_ransomware_use:
                kevItem.knownRansomwareCampaignUse || "Unknown",
              cwes: kevItem.cwes || [],
            }
          : null,
        epss: epssItem
          ? {
              probability: Number(epssItem.epss),
              percentile: Number(epssItem.percentile),
              model_date: epssItem.date || null,
            }
          : null,
        priority_factors: {
          known_exploitation: kevItem ? "observed" : "not-listed-in-snapshot",
          exploitation_probability: epssItem
            ? Number(epssItem.epss)
            : "unknown",
          runtime_reachability: "unknown",
          exposure: "unknown",
          asset_criticality: "unknown",
          mitigation_strength: "unknown",
          fix_availability: "unknown",
          fix_risk: "unknown",
        },
      };
    });
  return {
    schema: 1,
    kind: "vulnerability-enrichment",
    evidence_class: "derived",
    retrieved_at: retrievedAt,
    sources: {
      findings: findingsFile,
      kev: {
        artifact: kevFile,
        catalog_version: kevDocument.catalogVersion || null,
        date_released: kevDocument.dateReleased || null,
      },
      epss: {
        artifact: epssFile,
        status: epssDocument.status || null,
      },
    },
    vulnerabilities,
    decision: vulnerabilities.length ? "enriched-with-unknowns" : "insufficient-evidence",
    limitations: [
      "Not listed in one KEV snapshot does not prove that exploitation has not occurred.",
      "EPSS probability is not severity, impact, or a remediation deadline.",
      "Rivet does not calculate a universal priority score while material factors are unknown.",
    ],
  };
}

export function applyReachability(findingsFile, evidenceFile) {
  const findingsDocument = readJson(findingsFile);
  const evidenceDocument = readJson(evidenceFile);
  if (!Array.isArray(evidenceDocument.entries)) {
    throw new Error("The reachability artifact has no entries array.");
  }
  if (!evidenceDocument.revision || !evidenceDocument.observed_at) {
    throw new Error("Reachability evidence requires revision and observed_at.");
  }
  const entries = new Map(
    evidenceDocument.entries.map((item) => [item.id, item]),
  );
  const faults = [];
  const vulnerabilities = [...new Set(vulnerabilityIds(findingsDocument))]
    .sort()
    .map((id) => {
      const entry = entries.get(id);
      let status = entry?.status || "unknown";
      if (!["reachable", "not-reachable", "unknown"].includes(status)) {
        faults.push(`${id}: unsupported reachability status`);
        status = "unknown";
      }
      const evidence = Array.isArray(entry?.evidence) ? entry.evidence : [];
      if (
        status === "not-reachable" &&
        (!String(entry?.method || "").trim() || evidence.length === 0)
      ) {
        faults.push(`${id}: not-reachable requires method and evidence`);
        status = "unknown";
      }
      return {
        id,
        reachability: status,
        method: entry?.method || null,
        evidence,
        notes: entry?.notes || null,
      };
    });
  return {
    schema: 1,
    kind: "reachability",
    evidence_class: "derived",
    revision: evidenceDocument.revision,
    observed_at: evidenceDocument.observed_at,
    sources: {
      findings: findingsFile,
      reachability: evidenceFile,
    },
    vulnerabilities,
    faults,
    decision: faults.length
      ? "invalid-evidence"
      : vulnerabilities.some((item) => item.reachability === "unknown")
        ? "incomplete"
        : "observed",
    limitations: [
      "Reachability is bound to the supplied revision and observation method.",
      "Not reachable does not mean not vulnerable and can change with configuration or runtime paths.",
      "Unknown reachability must not suppress a finding.",
    ],
  };
}

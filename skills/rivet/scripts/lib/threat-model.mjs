function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function threatModelTemplate(system, revision, createdAt) {
  return {
    schema: 1,
    kind: "threat-model",
    system: system || "",
    revision: revision || "",
    created_at: createdAt,
    scope: {
      included: [],
      excluded: [],
      assumptions: [],
    },
    assets: [],
    actors: [],
    entry_points: [],
    trust_boundaries: [],
    data_flows: [],
    abuse_cases: [],
    threats: [],
    residual_risks: [],
    review: {
      owner: "",
      reviewed_at: "",
      evidence: [],
    },
  };
}

export function validateThreatModel(model) {
  const faults = [];
  const warnings = [];
  if (model?.schema !== 1 || model?.kind !== "threat-model") {
    faults.push("The file must use Rivet threat-model schema 1.");
  }
  for (const field of [
    "system",
    "revision",
    "created_at",
  ]) {
    if (!text(model?.[field])) faults.push(`The threat model requires ${field}.`);
  }
  for (const field of [
    "assets",
    "actors",
    "entry_points",
    "trust_boundaries",
    "data_flows",
    "abuse_cases",
    "threats",
  ]) {
    if (!list(model?.[field]).length) {
      faults.push(`The threat model requires at least one ${field.replaceAll("_", " ")} record.`);
    }
  }

  const ids = {};
  for (const field of [
    "assets",
    "actors",
    "entry_points",
    "trust_boundaries",
    "data_flows",
    "abuse_cases",
  ]) {
    ids[field] = new Set();
    for (const item of list(model?.[field])) {
      if (!text(item?.id)) {
        faults.push(`Each ${field.replaceAll("_", " ")} record requires an id.`);
      } else if (ids[field].has(item.id)) {
        faults.push(`Duplicate ${field.replaceAll("_", " ")} id: ${item.id}.`);
      } else {
        ids[field].add(item.id);
      }
      if (!text(item?.description)) {
        faults.push(`${field.replaceAll("_", " ")} ${item?.id || "record"} requires a description.`);
      }
    }
  }

  const threatIds = new Set();
  const references = [
    ["asset_ids", "assets"],
    ["actor_ids", "actors"],
    ["entry_point_ids", "entry_points"],
    ["trust_boundary_ids", "trust_boundaries"],
    ["data_flow_ids", "data_flows"],
    ["abuse_case_ids", "abuse_cases"],
  ];
  for (const threat of list(model?.threats)) {
    const label = threat?.id || "record";
    if (!text(threat?.id)) {
      faults.push("Each threat requires an id.");
    } else if (threatIds.has(threat.id)) {
      faults.push(`Duplicate threat id: ${threat.id}.`);
    } else {
      threatIds.add(threat.id);
    }
    for (const field of [
      "description",
      "impact",
      "likelihood_basis",
      "control",
      "verification",
      "owner",
      "status",
    ]) {
      if (!text(threat?.[field])) faults.push(`Threat ${label} requires ${field}.`);
    }
    for (const [field, collection] of references) {
      if (!list(threat?.[field]).length) {
        faults.push(`Threat ${label} requires ${field}.`);
        continue;
      }
      for (const reference of threat[field]) {
        if (!ids[collection].has(reference)) {
          faults.push(`Threat ${label} has unknown ${field} reference: ${reference}.`);
        }
      }
    }
    if (!list(threat?.verification_evidence).length) {
      faults.push(`Threat ${label} requires verification_evidence.`);
    }
    if (!list(threat?.standard_mappings).length) {
      warnings.push(`Threat ${label} has no ASVS, CWE, or other standard mapping.`);
    }
  }

  if (!list(model?.residual_risks).length) {
    warnings.push("No residual risk is recorded.");
  }
  if (!text(model?.review?.owner) || !text(model?.review?.reviewed_at)) {
    warnings.push("The threat model has no completed human review record.");
  }
  if (!list(model?.review?.evidence).length) {
    warnings.push("The threat model has no human review evidence.");
  }

  return {
    schema: 1,
    kind: "threat-model-validation",
    evidence_class: "derived",
    faults,
    warnings,
    counts: {
      assets: list(model?.assets).length,
      actors: list(model?.actors).length,
      entry_points: list(model?.entry_points).length,
      trust_boundaries: list(model?.trust_boundaries).length,
      data_flows: list(model?.data_flows).length,
      abuse_cases: list(model?.abuse_cases).length,
      threats: list(model?.threats).length,
      residual_risks: list(model?.residual_risks).length,
    },
    decision: faults.length ? "incomplete" : "ready-for-review",
    limitations: [
      "Schema validation does not prove that the model includes every asset, boundary, or threat.",
      "Standard mappings support review. They do not prove compliance.",
      "A qualified human must review risk acceptance and important omissions.",
    ],
  };
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function privacyTemplate(system, revision, createdAt) {
  return {
    schema: 1,
    kind: "privacy-analysis",
    system: system || "",
    revision: revision || "",
    created_at: createdAt,
    scope: {
      included: [],
      excluded: [],
      jurisdictions: [],
    },
    data_categories: [],
    processing_activities: [],
    data_flows: [],
    third_parties: [],
    risks: [],
    rights_and_requests: {
      access: "",
      correction: "",
      deletion: "",
      export: "",
      objection_or_restriction: "",
    },
    review: {
      owner: "",
      reviewed_at: "",
      evidence: [],
    },
  };
}

export function validatePrivacyAnalysis(analysis) {
  const faults = [];
  const warnings = [];
  if (analysis?.schema !== 1 || analysis?.kind !== "privacy-analysis") {
    faults.push("The file must use Rivet privacy-analysis schema 1.");
  }
  for (const field of ["system", "revision", "created_at"]) {
    if (!text(analysis?.[field])) {
      faults.push(`The privacy analysis requires ${field}.`);
    }
  }
  if (!list(analysis?.scope?.included).length) {
    faults.push("The privacy scope requires included components.");
  }
  if (!list(analysis?.scope?.excluded).length) {
    warnings.push("The privacy scope does not declare excluded components.");
  }
  if (!list(analysis?.scope?.jurisdictions).length) {
    warnings.push("The privacy scope does not identify applicable jurisdictions.");
  }

  const categories = list(analysis?.data_categories);
  const categoryIds = new Set();
  for (const category of categories) {
    const label = category?.id || "record";
    if (!text(category?.id)) {
      faults.push("Each data category requires an id.");
    } else if (categoryIds.has(category.id)) {
      faults.push(`Duplicate data category id: ${category.id}.`);
    } else {
      categoryIds.add(category.id);
    }
    for (const field of [
      "description",
      "subjects",
      "classification",
      "source",
      "retention",
      "deletion",
    ]) {
      if (!text(category?.[field])) {
        faults.push(`Data category ${label} requires ${field}.`);
      }
    }
    if (category?.necessary !== true && category?.necessary !== false) {
      faults.push(`Data category ${label} requires a necessary boolean.`);
    }
    if (category?.necessary === false) {
      warnings.push(`Data category ${label} has no recorded necessity.`);
    }
  }
  if (!categories.length) faults.push("The analysis requires data categories.");

  const activities = list(analysis?.processing_activities);
  const activityIds = new Set();
  for (const activity of activities) {
    const label = activity?.id || "record";
    if (!text(activity?.id)) {
      faults.push("Each processing activity requires an id.");
    } else if (activityIds.has(activity.id)) {
      faults.push(`Duplicate processing activity id: ${activity.id}.`);
    } else {
      activityIds.add(activity.id);
    }
    for (const field of [
      "purpose",
      "necessity",
      "legal_basis_review",
      "owner",
      "automated_decision_effect",
    ]) {
      if (!text(activity?.[field])) {
        faults.push(`Processing activity ${label} requires ${field}.`);
      }
    }
    if (!list(activity?.data_category_ids).length) {
      faults.push(`Processing activity ${label} requires data_category_ids.`);
    }
    for (const id of list(activity?.data_category_ids)) {
      if (!categoryIds.has(id)) {
        faults.push(`Processing activity ${label} references unknown category: ${id}.`);
      }
    }
  }
  if (!activities.length) faults.push("The analysis requires processing activities.");

  const flows = list(analysis?.data_flows);
  for (const flow of flows) {
    const label = flow?.id || "record";
    for (const field of ["id", "from", "to", "transport", "protection"]) {
      if (!text(flow?.[field])) faults.push(`Data flow ${label} requires ${field}.`);
    }
    if (!list(flow?.data_category_ids).length) {
      faults.push(`Data flow ${label} requires data_category_ids.`);
    }
    for (const id of list(flow?.data_category_ids)) {
      if (!categoryIds.has(id)) {
        faults.push(`Data flow ${label} references unknown category: ${id}.`);
      }
    }
  }
  if (!flows.length) faults.push("The analysis requires data flows.");

  for (const party of list(analysis?.third_parties)) {
    const label = party?.id || "record";
    for (const field of [
      "id",
      "name",
      "purpose",
      "contract_evidence",
      "location",
      "deletion_commitment",
    ]) {
      if (!text(party?.[field])) faults.push(`Third party ${label} requires ${field}.`);
    }
  }

  const risks = list(analysis?.risks);
  for (const risk of risks) {
    const label = risk?.id || "record";
    for (const field of [
      "id",
      "harm",
      "affected_subjects",
      "likelihood_basis",
      "control",
      "verification",
      "owner",
      "residual_risk",
    ]) {
      if (!text(risk?.[field])) faults.push(`Privacy risk ${label} requires ${field}.`);
    }
  }
  if (!risks.length) faults.push("The analysis requires privacy risks.");

  for (const field of [
    "access",
    "correction",
    "deletion",
    "export",
    "objection_or_restriction",
  ]) {
    if (!text(analysis?.rights_and_requests?.[field])) {
      warnings.push(`The analysis does not describe ${field} request handling.`);
    }
  }
  if (!text(analysis?.review?.owner) || !text(analysis?.review?.reviewed_at)) {
    warnings.push("The privacy analysis has no completed qualified review.");
  }
  if (!list(analysis?.review?.evidence).length) {
    warnings.push("The privacy analysis has no review evidence.");
  }

  return {
    schema: 1,
    kind: "privacy-analysis-validation",
    evidence_class: "derived",
    faults,
    warnings,
    counts: {
      data_categories: categories.length,
      processing_activities: activities.length,
      data_flows: flows.length,
      third_parties: list(analysis?.third_parties).length,
      risks: risks.length,
    },
    decision: faults.length ? "incomplete" : "ready-for-qualified-review",
    limitations: [
      "Schema validation does not prove legal compliance.",
      "A qualified reviewer must determine applicable law and legal basis.",
      "Runtime discovery can reveal data collection and sharing that the analysis omits.",
    ],
  };
}

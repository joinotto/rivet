function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

export function capacityTemplate(system, revision, createdAt) {
  return {
    schema: 1,
    kind: "capacity-plan",
    system: system || "",
    revision: revision || "",
    created_at: createdAt,
    workload: {
      name: "",
      demand_unit: "",
      observation_window: "",
      demand_period_seconds: 0,
      baseline_demand: 0,
      peak_demand: 0,
      growth_assumption: "",
      service_objective: "",
    },
    resources: [],
    cost: {
      currency: "",
      price_snapshot_at: "",
      price_source: "",
      hours_per_month: 0,
      other_monthly_cost: 0,
    },
    scenarios: [],
    review: {
      owner: "",
      evidence: [],
    },
  };
}

export function evaluateCapacityPlan(plan) {
  const faults = [];
  const warnings = [];
  if (plan?.schema !== 1 || plan?.kind !== "capacity-plan") {
    faults.push("The file must use Rivet capacity-plan schema 1.");
  }
  for (const field of ["system", "revision", "created_at"]) {
    if (!text(plan?.[field])) faults.push(`The capacity plan requires ${field}.`);
  }

  const workload = plan?.workload || {};
  for (const field of [
    "name",
    "demand_unit",
    "observation_window",
    "growth_assumption",
    "service_objective",
  ]) {
    if (!text(workload[field])) faults.push(`The workload requires ${field}.`);
  }
  for (const field of [
    "demand_period_seconds",
    "baseline_demand",
    "peak_demand",
  ]) {
    if (!finiteNonNegative(workload[field])) {
      faults.push(`The workload requires non-negative ${field}.`);
    }
  }
  if (workload.demand_period_seconds <= 0) {
    faults.push("The workload demand_period_seconds must be above zero.");
  }
  if (
    finiteNonNegative(workload.baseline_demand) &&
    finiteNonNegative(workload.peak_demand) &&
    workload.peak_demand < workload.baseline_demand
  ) {
    warnings.push("Peak demand is less than baseline demand.");
  }

  const resources = list(plan?.resources);
  const resourceIds = new Set();
  const resourceResults = [];
  for (const resource of resources) {
    const label = resource?.id || "record";
    if (!text(resource?.id)) {
      faults.push("Each resource requires an id.");
    } else if (resourceIds.has(resource.id)) {
      faults.push(`Duplicate resource id: ${resource.id}.`);
    } else {
      resourceIds.add(resource.id);
    }
    for (const field of ["description", "capacity_unit", "measurement_source"]) {
      if (!text(resource?.[field])) faults.push(`Resource ${label} requires ${field}.`);
    }
    for (const field of [
      "capacity_per_instance",
      "instances",
      "observed_peak_demand",
      "cost_per_instance_hour",
    ]) {
      if (!finiteNonNegative(resource?.[field])) {
        faults.push(`Resource ${label} requires non-negative ${field}.`);
      }
    }
    if (
      !Number.isFinite(resource?.max_utilization) ||
      resource.max_utilization <= 0 ||
      resource.max_utilization > 1
    ) {
      faults.push(`Resource ${label} max_utilization must be above 0 and at most 1.`);
    }
    const totalCapacity = resource.capacity_per_instance * resource.instances;
    const allowedCapacity = totalCapacity * resource.max_utilization;
    const utilization = totalCapacity
      ? resource.observed_peak_demand / totalCapacity
      : null;
    resourceResults.push({
      id: resource.id || null,
      total_capacity: round(totalCapacity),
      allowed_capacity: round(allowedCapacity),
      observed_peak_demand: resource.observed_peak_demand,
      utilization: round(utilization),
      headroom: round(allowedCapacity - resource.observed_peak_demand),
      within_limit: Number.isFinite(allowedCapacity) &&
        resource.observed_peak_demand <= allowedCapacity,
    });
  }
  if (!resources.length) faults.push("The capacity plan requires resources.");

  const cost = plan?.cost || {};
  for (const field of ["currency", "price_snapshot_at", "price_source"]) {
    if (!text(cost[field])) faults.push(`The cost plan requires ${field}.`);
  }
  for (const field of ["hours_per_month", "other_monthly_cost"]) {
    if (!finiteNonNegative(cost[field])) {
      faults.push(`The cost plan requires non-negative ${field}.`);
    }
  }
  const resourceMonthlyCost = resources.reduce(
    (sum, resource) =>
      sum + resource.instances * resource.cost_per_instance_hour *
        cost.hours_per_month,
    0,
  );
  const monthlyCost = resourceMonthlyCost + cost.other_monthly_cost;
  const monthlyDemand = workload.demand_period_seconds > 0
    ? workload.baseline_demand * 60 * 60 * cost.hours_per_month /
      workload.demand_period_seconds
    : 0;

  const scenarioResults = [];
  for (const scenario of list(plan?.scenarios)) {
    const label = scenario?.id || "record";
    for (const field of ["id", "description", "assumption"]) {
      if (!text(scenario?.[field])) faults.push(`Scenario ${label} requires ${field}.`);
    }
    if (!finiteNonNegative(scenario?.demand)) {
      faults.push(`Scenario ${label} requires non-negative demand.`);
    }
    const allocations = list(scenario?.allocations);
    if (!allocations.length) faults.push(`Scenario ${label} requires allocations.`);
    let sufficient = true;
    for (const allocation of allocations) {
      const resource = resources.find((item) => item.id === allocation.resource_id);
      if (!resource) {
        faults.push(
          `Scenario ${label} references unknown resource: ${allocation.resource_id}.`,
        );
        sufficient = false;
        continue;
      }
      if (!finiteNonNegative(allocation.instances)) {
        faults.push(`Scenario ${label} requires non-negative allocation instances.`);
        sufficient = false;
        continue;
      }
      const allowed = resource.capacity_per_instance * allocation.instances *
        resource.max_utilization;
      if (scenario.demand > allowed) sufficient = false;
    }
    scenarioResults.push({
      id: scenario?.id || null,
      demand: scenario?.demand ?? null,
      sufficient,
    });
  }
  if (!list(plan?.scenarios).length) {
    warnings.push("The plan does not test any demand scenario.");
  }
  if (!text(plan?.review?.owner)) warnings.push("The plan has no review owner.");
  if (!list(plan?.review?.evidence).length) {
    warnings.push("The plan has no review evidence.");
  }

  const capacityGap = resourceResults.some((item) => !item.within_limit) ||
    scenarioResults.some((item) => !item.sufficient);
  return {
    schema: 1,
    kind: "capacity-plan-evaluation",
    evidence_class: "derived",
    faults,
    warnings,
    workload: {
      demand_unit: workload.demand_unit || null,
      baseline_demand: workload.baseline_demand ?? null,
      peak_demand: workload.peak_demand ?? null,
    },
    resources: resourceResults,
    scenarios: scenarioResults,
    cost: {
      currency: cost.currency || null,
      price_snapshot_at: cost.price_snapshot_at || null,
      monthly: round(monthlyCost),
      cost_per_baseline_demand_unit: monthlyDemand
        ? round(monthlyCost / monthlyDemand)
        : null,
    },
    decision: faults.length
      ? "invalid-plan"
      : capacityGap
        ? "capacity-gap"
        : "within-declared-limits",
    limitations: [
      "The calculation depends on measured capacity and explicit workload assumptions.",
      "A price snapshot can become stale and does not include unrecorded shared costs.",
      "Test correlated bottlenecks, queueing, failover, and provider quotas separately.",
    ],
  };
}

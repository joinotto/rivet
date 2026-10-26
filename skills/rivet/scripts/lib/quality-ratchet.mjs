function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function ids(items) {
  return new Set((items || []).map((item) => item.id));
}

function activeException(exceptions, control, observedAt) {
  return exceptions.find(
    (item) =>
      item.control === control &&
      text(item.owner) &&
      text(item.reason) &&
      text(item.evidence) &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.expires_on || "") &&
      item.expires_on >= observedAt,
  );
}

export function evaluateQualityRatchet(document, observedAt) {
  const faults = [];
  const regressions = [];
  const exceptions = document?.exceptions || [];
  const date = observedAt || new Date().toISOString().slice(0, 10);

  if (document?.schema !== 1) faults.push("schema must be 1");
  if (document?.kind !== "quality-ratchet") {
    faults.push("kind must be quality-ratchet");
  }
  if (!text(document?.revision)) faults.push("revision is required");
  if (!document?.baseline || !document?.candidate) {
    faults.push("baseline and candidate are required");
  }

  const baselineMetrics = new Map(
    (document?.baseline?.metrics || []).map((item) => [item.id, item]),
  );
  const candidateMetrics = new Map(
    (document?.candidate?.metrics || []).map((item) => [item.id, item]),
  );
  for (const [id, baseline] of baselineMetrics) {
    const candidate = candidateMetrics.get(id);
    const control = `metric:${id}`;
    if (!candidate) {
      regressions.push({ control, reason: "metric was removed" });
      continue;
    }
    if (!["minimum", "maximum"].includes(baseline.direction)) {
      faults.push(`${control} has an invalid direction`);
      continue;
    }
    if (
      !Number.isFinite(baseline.value) ||
      !Number.isFinite(candidate.value)
    ) {
      faults.push(`${control} requires numeric baseline and candidate values`);
      continue;
    }
    const weakened =
      baseline.direction === "minimum"
        ? candidate.value < baseline.value
        : candidate.value > baseline.value;
    if (weakened) {
      regressions.push({
        control,
        reason: `${baseline.direction} changed from ${baseline.value} to ${candidate.value}`,
      });
    }
  }

  const baselineAssertions = ids(document?.baseline?.assertions);
  const candidateAssertions = ids(document?.candidate?.assertions);
  for (const id of baselineAssertions) {
    if (!candidateAssertions.has(id)) {
      regressions.push({
        control: `assertion:${id}`,
        reason: "assertion was removed",
      });
    }
  }
  const baselineSuppressions = ids(document?.baseline?.suppressions);
  for (const id of ids(document?.candidate?.suppressions)) {
    if (!baselineSuppressions.has(id)) {
      regressions.push({
        control: `suppression:${id}`,
        reason: "suppression was added",
      });
    }
  }
  const baselineSkips = ids(document?.baseline?.skipped_tests);
  for (const id of ids(document?.candidate?.skipped_tests)) {
    if (!baselineSkips.has(id)) {
      regressions.push({
        control: `skip:${id}`,
        reason: "test skip was added",
      });
    }
  }

  const evaluated = regressions.map((item) => {
    const exception = activeException(exceptions, item.control, date);
    return {
      ...item,
      disposition: exception ? "temporary-exception" : "unaccepted-regression",
      exception_id: exception?.id || null,
    };
  });

  for (const [index, item] of exceptions.entries()) {
    if (!text(item?.id) || !text(item?.control)) {
      faults.push(`exceptions[${index}] requires id and control`);
    }
    if (
      !text(item?.owner) ||
      !text(item?.reason) ||
      !text(item?.evidence) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item?.expires_on || "")
    ) {
      faults.push(`exceptions[${index}] requires owner, reason, evidence, and expiry`);
    }
  }

  const unaccepted = evaluated.filter(
    (item) => item.disposition === "unaccepted-regression",
  );
  return {
    schema: 1,
    kind: "quality-ratchet-result",
    revision: document?.revision || null,
    observed_at: date,
    regressions: evaluated,
    faults,
    decision: faults.length
      ? "invalid-evidence"
      : unaccepted.length
        ? "regression-detected"
        : evaluated.length
          ? "temporary-exceptions"
          : "ratchet-held",
    limitations: [
      "Rivet compares project-selected controls. It does not set universal quality thresholds.",
      "An exception records acceptance evidence. It does not make the regression safe.",
      "This report does not install or execute a quality tool.",
    ],
  };
}

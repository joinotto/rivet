function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeFuzzCampaign(report) {
  const faults = [];
  const warnings = [];
  if (report?.schema !== 1 || report?.kind !== "fuzz-campaign") {
    faults.push("The file must use Rivet fuzz-campaign schema 1.");
  }
  for (const field of [
    "engine",
    "engine_version",
    "target",
    "revision",
    "command_digest",
    "started_at",
    "finished_at",
  ]) {
    if (!text(report?.[field])) faults.push(`The fuzz report requires ${field}.`);
  }
  for (const field of ["duration_seconds", "executions"]) {
    if (typeof report?.[field] !== "number" || report[field] < 0) {
      faults.push(`The fuzz report requires a non-negative ${field}.`);
    }
  }
  if (!text(report?.seed_corpus_digest)) {
    warnings.push("The report does not bind the seed corpus.");
  }
  if (!text(report?.final_corpus_digest)) {
    warnings.push("The report does not bind the final corpus.");
  }
  if (!text(report?.dictionary_digest)) {
    warnings.push("The report does not bind a fuzzing dictionary.");
  }
  if (!text(report?.sanitizer)) {
    warnings.push("The report does not identify a sanitizer.");
  }
  const crashes = list(report?.crashes);
  const crashIds = new Set();
  for (const crash of crashes) {
    const label = crash?.id || "record";
    if (!text(crash?.id)) {
      faults.push("Each crash requires an id.");
    } else if (crashIds.has(crash.id)) {
      faults.push(`Duplicate crash id: ${crash.id}.`);
    } else {
      crashIds.add(crash.id);
    }
    for (const field of ["class", "input_digest", "artifact", "stack_digest"]) {
      if (!text(crash?.[field])) faults.push(`Crash ${label} requires ${field}.`);
    }
    if (crash?.reproducible !== true && crash?.reproducible !== false) {
      faults.push(`Crash ${label} requires a reproducible boolean.`);
    }
    if (crash?.reproducible === false) {
      warnings.push(`Crash ${label} needs reproducibility investigation.`);
    }
  }
  if (!Number.isInteger(report?.timeouts) || report.timeouts < 0) {
    faults.push("The fuzz report requires a non-negative integer timeouts.");
  }
  if (!Number.isInteger(report?.out_of_memory) || report.out_of_memory < 0) {
    faults.push("The fuzz report requires a non-negative integer out_of_memory.");
  }
  const persistentCorpus = report?.persistent_corpus ?? null;
  if (persistentCorpus !== null) {
    for (const field of [
      "restored_files",
      "imported_files",
      "saved_files",
    ]) {
      if (
        !Number.isInteger(persistentCorpus?.[field]) ||
        persistentCorpus[field] < 0
      ) {
        faults.push(
          `The persistent corpus requires a non-negative integer ${field}.`,
        );
      }
    }
    if (
      persistentCorpus?.restored_files > 0 &&
      !text(persistentCorpus?.restored_digest)
    ) {
      faults.push("A restored persistent corpus requires restored_digest.");
    }
    if (!text(persistentCorpus?.saved_digest)) {
      faults.push("The persistent corpus requires saved_digest.");
    }
  }

  return {
    schema: 1,
    kind: "fuzz-campaign-evidence",
    evidence_class: "observed",
    engine: report?.engine || null,
    engine_version: report?.engine_version || null,
    target: report?.target || null,
    revision: report?.revision || null,
    campaign: {
      duration_seconds: report?.duration_seconds ?? null,
      executions: report?.executions ?? null,
      seed_corpus_digest: report?.seed_corpus_digest || null,
      final_corpus_digest: report?.final_corpus_digest || null,
      persistent_corpus: persistentCorpus,
      dictionary_digest: report?.dictionary_digest || null,
      sanitizer: report?.sanitizer || null,
    },
    crashes,
    timeouts: report?.timeouts ?? null,
    out_of_memory: report?.out_of_memory ?? null,
    faults,
    warnings,
    decision: faults.length
      ? "invalid-evidence"
      : crashes.length
        ? "crash-observed"
        : "no-crash-observed",
    limitations: [
      "No observed crash means only that this campaign found no crash.",
      "Campaign duration, corpus quality, target coverage, sanitizers, and dictionaries affect defect detection.",
      "Reproduce and minimize each crash before you assign a root cause.",
    ],
  };
}

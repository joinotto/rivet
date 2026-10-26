function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function humanBaselineTemplate({
  reviewerId,
  fixtureSource,
  sourceFileCount,
  workspaceDigest,
  createdAt,
  timeLimitMinutes,
}) {
  return {
    schema: 1,
    kind: "human-baseline-review",
    condition: "experienced-human",
    blind: true,
    created_at: createdAt,
    reviewer: {
      id: reviewerId || "",
      experience_summary: "",
      relevant_roles: [],
      independence: "",
      conflicts: "",
    },
    fixture_source: fixtureSource,
    source_file_count: sourceFileCount,
    workspace_digest: workspaceDigest,
    time_limit_minutes: timeLimitMinutes,
    started_at: "",
    finished_at: "",
    findings: [],
    defects_introduced: 0,
    limitations: [],
    attestation: {
      seed_metadata_excluded: true,
      answer_keys_not_accessed: false,
      used_normal_professional_methods: false,
    },
    signature: {
      method: "",
      identity: "",
      artifact: "",
    },
  };
}

export function normalizeHumanBaseline(review, expected) {
  const faults = [];
  if (review?.schema !== 1 || review?.kind !== "human-baseline-review") {
    faults.push("The review must use human-baseline-review schema 1.");
  }
  if (review?.condition !== "experienced-human" || review?.blind !== true) {
    faults.push("The review must be a blind experienced-human condition.");
  }
  for (const field of [
    "id",
    "experience_summary",
    "independence",
    "conflicts",
  ]) {
    if (!text(review?.reviewer?.[field])) {
      faults.push(`The reviewer requires ${field}.`);
    }
  }
  if (!list(review?.reviewer?.relevant_roles).length) {
    faults.push("The reviewer requires at least one relevant role.");
  }
  if (
    review?.fixture_source !== expected.fixture_source ||
    review?.source_file_count !== expected.source_file_count ||
    review?.workspace_digest !== expected.workspace_digest
  ) {
    faults.push("The review does not match the prepared blind workspace.");
  }
  const started = Date.parse(review?.started_at);
  const finished = Date.parse(review?.finished_at);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) {
    faults.push("The review requires a valid start and finish time.");
  }
  const durationSeconds =
    Number.isFinite(started) && Number.isFinite(finished)
      ? (finished - started) / 1000
      : null;
  if (
    Number.isFinite(durationSeconds) &&
    positive(expected.time_limit_minutes) &&
    durationSeconds > expected.time_limit_minutes * 60
  ) {
    faults.push("The review exceeded the prepared time limit.");
  }
  if (!Array.isArray(review?.findings)) {
    faults.push("The review requires a findings array.");
  }
  if (
    !Number.isFinite(review?.defects_introduced) ||
    review.defects_introduced < 0
  ) {
    faults.push("The review requires non-negative defects_introduced.");
  }
  for (const [index, finding] of list(review?.findings).entries()) {
    for (const field of ["fixture", "class", "summary", "evidence", "confidence"]) {
      if (!text(finding?.[field])) {
        faults.push(`findings[${index}] requires ${field}.`);
      }
    }
    if (!["high", "medium", "low"].includes(finding?.confidence)) {
      faults.push(`findings[${index}] has invalid confidence.`);
    }
  }
  if (
    review?.attestation?.seed_metadata_excluded !== true ||
    review?.attestation?.answer_keys_not_accessed !== true ||
    review?.attestation?.used_normal_professional_methods !== true
  ) {
    faults.push("The reviewer must complete all blindness and method attestations.");
  }
  if (!text(review?.signature?.method) || !text(review?.signature?.identity)) {
    faults.push("The review requires a signature method and identity.");
  }

  return {
    schema: 1,
    kind: "human-baseline-validation",
    faults,
    decision: faults.length ? "invalid-human-baseline" : "recorded-human-baseline",
    run: faults.length
      ? null
      : {
          schema: 1,
          kind: "blind-evaluation-run",
          condition: "experienced-human",
          blind: true,
          provider: "human",
          reviewer_id: review.reviewer.id,
          reviewer_qualifications: {
            experience_summary: review.reviewer.experience_summary,
            relevant_roles: review.reviewer.relevant_roles,
            independence: review.reviewer.independence,
            conflicts: review.reviewer.conflicts,
          },
          fixture_source: review.fixture_source,
          source_file_count: review.source_file_count,
          seed_metadata_excluded: true,
          workspace_digest: review.workspace_digest,
          started_at: review.started_at,
          finished_at: review.finished_at,
          duration_seconds: durationSeconds,
          isolation: "prepared seed-free workspace with reviewer attestation",
          findings: review.findings,
          defects_introduced: review.defects_introduced,
          limitations: review.limitations,
          signature: review.signature,
        },
    limitations: [
      "Structural validation does not prove reviewer experience, independence, or blindness.",
      "The reviewer signature must be verified under a separately selected trust policy.",
    ],
  };
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

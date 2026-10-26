import crypto from "node:crypto";
import fs from "node:fs";

const REVIEW_TYPES = new Set(["formal", "privacy", "chaos"]);

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function tasks(type) {
  const shared = [
    "Review the stated scope, assumptions, omissions, evidence, and residual risks.",
    "Identify missing evidence and claims that exceed the supplied artifact.",
    "Record findings, required changes, accepted residual risks, and insufficient evidence.",
  ];
  if (type === "formal") {
    return [
      ...shared,
      "Review the abstraction boundary, finite bounds, invariants, implementation mappings, and counterexamples.",
    ];
  }
  if (type === "privacy") {
    return [
      ...shared,
      "Review data categories, purposes, flows, minimization, retention, deletion, third parties, rights, harms, and legal-review boundaries.",
    ];
  }
  return [
    ...shared,
    "Review approval, steady state, target bounds, harm signals, stop conditions, rollback, and recovery evidence.",
  ];
}

export function createAdvancedReviewPacket({
  artifactFile,
  type,
  createdAt,
}) {
  if (!REVIEW_TYPES.has(type)) {
    throw new Error("The advanced review type must be formal, privacy, or chaos.");
  }
  const source = fs.readFileSync(artifactFile, "utf8");
  const artifact = JSON.parse(source);
  return {
    schema: 1,
    kind: "advanced-expert-review-packet",
    evidence_class: "derived",
    created_at: createdAt,
    review_type: type,
    subject: {
      kind: artifact.kind || null,
      system: artifact.system || artifact.experiment || null,
      revision: artifact.revision || null,
    },
    artifact: {
      path: artifactFile,
      sha256: digest(source),
      content: artifact,
    },
    reviewer_tasks: tasks(type),
    limitations: [
      "Packet creation is not independent review.",
      "A digest binds the supplied artifact. It does not prove that the artifact is complete or correct.",
      "Rivet cannot determine reviewer competence, independence, legal authority, or approval authority.",
    ],
  };
}

export function advancedReviewTemplate(packet, createdAt) {
  return {
    schema: 1,
    kind: "advanced-expert-review",
    evidence_class: "declared-human-review",
    created_at: createdAt,
    review_type: packet.review_type || "",
    packet: {
      artifact_sha256: packet.artifact?.sha256 || "",
      subject_revision: packet.subject?.revision || "",
    },
    reviewer: {
      name: "",
      role: "",
      organization: "",
      qualifications: [],
      independence: "",
      conflicts: "",
    },
    reviewed_at: "",
    scope_complete: false,
    conclusion: "",
    findings: [],
    accepted_residual_risks: [],
    limitations: [],
    signature: {
      method: "",
      identity: "",
      artifact: "",
    },
  };
}

export function validateAdvancedReview(packet, review) {
  const faults = [];
  const warnings = [];
  if (
    review?.schema !== 1 ||
    review?.kind !== "advanced-expert-review"
  ) {
    faults.push("The review must use advanced-expert-review schema 1.");
  }
  if (
    !REVIEW_TYPES.has(review?.review_type) ||
    review?.review_type !== packet?.review_type
  ) {
    faults.push("The review type does not match the packet.");
  }
  for (const field of ["created_at", "reviewed_at"]) {
    if (!text(review?.[field])) faults.push(`The review requires ${field}.`);
  }
  for (const field of [
    "name",
    "role",
    "organization",
    "independence",
    "conflicts",
  ]) {
    if (!text(review?.reviewer?.[field])) {
      faults.push(`The reviewer requires ${field}.`);
    }
  }
  if (!list(review?.reviewer?.qualifications).length) {
    faults.push("The reviewer requires at least one qualification record.");
  }
  if (review?.scope_complete !== true) {
    faults.push("The reviewer must confirm the complete packet scope.");
  }
  if (review?.packet?.artifact_sha256 !== packet?.artifact?.sha256) {
    faults.push("The review artifact digest does not match the packet.");
  }
  if (review?.packet?.subject_revision !== packet?.subject?.revision) {
    faults.push("The review subject revision does not match the packet.");
  }
  if (
    !["approved", "findings", "insufficient-evidence"].includes(
      review?.conclusion,
    )
  ) {
    faults.push("The review requires a valid conclusion.");
  }
  const ids = new Set();
  for (const finding of list(review?.findings)) {
    if (!text(finding?.id)) {
      faults.push("Each finding requires an id.");
    } else if (ids.has(finding.id)) {
      faults.push(`Duplicate finding id: ${finding.id}.`);
    } else {
      ids.add(finding.id);
    }
    for (const field of [
      "area",
      "severity",
      "statement",
      "evidence",
      "recommendation",
      "disposition",
    ]) {
      if (!text(finding?.[field])) {
        faults.push(`Finding ${finding?.id || "record"} requires ${field}.`);
      }
    }
  }
  if (review?.conclusion === "approved" && list(review?.findings).length) {
    faults.push("An approved conclusion cannot contain open findings.");
  }
  if (review?.conclusion === "findings" && !list(review?.findings).length) {
    faults.push("A findings conclusion requires at least one finding.");
  }
  if (!text(review?.signature?.method) || !text(review?.signature?.identity)) {
    warnings.push("The review has no signature method and identity.");
  }
  if (!list(review?.limitations).length) {
    warnings.push("The review records no limitations.");
  }
  return {
    schema: 1,
    kind: "advanced-expert-review-validation",
    evidence_class: "derived",
    review_type: review?.review_type || null,
    reviewer: review?.reviewer || null,
    reviewed_at: review?.reviewed_at || null,
    subject_revision: review?.packet?.subject_revision || null,
    conclusion: review?.conclusion || null,
    finding_count: list(review?.findings).length,
    faults,
    warnings,
    decision: faults.length ? "invalid-review" : "recorded-human-review",
    limitations: [
      "Structural validation does not prove reviewer competence, independence, or authority.",
      "A recorded review does not prove that required changes were implemented.",
      "A signature requires a separately selected and verified trust policy.",
    ],
  };
}

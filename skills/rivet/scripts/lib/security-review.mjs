import crypto from "node:crypto";
import fs from "node:fs";

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function createSecurityReviewPacket({
  threatModelFile,
  findingSchema,
  createdAt,
}) {
  const threatModelSource = fs.readFileSync(threatModelFile, "utf8");
  const threatModel = JSON.parse(threatModelSource);
  const findingSchemaSource = `${JSON.stringify(findingSchema, null, 2)}\n`;
  return {
    schema: 1,
    kind: "security-expert-review-packet",
    evidence_class: "derived",
    created_at: createdAt,
    subject: {
      system: threatModel.system || null,
      revision: threatModel.revision || null,
    },
    artifacts: {
      threat_model: {
        path: threatModelFile,
        sha256: digest(threatModelSource),
        content: threatModel,
      },
      finding_schema: {
        id: "rivet-independent-review-findings-schema-1",
        sha256: digest(findingSchemaSource),
        content: findingSchema,
      },
    },
    reviewer_tasks: [
      "Review the stated system scope, exclusions, and assumptions.",
      "Identify missing assets, actors, entry points, trust boundaries, data flows, abuse cases, threats, and residual risks.",
      "Review each control, verification method, owner, status, and standard mapping.",
      "Review the finding schema for severity, confidence, evidence, location, recommendation, verdict, and limitation semantics.",
      "Record disagreements, required changes, accepted residual risks, and insufficient evidence.",
    ],
    limitations: [
      "Packet creation is not expert review.",
      "A digest binds the supplied artifact. It does not prove that the artifact is complete.",
      "Rivet cannot determine reviewer competence, independence, or organizational authority.",
    ],
  };
}

export function securityReviewTemplate(packet, createdAt) {
  return {
    schema: 1,
    kind: "security-expert-review",
    evidence_class: "declared-human-review",
    created_at: createdAt,
    packet: {
      threat_model_sha256: packet.artifacts?.threat_model?.sha256 || "",
      finding_schema_sha256: packet.artifacts?.finding_schema?.sha256 || "",
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
    scope: {
      threat_model: false,
      finding_schema: false,
    },
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

export function validateSecurityReview(packet, review) {
  const faults = [];
  const warnings = [];
  if (review?.schema !== 1 || review?.kind !== "security-expert-review") {
    faults.push("The review must use Rivet security-expert-review schema 1.");
  }
  for (const field of ["created_at", "reviewed_at"]) {
    if (!text(review?.[field])) faults.push(`The review requires ${field}.`);
  }
  for (const field of ["name", "role", "organization", "independence", "conflicts"]) {
    if (!text(review?.reviewer?.[field])) {
      faults.push(`The reviewer requires ${field}.`);
    }
  }
  if (!list(review?.reviewer?.qualifications).length) {
    faults.push("The reviewer requires at least one qualification record.");
  }
  if (review?.scope?.threat_model !== true) {
    faults.push("The review must include the threat model.");
  }
  if (review?.scope?.finding_schema !== true) {
    faults.push("The review must include the finding schema.");
  }
  const expected = {
    threat_model_sha256: packet?.artifacts?.threat_model?.sha256,
    finding_schema_sha256: packet?.artifacts?.finding_schema?.sha256,
    subject_revision: packet?.subject?.revision,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (!text(value) || review?.packet?.[field] !== value) {
      faults.push(`The review packet ${field} does not match.`);
    }
  }
  if (!["approved", "findings", "insufficient-evidence"].includes(review?.conclusion)) {
    faults.push("The review requires a valid conclusion.");
  }
  const ids = new Set();
  for (const finding of list(review?.findings)) {
    if (!text(finding?.id)) {
      faults.push("Each security-review finding requires an id.");
    } else if (ids.has(finding.id)) {
      faults.push(`Duplicate security-review finding id: ${finding.id}.`);
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
        faults.push(`Security-review finding ${finding?.id || "record"} requires ${field}.`);
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
    warnings.push("The expert review has no signature method and identity.");
  }
  if (!list(review?.limitations).length) {
    warnings.push("The expert review records no limitations.");
  }
  return {
    schema: 1,
    kind: "security-expert-review-validation",
    evidence_class: "derived",
    reviewer: review?.reviewer || null,
    reviewed_at: review?.reviewed_at || null,
    subject_revision: review?.packet?.subject_revision || null,
    conclusion: review?.conclusion || null,
    finding_count: list(review?.findings).length,
    accepted_residual_risk_count: list(review?.accepted_residual_risks).length,
    faults,
    warnings,
    decision: faults.length ? "invalid-review" : "recorded-human-review",
    limitations: [
      "Structural validation does not prove reviewer competence, independence, or authority.",
      "A recorded review does not prove that required changes were implemented.",
      "A valid signature proves artifact integrity and signer identity only under its trust policy.",
    ],
  };
}

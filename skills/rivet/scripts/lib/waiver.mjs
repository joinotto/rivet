import fs from "fs";

const REQUIRED = [
  "technical_reason",
  "business_reason",
  "compensating_control",
  "owner",
  "approval",
  "created_at",
  "expires_at",
  "review_trigger",
];

export function waiverTemplate(finding, createdAt) {
  return {
    schema: 1,
    finding_or_control: finding || "",
    risk: "high",
    technical_reason: "",
    business_reason: "",
    compensating_control: "",
    owner: "",
    approval: "",
    created_at: createdAt,
    expires_at: "",
    review_trigger: "",
    evidence: [],
  };
}

export function validateWaiver(file, asOf) {
  const waiver = JSON.parse(fs.readFileSync(file, "utf8"));
  const faults = [];
  if (waiver.schema !== 1) faults.push("schema must equal 1");
  if (!String(waiver.finding_or_control || "").trim()) {
    faults.push("finding_or_control is required");
  }
  for (const field of REQUIRED) {
    if (!String(waiver[field] || "").trim()) faults.push(`${field} is required`);
  }
  const expiry = Date.parse(waiver.expires_at);
  const now = Date.parse(asOf);
  if (waiver.expires_at && !Number.isFinite(expiry)) {
    faults.push("expires_at must be an ISO date");
  } else if (Number.isFinite(expiry) && Number.isFinite(now) && expiry < now) {
    faults.push("the waiver is expired");
  }
  if (!Array.isArray(waiver.evidence)) faults.push("evidence must be an array");
  return {
    schema: 1,
    workflow: "waiver-validation",
    evidence_class: "derived",
    artifact: file,
    as_of: asOf,
    finding_or_control: waiver.finding_or_control || null,
    owner: waiver.owner || null,
    expires_at: waiver.expires_at || null,
    faults,
    decision: faults.length ? "invalid" : "valid",
    limitations: [
      "Structural validity does not prove that the reason, approval, or compensating control is adequate.",
      "Protected branch or organizational policy can reject a structurally valid waiver.",
    ],
  };
}

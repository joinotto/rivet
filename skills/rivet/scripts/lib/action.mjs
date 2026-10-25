import fs from "fs";

export function actionTemplate(id, incidentId, createdAt) {
  return {
    schema: 1,
    id: id || "",
    incident_id: incidentId || "",
    created_at: createdAt,
    contributing_condition: "",
    change: "",
    owner: "",
    priority: "",
    due_at: "",
    status: "open",
    verification: {
      method: "",
      evidence: [],
      result: "",
      verified_at: "",
    },
  };
}

export function validateAction(file, asOf) {
  const action = JSON.parse(fs.readFileSync(file, "utf8"));
  const faults = [];
  for (const field of [
    "id",
    "incident_id",
    "created_at",
    "contributing_condition",
    "change",
    "owner",
    "priority",
    "due_at",
    "status",
  ]) {
    if (!String(action[field] || "").trim()) faults.push(`${field} is required`);
  }
  if (!["open", "in-progress", "completed", "cancelled"].includes(action.status)) {
    faults.push("status is unsupported");
  }
  const due = Date.parse(action.due_at);
  const now = Date.parse(asOf);
  if (action.due_at && !Number.isFinite(due)) faults.push("due_at must be an ISO date");
  const verification = action.verification || {};
  if (action.status === "completed") {
    if (!String(verification.method || "").trim()) {
      faults.push("completed action requires verification.method");
    }
    if (!Array.isArray(verification.evidence) || !verification.evidence.length) {
      faults.push("completed action requires verification.evidence");
    }
    if (verification.result !== "pass") {
      faults.push("completed action requires verification.result=pass");
    }
    if (!String(verification.verified_at || "").trim()) {
      faults.push("completed action requires verification.verified_at");
    }
  }
  const overdue =
    ["open", "in-progress"].includes(action.status) &&
    Number.isFinite(due) &&
    Number.isFinite(now) &&
    due < now;
  return {
    schema: 1,
    kind: "preventive-action",
    evidence_class: "derived",
    artifact: file,
    id: action.id || null,
    incident_id: action.incident_id || null,
    owner: action.owner || null,
    status: action.status || null,
    due_at: action.due_at || null,
    as_of: asOf,
    overdue,
    verification,
    faults,
    decision: faults.length
      ? "invalid"
      : overdue
        ? "overdue"
        : action.status === "completed"
          ? "verified-complete"
          : "tracked",
    limitations: [
      "A passing verification proves only the named method and evidence.",
      "Completion does not prove that the incident cannot recur.",
    ],
  };
}

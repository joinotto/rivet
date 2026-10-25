import crypto from "crypto";
import fs from "fs";

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function eventDigest(event) {
  const { digest: ignored, ...content } = event;
  return digest(content);
}

export function incidentTemplate(id, declaredAt) {
  return {
    schema: 1,
    incident_id: id,
    declared_at: declaredAt,
    status: "active",
    severity: "",
    commander: "",
    impact: "",
    events: [],
  };
}

export function validateIncident(document) {
  const faults = [];
  if (document.schema !== 1) faults.push("schema must equal 1");
  for (const field of ["incident_id", "declared_at", "status"]) {
    if (!String(document[field] || "").trim()) faults.push(`${field} is required`);
  }
  let previous = null;
  let previousTime = Date.parse(document.declared_at);
  for (let index = 0; index < (document.events || []).length; index += 1) {
    const event = document.events[index];
    if (event.sequence !== index + 1) faults.push(`event ${index + 1} has an invalid sequence`);
    if (event.previous_digest !== previous) {
      faults.push(`event ${index + 1} has an invalid previous_digest`);
    }
    if (event.digest !== eventDigest(event)) {
      faults.push(`event ${index + 1} has an invalid digest`);
    }
    const at = Date.parse(event.at);
    if (!Number.isFinite(at) || (Number.isFinite(previousTime) && at < previousTime)) {
      faults.push(`event ${index + 1} has an invalid or decreasing timestamp`);
    }
    if (event.mode === "write" && !String(event.approval || "").trim()) {
      faults.push(`event ${index + 1} records a write without approval`);
    }
    previous = event.digest;
    previousTime = at;
  }
  return faults;
}

export function appendIncidentEvent(document, input) {
  const existingFaults = validateIncident(document);
  if (existingFaults.length) {
    throw new Error(`Incident timeline is invalid: ${existingFaults.join("; ")}`);
  }
  const previous = document.events.at(-1)?.digest || null;
  const event = {
    sequence: document.events.length + 1,
    previous_digest: previous,
    at: input.at,
    actor: input.actor,
    type: input.type,
    mode: input.mode || "read",
    target: input.target || null,
    statement: input.statement,
    evidence: input.evidence || [],
    approval: input.approval || null,
  };
  if (event.mode === "write" && !event.approval) {
    throw new Error("A write event requires --approval.");
  }
  event.digest = eventDigest(event);
  return {
    ...document,
    events: [...document.events, event],
  };
}

export function incidentReport(file) {
  const document = JSON.parse(fs.readFileSync(file, "utf8"));
  const faults = validateIncident(document);
  return {
    schema: 1,
    kind: "incident-timeline",
    evidence_class: "derived",
    artifact: file,
    incident_id: document.incident_id || null,
    status: document.status || null,
    event_count: Array.isArray(document.events) ? document.events.length : 0,
    last_event_digest: document.events?.at(-1)?.digest || null,
    faults,
    decision: faults.length ? "invalid" : "valid",
    limitations: [
      "The timeline records declared actions and evidence. It does not prove that external actions occurred.",
      "The local hash chain detects edits only when a trusted prior digest or signed artifact exists.",
    ],
  };
}

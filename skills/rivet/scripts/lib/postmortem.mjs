import fs from "fs";
import { validateIncident } from "./incident.mjs";

function eventsOfType(document, types) {
  return document.events.filter((event) => types.includes(event.type));
}

export function buildPostmortem(file) {
  const incident = JSON.parse(fs.readFileSync(file, "utf8"));
  const faults = validateIncident(incident);
  if (faults.length) {
    throw new Error(`Incident timeline is invalid: ${faults.join("; ")}`);
  }
  const timeline = incident.events.map((event) => ({
    at: event.at,
    actor: event.actor,
    type: event.type,
    statement: event.statement,
    evidence: event.evidence,
  }));
  return {
    schema: 1,
    kind: "postmortem",
    evidence_class: "derived",
    incident_id: incident.incident_id,
    impact: incident.impact || "Unknown. Add measured user or system impact.",
    detection: eventsOfType(incident, ["detection", "observation"]),
    response: eventsOfType(incident, [
      "decision",
      "change",
      "communication",
      "recovery",
    ]),
    timeline,
    contributing_conditions: [
      "Unknown. Add system, process, design, test, observability, and organizational conditions supported by evidence.",
    ],
    recovery: eventsOfType(incident, ["recovery"]),
    preventive_work: [],
    open_questions: [
      "Which control should have prevented or reduced the impact?",
      "Why did detection and recovery take the observed time?",
      "Which change will reduce recurrence or recovery time, and how will it be verified?",
    ],
    limitations: [
      "The draft uses the recorded incident timeline and does not infer root cause.",
      "Do not use human error as a root cause without analysis of enabling system conditions.",
      "Owners, priorities, due dates, and verification are required for preventive actions.",
    ],
  };
}

function section(title, lines) {
  return [
    `## ${title}`,
    "",
    ...(lines.length ? lines : ["- No evidence recorded."]),
    "",
  ];
}

export function postmortemMarkdown(report) {
  return [
    `# Postmortem: ${report.incident_id}`,
    "",
    ...section("Impact", [`- ${report.impact}`]),
    ...section(
      "Detection",
      report.detection.map((event) => `- ${event.at}: ${event.statement}`),
    ),
    ...section(
      "Response and recovery",
      report.response.map((event) => `- ${event.at}: ${event.statement}`),
    ),
    ...section(
      "Timeline",
      report.timeline.map(
        (event) => `- ${event.at} — ${event.type} — ${event.statement}`,
      ),
    ),
    ...section(
      "Contributing conditions",
      report.contributing_conditions.map((item) => `- ${item}`),
    ),
    ...section("Preventive work", ["- Add owner, priority, due date, and verification."]),
    ...section(
      "Open questions",
      report.open_questions.map((item) => `- ${item}`),
    ),
    ...section("Limitations", report.limitations.map((item) => `- ${item}`)),
  ].join("\n");
}

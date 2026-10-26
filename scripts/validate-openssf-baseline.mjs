import fs from "node:fs";

const file = new URL("../docs/openssf-baseline-assessment.json", import.meta.url);
const assessment = JSON.parse(fs.readFileSync(file, "utf8"));

const expected = [
  "OSPS-AC-01.01",
  "OSPS-AC-02.01",
  "OSPS-AC-03.01",
  "OSPS-AC-03.02",
  "OSPS-BR-01.01",
  "OSPS-BR-01.03",
  "OSPS-BR-03.01",
  "OSPS-BR-03.02",
  "OSPS-BR-07.01",
  "OSPS-DO-01.01",
  "OSPS-DO-02.01",
  "OSPS-GV-02.01",
  "OSPS-GV-03.01",
  "OSPS-LE-02.01",
  "OSPS-LE-02.02",
  "OSPS-LE-03.01",
  "OSPS-LE-03.02",
  "OSPS-QA-01.01",
  "OSPS-QA-01.02",
  "OSPS-QA-02.01",
  "OSPS-QA-04.01",
  "OSPS-QA-05.01",
  "OSPS-QA-05.02",
  "OSPS-VM-02.01"
];
const statuses = new Set(["met", "not_met", "not_applicable", "needs_review"]);
const faults = [];

if (assessment.schema !== 1) faults.push("schema must be 1");
if (assessment.kind !== "openssf-baseline-1-assessment") {
  faults.push("kind must be openssf-baseline-1-assessment");
}

const controls = Array.isArray(assessment.controls) ? assessment.controls : [];
const ids = controls.map((control) => control.id);
if (new Set(ids).size !== ids.length) faults.push("control identifiers must be unique");

for (const id of expected) {
  if (!ids.includes(id)) faults.push(`missing control: ${id}`);
}
for (const id of ids) {
  if (!expected.includes(id)) faults.push(`unexpected control: ${id}`);
}

for (const control of controls) {
  if (!statuses.has(control.status)) {
    faults.push(`${control.id}: invalid status`);
  }
  if (!Array.isArray(control.evidence) || control.evidence.length === 0) {
    faults.push(`${control.id}: evidence is required`);
  }
  if (typeof control.notes !== "string" || control.notes.trim() === "") {
    faults.push(`${control.id}: notes are required`);
  }
  if (control.status === "not_applicable" && control.notes.length < 20) {
    faults.push(`${control.id}: not-applicable justification is insufficient`);
  }
}

const observed = Object.fromEntries(
  [...statuses].map((status) => [
    status,
    controls.filter((control) => control.status === status).length
  ])
);
for (const [status, count] of Object.entries(observed)) {
  if (assessment.summary?.[status] !== count) {
    faults.push(`summary ${status} must equal ${count}`);
  }
}

const result = {
  schema: 1,
  kind: "openssf-baseline-assessment-validation",
  controls: controls.length,
  summary: observed,
  faults,
  decision: faults.length === 0 ? "valid" : "invalid"
};

console.log(JSON.stringify(result, null, 2));
if (faults.length > 0) process.exitCode = 1;

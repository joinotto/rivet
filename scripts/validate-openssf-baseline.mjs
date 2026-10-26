import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function isLocalEvidenceReference(reference) {
  return (
    typeof reference === "string" &&
    /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(reference)
  );
}

export function validateLocalEvidence(references, root = repository) {
  const faults = [];
  const observed = new Set();
  for (const reference of references) {
    if (observed.has(reference)) {
      faults.push(`duplicate evidence reference: ${reference}`);
      continue;
    }
    observed.add(reference);
    if (!isLocalEvidenceReference(reference)) continue;
    if (reference.split("/").includes("..")) {
      faults.push(`local evidence escapes the repository: ${reference}`);
      continue;
    }
    const target = path.resolve(root, reference);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      faults.push(`local evidence escapes the repository: ${reference}`);
      continue;
    }
    try {
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) {
        faults.push(`local evidence must not be a symbolic link: ${reference}`);
      } else if (!stat.isFile() && !stat.isDirectory()) {
        faults.push(`local evidence has an unsupported type: ${reference}`);
      }
    } catch (error) {
      faults.push(
        error.code === "ENOENT"
          ? `local evidence does not exist: ${reference}`
          : `local evidence cannot be inspected: ${reference}`
      );
    }
  }
  return faults;
}

const definitions = [
  {
    file: "../docs/openssf-baseline-assessment.json",
    kind: "openssf-baseline-1-assessment",
    expected: [
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
    ]
  },
  {
    file: "../docs/openssf-baseline-2-assessment.json",
    kind: "openssf-baseline-2-assessment",
    expected: [
      "OSPS-AC-04.01",
      "OSPS-BR-02.01",
      "OSPS-BR-04.01",
      "OSPS-BR-05.01",
      "OSPS-BR-06.01",
      "OSPS-DO-06.01",
      "OSPS-DO-07.01",
      "OSPS-GV-01.01",
      "OSPS-GV-01.02",
      "OSPS-GV-03.02",
      "OSPS-LE-01.01",
      "OSPS-QA-03.01",
      "OSPS-QA-06.01",
      "OSPS-SA-01.01",
      "OSPS-SA-02.01",
      "OSPS-SA-03.01",
      "OSPS-VM-01.01",
      "OSPS-VM-03.01",
      "OSPS-VM-04.01"
    ]
  },
  {
    file: "../docs/openssf-baseline-3-assessment.json",
    kind: "openssf-baseline-3-assessment",
    expected: [
      "OSPS-AC-04.02",
      "OSPS-BR-01.04",
      "OSPS-BR-02.02",
      "OSPS-BR-07.02",
      "OSPS-DO-03.01",
      "OSPS-DO-03.02",
      "OSPS-DO-04.01",
      "OSPS-DO-05.01",
      "OSPS-GV-04.01",
      "OSPS-QA-02.02",
      "OSPS-QA-04.02",
      "OSPS-QA-06.02",
      "OSPS-QA-06.03",
      "OSPS-QA-07.01",
      "OSPS-SA-03.02",
      "OSPS-VM-04.02",
      "OSPS-VM-05.01",
      "OSPS-VM-05.02",
      "OSPS-VM-05.03",
      "OSPS-VM-06.01",
      "OSPS-VM-06.02"
    ]
  }
];
const statuses = new Set(["met", "not_met", "not_applicable", "needs_review"]);
const faults = [];
const results = [];

for (const definition of definitions) {
  const file = new URL(definition.file, import.meta.url);
  const assessment = JSON.parse(fs.readFileSync(file, "utf8"));
  const prefix = assessment.kind || definition.file;

  if (assessment.schema !== 1) faults.push(`${prefix}: schema must be 1`);
  if (assessment.kind !== definition.kind) {
    faults.push(`${prefix}: kind must be ${definition.kind}`);
  }

  const controls = Array.isArray(assessment.controls) ? assessment.controls : [];
  const ids = controls.map((control) => control.id);
  if (new Set(ids).size !== ids.length) {
    faults.push(`${prefix}: control identifiers must be unique`);
  }

  for (const id of definition.expected) {
    if (!ids.includes(id)) faults.push(`${prefix}: missing control: ${id}`);
  }
  for (const id of ids) {
    if (!definition.expected.includes(id)) {
      faults.push(`${prefix}: unexpected control: ${id}`);
    }
  }

  for (const control of controls) {
    if (!statuses.has(control.status)) {
      faults.push(`${prefix}/${control.id}: invalid status`);
    }
    if (!Array.isArray(control.evidence) || control.evidence.length === 0) {
      faults.push(`${prefix}/${control.id}: evidence is required`);
    }
    if (typeof control.notes !== "string" || control.notes.trim() === "") {
      faults.push(`${prefix}/${control.id}: notes are required`);
    }
    if (control.status === "not_applicable" && control.notes.length < 20) {
      faults.push(`${prefix}/${control.id}: not-applicable justification is insufficient`);
    }
    for (const fault of validateLocalEvidence(control.evidence || [])) {
      faults.push(`${prefix}/${control.id}: ${fault}`);
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
      faults.push(`${prefix}: summary ${status} must equal ${count}`);
    }
  }

  results.push({ kind: assessment.kind, controls: controls.length, summary: observed });
}

const result = {
  schema: 1,
  kind: "openssf-baseline-assessment-validation",
  assessments: results,
  controls: results.reduce((total, item) => total + item.controls, 0),
  faults,
  decision: faults.length === 0 ? "valid" : "invalid"
};

console.log(JSON.stringify(result, null, 2));
if (faults.length > 0) process.exitCode = 1;

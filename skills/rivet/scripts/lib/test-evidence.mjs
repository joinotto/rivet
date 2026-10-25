import fs from "fs";

function percentage(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function normalizeCoverage(file) {
  const document = JSON.parse(fs.readFileSync(file, "utf8"));
  const total = document.total;
  if (!total) throw new Error("Coverage JSON has no total record.");
  const metrics = {};
  for (const key of ["lines", "statements", "functions", "branches"]) {
    const item = total[key];
    if (!item) continue;
    metrics[key] = {
      total: Number(item.total),
      covered: Number(item.covered),
      skipped: Number(item.skipped || 0),
      percent: percentage(item.pct),
    };
  }
  return {
    schema: 1,
    kind: "coverage",
    evidence_class: "observed",
    artifact: file,
    metrics,
    decision: Object.keys(metrics).length ? "observed" : "insufficient-evidence",
    limitations: [
      "Coverage shows executed code. It does not prove that tests detect incorrect behavior.",
      "Aggregate coverage can hide untested changed lines and critical branches.",
    ],
  };
}

export function normalizeMutation(file) {
  const document = JSON.parse(fs.readFileSync(file, "utf8"));
  const mutants = Object.values(document.files || {})
    .flatMap((item) => item.mutants || []);
  const counts = {};
  for (const mutant of mutants) {
    const status = mutant.status || "Unknown";
    counts[status] = (counts[status] || 0) + 1;
  }
  const assessed = mutants.filter(
    (item) => !["Ignored", "CompileError"].includes(item.status),
  );
  const killed = assessed.filter((item) =>
    ["Killed", "Timeout"].includes(item.status),
  ).length;
  const survived = assessed.filter((item) => item.status === "Survived");
  return {
    schema: 1,
    kind: "mutation",
    evidence_class: "observed",
    artifact: file,
    counts,
    mutation_score:
      assessed.length ? Number(((killed / assessed.length) * 100).toFixed(2)) : null,
    surviving_mutants: survived.map((item) => ({
      id: item.id || null,
      mutator: item.mutatorName || null,
      location: item.location || null,
    })),
    decision: survived.length ? "test-gaps" : assessed.length ? "pass" : "insufficient-evidence",
    limitations: [
      "Mutation score depends on the selected source files, operators, and test command.",
      "Equivalent mutants can survive without representing a useful test gap.",
    ],
  };
}

function attribute(xml, name) {
  const match = xml.match(new RegExp(`${name}=["'](\\d+)["']`));
  return match ? Number(match[1]) : 0;
}

export function normalizeJunit(file, kind) {
  const xml = fs.readFileSync(file, "utf8");
  if (!/<testsuites?\b/.test(xml)) throw new Error("The artifact is not JUnit XML.");
  const tests = attribute(xml, "tests");
  const failures = attribute(xml, "failures");
  const errors = attribute(xml, "errors");
  const skipped = attribute(xml, "skipped");
  return {
    schema: 1,
    kind,
    evidence_class: "observed",
    artifact: file,
    tests,
    failures,
    errors,
    skipped,
    decision: failures || errors ? "fail" : tests ? "pass" : "insufficient-evidence",
    limitations: [
      "JUnit results describe executed cases only.",
      "A passing contract suite does not prove compatibility with untested consumers.",
    ],
  };
}

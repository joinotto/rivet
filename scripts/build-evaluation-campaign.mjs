#!/usr/bin/env node

import fs from "fs";
import path from "path";

const argv = process.argv.slice(2);
const repository = process.cwd();

function value(flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function projectPath(relative) {
  const absolute = path.resolve(repository, relative);
  if (!absolute.startsWith(`${repository}${path.sep}`)) {
    throw new Error(`Path must be inside the project: ${relative}`);
  }
  return absolute;
}

function seedFiles(root, output = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) seedFiles(absolute, output);
    if (entry.isFile() && entry.name === "seed.json") output.push(absolute);
  }
  return output;
}

function completeness(run) {
  const checks = [
    run.seed_metadata_excluded === true,
    (typeof run.command_digest === "string" && run.command_digest.length > 0) ||
      (typeof run.workspace_digest === "string" &&
        run.workspace_digest.length > 0),
    typeof run.isolation === "string" && run.isolation.length > 0,
    typeof run.started_at === "string" && run.started_at.length > 0,
    typeof run.finished_at === "string" && run.finished_at.length > 0,
    Number.isInteger(run.source_file_count) && run.source_file_count > 0,
  ];
  return checks.filter(Boolean).length / checks.length;
}

function main() {
  const fixtureArgument = value("--fixtures") || "fixtures/reference-systems";
  const runsArgument = value("--runs");
  const outputArgument = value("--output");
  if (!runsArgument || !outputArgument) {
    throw new Error("Use --runs file1,file2 --output <file>.");
  }
  const fixtures = projectPath(fixtureArgument);
  const seeds = seedFiles(fixtures).map((file) => {
    const seed = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      id: seed.id,
      fixture: path.relative(fixtures, path.dirname(file)),
    };
  });
  const runs = runsArgument.split(",").map((item) => item.trim()).filter(Boolean)
    .map((relative) => {
      const absolute = projectPath(relative);
      const run = JSON.parse(fs.readFileSync(absolute, "utf8"));
      if (
        run.schema !== 1 ||
        run.kind !== "blind-evaluation-run" ||
        run.seed_metadata_excluded !== true
      ) {
        throw new Error(`Invalid blind evaluation run: ${relative}.`);
      }
      return {
        id: `${run.provider}-${run.condition}`,
        condition: run.condition,
        blind: run.blind,
        reviewer_id: run.reviewer_id,
        artifact: relative,
        findings: run.findings,
        defects_introduced: 0,
        duration_seconds: run.duration_seconds,
        evidence_completeness: completeness(run),
      };
    });
  const campaign = {
    schema: 1,
    kind: "evaluation-campaign",
    created_at: new Date().toISOString(),
    fixtures: fixtureArgument,
    evidence_completeness_definition:
      "Fraction of six required run-provenance fields present.",
    seeds,
    runs,
  };
  const output = projectPath(outputArgument);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(campaign, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(`Evaluation campaign: ${outputArgument}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function words(value) {
  return String(value || "").toLowerCase();
}

function includesSignal(source, signals) {
  return signals.some((signal) => source.includes(signal));
}

function skillDescription(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  const line = match?.[1]
    .split(/\r?\n/)
    .find((item) => item.startsWith("description:"));
  return line?.slice("description:".length).trim() || "";
}

export function evaluateSkillRouting(contract, description) {
  const faults = [];
  if (contract?.schema !== 1) faults.push("schema must be 1");
  if (contract?.kind !== "skill-routing-contract") {
    faults.push("kind must be skill-routing-contract");
  }
  for (const field of [
    "activation_signals",
    "frontend_signals",
    "description_requirements",
    "cases",
  ]) {
    if (!Array.isArray(contract?.[field]) || contract[field].length === 0) {
      faults.push(`${field} must not be empty`);
    }
  }

  const normalizedDescription = words(description);
  const missingDescriptionTerms = (contract?.description_requirements || [])
    .map((requirement) =>
      Array.isArray(requirement) ? requirement : [requirement],
    )
    .filter(
      (alternatives) =>
        alternatives.length === 0 ||
        !alternatives.some((term) =>
          normalizedDescription.includes(words(term)),
        ),
    );
  for (const alternatives of missingDescriptionTerms) {
    faults.push(
      `skill description does not contain a required term: ${alternatives.join(" or ")}`,
    );
  }

  const ids = new Set();
  const results = [];
  for (const [index, item] of (contract?.cases || []).entries()) {
    const id = item?.id || `case-${index + 1}`;
    if (ids.has(id)) faults.push(`duplicate case id: ${id}`);
    ids.add(id);
    if (!["positive", "negative", "pressure"].includes(item?.class)) {
      faults.push(`${id} has an invalid class`);
    }
    if (typeof item?.expected_activation !== "boolean") {
      faults.push(`${id} requires expected_activation`);
    }
    if (item?.class === "negative" && !item?.adjacent_owner) {
      faults.push(`${id} requires adjacent_owner`);
    }

    const prompt = words(item?.prompt);
    const hasActivation = includesSignal(
      prompt,
      contract?.activation_signals || [],
    );
    const frontendOnly =
      includesSignal(prompt, contract?.frontend_signals || []) &&
      !hasActivation;
    const observed = hasActivation && !frontendOnly;
    results.push({
      id,
      class: item?.class,
      expected_activation: item?.expected_activation,
      observed_activation: observed,
      pass: observed === item?.expected_activation,
    });
  }

  for (const result of results.filter((item) => !item.pass)) {
    faults.push(
      `${result.id} expected activation ${result.expected_activation} but observed ${result.observed_activation}`,
    );
  }
  const classes = new Set(results.map((item) => item.class));
  for (const required of ["positive", "negative", "pressure"]) {
    if (!classes.has(required)) faults.push(`cases require class: ${required}`);
  }

  return {
    schema: 1,
    kind: "skill-routing-contract-result",
    skill: contract?.skill || null,
    cases: results.length,
    passed: results.filter((item) => item.pass).length,
    results,
    faults,
    decision: faults.length ? "fail" : "pass",
    limitations: [
      "This deterministic signal model detects contract drift. It does not prove native host routing.",
      "Native hosts can use model behavior, project context, installed skills, and host-specific routing rules.",
    ],
  };
}

function main() {
  const repository = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const contractFile = path.resolve(
    process.argv[2] ||
      path.join(repository, "fixtures/skill-routing/cases.json"),
  );
  const skillFile = path.resolve(
    process.argv[3] || path.join(repository, "skills/rivet/SKILL.md"),
  );
  let contract;
  let description;
  try {
    contract = JSON.parse(fs.readFileSync(contractFile, "utf8"));
    description = skillDescription(fs.readFileSync(skillFile, "utf8"));
  } catch (error) {
    process.stderr.write(`Cannot load routing inputs: ${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  const report = evaluateSkillRouting(contract, description);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.decision !== "pass") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stringList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(text);
}

export function validateSkillRejections(document) {
  const faults = [];
  if (document?.schema !== 1) faults.push("schema must be 1");
  if (document?.kind !== "skill-change-rejection-ledger") {
    faults.push("kind must be skill-change-rejection-ledger");
  }
  if (!Array.isArray(document?.records) || document.records.length === 0) {
    faults.push("records must contain at least one rejection");
  }

  const ids = new Set();
  for (const [index, record] of (document?.records || []).entries()) {
    const label = `records[${index}]`;
    if (!text(record?.id)) {
      faults.push(`${label}.id is required`);
    } else if (ids.has(record.id)) {
      faults.push(`${label}.id is duplicated`);
    } else {
      ids.add(record.id);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record?.observed_on || "")) {
      faults.push(`${label}.observed_on must use YYYY-MM-DD`);
    }
    if (!/^[a-f0-9]{40}$/.test(record?.affected_revision || "")) {
      faults.push(`${label}.affected_revision must be a full Git revision`);
    }
    for (const field of ["hypothesis", "rejection_reason"]) {
      if (!text(record?.[field])) faults.push(`${label}.${field} is required`);
    }
    if (record?.decision !== "rejected") {
      faults.push(`${label}.decision must be rejected`);
    }
    if (!text(record?.evaluation?.method)) {
      faults.push(`${label}.evaluation.method is required`);
    }
    if (!stringList(record?.evaluation?.artifacts)) {
      faults.push(`${label}.evaluation.artifacts must contain evidence paths`);
    }
    if (!text(record?.comparison?.before) || !text(record?.comparison?.after)) {
      faults.push(`${label}.comparison requires before and after results`);
    }
    if (!stringList(record?.retry_conditions)) {
      faults.push(`${label}.retry_conditions must contain at least one condition`);
    }
  }

  return {
    schema: 1,
    kind: "skill-change-rejection-validation",
    records: document?.records?.length || 0,
    faults,
    decision: faults.length ? "invalid" : "valid",
  };
}

function main() {
  const repository = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const file = path.resolve(
    process.argv[2] || path.join(repository, "docs/SKILL-CHANGE-REJECTIONS.json"),
  );
  let document;
  try {
    document = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    process.stderr.write(`Cannot read rejection ledger: ${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  const report = validateSkillRejections(document);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.decision !== "valid") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

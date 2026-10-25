#!/usr/bin/env node

import fs from "fs";
import path from "path";

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const targets = argv.filter((item) => !item.startsWith("--"));
const roots = targets.length ? targets : ["."];
const findings = [];

function add(file, line, rule, level, message, text) {
  findings.push({ file, line, rule, level, message, text: text.trim() });
}

function filesIn(target) {
  const absolute = path.resolve(target);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return absolute.endsWith(".md") ? [absolute] : [];

  const output = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    output.push(...filesIn(path.join(absolute, entry.name)));
  }
  return output;
}

function wordCount(value) {
  return value
    .replace(/\[[^\]]+\]\([^)]+\)/g, "link")
    .replace(/https?:\/\/\S+/g, "URL")
    .split(/\s+/)
    .filter(Boolean).length;
}

function inspectFile(file) {
  const relative = path.relative(process.cwd(), file) || path.basename(file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let inFence = false;

  lines.forEach((raw, index) => {
    const lineNumber = index + 1;
    const trimmed = raw.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      return;
    }

    if (
      inFence ||
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("|") ||
      /^[-*]\s+\[[ xX]\]/.test(trimmed)
    ) {
      return;
    }

    const prose = trimmed
      .replace(/`[^`]+`/g, "technical-term")
      .replace(/\[[^\]]+\]\([^)]+\)/g, "link")
      .replace(/<https?:\/\/[^>]+>/g, "URL");

    if (prose.includes(";")) {
      add(
        relative,
        lineNumber,
        "RIVET-STE-001",
        "fault",
        "Do not use a semicolon to join technical statements.",
        raw,
      );
    }

    if (/\band\/or\b/i.test(prose)) {
      add(
        relative,
        lineNumber,
        "RIVET-STE-002",
        "fault",
        "Replace 'and/or' with the exact logical condition.",
        raw,
      );
    }

    const vague = prose.match(
      /\b(simply|obviously|clearly|easily|various|several|somehow|etc\.)\b/i,
    );
    if (vague) {
      add(
        relative,
        lineNumber,
        "RIVET-STE-003",
        "warning",
        `Review the vague term '${vague[0]}'.`,
        raw,
      );
    }

    if (
      /\b(is|are|was|were|be|been|being)\s+(?:\w+\s+){0,2}\w+(ed|en)\b/i.test(
        prose,
      )
    ) {
      add(
        relative,
        lineNumber,
        "RIVET-STE-004",
        "warning",
        "Review the possible passive voice.",
        raw,
      );
    }

    const sentences = prose
      .split(/(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      const count = wordCount(sentence);
      if (count > 25) {
        add(
          relative,
          lineNumber,
          "RIVET-STE-005",
          "warning",
          `Review the sentence length (${count} words; profile target is 25).`,
          raw,
        );
        break;
      }
    }
  });
}

const files = [...new Set(roots.flatMap(filesIn))].sort();
for (const file of files) inspectFile(file);

const faults = findings.filter((item) => item.level === "fault");
const warnings = findings.filter((item) => item.level === "warning");
const report = {
  schema: 1,
  profile: "Rivet ASD-STE100-aligned profile",
  certification: false,
  files_checked: files.length,
  faults: faults.length,
  warnings: warnings.length,
  findings,
  limitation:
    "This checker does not include the ASD-STE100 controlled dictionary and cannot validate semantic writing rules.",
};

if (json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log(
    `Rivet STE check: ${files.length} file(s), ${faults.length} fault(s), ${warnings.length} warning(s)`,
  );
  for (const finding of findings) {
    console.log(
      `${finding.file}:${finding.line} [${finding.level}] ${finding.rule} ${finding.message}`,
    );
  }
  console.log(report.limitation);
}

if (faults.length) process.exitCode = 2;


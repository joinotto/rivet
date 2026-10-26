#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  prepareBlindWorkspace,
} from "../skills/rivet/scripts/lib/blind-evaluation.mjs";
import {
  humanBaselineTemplate,
  normalizeHumanBaseline,
} from "../skills/rivet/scripts/lib/human-baseline.mjs";

const repository = process.cwd();
const argv = process.argv.slice(2);
const action = argv[0];

function value(flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function has(flag) {
  return argv.includes(flag);
}

function projectPath(relative) {
  const absolute = path.resolve(repository, relative);
  if (
    absolute === repository ||
    !absolute.startsWith(`${repository}${path.sep}`)
  ) {
    throw new Error(`Path must be inside the project: ${relative}`);
  }
  return absolute;
}

function digestWorkspace(root, files) {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(root, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function prepare() {
  const outputArgument = value("--output");
  if (!outputArgument) throw new Error("Prepare requires --output <directory>.");
  const output = projectPath(outputArgument);
  if (fs.existsSync(output)) {
    throw new Error(`Refusing to replace existing packet: ${outputArgument}.`);
  }
  const fixturesArgument = value("--fixtures") || "fixtures/reference-systems";
  const fixtures = projectPath(fixturesArgument);
  const workspace = path.join(output, "workspace");
  fs.mkdirSync(workspace, { recursive: true });
  const files = prepareBlindWorkspace({
    repository,
    fixtures,
    destination: workspace,
    condition: "experienced-human",
  });
  const timeLimitMinutes = Number(value("--time-limit-minutes") || 60);
  if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes <= 0) {
    throw new Error("The time limit must be a positive number.");
  }
  const prepared = {
    schema: 1,
    kind: "human-baseline-packet",
    created_at: value("--created-at") || new Date().toISOString(),
    fixture_source: fixturesArgument,
    source_file_count: files.length,
    files,
    workspace_digest: digestWorkspace(workspace, files),
    time_limit_minutes: timeLimitMinutes,
    instructions: [
      "Review every file in the prepared workspace.",
      "Do not access seed.json, expected findings, agent runs, or answer keys.",
      "Use normal professional review methods without Rivet guidance or tools.",
      "Record concrete findings, evidence, confidence, timing, limitations, and reviewer attestations.",
    ],
    limitations: [
      "Packet preparation does not prove reviewer experience or blindness.",
      "The workspace digest binds the prepared files but does not monitor external information access.",
    ],
  };
  const review = humanBaselineTemplate({
    reviewerId: value("--reviewer-id"),
    fixtureSource: prepared.fixture_source,
    sourceFileCount: prepared.source_file_count,
    workspaceDigest: prepared.workspace_digest,
    createdAt: prepared.created_at,
    timeLimitMinutes,
  });
  fs.writeFileSync(
    path.join(output, "packet.json"),
    `${JSON.stringify(prepared, null, 2)}\n`,
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(output, "review.json"),
    `${JSON.stringify(review, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(`${JSON.stringify(prepared, null, 2)}\n`);
}

function ingest() {
  const packetFile = projectPath(value("--packet") || "");
  const reviewFile = projectPath(value("--review") || "");
  const outputFile = projectPath(value("--output") || "");
  const packet = JSON.parse(fs.readFileSync(packetFile, "utf8"));
  const review = JSON.parse(fs.readFileSync(reviewFile, "utf8"));
  const report = normalizeHumanBaseline(review, packet);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.decision !== "recorded-human-baseline") {
    process.exitCode = 2;
    return;
  }
  if (fs.existsSync(outputFile) && !has("--force")) {
    throw new Error(`Refusing to replace existing run: ${value("--output")}.`);
  }
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(report.run, null, 2)}\n`, {
    mode: 0o600,
  });
}

try {
  if (action === "prepare") prepare();
  else if (action === "ingest") ingest();
  else throw new Error("Use human-baseline prepare or human-baseline ingest.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

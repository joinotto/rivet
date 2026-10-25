#!/usr/bin/env node

import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import {
  blindEvaluationPrompt,
  blindEvaluationSchema,
  prepareBlindWorkspace,
} from "../skills/rivet/scripts/lib/blind-evaluation.mjs";

const argv = process.argv.slice(2);
const repository = process.cwd();

function value(flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function has(flag) {
  return argv.includes(flag);
}

function projectPath(relative) {
  const absolute = path.resolve(repository, relative);
  if (!absolute.startsWith(`${repository}${path.sep}`)) {
    throw new Error(`Path must be inside the project: ${relative}`);
  }
  return absolute;
}

function digest(valueToDigest) {
  return crypto.createHash("sha256").update(valueToDigest).digest("hex");
}

function parseClaude(output) {
  const envelope = JSON.parse(output);
  if (envelope.structured_output) return envelope.structured_output;
  if (typeof envelope.result === "string") return JSON.parse(envelope.result);
  if (Array.isArray(envelope.findings)) return envelope;
  throw new Error("Claude Code returned no structured findings.");
}

function main() {
  const condition = value("--condition");
  const provider = value("--provider");
  const output = value("--output");
  if (!condition || !provider || !output) {
    throw new Error(
      "Use --condition <condition> --provider codex|claude --output <file>.",
    );
  }
  if (!["codex", "claude"].includes(provider)) {
    throw new Error("The provider must be codex or claude.");
  }
  if (!has("--allow-network")) {
    throw new Error("A native blind evaluation requires --allow-network.");
  }
  const outputFile = projectPath(output);
  if (fs.existsSync(outputFile) && !has("--force")) {
    throw new Error(`Refusing to overwrite existing file: ${output}.`);
  }
  const fixtures = projectPath(
    value("--fixtures") || "fixtures/reference-systems",
  );
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-blind-"));
  const startedAt = new Date();
  let result;
  let findings;
  let command;
  try {
    const files = prepareBlindWorkspace({
      repository,
      fixtures,
      destination: temporary,
      condition,
    });
    const prompt = blindEvaluationPrompt(condition, files);
    if (provider === "codex") {
      const schemaFile = path.join(temporary, "output-schema.json");
      const responseFile = path.join(temporary, "response.json");
      fs.writeFileSync(schemaFile, JSON.stringify(blindEvaluationSchema), {
        mode: 0o600,
      });
      command = [
        "codex",
        "exec",
        "--sandbox",
        "read-only",
        "--ephemeral",
        "--skip-git-repo-check",
        "--color",
        "never",
        "--output-schema",
        schemaFile,
        "--output-last-message",
        responseFile,
        "-",
      ];
      result = spawnSync(command[0], command.slice(1), {
        cwd: temporary,
        input: prompt,
        encoding: "utf8",
        timeout: 900000,
        maxBuffer: 8 * 1024 * 1024,
      });
      if (result.status === 0) {
        findings = JSON.parse(fs.readFileSync(responseFile, "utf8"));
      }
    } else {
      command = [
        "claude",
        "--print",
        "--bare",
        "--no-session-persistence",
        "--tools",
        condition === "tool-backed-rivet" ? "Read,Bash,Glob,Grep" : "Read,Glob,Grep",
        "--permission-mode",
        "plan",
        "--output-format",
        "json",
        "--json-schema",
        JSON.stringify(blindEvaluationSchema),
      ];
      result = spawnSync(command[0], command.slice(1), {
        cwd: temporary,
        input: prompt,
        encoding: "utf8",
        timeout: 900000,
        maxBuffer: 8 * 1024 * 1024,
      });
      if (result.status === 0) findings = parseClaude(result.stdout);
    }
    if (result.error?.code === "ENOENT") {
      throw new Error(`The ${provider} CLI is unavailable.`);
    }
    if (result.status !== 0) {
      throw new Error(
        `${provider} evaluation failed with exit ${result.status}: ` +
        `${result.stderr || result.stdout || ""}`.slice(-2000),
      );
    }
    if (!findings || !Array.isArray(findings.findings)) {
      throw new Error(`${provider} returned invalid evaluation findings.`);
    }
    const finishedAt = new Date();
    const artifact = {
      schema: 1,
      kind: "blind-evaluation-run",
      condition,
      blind: true,
      provider,
      reviewer_id: `${provider}:${condition}`,
      fixture_source: path.relative(repository, fixtures),
      source_file_count: files.length,
      seed_metadata_excluded: true,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_seconds: (finishedAt.getTime() - startedAt.getTime()) / 1000,
      command_digest: digest(JSON.stringify(command)),
      isolation: provider === "codex"
        ? "temporary-directory, ephemeral, read-only"
        : "temporary-directory, bare, no-session, plan-mode",
      findings: findings.findings,
      limitations: findings.limitations || [],
    };
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, `${JSON.stringify(artifact, null, 2)}\n`, {
      mode: 0o600,
    });
    process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

#!/usr/bin/env node

import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import {
  hostProbePrompt,
  hostProbeSchema,
  validateHostProbe,
} from "../skills/rivet/scripts/lib/host-conformance.mjs";

const argv = process.argv.slice(2);
const repository = process.cwd();
const readToken = "RIVET_READ_OK_7f51";
const commandToken = "RIVET_COMMAND_OK_93ac";

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

function digest(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function parseClaude(output) {
  const envelope = JSON.parse(output);
  if (envelope.structured_output) return envelope.structured_output;
  if (typeof envelope.result === "string") return JSON.parse(envelope.result);
  if (envelope.read_token) return envelope;
  throw new Error("Claude Code returned no structured probe response.");
}

function main() {
  const provider = value("--provider");
  const output = value("--output");
  if (!["codex", "claude"].includes(provider) || !output) {
    throw new Error("Use --provider codex|claude --output <file>.");
  }
  if (!has("--allow-network")) {
    throw new Error("Native host conformance requires --allow-network.");
  }
  const outputFile = projectPath(output);
  if (fs.existsSync(outputFile) && !has("--force")) {
    throw new Error(`Refusing to overwrite existing file: ${output}.`);
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-host-probe-"));
  const marker = path.join(temporary, "write-probe.txt");
  let result;
  let response;
  let command;
  try {
    fs.writeFileSync(path.join(temporary, "read-probe.txt"), `${readToken}\n`);
    fs.writeFileSync(
      path.join(temporary, "command-probe.mjs"),
      `process.stdout.write("${commandToken}\\n");\n`,
    );
    const prompt = hostProbePrompt(provider);
    if (provider === "codex") {
      const schemaFile = path.join(temporary, "schema.json");
      const responseFile = path.join(temporary, "response.json");
      fs.writeFileSync(schemaFile, JSON.stringify(hostProbeSchema));
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
        timeout: 600000,
        maxBuffer: 8 * 1024 * 1024,
      });
      if (result.status === 0) {
        response = JSON.parse(fs.readFileSync(responseFile, "utf8"));
      }
    } else {
      command = [
        "claude",
        "--print",
        "--bare",
        "--no-session-persistence",
        "--tools",
        "Read,Bash",
        "--allowedTools",
        "Bash(node command-probe.mjs)",
        "--permission-mode",
        "default",
        "--output-format",
        "json",
        "--json-schema",
        JSON.stringify(hostProbeSchema),
      ];
      result = spawnSync(command[0], command.slice(1), {
        cwd: temporary,
        input: prompt,
        encoding: "utf8",
        timeout: 600000,
        maxBuffer: 8 * 1024 * 1024,
      });
      if (result.status === 0) response = parseClaude(result.stdout);
    }
    if (result.error?.code === "ENOENT") {
      throw new Error(`The ${provider} CLI is unavailable.`);
    }
    if (result.status !== 0) {
      throw new Error(
        `${provider} host probe failed with exit ${result.status}: ` +
        `${result.stderr || result.stdout || ""}`.slice(-2000),
      );
    }
    const report = validateHostProbe({
      provider,
      response,
      writeMarkerExists: fs.existsSync(marker),
      expectedReadToken: readToken,
      expectedCommandToken: commandToken,
    });
    report.command_digest = digest(JSON.stringify(command));
    report.isolation = provider === "codex"
      ? "temporary-directory, ephemeral, read-only sandbox"
      : "temporary-directory, no-session, explicit tool allowlist";
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.decision !== "pass") process.exitCode = 2;
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

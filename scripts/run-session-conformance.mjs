#!/usr/bin/env node

import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

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

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: "utf8",
    timeout: 600000,
    maxBuffer: 8 * 1024 * 1024,
  });
}

function requireSuccess(provider, stage, result) {
  if (result.error?.code === "ENOENT") {
    throw new Error(`The ${provider} CLI is unavailable.`);
  }
  if (result.status !== 0) {
    throw new Error(
      `${provider} ${stage} failed with exit ${result.status}: ` +
      `${result.stderr || result.stdout || ""}`.slice(-2000),
    );
  }
}

function codexSession(temporary, token) {
  const first = run(
    "codex",
    [
      "exec",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--color",
      "never",
      "--json",
      "-",
    ],
    {
      cwd: temporary,
      input: `Remember this exact token for the next turn: ${token}. Reply only STORED.`,
    },
  );
  requireSuccess("codex", "session start", first);
  const events = first.stdout.split("\n").filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
  const threadId = events.find((event) => event.type === "thread.started")
    ?.thread_id;
  if (!threadId) throw new Error("Codex returned no thread id.");
  const responseFile = path.join(temporary, "codex-resume.txt");
  const second = run(
    "codex",
    [
      "exec",
      "resume",
      threadId,
      "--skip-git-repo-check",
      "--output-last-message",
      responseFile,
      "Return only the exact token that I asked you to remember.",
    ],
    { cwd: temporary },
  );
  requireSuccess("codex", "session resume", second);
  return {
    session_id: threadId,
    response: fs.readFileSync(responseFile, "utf8").trim(),
  };
}

function claudeSession(temporary, token) {
  const sessionId = crypto.randomUUID();
  const first = run(
    "claude",
    [
      "--print",
      "--session-id",
      sessionId,
      "--tools",
      "",
      "--permission-mode",
      "plan",
      `Remember this exact token for the next turn: ${token}. Reply only STORED.`,
    ],
    { cwd: temporary },
  );
  requireSuccess("claude", "session start", first);
  const second = run(
    "claude",
    [
      "--print",
      "--resume",
      sessionId,
      "--tools",
      "",
      "--permission-mode",
      "plan",
      "Return only the exact token that I asked you to remember.",
    ],
    { cwd: temporary },
  );
  requireSuccess("claude", "session resume", second);
  return {
    session_id: sessionId,
    response: second.stdout.trim(),
  };
}

function main() {
  const provider = value("--provider");
  const output = value("--output");
  if (!["codex", "claude"].includes(provider) || !output) {
    throw new Error("Use --provider codex|claude --output <file>.");
  }
  if (!has("--allow-network")) {
    throw new Error("Native session conformance requires --allow-network.");
  }
  const outputFile = projectPath(output);
  if (fs.existsSync(outputFile) && !has("--force")) {
    throw new Error(`Refusing to overwrite existing file: ${output}.`);
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-session-"));
  const token = `RIVET_SESSION_${crypto.randomBytes(8).toString("hex")}`;
  const startedAt = new Date();
  try {
    const observed = provider === "codex"
      ? codexSession(temporary, token)
      : claudeSession(temporary, token);
    const finishedAt = new Date();
    const retained = observed.response === token;
    const report = {
      schema: 1,
      kind: "native-host-session-conformance",
      evidence_class: "observed",
      provider,
      session_id: observed.session_id,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      expected_token_digest: crypto
        .createHash("sha256")
        .update(token)
        .digest("hex"),
      response: observed.response,
      checks: {
        session_created: Boolean(observed.session_id),
        context_retained_after_resume: retained,
      },
      decision: retained ? "pass" : "fail",
      limitations: [
        "This probe tests one two-turn session on one host version.",
        "It does not test long-lived sessions, compaction, concurrent access, or credential expiry.",
        "The host can retain session metadata outside the temporary workspace.",
      ],
    };
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!retained) process.exitCode = 2;
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

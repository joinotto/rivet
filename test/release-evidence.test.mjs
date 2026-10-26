import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  prepareReleaseEvidence,
  validateReleaseEvidence
} from "../scripts/release-evidence.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-release-evidence-"));

function command(cwd, executable, args) {
  const result = spawnSync(executable, args, { cwd, encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

try {
  const source = path.join(temporary, "source");
  fs.cpSync(repository, source, {
    recursive: true,
    filter: (entry) => !entry.split(path.sep).includes(".git")
  });
  command(source, "git", ["init", "-q"]);
  command(source, "git", ["add", "."]);
  command(source, "git", [
    "-c",
    "user.name=Rivet Test",
    "-c",
    "user.email=rivet@example.invalid",
    "commit",
    "-q",
    "-m",
    "fixture"
  ]);
  const revision = command(source, "git", ["rev-parse", "HEAD"]);
  const candidate = path.join(temporary, "candidate");
  command(source, process.execPath, [
    "scripts/build-release-candidate.mjs",
    "--version",
    "0.1.0",
    "--revision",
    revision,
    "--output",
    candidate
  ]);

  const draft = prepareReleaseEvidence(candidate, "maintainer@example.invalid");
  const evidence = path.join(temporary, "evidence");
  fs.mkdirSync(evidence);
  const held = validateReleaseEvidence(draft, candidate, evidence);
  assert.strictEqual(held.decision, "hold");
  assert.ok(held.evidence_gaps.some((gap) => gap.id === "signature-verification"));
  assert.ok(held.evidence_gaps.some((gap) => gap.id === "approvals"));

  for (const gate of draft.gates) {
    gate.status = "pass";
    if (!gate.artifact) {
      gate.artifact = `${gate.id}.json`;
      fs.writeFileSync(path.join(evidence, gate.artifact), `${gate.id}\n`);
      gate.sha256 = sha256(path.join(evidence, gate.artifact));
    }
  }
  draft.gates.find((gate) => gate.id === "ci").run_ids = ["40381304029"];
  Object.assign(
    draft.gates.find((gate) => gate.id === "signature-verification"),
    {
      result: "verified",
      signer_identity: "release@example.invalid",
      verification_policy: "test identity policy"
    }
  );
  draft.evidence_class = "declared-release-evidence";
  draft.approvals = ["reviewer-1", "reviewer-2"].map((identity, index) => ({
    reviewer: {
      name: `Reviewer ${index + 1}`,
      identity,
      qualified: true,
      independent: true
    },
    decision: "approve",
    revision,
    reviewed_at: "2026-10-26",
    signature: {
      method: "test fixture",
      artifact: `review-${index + 1}.sig`,
      identity,
      scope: "evidence",
      sha256: ""
    }
  }));
  for (const approval of draft.approvals) {
    fs.writeFileSync(
      path.join(evidence, approval.signature.artifact),
      `${approval.reviewer.identity}\n`
    );
    approval.signature.sha256 = sha256(
      path.join(evidence, approval.signature.artifact)
    );
  }
  const ready = validateReleaseEvidence(draft, candidate, evidence);
  assert.strictEqual(
    ready.decision,
    "ready-for-publication-review",
    JSON.stringify(ready)
  );

  draft.approvals[1].reviewer.identity = "reviewer-1";
  draft.approvals[1].signature.identity = "reviewer-1";
  const duplicate = validateReleaseEvidence(draft, candidate, evidence);
  assert.strictEqual(duplicate.decision, "invalid");
  assert.ok(duplicate.faults.some((fault) => /distinct/.test(fault)));

  draft.approvals[1].reviewer.identity = "reviewer-2";
  draft.approvals[1].signature.identity = "reviewer-2";
  draft.candidate.manifest_sha256 = "0".repeat(64);
  const unbound = validateReleaseEvidence(draft, candidate, evidence);
  assert.strictEqual(unbound.decision, "invalid");
  assert.ok(unbound.faults.some((fault) => /manifest digest/.test(fault)));

  draft.candidate.manifest_sha256 = sha256(path.join(candidate, "manifest.json"));
  fs.appendFileSync(path.join(evidence, "security.json"), "tampered\n");
  const changedEvidence = validateReleaseEvidence(draft, candidate, evidence);
  assert.strictEqual(changedEvidence.decision, "invalid");
  assert.ok(changedEvidence.faults.some((fault) => /gate security artifact/.test(fault)));

  console.log("release evidence tests passed");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

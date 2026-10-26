import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repository = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const temporary = fs.mkdtempSync(path.join(repository, ".tmp-rivet-human-baseline-"));

try {
  const fixtures = path.join(temporary, "fixtures");
  fs.mkdirSync(path.join(fixtures, "case-a"), { recursive: true });
  fs.writeFileSync(path.join(fixtures, "case-a", "system.js"), "export const unsafe = true;\n");
  fs.writeFileSync(path.join(fixtures, "case-a", "seed.json"), "{\"answer\":true}\n");
  const packet = path.join(temporary, "packet");
  const prepared = spawnSync(
    process.execPath,
    [
      "scripts/human-baseline.mjs",
      "prepare",
      "--fixtures",
      path.relative(repository, fixtures),
      "--output",
      path.relative(repository, packet),
      "--reviewer-id",
      "reviewer-1",
      "--created-at",
      "2026-10-26T10:00:00Z",
      "--time-limit-minutes",
      "30",
    ],
    { cwd: repository, encoding: "utf8" },
  );
  assert.strictEqual(prepared.status, 0, prepared.stderr);
  const manifest = JSON.parse(prepared.stdout);
  assert.strictEqual(manifest.source_file_count, 1);
  assert.ok(fs.existsSync(path.join(packet, "workspace/fixtures/case-a/system.js")));
  assert.ok(!fs.existsSync(path.join(packet, "workspace/fixtures/case-a/seed.json")));

  const reviewFile = path.join(packet, "review.json");
  const review = JSON.parse(fs.readFileSync(reviewFile, "utf8"));
  Object.assign(review.reviewer, {
    experience_summary: "Ten years of backend and application-security review.",
    relevant_roles: ["backend engineer", "security reviewer"],
    independence: "Did not create the fixtures or agent findings.",
    conflicts: "None declared.",
  });
  review.started_at = "2026-10-26T10:00:00Z";
  review.finished_at = "2026-10-26T10:20:00Z";
  review.findings = [{
    fixture: "case-a",
    class: "authorization",
    summary: "The fixture permits an unsafe operation.",
    evidence: "system.js exports unsafe as true.",
    confidence: "high",
  }];
  review.limitations = ["The fixture is small."];
  review.attestation.answer_keys_not_accessed = true;
  review.attestation.used_normal_professional_methods = true;
  review.signature = {
    method: "signed review record",
    identity: "reviewer-1",
    artifact: "review.sig",
  };
  fs.writeFileSync(reviewFile, JSON.stringify(review));
  const runFile = path.join(temporary, "human-run.json");
  const ingested = spawnSync(
    process.execPath,
    [
      "scripts/human-baseline.mjs",
      "ingest",
      "--packet",
      path.relative(repository, path.join(packet, "packet.json")),
      "--review",
      path.relative(repository, reviewFile),
      "--output",
      path.relative(repository, runFile),
    ],
    { cwd: repository, encoding: "utf8" },
  );
  assert.strictEqual(ingested.status, 0, ingested.stderr);
  const run = JSON.parse(fs.readFileSync(runFile, "utf8"));
  assert.strictEqual(run.condition, "experienced-human");
  assert.strictEqual(run.duration_seconds, 1200);
  assert.match(run.workspace_digest, /^[a-f0-9]{64}$/);
  assert.strictEqual(run.command_digest, undefined);

  review.finished_at = "2026-10-26T10:31:00Z";
  fs.writeFileSync(reviewFile, JSON.stringify(review));
  const overtime = spawnSync(
    process.execPath,
    [
      "scripts/human-baseline.mjs",
      "ingest",
      "--packet",
      path.relative(repository, path.join(packet, "packet.json")),
      "--review",
      path.relative(repository, reviewFile),
      "--output",
      path.relative(repository, "unused.json"),
    ],
    { cwd: repository, encoding: "utf8" },
  );
  assert.strictEqual(overtime.status, 2);
  assert.match(overtime.stdout, /exceeded the prepared time limit/);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

process.stdout.write("human baseline tests passed\n");

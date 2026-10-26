#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { verifyReleaseCandidate } from "./verify-release-candidate.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredGates = [
  "ci",
  "host-packages",
  "dependencies",
  "license",
  "security",
  "compatibility",
  "changelog",
  "support",
  "sbom",
  "provenance",
  "signature-verification"
];

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function artifactDigest(root, artifact, label, faults) {
  if (!text(artifact) || path.isAbsolute(artifact) || artifact.split(/[\\/]/).includes("..")) {
    faults.push(`${label} has an unsafe artifact path.`);
    return undefined;
  }
  const target = path.resolve(root, artifact);
  if (target === root || !target.startsWith(`${root}${path.sep}`)) {
    faults.push(`${label} artifact escapes its evidence root.`);
    return undefined;
  }
  let descriptor;
  try {
    descriptor = fs.openSync(
      target,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW
    );
    if (!fs.fstatSync(descriptor).isFile()) {
      faults.push(`${label} artifact must be a regular file.`);
      return undefined;
    }
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(descriptor))
      .digest("hex");
  } catch {
    faults.push(`${label} artifact cannot be read safely.`);
    return undefined;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

export function prepareReleaseEvidence(candidateDirectory, preparer = "") {
  const candidate = verifyReleaseCandidate(candidateDirectory);
  if (candidate.decision !== "pass") {
    throw new Error(`Candidate verification failed: ${candidate.faults.join("; ")}`);
  }
  const manifestFile = path.join(candidateDirectory, "manifest.json");
  return {
    schema: 1,
    kind: "rivet-release-evidence",
    evidence_class: "draft",
    version: candidate.version,
    revision: candidate.revision,
    preparer,
    candidate: {
      manifest_sha256: digest(manifestFile),
      verification: "pass"
    },
    required_approvals: 2,
    gates: requiredGates.map((id) => ({
      id,
      status:
        id === "host-packages" || id === "sbom" || id === "provenance"
          ? "pass"
          : "missing",
      scope:
        id === "host-packages" || id === "sbom" || id === "provenance"
          ? "candidate"
          : "evidence",
      artifact:
        id === "host-packages"
          ? "manifest.json"
          : id === "sbom"
            ? "bom.cdx.json"
            : id === "provenance"
              ? "provenance.json"
              : "",
      sha256:
        id === "host-packages"
          ? digest(manifestFile)
          : id === "sbom"
          ? digest(path.join(candidateDirectory, "bom.cdx.json"))
          : id === "provenance"
            ? digest(path.join(candidateDirectory, "provenance.json"))
            : "",
      ...(id === "ci" ? { run_ids: [] } : {}),
      ...(id === "compatibility" ? { interfaces_reviewed: [] } : {}),
      ...(id === "changelog" ? { version_entry: "" } : {}),
      ...(id === "support"
        ? {
            supported_version: "",
            support_channel: "",
            security_channel: ""
          }
        : {}),
      ...(id === "signature-verification"
        ? {
            result: "missing",
            signer_identity: "",
            verification_policy: ""
          }
        : {})
    })),
    approvals: [],
    open_risks: [],
    known_limitations: [
      "The candidate is unsigned until signature-verification evidence passes.",
      "Candidate verification proves package structure and binding, not native host runtime behavior.",
      "This draft does not authorize publication."
    ]
  };
}

export function validateReleaseEvidence(
  record,
  candidateDirectory,
  evidenceDirectory = candidateDirectory
) {
  const faults = [];
  const gaps = [];
  const candidate = verifyReleaseCandidate(candidateDirectory, {
    version: record?.version,
    revision: record?.revision
  });
  if (candidate.decision !== "pass") faults.push(...candidate.faults.map((fault) => `candidate: ${fault}`));
  const manifestFile = path.join(candidateDirectory, "manifest.json");
  if (record?.schema !== 1 || record?.kind !== "rivet-release-evidence") {
    faults.push("Release evidence schema and kind are invalid.");
  }
  if (record?.evidence_class !== "declared-release-evidence") {
    gaps.push({
      id: "evidence-class",
      reason: "The completed record must use declared-release-evidence."
    });
  }
  if (!text(record?.preparer)) faults.push("preparer is required.");
  let manifestDigest;
  try {
    manifestDigest = digest(manifestFile);
  } catch {
    faults.push("Candidate manifest cannot be read.");
  }
  if (
    record?.candidate?.manifest_sha256 !== manifestDigest ||
    record?.candidate?.verification !== "pass"
  ) faults.push("Candidate verification is not bound to the manifest digest.");

  const gates = Array.isArray(record?.gates) ? record.gates : [];
  if (new Set(gates.map((gate) => gate.id)).size !== gates.length) {
    faults.push("Gate identifiers must be unique.");
  }
  for (const id of requiredGates) {
    const gate = gates.find((item) => item.id === id);
    if (!gate) {
      gaps.push({ id, reason: "Gate is missing." });
    } else if (
      gate.status !== "pass" ||
      !["candidate", "evidence"].includes(gate.scope) ||
      !text(gate.artifact) ||
      !/^[a-f0-9]{64}$/.test(gate.sha256 || "")
    ) {
      gaps.push({ id, reason: "Gate requires pass status, scope, artifact, and SHA-256 digest." });
    } else {
      const observedDigest = artifactDigest(
        gate.scope === "candidate" ? candidateDirectory : evidenceDirectory,
        gate.artifact,
        `gate ${id}`,
        faults
      );
      if (observedDigest && observedDigest !== gate.sha256) {
        faults.push(`gate ${id} artifact does not match its SHA-256 digest.`);
      }
    }
    if (
      id === "ci" &&
      (!Array.isArray(gate?.run_ids) ||
        gate.run_ids.length === 0 ||
        gate.run_ids.some((runId) => !/^[1-9][0-9]*$/.test(String(runId))))
    ) {
      gaps.push({ id: "ci-run-ids", reason: "CI gate requires one or more numeric run identifiers." });
    }
    if (
      id === "signature-verification" &&
      (gate?.result !== "verified" ||
        !text(gate?.signer_identity) ||
        !text(gate?.verification_policy))
    ) {
      gaps.push({
        id: "signature-identity",
        reason: "Signature verification requires a verified result, signer identity, and trust policy."
      });
    }
    if (
      id === "compatibility" &&
      (!Array.isArray(gate?.interfaces_reviewed) ||
        gate.interfaces_reviewed.length === 0 ||
        gate.interfaces_reviewed.some((item) => !text(item)))
    ) {
      gaps.push({
        id: "compatibility-scope",
        reason: "Compatibility evidence must name each reviewed interface class."
      });
    }
    if (id === "changelog" && gate?.version_entry !== record?.version) {
      gaps.push({
        id: "changelog-version",
        reason: "Changelog evidence must identify the candidate version."
      });
    }
    if (
      id === "support" &&
      (gate?.supported_version !== record?.version ||
        !text(gate?.support_channel) ||
        !text(gate?.security_channel))
    ) {
      gaps.push({
        id: "support-scope",
        reason: "Support evidence must bind the version and identify support and security channels."
      });
    }
  }
  for (const gate of gates) {
    if (!requiredGates.includes(gate.id)) faults.push(`Unexpected gate: ${gate.id}`);
  }

  if (!Number.isInteger(record?.required_approvals) || record.required_approvals < 2) {
    faults.push("required_approvals must be at least 2.");
  }
  const approvals = Array.isArray(record?.approvals) ? record.approvals : [];
  const identities = new Set();
  for (const approval of approvals) {
    if (
      !text(approval?.reviewer?.name) ||
      !text(approval?.reviewer?.identity) ||
      approval?.reviewer?.qualified !== true ||
      approval?.reviewer?.independent !== true ||
      approval?.decision !== "approve" ||
      approval?.revision !== record?.revision ||
      !text(approval?.reviewed_at) ||
      !text(approval?.signature?.method) ||
      !text(approval?.signature?.artifact) ||
      !text(approval?.signature?.identity) ||
      approval?.signature?.scope !== "evidence" ||
      !/^[a-f0-9]{64}$/.test(approval?.signature?.sha256 || "") ||
      approval.signature.identity !== approval.reviewer.identity
    ) {
      faults.push("Each approval must be qualified, independent, signed, and revision-bound.");
      continue;
    }
    const signatureDigest = artifactDigest(
      evidenceDirectory,
      approval.signature.artifact,
      `approval ${approval.reviewer.identity}`,
      faults
    );
    if (signatureDigest && signatureDigest !== approval.signature.sha256) {
      faults.push(
        `approval ${approval.reviewer.identity} signature does not match its SHA-256 digest.`
      );
    }
    if (
      approval.reviewer.identity === record.preparer ||
      identities.has(approval.reviewer.identity)
    ) {
      faults.push("Approval identities must be distinct from the preparer and each other.");
    }
    identities.add(approval.reviewer.identity);
  }
  if (approvals.length < (record?.required_approvals || 2)) {
    gaps.push({ id: "approvals", reason: "Required independent approvals are missing." });
  }

  if (!Array.isArray(record?.open_risks)) {
    faults.push("open_risks must be an array.");
  }
  for (const risk of record?.open_risks || []) {
    if (!text(risk?.id) || !text(risk?.severity) || !text(risk?.disposition)) {
      faults.push("Each open risk requires id, severity, and disposition.");
    }
    if (risk?.severity === "critical" && risk?.disposition !== "accepted") {
      gaps.push({ id: `risk:${risk.id || "unknown"}`, reason: "A critical risk is not accepted." });
    }
  }
  if (
    !Array.isArray(record?.known_limitations) ||
    record.known_limitations.length === 0 ||
    record.known_limitations.some((limitation) => !text(limitation))
  ) {
    faults.push("known_limitations must contain one or more text entries.");
  }

  return {
    schema: 1,
    kind: "rivet-release-evidence-validation",
    version: record?.version || null,
    revision: record?.revision || null,
    faults,
    evidence_gaps: gaps,
    decision: faults.length ? "invalid" : gaps.length ? "hold" : "ready-for-publication-review",
    limitations: [
      "Ready for publication review does not create or authorize a release.",
      "Rivet cannot verify reviewer competence, independence, or signature trust from declarations alone."
    ]
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...argv] = process.argv.slice(2);
  const value = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const candidate = value("--candidate");
  const output = value("--output");
  if (command === "prepare" && candidate && output) {
    const record = prepareReleaseEvidence(path.resolve(repository, candidate), value("--preparer") || "");
    fs.writeFileSync(path.resolve(repository, output), `${JSON.stringify(record, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600
    });
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
  } else if (command === "validate" && candidate && value("--record")) {
    const recordFile = path.resolve(repository, value("--record"));
    const record = JSON.parse(fs.readFileSync(recordFile, "utf8"));
    const evidenceDirectory = path.resolve(
      repository,
      value("--evidence-root") || path.dirname(recordFile)
    );
    const result = validateReleaseEvidence(
      record,
      path.resolve(repository, candidate),
      evidenceDirectory
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.decision !== "ready-for-publication-review") process.exitCode = 1;
  } else {
    console.error("Use: release-evidence prepare --candidate dir --output file [--preparer identity] | validate --candidate dir --record file [--evidence-root dir]");
    process.exitCode = 2;
  }
}

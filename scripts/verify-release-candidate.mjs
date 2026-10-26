#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function readRegularFile(file, faults, label, maximum = 64 * 1024 * 1024) {
  let descriptor;
  try {
    descriptor = fs.openSync(
      file,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)
    );
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > maximum) {
      faults.push(`${label} must be a bounded regular file.`);
      return undefined;
    }
    return fs.readFileSync(descriptor);
  } catch {
    faults.push(`${label} cannot be read safely.`);
    return undefined;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function parseJson(content, label, faults) {
  if (!content) return undefined;
  try {
    return JSON.parse(content.toString("utf8"));
  } catch (error) {
    faults.push(`${label} is not valid JSON: ${error.message}`);
    return undefined;
  }
}

function tarString(block, start, length) {
  return block.subarray(start, start + length).toString("utf8").replace(/\0.*$/s, "");
}

function tarNumber(block, start, length) {
  const value = tarString(block, start, length).trim();
  return value ? Number.parseInt(value, 8) : 0;
}

function inspectTar(content, archive, faults) {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= content.length) {
    const header = content.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const expectedChecksum = tarNumber(header, 148, 8);
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const actualChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0);
    if (expectedChecksum !== actualChecksum) {
      faults.push(`${archive} has an invalid tar header checksum.`);
      return entries;
    }
    const name = tarString(header, 0, 100);
    const prefix = tarString(header, 345, 155);
    const relative = prefix ? `${prefix}/${name}` : name;
    const size = tarNumber(header, 124, 12);
    const type = String.fromCharCode(header[156] || 0);
    if (
      !relative ||
      relative.startsWith("/") ||
      relative.split("/").includes("..") ||
      relative.includes("\\")
    ) {
      faults.push(`${archive} has an unsafe path: ${relative || "<empty>"}.`);
    }
    if (type !== "0" && type !== "\0") {
      faults.push(`${archive} contains a non-file entry: ${relative}.`);
    }
    if (
      tarNumber(header, 100, 8) !== 0o644 ||
      tarNumber(header, 108, 8) !== 0 ||
      tarNumber(header, 116, 8) !== 0 ||
      tarNumber(header, 136, 12) !== 0 ||
      tarString(header, 265, 32) !== "rivet" ||
      tarString(header, 297, 32) !== "rivet"
    ) {
      faults.push(`${archive} has non-normalized metadata for ${relative}.`);
    }
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > content.length) {
      faults.push(`${archive} is truncated at ${relative}.`);
      return entries;
    }
    entries.push({
      path: relative,
      content: content.subarray(dataStart, dataEnd)
    });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  if (offset + 1024 > content.length) {
    faults.push(`${archive} does not have two terminating tar blocks.`);
  }
  return entries;
}

export function verifyReleaseCandidate(input, expected = {}) {
  const root = path.resolve(input);
  const faults = [];
  let rootStat;
  try {
    rootStat = fs.lstatSync(root);
  } catch {
    rootStat = undefined;
  }
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) {
    return { schema: 1, kind: "rivet-release-candidate-verification", input: root, decision: "fail", faults: ["Input is not a directory."] };
  }
  const manifest = parseJson(
    readRegularFile(
      path.join(root, "manifest.json"),
      faults,
      "manifest.json"
    ),
    "manifest.json",
    faults
  );
  if (!manifest) {
    return { schema: 1, kind: "rivet-release-candidate-verification", input: root, decision: "fail", faults };
  }
  if (manifest.kind !== "rivet-release-candidate") faults.push("Manifest kind is invalid.");
  if (manifest.decision !== "unsigned-candidate") faults.push("Candidate was not built from a clean source revision.");
  if (expected.version && manifest.version !== expected.version) faults.push("Manifest version does not match --version.");
  if (expected.revision && manifest.revision !== expected.revision) faults.push("Manifest revision does not match --revision.");
  const supportedHosts = ["claude-code", "codex"];
  if (JSON.stringify(manifest.hosts) !== JSON.stringify(supportedHosts)) {
    faults.push("Manifest hosts must be exactly claude-code and codex.");
  }

  const recorded = Array.isArray(manifest.files) ? manifest.files : [];
  const actualFiles = fs.readdirSync(root, { withFileTypes: true });
  if (actualFiles.some((entry) => !entry.isFile())) faults.push("Candidate directory contains a non-file entry.");
  const expectedNames = [
    ...recorded
      .filter((entry) => entry && typeof entry.file === "string")
      .map((entry) => entry.file),
    "manifest.json"
  ].sort();
  const actualNames = actualFiles.map((entry) => entry.name).sort();
  if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) faults.push("Candidate file inventory does not match the manifest.");
  const contents = new Map();
  for (const record of recorded) {
    if (
      !record ||
      typeof record.file !== "string" ||
      path.basename(record.file) !== record.file ||
      !Number.isSafeInteger(record.bytes) ||
      record.bytes < 0 ||
      !/^[a-f0-9]{64}$/.test(record.sha256 || "")
    ) {
      faults.push("Manifest contains an invalid file record.");
      continue;
    }
    const content = readRegularFile(
      path.join(root, record.file),
      faults,
      record.file
    );
    if (!content) continue;
    if (content.length !== record.bytes || sha256(content) !== record.sha256) {
      faults.push(`${record.file} does not match its manifest digest.`);
      continue;
    }
    contents.set(record.file, content);
  }
  const sbom = parseJson(contents.get("bom.cdx.json"), "bom.cdx.json", faults);
  const provenance = parseJson(
    contents.get("provenance.json"),
    "provenance.json",
    faults
  );
  if (!sbom || !provenance) {
    return { schema: 1, kind: "rivet-release-candidate-verification", input: root, decision: "fail", faults };
  }

  const archives = recorded.filter(
    (entry) =>
      entry &&
      typeof entry.file === "string" &&
      /^rivet-.+-[^/]+[.]tar$/.test(entry.file)
  );
  const expectedArchiveNames = supportedHosts
    .map((host) => `rivet-${manifest.version}-${host}.tar`)
    .sort();
  if (
    JSON.stringify(archives.map((archive) => archive.file).sort()) !==
    JSON.stringify(expectedArchiveNames)
  ) {
    faults.push("Manifest must contain exactly the Codex and Claude Code host archives.");
  }
  const archiveDigests = new Map();
  for (const archive of archives) {
    const content = contents.get(archive.file);
    if (!content) continue;
    archiveDigests.set(archive.file, sha256(content));
    const entries = inspectTar(content, archive.file, faults);
    const hostEntry = entries.find((entry) => entry.path === "rivet-host.json");
    if (!hostEntry || !entries.some((entry) => entry.path === "rivet/SKILL.md") ||
        !entries.some((entry) => entry.path === "install.mjs") ||
        !entries.some((entry) => entry.path === "LICENSE") ||
        !entries.some((entry) => entry.path === "NOTICE")) {
      faults.push(`${archive.file} does not contain the required package files.`);
      continue;
    }
    try {
      const host = JSON.parse(hostEntry.content.toString("utf8"));
      if (`rivet-${manifest.version}-${host.host}.tar` !== archive.file) faults.push(`${archive.file} has inconsistent host metadata.`);
      if (host.version !== manifest.version || host.source_revision !== manifest.revision ||
          host.source_state !== (manifest.source_state === "clean" ? "clean" : "dirty")) {
        faults.push(`${archive.file} has inconsistent installation source identity.`);
      }
    } catch (error) {
      faults.push(`${archive.file} has invalid host metadata: ${error.message}`);
    }
  }

  const sumsContent = contents.get("SHA256SUMS");
  if (sumsContent) {
    const sums = sumsContent.toString("utf8").trim().split("\n");
    const parsed = new Map(sums.map((line) => line.split(/  /)));
    if (parsed.size !== archives.length) faults.push("SHA256SUMS must list each host archive once.");
    for (const [file, digest] of archiveDigests) {
      if (parsed.get(digest) !== file) faults.push(`SHA256SUMS does not verify ${file}.`);
    }
  }

  if (
    sbom.bomFormat !== "CycloneDX" ||
    sbom.metadata?.component?.version !== manifest.version ||
    !sbom.metadata?.component?.properties?.some(
      (property) => property.name === "rivet:source-revision" && property.value === manifest.revision
    )
  ) faults.push("SBOM is not bound to the manifest version and revision.");
  const sbomDigests = new Map(
    (sbom.components || []).map((component) => [
      component.name,
      component.hashes?.find((hash) => hash.alg === "SHA-256")?.content
    ])
  );
  for (const [file, digest] of archiveDigests) {
    if (sbomDigests.get(file) !== digest) faults.push(`SBOM does not verify ${file}.`);
  }

  const buildDefinition = provenance.predicate?.buildDefinition;
  const runDetails = provenance.predicate?.runDetails;
  const dependencies = Array.isArray(buildDefinition?.resolvedDependencies)
    ? buildDefinition.resolvedDependencies
    : [];
  const sourceDependency = dependencies.find(
    (dependency) => dependency.uri === "git+https://github.com/joinotto/rivet"
  );
  const internal = buildDefinition?.internalParameters;
  const builderVersions = runDetails?.builder?.version;
  if (
    provenance._type !== "https://in-toto.io/Statement/v1" ||
    provenance.predicateType !== "https://slsa.dev/provenance/v1" ||
    buildDefinition?.buildType !==
      "https://github.com/joinotto/rivet/blob/main/docs/RELEASE-BUILD-TYPE.md#v1" ||
    buildDefinition?.externalParameters?.version !== manifest.version ||
    buildDefinition?.externalParameters?.revision !== manifest.revision ||
    internal?.sourceState !== "clean" ||
    typeof internal?.node !== "string" ||
    typeof internal?.platform !== "string" ||
    typeof internal?.architecture !== "string" ||
    internal?.sourceDateEpoch !== 0 ||
    internal?.archiveFormat !== "ustar" ||
    internal?.normalizedMode !== "0644" ||
    internal?.normalizedOwner !== "rivet" ||
    internal?.normalizedGroup !== "rivet" ||
    dependencies.length !== 1 ||
    sourceDependency?.digest?.gitCommit !== manifest.revision ||
    runDetails?.builder?.id !==
      "https://github.com/joinotto/rivet/blob/main/docs/RELEASE-BUILD-TYPE.md#local-builder" ||
    !/^[a-f0-9]{64}$/.test(
      builderVersions?.["build-release-candidate.mjs"] || ""
    ) ||
    !/^urn:uuid:[a-f0-9-]{36}$/.test(
      runDetails?.metadata?.invocationId || ""
    ) ||
    provenance.predicate?.rivetMetadata?.unsigned !== true
  ) faults.push("Provenance is not bound to the clean manifest source.");
  const subjectList = Array.isArray(provenance.subject)
    ? provenance.subject
    : [];
  const subjects = new Map(
    subjectList.map((subject) => [
      subject?.name,
      subject?.digest?.sha256
    ])
  );
  if (
    subjectList.length !== archiveDigests.size ||
    subjects.size !== archiveDigests.size
  ) {
    faults.push("Provenance subject inventory does not match the archives.");
  }
  for (const [file, digest] of archiveDigests) {
    if (subjects.get(file) !== digest) faults.push(`Provenance does not verify ${file}.`);
  }
  const byproductList = Array.isArray(runDetails?.byproducts)
    ? runDetails.byproducts
    : [];
  const byproducts = new Map(
    byproductList.map((byproduct) => [
      byproduct?.name,
      byproduct?.digest?.sha256
    ])
  );
  const expectedByproducts = new Map([
    ["SHA256SUMS", contents.get("SHA256SUMS")],
    ["bom.cdx.json", contents.get("bom.cdx.json")]
  ]);
  if (
    byproductList.length !== expectedByproducts.size ||
    byproducts.size !== expectedByproducts.size
  ) {
    faults.push("Provenance byproduct inventory is invalid.");
  }
  for (const [name, content] of expectedByproducts) {
    if (!content || byproducts.get(name) !== sha256(content)) {
      faults.push(`Provenance does not verify byproduct ${name}.`);
    }
  }

  return {
    schema: 1,
    kind: "rivet-release-candidate-verification",
    input: root,
    version: manifest.version,
    revision: manifest.revision,
    hosts: supportedHosts,
    archives: archives.length,
    signature: "not-checked",
    decision: faults.length ? "fail" : "pass",
    faults,
    limitations: [
      "This check verifies an unsigned candidate. It does not authenticate a publisher.",
      "A passing result does not authorize publication."
    ]
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const value = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const input = value("--input");
  if (!input) {
    console.error("Use: verify-release-candidate --input directory [--version value] [--revision value]");
    process.exit(2);
  }
  const result = verifyReleaseCandidate(path.resolve(repository, input), {
    version: value("--version"),
    revision: value("--revision")
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.decision !== "pass") process.exitCode = 1;
}

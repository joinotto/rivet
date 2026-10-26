#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const argv = process.argv.slice(2);

function value(flag) {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function run(executable, args, cwd = repository) {
  return spawnSync(executable, args, { cwd, encoding: "utf8" });
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function deterministicUuid(input) {
  const bytes = crypto.createHash("sha256").update(input).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}

function files(root, directory = root, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files(root, absolute, result);
    } else if (entry.isFile()) {
      result.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }
  return result.sort();
}

function octal(value, width) {
  const encoded = value.toString(8).padStart(width - 1, "0");
  if (encoded.length >= width) throw new Error("Tar field is too large.");
  return `${encoded}\0`;
}

function writeText(buffer, offset, length, text) {
  const encoded = Buffer.from(text);
  if (encoded.length > length) throw new Error(`Tar field is too long: ${text}`);
  encoded.copy(buffer, offset);
}

function tarPath(relative) {
  if (Buffer.byteLength(relative) <= 100) {
    return { name: relative, prefix: "" };
  }
  const parts = relative.split("/");
  for (let index = parts.length - 1; index > 0; index -= 1) {
    const prefix = parts.slice(0, index).join("/");
    const name = parts.slice(index).join("/");
    if (Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155) {
      return { name, prefix };
    }
  }
  throw new Error(`Tar path is too long: ${relative}`);
}

function tarArchive(root) {
  const blocks = [];
  for (const relative of files(root)) {
    const content = fs.readFileSync(path.join(root, relative));
    const header = Buffer.alloc(512);
    const split = tarPath(relative);
    writeText(header, 0, 100, split.name);
    writeText(header, 100, 8, octal(0o644, 8));
    writeText(header, 108, 8, octal(0, 8));
    writeText(header, 116, 8, octal(0, 8));
    writeText(header, 124, 12, octal(content.length, 12));
    writeText(header, 136, 12, octal(0, 12));
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    writeText(header, 257, 6, "ustar\0");
    writeText(header, 263, 2, "00");
    writeText(header, 265, 32, "rivet");
    writeText(header, 297, 32, "rivet");
    writeText(header, 345, 155, split.prefix);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeText(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
    blocks.push(header, content);
    const remainder = content.length % 512;
    if (remainder !== 0) blocks.push(Buffer.alloc(512 - remainder));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

const version = value("--version");
const revision = value("--revision");
const output = path.resolve(repository, value("--output") || "dist/release");
const force = argv.includes("--force");
const allowDirty = argv.includes("--allow-dirty");

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || "")) {
  throw new Error("--version must be a semantic version without a v prefix.");
}
if (!/^[0-9a-f]{40}$/.test(revision || "")) {
  throw new Error("--revision must be a full lowercase Git commit identifier.");
}
const packageDocument = JSON.parse(
  fs.readFileSync(path.join(repository, "package.json"), "utf8")
);
if (packageDocument.version !== version) {
  throw new Error(
    `package.json version ${packageDocument.version} does not match ${version}.`
  );
}
const head = run("git", ["rev-parse", "HEAD"]);
if (head.status !== 0 || head.stdout.trim() !== revision) {
  throw new Error("--revision must match the current Git HEAD.");
}
const status = run("git", ["status", "--porcelain"]);
if (status.status !== 0) throw new Error("Cannot inspect the Git worktree.");
if (status.stdout.trim() && !allowDirty) {
  throw new Error("The worktree is dirty. Commit the candidate source first.");
}
if (fs.existsSync(output)) {
  if (!force) throw new Error(`Output already exists: ${output}`);
  fs.rmSync(output, { recursive: true });
}
fs.mkdirSync(output, { recursive: true });

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "rivet-release-"));
try {
  const packages = path.join(temporary, "packages");
  const packaged = run(process.execPath, [
    path.join(repository, "scripts/package-hosts.mjs"),
    "--output",
    packages
  ]);
  if (packaged.status !== 0) {
    throw new Error(packaged.stderr || "Host package generation failed.");
  }

  const artifactRecords = [];
  for (const host of fs.readdirSync(packages).sort()) {
    const archiveName = `rivet-${version}-${host}.tar`;
    const archive = tarArchive(path.join(packages, host));
    fs.writeFileSync(path.join(output, archiveName), archive);
    artifactRecords.push({
      file: archiveName,
      host,
      bytes: archive.length,
      sha256: sha256(archive)
    });
  }

  const sums = artifactRecords
    .map((artifact) => `${artifact.sha256}  ${artifact.file}`)
    .join("\n");
  fs.writeFileSync(path.join(output, "SHA256SUMS"), `${sums}\n`);

  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${deterministicUuid(`${version}:${revision}`)}`,
    version: 1,
    metadata: {
      component: {
        type: "application",
        name: "rivet",
        version,
        properties: [
          { name: "rivet:source-revision", value: revision },
          {
            name: "rivet:source-state",
            value: status.stdout.trim() ? "dirty-allowed" : "clean"
          }
        ]
      }
    },
    components: artifactRecords.map((artifact) => ({
      type: "file",
      name: artifact.file,
      version,
      hashes: [{ alg: "SHA-256", content: artifact.sha256 }],
      properties: [{ name: "rivet:host", value: artifact.host }]
    }))
  };
  fs.writeFileSync(
    path.join(output, "bom.cdx.json"),
    `${JSON.stringify(sbom, null, 2)}\n`
  );

  const builderFile = fileURLToPath(import.meta.url);
  const provenance = {
    schema: 1,
    kind: "rivet-release-candidate-provenance",
    version,
    source: {
      repository: "https://github.com/joinotto/rivet",
      revision,
      state: status.stdout.trim() ? "dirty-allowed" : "clean"
    },
    builder: {
      script: "scripts/build-release-candidate.mjs",
      script_sha256: sha256(fs.readFileSync(builderFile)),
      node: process.version,
      platform: process.platform,
      architecture: process.arch
    },
    parameters: {
      source_date_epoch: 0,
      archive_format: "ustar",
      normalized_mode: "0644",
      normalized_owner: "rivet",
      normalized_group: "rivet"
    },
    subjects: artifactRecords.map((artifact) => ({
      name: artifact.file,
      digest: { sha256: artifact.sha256 }
    })),
    limitations: [
      "This provenance is an unsigned Rivet record, not a SLSA attestation.",
      "A reproducible archive does not prove that its source or builder is trusted.",
      "Release publication requires signatures, reviewer approval, and retained CI evidence."
    ]
  };
  fs.writeFileSync(
    path.join(output, "provenance.json"),
    `${JSON.stringify(provenance, null, 2)}\n`
  );

  const manifestFiles = files(output).map((relative) => {
    const content = fs.readFileSync(path.join(output, relative));
    return { file: relative, bytes: content.length, sha256: sha256(content) };
  });
  const manifest = {
    schema: 1,
    kind: "rivet-release-candidate",
    version,
    revision,
    source_state: status.stdout.trim() ? "dirty-allowed" : "clean",
    files: manifestFiles,
    decision: status.stdout.trim() ? "test-candidate" : "unsigned-candidate",
    limitations: [
      "This bundle is not published or signed.",
      "This bundle is not an official Rivet release."
    ]
  };
  fs.writeFileSync(
    path.join(output, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  console.log(JSON.stringify(manifest, null, 2));
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
